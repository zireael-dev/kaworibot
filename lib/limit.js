/**
 * lib/limit.js
 * Sistem terpusat untuk memeriksa dan mengelola limit penggunaan harian.
 */

const fs = require('fs');
const path = require('path');

// Fungsi untuk memastikan database siap digunakan
function ensureDB() {
    global.db = global.db || {};
    global.db.usage_limit = global.db.usage_limit || {};
    global.db.premium_users = global.db.premium_users || {};
}

/**
 * Memeriksa dan mengupdate limit penggunaan harian untuk user.
 * @param {string} senderJid JID pengguna.
 * @returns {boolean} True jika limit habis, false jika masih ada.
 */
function checkLimit(senderJid) {
    ensureDB();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split('T')[0];

    // 1. Cek status premium
    const premiumData = global.db.premium_users[senderJid];
    if (premiumData && premiumData.expiry > now.getTime()) {
        return false; // Pengguna premium tidak memiliki limit
    }

    // 2. Baca limit harian dari config.json
    let dailyLimit = 5; // Limit default jika tidak diatur
    try {
        const configPath = path.join(__dirname, '..', 'config.json');
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.dailyLimit) {
            dailyLimit = config.dailyLimit;
        }
    } catch (e) {
        console.error("Gagal membaca dailyLimit dari config.json, menggunakan default:", e);
    }

    // 3. Inisialisasi data pengguna jika belum ada
    if (!global.db.usage_limit[senderJid]) {
        global.db.usage_limit[senderJid] = {};
    }

    // 4. Reset limit jika hari sudah berganti
    if (!global.db.usage_limit[senderJid][today]) {
        global.db.usage_limit[senderJid][today] = 0;
    }

    // 5. Cek apakah limit sudah tercapai
    if (global.db.usage_limit[senderJid][today] >= dailyLimit) {
        return true; // Limit habis
    }

    // 6. Jika belum, tambahkan hitungan dan izinkan penggunaan
    global.db.usage_limit[senderJid][today]++;
    return false; // Limit masih ada
}

module.exports = { checkLimit };
