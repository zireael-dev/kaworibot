/**
 * plugins/ig.js
 * Instagram Downloader (photo, video, carousel) langsung ke WhatsApp.
 * Command: /ig [link]
 * npm install axios
 */
const axios = require('axios');
const TRIGGER = '/ig';

module.exports = async (sock, m, text, from) => {
    const trimmed = (text || '').trim();
    const command = trimmed.split(' ')[0].toLowerCase();
    const link    = trimmed.split(' ')[1];

    if (command !== TRIGGER) return;
    if (!link || !link.match(/^https:\/\/(www\.)?instagram\.com/)) {
        return sock.sendMessage(from, {
            text: '❌ Kirim: /ig [link Instagram]\nContoh: /ig https://www.instagram.com/p/CK0tLXyAzEI'
        }, { quoted: m });
    }

    // Tunjukkan sedang proses
    await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

    // Ambil data dari API
    let json;
    try {
        const url = `https://api.neoxr.eu/api/ig?url=${encodeURIComponent(link)}&apikey=UCIELL`;
        const resp = await axios.get(url);
        json = resp.data;
    } catch (e) {
        console.error('ig api error:', e);
        return sock.sendMessage(from, { text: '❌ Gagal memanggil API Instagram.' }, { quoted: m });
    }

    if (!json.status || !json.data || !json.data.length) {
        return sock.sendMessage(from, { text: '❌ Link tidak valid, private, atau media tidak ditemukan.' }, { quoted: m });
    }

    // Kirim satu-satu, support multi file (carousel)
    for (const media of json.data) {
        try {
            const res = await axios.get(media.url, { responseType: 'arraybuffer' });
            if (media.type === 'mp4') {
                await sock.sendMessage(
                    from,
                    { video: Buffer.from(res.data), mimetype: 'video/mp4' },
                                       { quoted: m }
                );
            } else {
                await sock.sendMessage(
                    from,
                    { image: Buffer.from(res.data), mimetype: 'image/jpeg' },
                                       { quoted: m }
                );
            }
            // Delay sedikit biar ga spam dan proses smooth
            await new Promise(r => setTimeout(r, 1200));
        } catch (e) {
            // Jika gagal upload (mungkin size besar), kasih link manual
            console.error('ig upload error:', e);
            await sock.sendMessage(
                from,
                { text: `❌ Gagal upload ke WA (mungkin file terlalu besar).\nDownload manual: ${media.url}` },
                                   { quoted: m }
            );
        }
    }
};
