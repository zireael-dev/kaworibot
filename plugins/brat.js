/**
 * plugins/brat.js
 * Command: /brat <text>  (max 30 char)
 * Output: sticker brat dengan EXIF packname/author
 *
 * FIX: Menggunakan wa-sticker-formatter untuk memastikan kompatibilitas
 * di semua perangkat dan penyematan EXIF yang benar.
 *
 * npm i axios wa-sticker-formatter
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { Sticker } = require('wa-sticker-formatter');

const API_KEY = 'UCIELL'; // ganti kalau perlu

module.exports = async (sock, m, text, from) => {
  const raw = (text || '').trim();
  const lc = raw.toLowerCase();

  // Hanya trigger jika diawali '/brat'
  if (!lc.startsWith('/brat')) return;

  // Ambil argumen setelah '/brat'
  const payload = raw.slice(5).trim();
  if (!payload) {
    return sock.sendMessage(from, { text: '❌ Kasih teksnya ya.\nContoh: /brat kawori bot' }, { quoted: m });
  }
  if (payload.length > 30) {
    return sock.sendMessage(from, { text: '🚩 Maksimal 30 karakter.' }, { quoted: m });
  }

  // React jam pasir
  try { await sock.sendMessage(from, { react: { text: '⏳', key: m.key } }); } catch {}

  // Panggil API neoxr
  let imageUrl;
  try {
    const url = `https://api.neoxr.eu/api/brat?text=${encodeURIComponent(payload)}&apikey=${API_KEY}`;
    const resp = await axios.get(url);
    const data = resp.data;
    if (!data || data.status !== true || !data.data?.url) {
      throw new Error(data?.msg || 'Gagal generate brat');
    }
    imageUrl = data.data.url;
  } catch (e) {
    console.error('brat API error:', e?.response?.data || e.message);
    await sock.sendMessage(from, { text: '❌ Tidak bisa generate brat sticker sekarang.' }, { quoted: m });
    try { await sock.sendMessage(from, { react: { text: '❌', key: m.key } }); } catch {}
    return;
  }

  // Ambil EXIF metadata (packname/author)
  let packname = 'KaworiBot';
  let author = 'Zireael';
  try {
    const exif = global.db?.setting || {};
    const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
    packname = exif.sk_pack || cfg.stickerPack || cfg.botName || packname;
    author   = exif.sk_author || cfg.stickerAuthor || (Array.isArray(cfg.owner) && cfg.owner[0]) || author;
  } catch {}

  // Buat stiker menggunakan wa-sticker-formatter
  try {
    const sticker = new Sticker(imageUrl, {
        pack: packname,
        author: author,
        type: 'full', // Tipe stiker (bisa 'full' atau 'crop')
        quality: 70     // Kualitas stiker
    });

    // Kirim stiker yang sudah jadi
    await sock.sendMessage(from, await sticker.toMessage(), { quoted: m });
    try { await sock.sendMessage(from, { react: { text: '✅', key: m.key } }); } catch {}

  } catch (e) {
    console.error('brat send sticker error:', e.message);
    await sock.sendMessage(from, { text: '❌ Gagal membuat atau mengirim sticker.' }, { quoted: m });
    try { await sock.sendMessage(from, { react: { text: '❌', key: m.key } }); } catch {}
  }
};
