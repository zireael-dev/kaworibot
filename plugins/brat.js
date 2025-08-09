/**
 * plugins/brat.js
 * Command: /brat <text>  (max 30 char)
 * Output: sticker brat dengan EXIF packname/author
 *
 * npm i axios
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_KEY = 'UCIELL'; // ganti kalau perlu

module.exports = async (sock, m, text, from) => {
  const raw = (text || '').trim();
  const lc = raw.toLowerCase();

  // Hanya trigger jika diawali '/brat '
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
  let data;
  try {
    const url = `https://api.neoxr.eu/api/brat?text=${encodeURIComponent(payload)}&apikey=${API_KEY}`;
    const resp = await axios.get(url);
    data = resp.data;
    if (!data || data.status !== true || !data.data?.url) {
      throw new Error(data?.msg || 'Gagal generate brat');
    }
  } catch (e) {
    console.error('brat API error:', e?.response?.data || e.message);
    await sock.sendMessage(from, { text: '❌ Tidak bisa generate brat sticker sekarang.' }, { quoted: m });
    try { await sock.sendMessage(from, { react: { text: '❌', key: m.key } }); } catch {}
    return;
  }

  // Ambil file result (webp/png) sebagai buffer
  let stickerBuf;
  try {
    const fileResp = await axios.get(data.data.url, { responseType: 'arraybuffer' });
    stickerBuf = Buffer.from(fileResp.data);
  } catch (e) {
    console.error('brat download error:', e.message);
    await sock.sendMessage(from, { text: '❌ Gagal mengunduh hasil brat.' }, { quoted: m });
    try { await sock.sendMessage(from, { react: { text: '❌', key: m.key } }); } catch {}
    return;
  }

  // EXIF metadata (packname/author)
  let packname = 'KaworiBot';
  let author = 'Zireael';
  try {
    const exif = global.db?.setting || {};
    const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
    packname = exif.sk_pack || cfg.stickerPack || cfg.botName || packname;
    author   = exif.sk_author || cfg.stickerAuthor || (Array.isArray(cfg.owner) && cfg.owner[0]) || author;
  } catch {}

  // Kirim sticker
  try {
    await sock.sendMessage(from, { sticker: stickerBuf, packname, author }, { quoted: m });
    try { await sock.sendMessage(from, { react: { text: '✅', key: m.key } }); } catch {}
  } catch (e) {
    console.error('brat send sticker error:', e.message);
    await sock.sendMessage(from, { text: '❌ Gagal mengirim sticker.' }, { quoted: m });
    try { await sock.sendMessage(from, { react: { text: '❌', key: m.key } }); } catch {}
  }
};
