/**
 * plugins/snobg.js
 * Membuat stiker transparan dengan menghapus background gambar menggunakan Neoxr API.
 *
 * • Reply foto dengan /snobg
 * • Upload foto dengan caption /snobg
 *
 * Butuh: npm i axios wa-sticker-formatter form-data
 */
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

// --- KONFIGURASI ---
const NEOXR_API_KEY = 'UCIELL'; // Ganti jika perlu
// --- ---

/**
 * Mengunggah buffer gambar ke layanan hosting gratis dan mengembalikan URL-nya.
 * @param {Buffer} buffer Buffer gambar yang akan diunggah.
 * @returns {Promise<string>} URL gambar yang telah diunggah.
 */
async function uploadImage(buffer) {
    const form = new FormData();
    form.append('file', buffer, 'image.jpg');

    const { data } = await axios.post('https://tmpfiles.org/api/v1/upload', form, {
        headers: form.getHeaders(),
    });

    if (!data || data.status !== 'success') {
        throw new Error('Gagal mengunggah gambar ke host sementara.');
    }
    // URL dari tmpfiles perlu sedikit diubah untuk direct link
    return data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
}


module.exports = async (sock, m, text, from) => {
    // --- 1. Deteksi Pemicu Perintah ---
    const isReply = m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
    const isUpload = m.message?.imageMessage;
    const caption = (m.message?.imageMessage?.caption || '').trim().toLowerCase();
    const commandText = (text || '').trim().toLowerCase();

    const triggerByReply = commandText === '/snobg' && isReply;
    const triggerByUpload = caption === '/snobg' && isUpload;

    if (!triggerByReply && !triggerByUpload) return;

    // --- 2. React & Download Media ---
    await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

    const mediaMessage = isReply ? m.message.extendedTextMessage.contextInfo.quotedMessage.imageMessage : m.message.imageMessage;
    let imageBuffer = Buffer.alloc(0);
    try {
        const stream = await downloadContentFromMessage(mediaMessage, 'image');
        for await (const chunk of stream) {
            imageBuffer = Buffer.concat([imageBuffer, chunk]);
        }
    } catch (e) {
        console.error('snobg download error:', e);
        await sock.sendMessage(from, { react: { text: '❌', key: m.key } });
        return sock.sendMessage(from, { text: '❌ Gagal mengunduh gambar.' }, { quoted: m });
    }

    if (imageBuffer.length === 0) {
        await sock.sendMessage(from, { react: { text: '❌', key: m.key } });
        return sock.sendMessage(from, { text: '❌ Media tidak ditemukan atau kosong.' }, { quoted: m });
    }

    // --- 3. Proses Hapus Background via Neoxr API ---
    let noBgImageUrl;
    try {
        // Langkah 3a: Unggah gambar untuk mendapatkan URL
        const uploadedUrl = await uploadImage(imageBuffer);

        // Langkah 3b: Panggil API Neoxr dengan URL yang didapat
        const neoxrUrl = `https://api.neoxr.eu/api/nobg?image=${encodeURIComponent(uploadedUrl)}&apikey=${NEOXR_API_KEY}`;
        const { data: neoxrResult } = await axios.get(neoxrUrl);

        if (!neoxrResult.status || !neoxrResult.data?.no_background) {
            throw new Error(neoxrResult.message || 'Respons API Neoxr tidak valid.');
        }
        noBgImageUrl = neoxrResult.data.no_background;

    } catch (e) {
        console.error('snobg API process error:', e.message);
        await sock.sendMessage(from, { react: { text: '❌', key: m.key } });
        return sock.sendMessage(from, { text: `❌ Gagal menghapus background: ${e.message}` }, { quoted: m });
    }

    // --- 4. Ambil Metadata EXIF ---
    let packname = 'KaworiBot';
    let author = 'Zireael';
    try {
        const exif = global.db?.setting || {};
        const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
        packname = exif.sk_pack || cfg.stickerPack || cfg.botName || packname;
        author   = exif.sk_author || cfg.stickerAuthor || (Array.isArray(cfg.owner) && cfg.owner[0]) || author;
    } catch {}

    // --- 5. Buat dan Kirim Stiker ---
    try {
        const sticker = new Sticker(noBgImageUrl, {
            pack: packname,
            author: author,
            type: StickerTypes.FULL,
            quality: 80
        });

        await sock.sendMessage(from, await sticker.toMessage(), { quoted: m });
        await sock.sendMessage(from, { react: { text: '✅', key: m.key } });

    } catch (e) {
        console.error('snobg sticker creation error:', e.message);
        await sock.sendMessage(from, { react: { text: '❌', key: m.key } });
        return sock.sendMessage(from, { text: '❌ Gagal membuat stiker.' }, { quoted: m });
    }
};
