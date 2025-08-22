/**
 * plugins/info.premium.js
 * Sistem semi-otomatis untuk donasi dan aktivasi premium.
 *
 * Commands:
 * /premium -> Menampilkan status & info donasi.
 * /bukti   -> (Caption pada gambar) Mengirim bukti transfer ke owner.
 *
 * Note:
 * - Anda WAJIB memiliki file 'qris.jpg' di dalam folder 'media'.
 * - Anda WAJIB mengisi nomor owner di 'config.json'.
 */

const fs = require('fs');
const path = require('path');

const b = (t) => `*${t}*`;
const i = (t) => `_${t}_`;
const LINE = '────────────────────';

// Fungsi untuk memastikan database siap digunakan
function ensureDB() {
    global.db = global.db || {};
    global.db.premium_users = global.db.premium_users || {};
}

module.exports = async (sock, m, text, from) => {
    ensureDB();
    const raw = (text || '').trim();
    const lower = raw.toLowerCase();
    // FIX: Menggunakan m.key.remoteJid sebagai fallback untuk chat pribadi
    const senderJid = m.key.participant || m.key.remoteJid;
    const userName = m.pushName || senderJid.split('@')[0];

    // --- LOGIKA UTAMA: PERINTAH /PREMIUM ---
    if (lower === '/premium') {
        const premiumData = global.db.premium_users[senderJid];
        const now = Date.now();

        // Cek jika pengguna sudah premium dan masih aktif
        if (premiumData && premiumData.expiry > now) {
            const expiryDate = new Date(premiumData.expiry).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
            const remainingDays = Math.ceil((premiumData.expiry - now) / (1000 * 60 * 60 * 24));

            const statusMessage = [
                `👑 ${b('Status Premium Kamu')} 👑`,
                LINE,
                `✅ Kamu adalah pengguna premium!`,
                `Masa aktif berakhir pada: ${expiryDate}`,
                `Sisa waktu: ${remainingDays} hari lagi.`,
                LINE,
                `Terima kasih telah mendukung bot ini! 🙏`
            ].join('\n');
            return sock.sendMessage(from, { text: statusMessage }, { quoted: m });
        }

        // Jika belum premium atau sudah kedaluwarsa
        const qrisPath = path.join(__dirname, '..', 'media', 'qris.jpg');
        if (!fs.existsSync(qrisPath)) {
            console.error("File qris.jpg tidak ditemukan di folder media.");
            return sock.sendMessage(from, { text: "❌ Maaf, QRIS untuk donasi belum tersedia saat ini." }, { quoted: m });
        }

        const donationMessage = [
            `✨ ${b('Dukung & Jadi Pengguna Premium')} ✨`,
            LINE,
            "Dengan menjadi pengguna premium, kamu mendapatkan akses ke fitur-fitur eksklusif dan membantu bot ini tetap online.",
            "",
            b("Paket Tersedia:"),
            "1️⃣ *15,000 IDR* - 1 Bulan",
            "2️⃣ *25,000 IDR* - 2 Bulan",
            "3️⃣ *40,000 IDR* - 3 Bulan",
            LINE,
            b("Cara Pembayaran:"),
            "1. Scan QRIS di bawah ini menggunakan GoPay/OVO/Dana/ShopeePay/m-Banking.",
            "2. Lakukan pembayaran sesuai paket yang kamu pilih.",
            `3. Kirim *screenshot bukti transfer* dengan caption */bukti* untuk konfirmasi.`,
            "",
            i("Aktivasi akan diproses oleh owner setelah verifikasi.")
        ].join('\n');

        // Kirim gambar QRIS beserta pesan donasi
        return sock.sendMessage(from, {
            image: fs.readFileSync(qrisPath),
                                caption: donationMessage
        }, { quoted: m });
    }

    // --- LOGIKA KEDUA: MENANGANI BUKTI TRANSFER ---
    const isUpload = m.message?.imageMessage;
    const caption = (m.message?.imageMessage?.caption || '').trim().toLowerCase();

    if (isUpload && caption === '/bukti') {
        // Baca config untuk mendapatkan nomor owner
        let ownerJid;
        try {
            const configPath = path.join(__dirname, '..', 'config.json');
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            let ownerNumber = config.owner[0]; // Ambil owner pertama dari daftar

            // Memastikan nomor owner dalam format JID yang benar
            if (ownerNumber && !ownerNumber.endsWith('@s.whatsapp.net')) {
                ownerNumber = ownerNumber.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
            }
            ownerJid = ownerNumber;

        } catch (e) {
            console.error("Gagal membaca config.json atau owner tidak ditemukan:", e);
            return sock.sendMessage(from, { text: "❌ Gagal meneruskan bukti, owner tidak dikonfigurasi." }, { quoted: m });
        }

        if (!ownerJid) {
            return sock.sendMessage(from, { text: "❌ Gagal meneruskan bukti, owner tidak dikonfigurasi." }, { quoted: m });
        }

        // Siapkan pesan untuk di-forward ke owner
        const userNumber = senderJid.split('@')[0];
        const forwardCaption = `🔔 *Konfirmasi Premium Baru* 🔔\n\nDari: ${userName}\nNomor: ${userNumber}\n\nMohon segera diverifikasi dan diaktifkan dengan perintah:\n/addprem ${userNumber} 30d`;

        // Forward pesan gambar (bukti) ke owner
        await sock.sendMessage(ownerJid, { forward: m }, {});
        // Kirim pesan teks tambahan ke owner dengan info pengguna
        await sock.sendMessage(ownerJid, { text: forwardCaption });

        // Kirim konfirmasi ke pengguna
        return sock.sendMessage(from, { text: "✅ Bukti transfer berhasil diteruskan ke owner. Mohon tunggu konfirmasi aktivasi ya!" }, { quoted: m });
    }
};
