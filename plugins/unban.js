/**
 * plugins/unban.js
 * Owner & Co-Owner command: Melepas ban user sehingga bisa kembali menggunakan bot.
 *
 * Usage:
 *   • Reply chat lalu ketik: /unban
 *   • Atau mention user:   /unban @62812xxx
 */

const fs   = require('fs');
const path = require('path');

module.exports = async (sock, m, text, from) => {
    const cmd = (text||'').trim();
    if (!cmd.toLowerCase().startsWith('/unban')) return;

    // — Load config.json untuk cek owner/co-owner —
    let cfg = {};
    try {
        cfg = JSON.parse(
            fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8')
        );
    } catch {}
    const sender = m.key.participant || m.key.remoteJid;
    const isOwner   = Array.isArray(cfg.owner)   && cfg.owner.includes(sender);
    const isCoOwner = Array.isArray(cfg.coowner) && cfg.coowner.includes(sender);
    if (!isOwner && !isCoOwner) {
        return sock.sendMessage(from, { text: '❌ Hanya owner atau co-owner yang dapat menjalankan perintah ini.' });
    }

    // — Tentukan target JID yang akan di-unban —
    let target;
    const ctx = m.message.extendedTextMessage?.contextInfo;
    // 1) mention
    if (ctx?.mentionedJid?.length) {
        target = ctx.mentionedJid[0];
    }
    // 2) reply message
    else if (ctx?.quotedMessage) {
        target = ctx.participant;
    }
    // 3) lewat argumen teks
    else {
        const parts = cmd.split(' ').slice(1);
        if (!parts.length) {
            return sock.sendMessage(from, { text: '❌ Tag atau masukkan nomor user yang akan di-unban.' });
        }
        let id = parts[0];
        if (!id.includes('@')) id = id + '@s.whatsapp.net';
        target = id;
    }

    // — Pastikan global.db.bannedUsers ter-setup —
    if (!global.db) global.db = {};
    if (!Array.isArray(global.db.bannedUsers)) {
        global.db.bannedUsers = [];
    }

    // — Cek apakah user memang sedang dibanned —
    const idx = global.db.bannedUsers.indexOf(target);
    if (idx === -1) {
        return sock.sendMessage(from, {
            text: `⚠️ @${target.split('@')[0]} belum di-ban sebelumnya.`,
                                mentions: [target]
        });
    }

    // — Hapus dari daftar bannedUsers —
    global.db.bannedUsers.splice(idx, 1);

    // (Opsional) Simpan ke file JSON agar persist
    // fs.writeFileSync(
    //   path.join(__dirname, '..', 'banned.json'),
    //   JSON.stringify(global.db.bannedUsers, null, 2)
    // );

    await sock.sendMessage(from, {
        text: `✅ Berhasil *unban* @${target.split('@')[0]}`,
                           mentions: [target]
    });
};
