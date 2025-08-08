const fs = require('fs');
const path = require('path');

module.exports = async (sock, m, text, from) => {
    const cmd = (text || '').trim().toLowerCase();
    if (cmd !== '/restart') return;

    // Ambil owner dari config
    let config = {};
    try {
        config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
    } catch {}
    const sender = m.key.participant || m.key.remoteJid || '';
    const isOwner = (config.owner || []).some(owner =>
    sender.replace(/[^0-9]/g, '') === owner.replace(/[^0-9]/g, '')
    );
    if (!isOwner) {
        await sock.sendMessage(from, { text: '❌ Hanya owner utama yang bisa me-restart bot.' }, { quoted: m });
        return;
    }

    // Buat file flag restart (biar nanti index.js tahu harus auto-pm owner)
    try {
        fs.writeFileSync(path.join(__dirname, '..', 'just_restarted.txt'), String(Date.now()));
    } catch {}

    await sock.sendMessage(from, { text: '🔄 Restarting bot... (tunggu 2-5 detik, aku hidup lagi!)' }, { quoted: m });

    setTimeout(() => process.exit(0), 1500);
};
