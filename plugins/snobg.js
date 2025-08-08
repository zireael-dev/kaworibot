/**
 * plugins/snobg.js
 *
 * • Reply foto dengan `/snobg`
 * • Upload foto dengan caption `/snobg`
 * npm install axios form-data node-fetch sharp
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const sharp = require('sharp');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

module.exports = async (sock, m, text, from) => {
    const cmd = (text||'').trim().toLowerCase();
    // 1) Deteksi trigger Reply atau Caption
    const ext    = m.message.extendedTextMessage;
    const quoted = ext?.contextInfo?.quotedMessage;
    const isReply= quoted?.imageMessage;
    const imgMsg = m.message.imageMessage;
    const caption= imgMsg?.caption?.trim().toLowerCase() || '';

    if (!( cmd === '/snobg' && (isReply || caption.startsWith('/snobg')) )) return;

    // 2) React ⏳
    await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

    // 3) Download buffer
    let mediaProto = isReply ? quoted.imageMessage : imgMsg;
    let imgBuf = Buffer.alloc(0);
    try {
        const stream = await downloadContentFromMessage(mediaProto, 'image');
        for await (const chunk of stream) imgBuf = Buffer.concat([imgBuf, chunk]);
    } catch (e) {
        console.error('snobg download error', e);
        return sock.sendMessage(from, { text: '❌ Gagal mendownload media.' });
    }

    // 4) Upload ke telegra.ph pakai axios+form-data
    let imageUrl;
    try {
        const form = new FormData();
        form.append('file', imgBuf, { filename: 'file.jpg' });
        const res = await axios.post('https://telegra.ph/upload', form, {
            headers: form.getHeaders(),
                                     maxBodyLength: Infinity,
                                     maxContentLength: Infinity
        });
        if (!Array.isArray(res.data) || !res.data[0].src) throw new Error('Invalid telegra.ph response');
        imageUrl = 'https://telegra.ph' + res.data[0].src;
    } catch (e) {
        console.error('snobg telegra upload error', e);
        return sock.sendMessage(from, { text: '❌ Gagal upload ke telegra.ph.' });
    }

    // 5) Panggil Neoxr nobg
    const apiKey = 'UCIELL';
    let respJson;
    try {
        const url = `https://api.neoxr.eu/api/nobg?image=${encodeURIComponent(imageUrl)}&apikey=${apiKey}`;
        const resp = await axios.get(url);
        respJson = resp.data;
    } catch (e) {
        console.error('snobg API error', e);
        return sock.sendMessage(from, { text: '❌ Gagal memanggil API nobg.' });
    }

    if (!respJson.status || !respJson.data?.no_background) {
        console.error('snobg bad response', respJson);
        return sock.sendMessage(from, {
            text: `❌ remove.bg error: ${respJson.message || 'Unknown'}`
        });
    }

    // 6) Download hasil PNG & convert → WebP lossless
    let webpBuf;
    try {
        const pngBuf = (await axios.get(respJson.data.no_background, { responseType: 'arraybuffer' })).data;
        webpBuf = await sharp(Buffer.from(pngBuf)).webp({ lossless: true }).toBuffer();
    } catch (e) {
        console.error('snobg sharp error', e);
        return sock.sendMessage(from, { text: '❌ Gagal konversi image.' });
    }

    // 7) Baca metadata & kirim sticker
    let cfg = {};
    try {
        cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
    } catch {}
    const exif = global.db.setting || {};
    const packname = exif.sk_pack || cfg.stickerPack || cfg.botName || 'Sticker';
    const author   = exif.sk_author || cfg.stickerAuthor || (Array.isArray(cfg.owner)&&cfg.owner[0]) || '';

    await sock.sendMessage(from, {
        sticker: webpBuf,
        packname,
        author
    });
};
