/**
 * plugins/smeme.js
 * Buat sticker meme dengan EXIF metadata yang
 * kompatibel di Android, iOS & Desktop.
 */

const { createCanvas, loadImage } = require('canvas');
const sharp = require('sharp');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const fs   = require('fs');
const path = require('path');

async function downloadBuffer(proto, type) {
    const stream = await downloadContentFromMessage(proto, type);
    let buffer = Buffer.alloc(0);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
}

module.exports = async (sock, m, text, from) => {
    const cmd = (text||'').trim();
    if (!cmd.toLowerCase().startsWith('/smeme ')) return;

    // 1) Ambil media (reply atau caption)
    const ctx   = m.message.extendedTextMessage?.contextInfo;
    const qmsg  = ctx?.quotedMessage;
    const isRep = Boolean(qmsg && qmsg.imageMessage);
    const imgM  = m.message.imageMessage;
    if (!isRep && !imgM) return;

    let imgBuf;
    try {
        if (isRep) imgBuf = await downloadBuffer(qmsg.imageMessage, 'image');
        else       imgBuf = await downloadBuffer(imgM,           'image');
    } catch {
        return sock.sendMessage(from, { text: '❌ Gagal mendownload media.' });
    }

    // 2) Parse teks atas|bawah
    const payload = cmd.slice(7).trim();
    const [rawTop = '', rawBot = ''] = payload.split('|').map(s => s.trim());
    const top    = rawTop.toUpperCase();
    const bottom = rawBot.toUpperCase();
    if (!top && !bottom) {
        return sock.sendMessage(from, {
            text: '❌ Format: /smeme TEKS ATAS|TEKS BAWAH'
        });
    }

    // 3) Baca metadata dari config.json
    let cfg = {};
    try {
        cfg = JSON.parse(fs.readFileSync(
            path.join(__dirname, '..', 'config.json'),
                                         'utf8'
        ));
    } catch {}
    const packname = cfg.stickerPack   || cfg.botName   || 'Sticker';
    const author   = cfg.stickerAuthor || (Array.isArray(cfg.owner)&&cfg.owner[0]) || 'Bot';

    try {
        // 4) Gambar + teks di Canvas 512×512
        const img    = await loadImage(imgBuf);
        const size   = 512;
        const canvas = createCanvas(size, size);
        const ctx2   = canvas.getContext('2d');
        ctx2.drawImage(img, 0, 0, size, size);

        ctx2.textAlign   = 'center';
        ctx2.strokeStyle = 'black';
        ctx2.fillStyle   = 'white';
        ctx2.lineWidth   = 8;
        ctx2.font        = '100px Arial';

        if (top) {
            ctx2.textBaseline = 'top';
            ctx2.strokeText(top, size/2, 20);
            ctx2.fillText(  top, size/2, 20);
        }
        if (bottom) {
            ctx2.textBaseline = 'bottom';
            ctx2.strokeText(bottom, size/2, size-20);
            ctx2.fillText(  bottom, size/2, size-20);
        }

        // 5) Convert Canvas→PNG→Buffer
        const pngBuffer = canvas.toBuffer('image/png');

        // 6) Gunakan wa-sticker-formatter untuk encode + EXIF
        const sticker = new Sticker(pngBuffer, {
            pack:     packname,
            author:   author,
            type:     StickerTypes.FULL,
            quality:  100,
            width:    size,
            height:   size
        });
        const stickerBuffer = await sticker.toBuffer();

        // 7) Kirim sticker
        await sock.sendMessage(from, { sticker: stickerBuffer });
    } catch (e) {
        console.error('Smeme build error:', e);
        await sock.sendMessage(from, { text: '❌ Gagal membuat sticker meme.' });
    }
};
