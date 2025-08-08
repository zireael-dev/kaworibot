// plugins/update.js
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

module.exports = async (sock, m, text, from, watermark) => {
    const cmd = text.trim().toLowerCase();
    // Pastikan hanya OWNER yang bisa
    let config = {};
    try {
        config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
    } catch {}
    const isOwner = config.owner && config.owner.includes(m.key.participant || m.key.remoteJid);
    if (!cmd.startsWith('/update') || !isOwner) return;

    await sock.sendMessage(from, { text: '🔄 Checking for updates, please wait...' });

    exec('git pull', (err, stdout, stderr) => {
        if (err) {
            return sock.sendMessage(from, { text: `❌ Error:\n${stderr || err.message}` });
        }
        if (/Already up.to.date|Sudah up.to.date/i.test(stdout)) {
            sock.sendMessage(from, { text: `✅ KaworiBot sudah versi terbaru!\n\n${stdout.trim()}` });
        } else {
            sock.sendMessage(from, { text: `🎉 Update berhasil! Bot akan restart otomatis...\n\n${stdout.trim()}` })
                .then(() => {
                    // === Flag agar bot bisa PM owner setelah restart ===
                    fs.writeFileSync(path.join(__dirname, '..', 'just_restarted.txt'), Date.now().toString());
                    // Restart proses (agar fresh), support PM2/forever
                    setTimeout(() => {
                        process.exit(0);
                    }, 1500);
                });
        }
    });
};
