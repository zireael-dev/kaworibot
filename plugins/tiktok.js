/**
 * plugins/tiktok.js
 * Downloader TikTok video/audio langsung ke WhatsApp (tanpa cek size).
 * Command: /tiktok /tikmp3 /tikwm /vt + [link]
 * npm install axios
 */
const axios = require('axios');
const TRIGGERS = ['/tiktok', '/tikmp3', '/tikwm', '/vt'];

module.exports = async (sock, m, text, from) => {
    const trimmed = (text || '').trim();
    const command = trimmed.split(' ')[0].toLowerCase();
    const link    = trimmed.split(' ')[1];

    if (!TRIGGERS.includes(command)) return;
    if (!link || !link.match(/tiktok\.com/)) {
        return sock.sendMessage(from, { text: '❌ Kirim: /tiktok [link TikTok]\nContoh: /tiktok https://vt.tiktok.com/xxxxxx' }, { quoted: m });
    }

    // Tunjukkan sedang proses
    await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

    // Ambil data dari API
    let json;
    try {
        const url = `https://api.neoxr.eu/api/tiktok?url=${encodeURIComponent(link)}&apikey=UCIELL`;
        const resp = await axios.get(url);
        json = resp.data;
    } catch (e) {
        console.error('tiktok api error:', e);
        return sock.sendMessage(from, { text: '❌ Gagal memanggil API TikTok.' }, { quoted: m });
    }

    if (!json.status) {
        return sock.sendMessage(from, { text: '❌ Link tidak valid atau TikTok tidak ditemukan.' }, { quoted: m });
    }

    // Ambil url sesuai perintah
    let sendType = 'video', fileUrl, fileName, caption = '';
    if (command === '/tikmp3') {
        fileUrl  = json.data.audio;
        sendType = 'audio';
        fileName = 'tiktok.mp3';
        caption  = '🎵 Audio TikTok';
    } else if (command === '/tikwm') {
        fileUrl  = json.data.videoWM;
        sendType = 'video';
        fileName = 'tiktok_wm.mp4';
        caption  = '🎥 TikTok (Watermark)';
    } else if (command === '/vt') {
        fileUrl  = json.data.video;
        sendType = 'video';
        fileName = 'tiktok_nowm.mp4';
        caption  = '🎬 TikTok (No Watermark)';
    } else {
        // default: /tiktok
        fileUrl  = json.data.video;
        sendType = 'video';
        fileName = 'tiktok.mp4';
        caption  = '🎬 TikTok (No Watermark)';
    }

    if (!fileUrl) {
        return sock.sendMessage(from, { text: '❌ Tidak bisa mengambil file dari TikTok.' }, { quoted: m });
    }

    // Download & kirim file ke WA
    try {
        const res = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        if (sendType === 'video') {
            await sock.sendMessage(
                from,
                { video: Buffer.from(res.data), mimetype: 'video/mp4', caption },
                                   { quoted: m }
            );
        } else if (sendType === 'audio') {
            await sock.sendMessage(
                from,
                { audio: Buffer.from(res.data), mimetype: 'audio/mp4', ptt: false },
                                   { quoted: m }
            );
        }
    } catch (e) {
        // Fallback: kirim link download jika gagal upload ke WhatsApp (mungkin terlalu besar)
        console.error('tiktok send to WA error:', e);
        await sock.sendMessage(from, {
            text: `❌ Gagal upload ke WhatsApp (mungkin file terlalu besar). Download manual: ${fileUrl}`
        }, { quoted: m });
    }
};
