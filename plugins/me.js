/**
 * plugins/userinfo.js
 * Cek profil user dengan data dinamis dari database.
 * Trigger: /userinfo, /me
 */
const fs = require('fs');
const path = require('path');

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

    // --- LOGIKA BARU: Tentukan JID dan Nama Target dengan Benar ---
    let targetJid;
    let name;

    const mentionedJid = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedJid = m.message?.extendedTextMessage?.contextInfo?.participant;

    if (mentionedJid) {
        targetJid = mentionedJid;
        // Untuk mendapatkan nama dari mention, kita perlu info grup
        if (from.endsWith('@g.us')) {
            try {
                const groupMeta = await sock.groupMetadata(from);
                const participant = groupMeta.participants.find(p => p.id === targetJid);
                // Nama dari notifikasi (jika ada) atau dari nomor
                name = participant?.notify || targetJid.split('@')[0];
            } catch {
                name = targetJid.split('@')[0];
            }
        } else {
            name = targetJid.split('@')[0];
        }
    } else if (quoted) {
        targetJid = quotedJid;
        // Nama dari notifikasi (jika ada) atau dari nomor
        name = m.message.extendedTextMessage.contextInfo.pushName || targetJid.split('@')[0];
    } else {
        // Jika tidak ada mention atau reply, targetnya adalah pengirim pesan
        targetJid = m.key.participant || m.key.remoteJid;
        name = m.pushName || targetJid.split('@')[0];
    }
    // --- ---

    const number = targetJid.replace(/[^0-9]/g, '');

    // --- Data Dinamis ---
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split('T')[0];
    
    // 1. Cek Status Premium & Expired
    const premiumData = global.db.premium_users[targetJid];
    let isPremium = false;
    let premiumExpiry = 'Tidak Aktif';
    if (premiumData && premiumData.expiry > now.getTime()) {
        isPremium = true;
        const expiryDate = new Date(premiumData.expiry);
        premiumExpiry = expiryDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    }

    // 2. Cek Sisa Limit
    let limitText = 'Unlimited ✨';
    if (!isPremium && !isOwner(targetJid)) {
        let dailyLimit = 15; // Default limit
        try {
            const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
            dailyLimit = config.dailyLimit || 15;
        } catch {}
        
        const userLimit = global.db.usage_limit[targetJid] || {};
        const usedToday = userLimit[today] || 0;
        const remaining = dailyLimit - usedToday;
        limitText = `${remaining} / ${dailyLimit}`;
    }

    // 3. Tentukan Status Pengguna
    let userStatus = 'User';
    if (isOwner(targetJid)) {
        userStatus = '👑 Owner';
    } else if (isPremium) {
        userStatus = '💎 Premium';
    } else if (global.db.bannedUsers.includes(targetJid)) {
        userStatus = '🚫 Banned';
    }

    // Dapatkan foto profil user
    let profilePic;
    try {
        profilePic = await sock.profilePictureUrl(targetJid, 'image');
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
