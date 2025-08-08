/**
 * plugins/toimg.js
 * Ubah sticker (webp) jadi gambar (png/jpg). Hanya untuk sticker non-animasi.
 * Support reply sticker saja.
 * Pakai react ⏳ saat proses.
 *
 * Syarat: butuh ffmpeg (pastikan sudah install di VPS/PC)
 */

const { readFileSync, unlinkSync } = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { tmpdir } = require('os');

module.exports = async (sock, m, text, from) => {
    const cmd = (text || '').trim().toLowerCase();
    if (cmd !== '/toimg') return;

    // Cek reply sticker
    const ctxInfo = m.message.extendedTextMessage?.contextInfo;
    const quoted  = ctxInfo?.quotedMessage?.stickerMessage;
    if (!quoted) {
        return sock.sendMessage(from, { text: '❌ Balas sticker (bukan animasi) dengan /toimg.' }, { quoted: m });
    }

    // Deteksi animasi (isAnimated=true = webp animasi)
    if (quoted.isAnimated) {
        return sock.sendMessage(from, { text: '❌ Belum bisa konversi sticker animasi. Hanya sticker biasa ya!' }, { quoted: m });
    }

    // React ⏳ agar user tahu sedang diproses
    await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

    // Download sticker webp
    let buf = Buffer.alloc(0);
    try {
        const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
        const stream = await downloadContentFromMessage(quoted, 'sticker');
        for await (const chunk of stream) buf = Buffer.concat([buf, chunk]);
    } catch (e) {
        console.error('toimg download error:', e);
        return sock.sendMessage(from, { text: '❌ Gagal mengunduh sticker. Coba ulangi.' }, { quoted: m });
    }

    // Simpan webp sementara
    const fileId = Date.now();
    const webpPath = path.join(tmpdir(), `${fileId}.webp`);
    const imgPath  = path.join(tmpdir(), `${fileId}.png`);
    require('fs').writeFileSync(webpPath, buf);

    // Convert dengan ffmpeg (webp → png)
    exec(`ffmpeg -i "${webpPath}" "${imgPath}"`, async (err, stdout, stderr) => {
        // Hapus file temp webp
        unlinkSync(webpPath);

        if (err) {
            console.error('toimg ffmpeg error:', err, stderr);
            return sock.sendMessage(from, { text: '❌ Konversi gagal. Pastikan hanya sticker biasa (bukan animasi).' }, { quoted: m });
        }

        // Kirim hasil ke user
        try {
            const imgBuf = readFileSync(imgPath);
            await sock.sendMessage(from, { image: imgBuf, caption: '✅ Konversi selesai!' }, { quoted: m });
        } catch (e) {
            console.error('toimg send image error:', e);
            await sock.sendMessage(from, { text: '❌ Gagal mengirim gambar hasil konversi.' }, { quoted: m });
        }

        // Hapus file temp png
        try { unlinkSync(imgPath); } catch {}
    });
};
