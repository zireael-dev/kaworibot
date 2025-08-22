/**
 * plugins/owner.addprem.js
 * Menambahkan status premium kepada pengguna.
 *
 * Commands:
 * /addprem <target> <durasi> -> Menambahkan masa aktif premium.
 *
 * Note:
 * - Perintah ini hanya untuk owner.
 * - Target bisa @mention, reply, atau nomor telepon.
 * - Durasi dalam format hari (contoh: 30d, 7d, 1d).
 */

const fs = require('fs');
const path = require('path');

const b = (t) => `*${t}*`;
const i = (t) => `_${t}_`;
const LINE = '────────────────────';

/**
 * Memeriksa apakah pengguna adalah owner.
 * @param {string} senderJid JID pengguna.
 * @returns {boolean} True jika owner, false jika bukan.
 */
function isOwner(senderJid) {
    try {
        const configPath = path.join(__dirname, '..', 'config.json');
        if (!fs.existsSync(configPath)) return false;
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const senderNumber = senderJid.split('@')[0];
        return Array.isArray(config.owner) && config.owner.some(owner => owner.includes(senderNumber));
    } catch (e) {
        console.error("Gagal membaca config.json:", e);
        return false;
    }
}

// Fungsi untuk memastikan database siap digunakan
function ensureDB() {
    global.db = global.db || {};
    global.db.premium_users = global.db.premium_users || {};
}

module.exports = async (sock, m, text, from) => {
    ensureDB();
    const raw = (text || '').trim();
    const lower = raw.toLowerCase();
    const senderJid = m.key.participant || m.key.remoteJid;

    if (!lower.startsWith('/addprem')) return;

    // 1. Verifikasi Owner
    if (!isOwner(senderJid)) {
        return sock.sendMessage(from, { text: "❌ Perintah ini hanya untuk owner." }, { quoted: m });
    }

    // 2. Parsing Argumen
    const args = raw.slice(9).trim().split(' ');
    if (args.length < 1) {
        return sock.sendMessage(from, { text: `❌ Format salah.\nContoh:\n/addprem @user 30d\n/addprem 628... 7d` }, { quoted: m });
    }

    let targetJid;
    let durationStr;

    // Cek apakah target dari mention atau reply
    const mentionedJid = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const repliedJid = m.message?.extendedTextMessage?.contextInfo?.participant;

    if (mentionedJid) {
        targetJid = mentionedJid;
        durationStr = args[1] || '30d'; // Default 30 hari jika durasi tidak disebut
    } else if (repliedJid && args.length === 1) {
        targetJid = repliedJid;
        durationStr = args[0];
    } else {
        // Jika tidak, asumsikan argumen pertama adalah nomor telepon
        let targetNumber = args[0].replace(/[^0-9]/g, '');
        if (!targetNumber.startsWith('62')) {
            targetNumber = '62' + targetNumber.substring(1);
        }
        targetJid = `${targetNumber}@s.whatsapp.net`;
        durationStr = args[1] || '30d';
    }

    // 3. Parsing Durasi
    const durationMatch = durationStr.match(/^(\d+)(d|h|m)$/); // d=hari, h=jam, m=menit
    if (!durationMatch) {
        return sock.sendMessage(from, { text: "❌ Format durasi salah. Gunakan 'd' untuk hari (contoh: 30d)." }, { quoted: m });
    }

    const value = parseInt(durationMatch[1]);
    const unit = durationMatch[2];
    let durationMs;

    if (unit === 'd') {
        durationMs = value * 24 * 60 * 60 * 1000; // Hari ke milidetik
    } else if (unit === 'h') {
        durationMs = value * 60 * 60 * 1000; // Jam ke milidetik
    } else {
        durationMs = value * 60 * 1000; // Menit ke milidetik
    }

    // 4. Update Database
    const now = Date.now();
    const currentExpiry = global.db.premium_users[targetJid]?.expiry || now;
    const newExpiry = (currentExpiry > now ? currentExpiry : now) + durationMs;

    global.db.premium_users[targetJid] = { expiry: newExpiry };

    // 5. Kirim Konfirmasi
    const expiryDate = new Date(newExpiry).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    const targetUsername = `@${targetJid.split('@')[0]}`;

    // Konfirmasi untuk owner
    await sock.sendMessage(from, { text: `✅ Berhasil! Premium untuk ${targetUsername} telah diaktifkan hingga ${expiryDate}.`, mentions: [targetJid] }, { quoted: m });

    // Notifikasi untuk pengguna
    const userMessage = [
        `🎉 ${b('Aktivasi Premium Berhasil!')} 🎉`,
        LINE,
        `Selamat! Akunmu telah diaktifkan sebagai pengguna premium.`,
        `Masa aktif berlaku hingga: ${b(expiryDate)}`,
        LINE,
        `Terima kasih telah mendukung kami! 🙏`
    ].join('\n');

    await sock.sendMessage(targetJid, { text: userMessage });
};
