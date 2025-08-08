/**
 * plugins/bc.js
 * Owner/Co-Owner command: Broadcast pesan ke semua user.
 *
 * Usage:
 *   /bc <pesan broadcast>
 *
 * Harus dijalankan oleh owner atau co-owner.
 */

const fs   = require('fs');
const path = require('path');

module.exports = async (sock, m, text, from) => {
    const cmd = (text||'').trim();
    if (!cmd.toLowerCase().startsWith('/bc ')) return;

    // — Load config untuk cek permission —
    let cfg = {};
    try {
        cfg = JSON.parse(
            fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8')
        );
    } catch {}
    const sender   = m.key.participant || m.key.remoteJid;
    const isOwner   = Array.isArray(cfg.owner)   && cfg.owner.includes(sender);
    const isCoOwner = Array.isArray(cfg.coowner) && cfg.coowner.includes(sender);
    if (!isOwner && !isCoOwner) {
        return sock.sendMessage(from, {
            text: '❌ Hanya owner atau co-owner yang dapat menggunakan perintah ini.'
        });
    }

    // — Ambil teks broadcast —
    const message = cmd.slice(4).trim();
    if (!message) {
        return sock.sendMessage(from, {
            text: '❌ Format salah. Contoh: /bc Hallo semuanya!'
        });
    }

    // — Pastikan ada list users di global.db.users —
    global.db.users = Array.isArray(global.db.users) ? global.db.users : [];
    const targets = [...new Set(global.db.users)]; // unique

    if (targets.length === 0) {
        return sock.sendMessage(from, {
            text: '⚠️ Tidak ada user tersimpan untuk di-broadcast.'
        });
    }

    // — Kirim satu per satu dengan delay ringan supaya gak spam terlalu cepat —
    let success = 0;
    for (const jid of targets) {
        try {
            await sock.sendMessage(jid, { text: message });
            success++;
            // opsional: await new Promise(r => setTimeout(r, 200));
        } catch {}
    }

    await sock.sendMessage(from, {
        text: `✅ Broadcast selesai!\nTerkirim ke ${success} dari ${targets.length} user.`
    });
};
