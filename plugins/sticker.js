/**
 * plugins/sticker.js
 * Trigger: /s /stick /stiker /sticker (bisa reply, bisa caption)
 * EXIF packname & author dibaca dari config/global.db.setting
 * npm install wa-sticker-formatter
 */
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

// List command trigger
const TRIGGERS = ['/s', '/stick', '/stiker', '/sticker'];

module.exports = async (sock, m, text, from) => {
    // Ambil trigger baik dari text (chat biasa) ataupun caption pada image/video
    let trigger = (text || '').trim().toLowerCase();
    // Jika tidak ada text, cek caption media
    if (!trigger) {
        trigger = m.message.imageMessage?.caption?.trim().toLowerCase()
        || m.message.videoMessage?.caption?.trim().toLowerCase()
        || '';
    }
    if (!TRIGGERS.includes(trigger.split(' ')[0])) return;

    // Cek media: reply atau direct upload
    const ctxInfo = m.message.extendedTextMessage?.contextInfo;
    const quoted = ctxInfo?.quotedMessage;
    const isReply = quoted && (quoted.imageMessage || quoted.videoMessage);
    const imgMsg = m.message.imageMessage;
    const vidMsg = m.message.videoMessage;

    let media, mediaType;
    if (isReply) {
        media = quoted.imageMessage || quoted.videoMessage;
        mediaType = quoted.imageMessage ? 'image' : 'video';
    } else if (imgMsg || vidMsg) {
        media = imgMsg || vidMsg;
        mediaType = imgMsg ? 'image' : 'video';
    } else {
        await sock.sendMessage(from, { text: '❌ Balas gambar/video atau kirim media dengan /s' }, { quoted: m });
        return;
    }

    // Download buffer
    let buf = Buffer.alloc(0);
    try {
        const stream = await downloadContentFromMessage(media, mediaType);
        for await (const chunk of stream) buf = Buffer.concat([buf, chunk]);
    } catch (e) {
        console.error('sticker download error:', e);
        return sock.sendMessage(from, { text: '❌ Gagal mengunduh media.' }, { quoted: m });
    }

    // EXIF metadata (ambil dari global.db.setting & config.json)
    let packname = 'KaworiBot', author = 'Yusril Falah';
    try {
        let cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
        let exif = global.db.setting || {};
        packname = exif.sk_pack || cfg.stickerPack || cfg.botName || packname;
        author   = exif.sk_author || cfg.stickerAuthor || (Array.isArray(cfg.owner) && cfg.owner[0]) || author;
    } catch {}

    // Bikin sticker
    try {
        const sticker = new Sticker(buf, {
            pack: packname,
            author: author,
            type: mediaType === 'image' ? StickerTypes.FULL : StickerTypes.CROPPED,
            quality: 80
        });
        const stickerBuffer = await sticker.toBuffer();
        await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: m });
    } catch (err) {
        console.error('sticker plugin error:', err);
        await sock.sendMessage(from, { text: '❌ Terjadi kesalahan saat membuat stiker.' }, { quoted: m });
    }
};
