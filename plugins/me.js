/**
 * plugins/userinfo.js
 * Cek profil user dengan data dinamis dari database.
 * Trigger: /userinfo, /me
 */
const fs = 'fs';
const path = 'path';

// Helper untuk memastikan database siap
function ensureDB() {
    global.db = global.db || {};
    global.db.usage_limit = global.db.usage_limit || {};
    global.db.premium_users = global.db.premium_users || {};
    global.db.bannedUsers = global.db.bannedUsers || [];
}

// Helper untuk memeriksa status owner
function isOwner(senderJid) {
    try {
        const configPath = path.join(__dirname, '..', 'config.json');
        if (!fs.existsSync(configPath)) return false;
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const senderNumber = senderJid.split('@')[0];
        return Array.isArray(config.owner) && config.owner.some(owner => owner.includes(senderNumber));
    } catch (e) {
        return false;
    }
}

module.exports = async (sock, m, text, from) => {
    ensureDB();
    const cmd = (text || '').trim().toLowerCase();
    if (!['/userinfo', '/me'].includes(cmd.split(' ')[0])) return;

    const jid = m.key.participant || m.key.remoteJid || from;
    const name = m.pushName || jid.split('@')[0];
    const number = jid.replace(/[^0-9]/g, '');

    // --- Data Dinamis ---
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split('T')[0];
    
    // 1. Cek Status Premium & Expired
    const premiumData = global.db.premium_users[jid];
    let isPremium = false;
    let premiumExpiry = 'Tidak Aktif';
    if (premiumData && premiumData.expiry > now.getTime()) {
        isPremium = true;
        const expiryDate = new Date(premiumData.expiry);
        premiumExpiry = expiryDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    }

    // 2. Cek Sisa Limit
    let limitText = 'Unlimited ✨';
    if (!isPremium) {
        let dailyLimit = 5; // Default limit
        try {
            const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
            dailyLimit = config.dailyLimit || 5;
        } catch {}
        
        const userLimit = global.db.usage_limit[jid] || {};
        const usedToday = userLimit[today] || 0;
        const remaining = dailyLimit - usedToday;
        limitText = `${remaining} / ${dailyLimit}`;
    }

    // 3. Tentukan Status Pengguna
    let userStatus = 'User';
    if (isOwner(jid)) {
        userStatus = '👑 Owner';
    } else if (isPremium) {
        userStatus = '💎 Premium';
    } else if (global.db.bannedUsers.includes(jid)) {
        userStatus = '🚫 Banned';
    }

    // Dapatkan foto profil user
    let profilePic;
    try {
        profilePic = await sock.profilePictureUrl(jid, 'image');
    } catch {
        profilePic = 'https://i.ibb.co/Fz65b7Q/blank-profile-picture.png'; // default
    }

    // Tampilkan info stylish
    let caption = `╭─────[ *👤 USER PROFILE* ]─────
│ 🏷️ *Nama* : ${name}
│ 📱 *Nomor* : wa.me/${number}
│ 
│ 🧧 *Sisa Limit* : ${limitText}
│ 💎 *Premium* : ${isPremium ? 'Aktif' : 'Tidak Aktif'}
│ ⏳ *Expired* : ${premiumExpiry}
│ 💬 *Status* : ${userStatus}
╰──────────────────────────

*Tips:*
- Limit harian akan direset setiap hari.
- Ingin jadi premium? Ketik */premium*

━━━━━━━━━━━━━━━━━━━
📅 *Request at:* ${new Date().toLocaleString('id-ID')}
`;

    // Kirim dengan thumbnail PP user
    await sock.sendMessage(from, {
        image: { url: profilePic },
        caption: caption,
    }, { quoted: m });
};
