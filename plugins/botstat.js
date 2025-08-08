/**
 * plugins/stat.js
 * Statistik & status bot: support db.json persist, ornamen, humor, "coming soon"
 * Command: /stat atau /botstat
 */

const os = require('os');
const moment = require('moment-timezone');

// Format uptime: 01j 23m 45d
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
        "Bot juga butuh kasih sayang 😁",
        "Uptime? Bisa sampe lupa jodoh! 🫠"
    ];
    return arr[Math.floor(Math.random() * arr.length)];
}

module.exports = async (sock, m, text, from, watermark) => {
    const cmd = (text||'').trim().toLowerCase();
    if (!/^\/(stat|botstat)\b/.test(cmd)) return;

    // Ambil data dari DB persist (jangan diinisialisasi ulang)
    const users   = global.db.users?.length || 0;
    const groups  = global.db.groups?.length || 0;
    const banned  = global.db.bannedUsers?.length || 0;
    const premium = global.db.premiumUsers?.length || '[Coming Soon]';
    const hitstat = global.db.statistic?.reduce?.((a, b) => a + (b.hitstat || 0), 0) || '[Coming Soon]';
    const blocked = '[Coming Soon]'; // Kalau fitur block belum ada

    // Setting system, pakai global.db.setting
    const setting = global.db.setting || {};
    const resetAt = moment(setting.lastReset).format('DD/MM/YYYY HH:mm');
    const uptime = formatUptime(os.uptime());

    // Fancy caption + ornamen
    const caption = `
┏━━━━━━━━━━━━━━━━━━━━━━━
┃ *🤖 KAWORI-BOT STATUS*
┃ ${funnyLine()}
┃
┃ 👥 Group aktif   : ${bold(groups)}
┃ 👤 Private chat  : [Coming Soon]
┃ 📊 Total user    : ${bold(users)}
┃ 🏷️ Banned user   : ${bold(banned)}
┃ 👑 Premium user  : ${bold(premium)}
┃ 🚫 Blocked user  : ${bold(blocked)}
┃ 💥 Total hitstat : ${bold(hitstat)}
┃ ⏱️ Runtime       : ${bold(uptime)}
┗━━━━━━━━━━━━━━━━━━━━━━━

┏━━━━━━━━━━━━━━━━━━━━━━━
┃ *⚙️ SYSTEM STATUS*
┃  ${checked(setting.autobackup)}  Auto Backup
┃  ${checked(setting.autodownload)}  Auto Download
┃  ${checked(setting.antispam)}  Anti Spam
┃  ${checked(setting.debug)}  Debug Mode
┃  ${checked(setting.groupmode)}  Group Mode
┃  ${checked(setting.online)}  Always Online
┃  ${checked(setting.self)}  Self Mode
┃  ${checked(setting.noprefix)}  No Prefix
┃  Prefix   : ${setting.multiprefix ? arrayToList(setting.prefix) : setting.onlyprefix || '/'}
┃  Reset At : ${resetAt || '-'}
┗━━━━━━━━━━━━━━━━━━━━━━━

${watermark}
    `.replace(/^\s+/gm, '');

    await sock.sendMessage(from, {
        text: caption,
    }, { quoted: m });
};
