/**
 * plugins/server.js
 * Info server status - dengan lokasi, timezone, dan ISP (tanpa IP).
 */
const os = require('os');
const fetch = global.fetch || require('node-fetch');

function bytesToSize(bytes) {
    if (bytes === 0) return '0B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + sizes[i];
}
function formatUptime(seconds) {
    seconds = Math.floor(seconds);
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}j ${m}m ${s}d`;
}

module.exports = async (sock, m, text, from, watermark) => {
    if (!/^\/server\b/i.test((text||'').trim())) return;

    // Fetch public server info (tanpa expose IP)
    let location = 'Unknown', isp = 'Unknown', timezone = 'Unknown', city = '', country = '';
    try {
        const resp = await fetch('http://ip-api.com/json');
        const data = await resp.json();
        city     = data.city || '';
        country  = data.country || '';
        location = [city, country].filter(Boolean).join(', ') || 'Unknown';
        isp      = data.isp || 'Unknown';
        timezone = data.timezone || 'Unknown';
    } catch { /* Ignore network errors */ }

    const uptime      = os.uptime();
    const cpu         = os.cpus()[0];
    const ramUsed     = bytesToSize(process.memoryUsage().rss);
    const ramTotal    = bytesToSize(os.totalmem());
    const cpuModel    = cpu.model;
    const cpuSpeed    = cpu.speed + ' MHz';
    const coreCount   = os.cpus().length;
    const osType      = os.type();
    const osArch      = os.arch();
    const osRelease   = os.release();
    const platform    = os.platform();
    const hostname    = os.hostname();

    const caption = `
    ╭─[ *🤖 SERVER STATUS* ]──
    │  • OS         : ${osType} (${osArch}) ${osRelease}
    │  • Hostname   : ${hostname}
    │  • Platform   : ${platform}
    │  • CPU        : ${cpuModel}
    │  • Core       : ${coreCount} cores @ ${cpuSpeed}
    │  • RAM        : ${ramUsed} / ${ramTotal}
    │  • Uptime     : ${formatUptime(uptime)}
    │
    │  • Lokasi     : ${location}
    │  • Timezone   : ${timezone}
    │  • ISP        : ${isp}
    ╰──────────────────────────
    ${watermark}
    `;

    await sock.sendMessage(from, {
        text: caption,
    }, { quoted: m });
};
