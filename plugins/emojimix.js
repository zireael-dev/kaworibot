const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');

const TRIGGERS = ['/emojimix', '/mix', '/emomix'];

module.exports = async (sock, m, text, from) => {
    const raw = (text || '').trim();
    const cmd = raw.split(' ')[0].toLowerCase();
    if (!TRIGGERS.includes(cmd)) return;

    // Ambil emoji
    let input = raw.slice(cmd.length).trim();
    let [emo1, emo2] = input.split('+').map(e => (e || '').trim());
    if (!emo1 || !emo2) {
        await sock.sendMessage(from, { text: '❌ Berikan 2 emoji untuk dicampur. Contoh: /emojimix 😳+😩' }, { quoted: m });
        return;
    }

    // React jam pasir
    await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

    // Panggil API neoxr
    let resp;
    try {
        const apiKey = 'UCIELL'; // Atur sesuai kebutuhan
        const url = `https://api.neoxr.eu/api/emoji?q=${encodeURIComponent(emo1 + '_' + emo2)}&apikey=${apiKey}`;
        resp = (await axios.get(url)).data;
    } catch (e) {
        return sock.sendMessage(from, { text: '❌ Gagal memanggil API emojimix.' }, { quoted: m });
    }

    if (!resp.status || !resp.data?.url) {
        return sock.sendMessage(from, { text: '❌ Emoji tidak bisa dicampur.' }, { quoted: m });
    }

    // Download PNG hasil emojimix
    let pngBuffer;
    try {
        pngBuffer = (await axios.get(resp.data.url, { responseType: 'arraybuffer' })).data;
    } catch (e) {
        return sock.sendMessage(from, { text: '❌ Gagal download gambar emojimix.' }, { quoted: m });
    }

    // Ambil EXIF metadata
    let cfg = {};
    try {
        cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
    } catch {}
    const exif = global.db.setting || {};
    const packname = exif.sk_pack || cfg.stickerPack || cfg.botName || 'Sticker';
    const author   = exif.sk_author || cfg.stickerAuthor || (Array.isArray(cfg.owner) && cfg.owner[0]) || '';

    // Gunakan wa-sticker-formatter agar EXIF WA valid (compat untuk Android/iOS)
    try {
        const sticker = new Sticker(pngBuffer, {
            pack: packname,
            author: author,
            type: StickerTypes.FULL,
            quality: 100
        });
        const stickerBuffer = await sticker.toBuffer();
        await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: m });
    } catch (err) {
        console.error('emojimix sticker error:', err);
        await sock.sendMessage(from, { text: '❌ Gagal membuat sticker emoji campuran.' }, { quoted: m });
    }
};
