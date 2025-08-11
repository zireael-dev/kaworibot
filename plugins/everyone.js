/**
 * plugins/group.everyone.js
 * Mention/tag semua anggota di dalam grup.
 *
 * Commands:
 * /everyone [pesan] -> Me-mention semua anggota dengan pesan opsional.
 *
 * Note:
 * - Perintah hanya bisa digunakan oleh admin grup.
 */

const b = (t) => `*${t}*`;

module.exports = async (sock, m, text, from) => {
    const raw = (text || '').trim();
    const lower = raw.toLowerCase();

    // Jika pesan tidak diawali dengan /everyone, hentikan.
    if (!lower.startsWith('/everyone')) return;

    // 1. Pastikan perintah dijalankan di dalam grup.
    if (!from.endsWith('@g.us')) {
        return sock.sendMessage(from, { text: "❌ Perintah ini hanya bisa digunakan di dalam grup." }, { quoted: m });
    }

    try {
        // 2. Ambil data grup dan periksa status admin pengirim.
        const groupMeta = await sock.groupMetadata(from);
        const participants = groupMeta.participants;
        const senderJid = m.key.participant || m.sender;
        
        const senderParticipant = participants.find(p => p.id === senderJid);
        const isSenderAdmin = senderParticipant?.admin === 'admin' || senderParticipant?.admin === 'superadmin';

        if (!isSenderAdmin) {
            return sock.sendMessage(from, { text: "❌ Hanya admin yang bisa menggunakan perintah ini." }, { quoted: m });
        }

        // 3. Siapkan pesan dan daftar mention.
        // Ambil teks setelah perintah /everyone sebagai pesan.
        const messageText = raw.slice(9).trim();
        
        // Buat teks pesan tanpa daftar mention yang terlihat.
        let hidetagText = `📢 ${b('Panggilan untuk semua!')}`;
        if (messageText) {
            hidetagText += `\n\nPesan: ${messageText}`;
        }

        const allParticipantJids = participants.map(p => p.id);
        
        // 4. Kirim pesan dengan teks singkat, tapi mention semua anggota secara "tersembunyi".
        // Properti 'mentions' inilah yang membuat notifikasi tetap masuk.
        await sock.sendMessage(from, {
            text: hidetagText,
            mentions: allParticipantJids
        }, { quoted: m });

    } catch (e) {
        console.error("Everyone command error:", e);
        await sock.sendMessage(from, { text: "❌ Terjadi kesalahan saat mencoba me-mention semua anggota." }, { quoted: m });
    }
};
