/**
 * plugins/group.actions.js
 * Perintah administrasi grup untuk promote, demote, dan kick.
 * Dibuat dari nol untuk kejelasan dan stabilitas.
 *
 * Commands:
 * /promote <@user> -> Menjadikan anggota sebagai admin.
 * /demote <@user>  -> Menurunkan admin menjadi anggota biasa.
 * /kick <@user>    -> Mengeluarkan anggota dari grup.
 */

module.exports = async (sock, m, text, from) => {
    const raw = (text || '').trim();
    const lower = raw.toLowerCase();

    // Daftar perintah yang akan ditangani oleh plugin ini
    const commands = ['/promote', '/demote', '/kick'];
    const command = commands.find(cmd => lower.startsWith(cmd));

    // Jika pesan bukan salah satu dari perintah di atas, hentikan eksekusi.
    if (!command) return;

    // --- Langkah 1: Validasi Lingkungan ---
    if (!from.endsWith('@g.us')) {
        return sock.sendMessage(from, { text: "❌ Perintah ini hanya bisa digunakan di dalam grup." }, { quoted: m });
    }

    try {
        // --- Langkah 2: Pengambilan Data & Pemeriksaan Izin Pengguna ---
        const groupMeta = await sock.groupMetadata(from);
        const participants = groupMeta.participants;

        const senderJid = m.key.participant || m.sender;
        const senderParticipant = participants.find(p => p.id === senderJid);
        const isSenderAdmin = senderParticipant?.admin === 'admin' || senderParticipant?.admin === 'superadmin';

        if (!isSenderAdmin) {
            return sock.sendMessage(from, { text: "❌ Hanya admin yang bisa menggunakan perintah ini." }, { quoted: m });
        }

        // --- Langkah 3: Penentuan Target ---
        const targetJid = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || m.message?.extendedTextMessage?.contextInfo?.participant;

        if (!targetJid) {
            return sock.sendMessage(from, { text: `❌ Anda harus me-mention atau me-reply pesan seseorang.\n\nContoh:\n${command} @namauser` }, { quoted: m });
        }

        const targetUser = participants.find(p => p.id === targetJid);
        if (!targetUser) {
            return sock.sendMessage(from, { text: `❌ Pengguna tersebut tidak ada di dalam grup ini.` }, { quoted: m });
        }

        // --- Langkah 4: Eksekusi Perintah ---
        const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const targetUsername = `@${targetJid.split('@')[0]}`;

        switch (command) {
            case '/promote':
                if (targetUser.admin) return sock.sendMessage(from, { text: `${targetUsername} sudah menjadi admin.` }, { quoted: m });
                await sock.groupParticipantsUpdate(from, [targetJid], 'promote');
                await sock.sendMessage(from, { text: `✅ ${targetUsername} telah dijadikan admin.`, mentions: [targetJid] }, { quoted: m });
                break;

            case '/demote':
                if (!targetUser.admin) return sock.sendMessage(from, { text: `${targetUsername} bukan seorang admin.` }, { quoted: m });
                await sock.groupParticipantsUpdate(from, [targetJid], 'demote');
                await sock.sendMessage(from, { text: `✅ ${targetUsername} telah diturunkan menjadi anggota biasa.`, mentions: [targetJid] }, { quoted: m });
                break;

            case '/kick':
                if (targetJid === botJid) return sock.sendMessage(from, { text: "🤖 Tidak bisa mengeluarkan diri sendiri." }, { quoted: m });
                if (targetUser.admin) return sock.sendMessage(from, { text: `❌ Tidak bisa mengeluarkan sesama admin.` }, { quoted: m });

                await sock.groupParticipantsUpdate(from, [targetJid], 'remove');
                await sock.sendMessage(from, { text: `✅ ${targetUsername} telah dikeluarkan dari grup.`, mentions: [targetJid] }, { quoted: m });
                break;
        }

    } catch (e) {
        console.error("Group actions error:", e.message);
        // Jika error disebabkan karena bot bukan admin, kirim pesan yang sesuai.
        if (e.message.includes('not-a-group-admin') || e.message.includes('403')) {
            await sock.sendMessage(from, { text: "❌ Gagal. Pastikan bot adalah admin di grup ini." }, { quoted: m });
        } else {
            await sock.sendMessage(from, { text: "❌ Terjadi kesalahan saat menjalankan perintah." }, { quoted: m });
        }
    }
};
