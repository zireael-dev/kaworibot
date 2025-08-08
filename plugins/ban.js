/**
 * plugins/ban.js
 * Owner & Co-Owner command: Banned user dari penggunaan bot.
 *
 * Usage:
 *   • Reply chat lalu ketik: /ban
 *   • Atau mention user:   /ban @62812xxx
 *
 * Hanya owner/co-owner yang bisa menjalankan.
 */

const fs   = require('fs');
const path = require('path');

module.exports = async (sock, m, text, from) => {
    const cmd = (text||'').trim();
    if (!cmd.toLowerCase().startsWith('/ban')) return;

    // --- load config.json utk cek owner/co-owner ---
    let cfg = {};
    try {
        cfg = JSON.parse(
            fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8')
        );
    } catch {}
    const sender = m.key.participant || m.key.remoteJid; // JID pengirim
    const isOwner   = Array.isArray(cfg.owner)   && cfg.owner.includes(sender);
    const isCoOwner = Array.isArray(cfg.coowner) && cfg.coowner.includes(sender);

    if (!isOwner && !isCoOwner) {
        return sock.sendMessage(from, { text: '❌ Hanya owner atau co-owner yang bisa menggunakan perintah ini.' });
    }

    // --- tentukan target JID ---
    let target;
    const ctx = m.message.extendedTextMessage?.contextInfo;
    // 1) jika ada mention
    if (ctx?.mentionedJid?.length) {
        target = ctx.mentionedJid[0];
    }
    // 2) jika reply ke message
    else if (ctx?.quotedMessage) {
        target = ctx.participant;
    }
    // 3) jika disertai nomor di text
    else {
        const parts = cmd.split(' ').slice(1);
        if (!parts.length) {
            return sock.sendMessage(from, { text: '❌ Tag atau masukkan nomor user yang akan di-ban.' });
        }
        let id = parts[0];
        if (!id.includes('@')) id = id + '@s.whatsapp.net';
        target = id;
    }

    // --- init banned list di memory ---
    if (!global.db) global.db = {};
    if (!Array.isArray(global.db.bannedUsers)) {
        global.db.bannedUsers = [];
    }

    if (global.db.bannedUsers.includes(target)) {
        return sock.sendMessage(from, { text: '⚠️ User tersebut sudah dibanned sebelumnya.' });
    }

    // --- tambahkan ke bannedUsers ---
    global.db.bannedUsers.push(target);

    // (Optional) kalau mau simpan ke file JSON:
    // fs.writeFileSync(
    //   path.join(__dirname, '..', 'banned.json'),
    //   JSON.stringify(global.db.bannedUsers, null, 2)
    // );

    await sock.sendMessage(from, {
        text: `✅ Berhasil *ban* @${target.split('@')[0]}`,
                           mentions: [target]
    });
};
