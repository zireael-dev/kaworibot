const fs = require('fs');
const path = require('path');

module.exports = async (sock, m, text, from) => {
    if ((text || '').trim().toLowerCase() !== '/owner') return;

    let cfg = {};
    try {
        cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
    } catch {}
    const ownerJid = (cfg.owner && cfg.owner[0]) || '';
    const ownerNum = ownerJid.replace(/@.*$/, '');
    const ownerName = 'Yusril Falah'; // Bisa diganti/otomatis dari config kalau mau
    const botName = cfg.botName || 'KaworiBot';

    const lines = [
        '┏━━━〔 *OWNER BOT* 〕━━━┓',
        `┃ Nama  : *${ownerName}*`,
        `┃ Nomor : wa.me/${ownerNum}`,
        '┃',
        `┃ Silakan klik link di atas untuk langsung chat owner di WhatsApp atau simpan secara manual.`,
        '┗━━━━━━━━━━━━━━━━━━━━━┛',
        '',
        `Salam dari *${botName}*!`
    ];

    await sock.sendMessage(from, { text: lines.join('\n') }, { quoted: m });
};
