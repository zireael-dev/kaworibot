/**
 * plugins/bcgc.js
 * Owner/Co-Owner command: Broadcast pesan ke semua group chat.
 *
 * Usage:
 *   /bcgc <pesan broadcast>
 *
 * Harus dijalankan oleh owner atau co-owner.
 */

const fs   = require('fs');
const path = require('path');

module.exports = async (sock, m, text, from) => {
    const cmd = (text||'').trim();
    if (!cmd.toLowerCase().startsWith('/bcgc ')) return;

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
    const message = cmd.slice(6).trim();
    if (!message) {
        return sock.sendMessage(from, {
            text: '❌ Format salah. Contoh: /bcgc Halo group!'
        });
    }

    // — Pastikan ada list groups di global.db.groups —
    global.db.groups = Array.isArray(global.db.groups) ? global.db.groups : [];
    const targets = [...new Set(global.db.groups)];

    if (targets.length === 0) {
        return sock.sendMessage(from, {
            text: '⚠️ Tidak ada group tersimpan untuk di-broadcast.'
        });
    }

    let success = 0;
    for (const jid of targets) {
        try {
            await sock.sendMessage(jid, { text: message });
            success++;
            // opsional: await new Promise(r => setTimeout(r, 200));
        } catch {}
    }

    await sock.sendMessage(from, {
        text: `✅ Broadcast selesai!\nTerkirim ke ${success} dari ${targets.length} group.`
    });
};
