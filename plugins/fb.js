/**
 * plugins/fb.js
 * Facebook Video Downloader (auto-upload jika <50MB, auto-link jika lebih)
 * Command: /fb [link]
 * Npm install: axios
 */
const axios = require('axios');

const TRIGGERS = ['/fb', '/fbdl', '/fbvid'];
const MAX_SIZE = 50 * 1024 * 1024; // 50MB

module.exports = async (sock, m, text, from) => {
    const trimmed = (text || '').trim();
    const args = trimmed.split(/\s+/);
    const cmd = args[0].toLowerCase();

    if (!TRIGGERS.includes(cmd)) return;

    const fbUrl = args[1];
    if (!fbUrl || !fbUrl.match(/(?:https?:\/\/)?(web\.|www\.|m\.)?(facebook|fb)\.(com|watch)/i)) {
        await sock.sendMessage(from, {
            text: '❌ Kirim link Facebook valid!\nContoh: /fb https://fb.watch/abc123'
        }, { quoted: m });
        return;
    }

    await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

    // Panggil API Neoxr
    const apiKey = 'UCIELL'; // Isi dengan API Key-mu
    let resultJson;
    try {
        const url = `https://api.neoxr.eu/api/fb?url=${encodeURIComponent(fbUrl)}&apikey=${apiKey}`;
        const { data } = await axios.get(url);
        resultJson = data;
    } catch (e) {
        console.error('fb API error:', e);
        await sock.sendMessage(from, { text: '❌ Gagal menghubungi API FB Downloader.' }, { quoted: m });
        return;
    }

    if (!resultJson.status || !resultJson.data || !resultJson.data.length) {
        await sock.sendMessage(from, { text: '❌ Gagal download, link tidak valid atau video private.' }, { quoted: m });
        return;
    }

    // Pilih HD dulu, fallback ke SD
    let vid = resultJson.data.find(v => v.quality === 'HD' && v.response === 200)
    || resultJson.data.find(v => v.quality === 'SD' && v.response === 200);

    if (!vid || !vid.url) {
        await sock.sendMessage(from, { text: '❌ Video tidak ditemukan atau private.' }, { quoted: m });
        return;
    }

    // Cek file size
    let fileSize = 0;
    try {
        const head = await axios.head(vid.url);
        fileSize = parseInt(head.headers['content-length'] || '0', 10);
    } catch (e) {
        console.error('FB HEAD error:', e);
        fileSize = 0; // fallback, tetap lanjut
    }

    if (fileSize && fileSize < MAX_SIZE) {
        // Download dan upload ke WhatsApp
        try {
            const { data: videoBuffer } = await axios.get(vid.url, { responseType: 'arraybuffer' });
            await sock.sendMessage(
                from,
                { video: Buffer.from(videoBuffer), mimetype: 'video/mp4', caption: `✅ FB Video Quality: *${vid.quality}*\nSize: ${(fileSize/1024/1024).toFixed(2)} MB` },
                                   { quoted: m }
            );
        } catch (e) {
            console.error('FB Video upload error:', e);
            await sock.sendMessage(from, { text: '❌ Gagal mengupload video ke WhatsApp.' }, { quoted: m });
        }
    } else {
        // Kirim link download saja
        await sock.sendMessage(from, {
            text: `✅ Video ditemukan!\n\n*Quality:* ${vid.quality}\n*Size:* ${(fileSize/1024/1024).toFixed(2)} MB\n\nFile terlalu besar untuk di-upload ke WhatsApp.\nDownload manual:\n${vid.url}`
        }, { quoted: m });
    }
};
