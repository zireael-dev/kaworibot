/**
 * plugins/setwm.js
 * Plugin untuk mengatur metadata watermark sticker (packname & author) secara persisten ke config.json.
 * Hanya owner utama yang dapat menggunakan.
 * Usage: /setwm packname|author
 */
const fs = require('fs');
const path = require('path');
const { isOwner } = require('../utils/owner');

module.exports = async (sock, m, text, from) => {
  const input = text.trim();
  if (!input.toLowerCase().startsWith('/setwm ')) return;

  // Ambil JID pengirim (participant jika di grup, fallback remoteJid)
  const senderJid = m.key.participant || m.key.remoteJid;
  if (!isOwner(senderJid)) {
    return sock.sendMessage(from, { text: '❌ Hanya owner utama yang dapat menggunakan perintah ini.' });
  }

  // Parse packname|author
  const args = input.slice(7).trim();
  const [packname, author] = args.split('|').map(s => s.trim());
  if (!packname || !author) {
    return sock.sendMessage(from, { text: '❌ Format salah. Gunakan: /setwm packname|author' });
  }

  // Path ke config.json
  const configPath = path.join(__dirname, '..', 'config.json');
  try {
    // Baca file config
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    // Set metadata sticker
    cfg.stickerPack   = packname;
    cfg.stickerAuthor = author;
    // Tulis kembali ke disk
    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf8');

    // Konfirmasi kepada pengguna
    await sock.sendMessage(from, {
      text: `✅ Sticker Watermark berhasil diatur:\n` +
      `• Packname: ${packname}\n` +
      `• Author: ${author}`
    });
  } catch (err) {
    console.error('Error menulis config.json di /setwm:', err);
    return sock.sendMessage(from, {
      text: '❌ Gagal menyimpan konfigurasi sticker watermark.'
    });
  }
};
