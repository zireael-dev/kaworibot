/**
 * plugins/group.antidelete.js
 * Mencegah pesan yang dihapus agar tidak hilang di grup.
 *
 * Commands:
 * /antidelete on      -> Mengaktifkan fitur (hanya admin)
 * /antidelete off     -> Menonaktifkan fitur (hanya admin)
 *
 * Note:
 * - Dilengkapi dengan pembersihan memori otomatis setiap menit
 * untuk menjaga RAM tetap ringan.
 */

const b = (t) => `*${t}*`;

// --- KONFIGURASI ---
const MESSAGE_EXPIRY_MS = 10 * 60 * 1000; // Pesan akan dihapus dari memori setelah 10 menit
const CLEANUP_INTERVAL_MS = 60 * 1000;   // Cek dan bersihkan memori setiap 1 menit
// --- ---

let isCleanupRunning = false;

// Fungsi untuk memastikan database siap digunakan
function ensureDB() {
    global.db = global.db || {};
    global.db.groupsetting = global.db.groupsetting || {};
    global.db.antidelete_store = global.db.antidelete_store || {};

    // Jalankan pembersihan otomatis hanya sekali saat bot pertama kali dimulai
    if (!isCleanupRunning) {
        setInterval(() => {
            const now = Date.now();
            const store = global.db.antidelete_store;
            let cleanedCount = 0;

            for (const msgId in store) {
                if (now - store[msgId].timestamp > MESSAGE_EXPIRY_MS) {
                    delete store[msgId];
                    cleanedCount++;
                }
            }
            // Uncomment baris di bawah ini jika Anda ingin melihat log pembersihan di konsol
            // if (cleanedCount > 0) console.log(`Anti-Delete: Membersihkan ${cleanedCount} pesan lama dari memori.`);

        }, CLEANUP_INTERVAL_MS);
        
        isCleanupRunning = true;
        console.log('✅ Anti-Delete: Pembersihan memori otomatis telah aktif.');
    }
}

module.exports = async (sock, m, text, from) => {
    ensureDB();
    const raw = (text || '').trim();
    const lower = raw.toLowerCase();

    // --- LOGIKA UTAMA: MENYIMPAN & MENANGKAP PESAN ---
    const isRevokeMsg = m.message?.protocolMessage?.type === 'REVOKE';

    if (isRevokeMsg) {
        const isEnabled = global.db.groupsetting[from]?.antidelete ?? true;
        if (!isEnabled) return;

        const deletedMsgId = m.message.protocolMessage.key.id;
        const storedData = global.db.antidelete_store[deletedMsgId];
        if (!storedData) return;

        const originalMsg = storedData.msg;
        const senderJid = originalMsg.key.participant || originalMsg.key.remoteJid;
        const senderName = `@${senderJid.split('@')[0]}`;
        const caption = `💬 Pesan dihapus terdeteksi!\nPengirim: ${senderName}`;

        await sock.sendMessage(from, { text: caption, mentions: [senderJid] }, { quoted: m });
        await sock.sendMessage(from, { forward: originalMsg }, { quoted: m });
        
        delete global.db.antidelete_store[deletedMsgId];

    } else {
        // Simpan pesan beserta timestamp-nya
        global.db.antidelete_store[m.key.id] = {
            msg: m,
            timestamp: Date.now()
        };
    }

    // --- LOGIKA PERINTAH: ON/OFF ---
    if (lower.startsWith('/antidelete')) {
        if (!from.endsWith('@g.us')) {
            return sock.sendMessage(from, { text: "Perintah ini hanya bisa digunakan di dalam grup." }, { quoted: m });
        }

        try {
            const groupMeta = await sock.groupMetadata(from);
            const sender = m.key.participant || m.sender;
            const participant = groupMeta.participants.find(p => p.id === sender);

            if (!participant || (participant.admin !== 'admin' && participant.admin !== 'superadmin')) {
                return sock.sendMessage(from, { text: "❌ Hanya admin yang bisa menggunakan perintah ini." }, { quoted: m });
            }
        } catch (e) {
            console.error("Gagal mendapatkan metadata grup:", e);
            return sock.sendMessage(from, { text: "Gagal memverifikasi status admin." }, { quoted: m });
        }
        
        const arg = lower.split(' ')[1];

        if (arg === 'on') {
            if (!global.db.groupsetting[from]) global.db.groupsetting[from] = {};
            global.db.groupsetting[from].antidelete = true;
            return sock.sendMessage(from, { text: "✅ Fitur Anti-Delete telah diaktifkan." }, { quoted: m });
        } else if (arg === 'off') {
            if (!global.db.groupsetting[from]) global.db.groupsetting[from] = {};
            global.db.groupsetting[from].antidelete = false;
            return sock.sendMessage(from, { text: "✅ Fitur Anti-Delete telah dinonaktifkan." }, { quoted: m });
        } else {
            const currentStatus = global.db.groupsetting[from]?.antidelete ?? true ? 'Aktif' : 'Nonaktif';
            const helpText = [
                b('Pengaturan Anti-Delete'),
                `Status saat ini: ${currentStatus}`,
                "",
                "Gunakan:",
                "• `/antidelete on` - untuk mengaktifkan",
                "• `/antidelete off` - untuk menonaktifkan"
            ].join('\n');
            return sock.sendMessage(from, { text: helpText }, { quoted: m });
        }
    }
};
