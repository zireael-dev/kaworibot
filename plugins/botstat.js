/**
 * plugins/stat.js
 * Statistik dan status bot, lengkap ornamen, humor, & coming soon
 * Command: /stat atau /botstat
 */

const os = require('os');
const moment = require('moment-timezone');

function formatUptime(seconds) {
    seconds = Math.floor(seconds);
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}j ${m}m ${s}d`;
}
function bold(txt) { return `*${txt}*`; }
function checked(val) { return val ? '✅' : '❌'; }
function arrayToList(arr) { return arr && arr.length ? arr.join(' ') : '-'; }
function funnyLine() {
    const arr = [
        "Bot lagi sehat walafiat! 🥗",
        "Masih kuat nge-jaga group kok 💪",
        "Jangan lupa traktir kopi ya ☕",
        "Status: belum pensiun! 😂",
        "Bot juga butuh kasih sayang 😁"
    ];
    return arr[Math.floor(Math.random() * arr.length)];
}

module.exports = async (sock, m, text, from, watermark) => {
    const cmd = (text||'').trim().toLowerCase();
    if (!/^\/(stat|botstat)\b/.test(cmd)) return;

    // Dummy/fake database jika belum ada
    global.db = global.db || {};
    global.db.users = global.db.users || [];
    global.db.chats = global.db.chats || [];
    global.db.bannedUsers = global.db.bannedUsers || [];
    global.db.premiumUsers = global.db.premiumUsers || [];
    global.db.statistic = global.db.statistic || [];
    global.db.setting = global.db.setting || {
        autobackup: false, autodownload: false, antispam: false,
        debug: false, groupmode: false, online: true, self: false, noprefix: false,
        multiprefix: false, prefix: ['/', '!'], onlyprefix: '/',
        lastReset: new Date()
    };

    // Info statistic
    const users   = global.db.users.length || 0;
    const chats   = global.db.chats.filter(v => /\.net$/.test(v.jid)).length || 0;
    const groups  = chats; // Group = chat jid yg .net
    const banned  = global.db.bannedUsers.length || 0;
    const blocked = 0; // Belum diimplementasi
    const premium = global.db.premiumUsers.length || 0;
    const hitstat = (global.db.statistic.reduce?.((a, b) => a + (b.hitstat || 0), 0)) || 0;

    // System setting
    const setting = global.db.setting;
    const resetAt = moment(setting.lastReset).format('DD/MM/YYYY HH:mm');

    // Uptime
    const uptime = formatUptime(os.uptime());

    // Caption fancy & sedikit bercanda
    const caption = `
    ┏━〔 *🤖 KAWORI-BOT STATUS* 〕━
    ┃ ${funnyLine()}
    ┃
    ┃  👥 Group aktif   : ${bold(groups)}
    ┃  👤 Private chat  : ${bold(chats)}
    ┃  📊 Total user    : ${bold(users)}
    ┃  🏷️ Banned user   : ${bold(banned)}
    ┃  👑 Premium user  : ${bold(premium > 0 ? premium : '[Coming Soon]')}
    ┃  🚫 Blocked user  : ${bold(blocked > 0 ? blocked : '[Coming Soon]')}
    ┃  💥 Total hitstat : ${bold(hitstat > 0 ? hitstat : '[Coming Soon]')}
    ┃  ⏱️ Runtime       : ${bold(uptime)}
    ┗━━━━━━━━━━━━━━━━━━━━━━

    ┏━〔 *⚙️ SYSTEM STATUS* 〕━
    ┃  ${checked(setting.autobackup)}  Auto Backup
    ┃  ${checked(setting.autodownload)}  Auto Download
    ┃  ${checked(setting.antispam)}  Anti Spam
    ┃  ${checked(setting.debug)}  Debug Mode
    ┃  ${checked(setting.groupmode)}  Group Mode
    ┃  ${checked(setting.online)}  Always Online
    ┃  ${checked(setting.self)}  Self Mode
    ┃  ${checked(setting.noprefix)}  No Prefix
    ┃  Prefix      : ${setting.multiprefix ? arrayToList(setting.prefix) : setting.onlyprefix}
    ┃  Reset At    : ${resetAt}
    ┗━━━━━━━━━━━━━━━━━━━━━━

    ${watermark}
    `;

    await sock.sendMessage(from, {
        text: caption,
    }, { quoted: m });
};
