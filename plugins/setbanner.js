/**
 * plugins/owner.setcover.js
 * Mengatur gambar cover dengan me-reply atau mengunggah foto.
 * Gambar akan di-crop, dikompres, dan disimpan secara lokal.
 *
 * Commands:
 * /setcover (reply/upload foto) -> Menyimpan gambar sebagai cover.
 * /delcover                     -> Menghapus cover yang tersimpan.
 */

const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

function isOwner(senderJid) {
  try {
    const configPath = path.join(__dirname, '..', 'config.json');
    if (!fs.existsSync(configPath)) return false;
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const senderNumber = senderJid.split('@')[0];
    return Array.isArray(config.owner) && config.owner.some(owner => owner.includes(senderNumber));
  } catch (e) {
    console.error("Gagal membaca config.json:", e);
    return false;
  }
}

async function cropToLandscapeBuffer(inputBuffer) {
  try {
    const image = await Jimp.read(inputBuffer);
    const { width, height } = image.bitmap;
    const targetAspectRatio = 16 / 9;
    const currentAspectRatio = width / height;

    let cropWidth, cropHeight, x, y;

    if (currentAspectRatio > targetAspectRatio) {
      cropHeight = height;
      cropWidth = Math.floor(height * targetAspectRatio);
      x = Math.floor((width - cropWidth) / 2);
      y = 0;
    } else {
      cropWidth = width;
      cropHeight = Math.floor(width / targetAspectRatio);
      x = 0;
      y = Math.floor((height - cropHeight) / 2);
    }

    image.crop(x, y, cropWidth, cropHeight).quality(60);
    return await image.getBufferAsync(Jimp.MIME_JPEG);
  } catch (error) {
    console.error('Error saat memotong gambar:', error.message);
    throw error;
  }
}

module.exports = async (sock, m, text, from) => {
  const raw = (text || '').trim().toLowerCase();
  const senderJid = m.key.participant || m.key.remoteJid;

  // --- Deteksi Pemicu Perintah ---
  const isReply = m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
  const isUpload = m.message?.imageMessage;
  const caption = (m.message?.imageMessage?.caption || '').trim().toLowerCase();

  const triggerByReply = raw === '/setcover' && isReply;
  const triggerByUpload = caption === '/setcover' && isUpload;

  if (triggerByReply || triggerByUpload) {
    if (!isOwner(senderJid)) {
      return sock.sendMessage(from, { text: "❌ Perintah ini hanya untuk owner." }, { quoted: m });
    }

    await sock.sendMessage(from, { react: { text: '🖼️', key: m.key } });

    try {
      // Tentukan pesan media mana yang akan diunduh
      const mediaMessage = isReply ? m.message.extendedTextMessage.contextInfo.quotedMessage.imageMessage : m.message.imageMessage;

      // Download gambar dari pesan
      const stream = await downloadContentFromMessage(mediaMessage, 'image');
      let imageBuffer = Buffer.alloc(0);
      for await (const chunk of stream) imageBuffer = Buffer.concat([imageBuffer, chunk]);

      // Proses gambar (crop & kompres)
      const processedBuffer = await cropToLandscapeBuffer(imageBuffer);

      // Tentukan path penyimpanan
      const mediaDir = path.join(__dirname, '..', 'media');
      const coverPath = path.join(mediaDir, 'cover.jpg');

      // Buat folder 'media' jika belum ada
      if (!fs.existsSync(mediaDir)) {
        fs.mkdirSync(mediaDir);
      }

      // Simpan file secara lokal
      fs.writeFileSync(coverPath, processedBuffer);

      const successMessage = "✅ Cover berhasil diatur. Perubahan akan langsung terlihat di /menu.";
      return sock.sendMessage(from, { text: successMessage }, { quoted: m });

    } catch (e) {
      console.error("Setcover error:", e);
      return sock.sendMessage(from, { text: `❌ Gagal memproses gambar: ${e.message}` }, { quoted: m });
    }
  }

  if (raw === '/delcover') {
    if (!isOwner(senderJid)) {
      return sock.sendMessage(from, { text: "❌ Perintah ini hanya untuk owner." }, { quoted: m });
    }
    try {
      const coverPath = path.join(__dirname, '..', 'media', 'cover.jpg');
      if (fs.existsSync(coverPath)) {
        fs.unlinkSync(coverPath);
        return sock.sendMessage(from, { text: "✅ Cover berhasil dihapus." }, { quoted: m });
      } else {
        return sock.sendMessage(from, { text: "ℹ️ Tidak ada cover yang sedang diatur." }, { quoted: m });
      }
    } catch (e) {
      console.error("Delcover error:", e);
      return sock.sendMessage(from, { text: "❌ Gagal menghapus cover." }, { quoted: m });
    }
  }
};
