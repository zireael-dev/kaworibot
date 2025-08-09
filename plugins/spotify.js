/**
 * plugins/spotify.js
 * Downloader Spotify via neoxr API
 * Pakai: /spotify <link>
 *
 * Catatan:
 * - Jika gagal mengirim file (terlalu besar/timeout), bot kirimkan link unduhan.
 * - Dependensi: npm i axios
 */
const axios = require('axios');

const API_KEY = 'UCIELL'; // pindahkan ke config.json kalau mau
const MAX_BYTES = 45 * 1024 * 1024; // ~45MB, di atas ini coba kirim link saja

function pickSpotifyUrlFromText(text) {
  const m = (text || '').match(/https?:\/\/open\.spotify\.com\/[^\s>]+/i);
  return m ? m[0] : null;
}

function sanitizeFileName(name = 'spotify') {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 100);
}

function findAudioUrl(data) {
  if (!data) return null;
  // Coba beberapa kemungkinan field
  if (typeof data === 'string') return data;
  if (data.audio) return data.audio;
  if (data.url) return data.url;
  if (data.download) {
    if (typeof data.download === 'string') return data.download;
    if (data.download.audio) return data.download.audio;
    if (Array.isArray(data.download)) {
      const cand = data.download.find(x => /audio|mp3/i.test(JSON.stringify(x)));
      if (cand?.url) return cand.url;
    }
  }
  if (Array.isArray(data.urls)) {
    const cand = data.urls.find(u => /\.mp3(\?|$)/i.test(u));
    if (cand) return cand;
  }
  return null;
}

async function tryGetContentLength(url) {
  try {
    const head = await axios.head(url, { timeout: 10000 });
    const len = head.headers['content-length'];
    return len ? parseInt(len, 10) : null;
  } catch {
    return null;
  }
}

module.exports = async (sock, m, text, from) => {
  const raw = (text || '').trim();
  const low = raw.toLowerCase();

  // support: /spotify <url> atau reply text berisi link + ketik /spotify
  const isCmd = low.startsWith('/spotify');
  if (!isCmd) return;

  // ambil link dari argumen atau dari pesan yang di-reply
  let link = raw.slice('/spotify'.length).trim();
  if (!link) {
    const quotedTxt =
      m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation ||
      m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text ||
      '';
    link = pickSpotifyUrlFromText(quotedTxt) || pickSpotifyUrlFromText(raw);
  }

  if (!link || !/open\.spotify\.com/i.test(link)) {
    return sock.sendMessage(from, {
      text: '❌ Berikan link Spotify yang valid.\nContoh: /spotify https://open.spotify.com/track/xxxxxxxx'
    }, { quoted: m });
  }

  // react ⏳
  await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

  // call API neoxr
  let json;
  try {
    const url = `https://api.neoxr.eu/api/spotify?url=${encodeURIComponent(link)}&apikey=${API_KEY}`;
    const res = await axios.get(url, { timeout: 30000 });
    json = res.data;
  } catch (e) {
    await sock.sendMessage(from, { react: { text: '❌', key: m.key } });
    return sock.sendMessage(from, { text: '❌ Gagal memanggil API Spotify.' }, { quoted: m });
  }

  if (!json || json.status === false) {
    await sock.sendMessage(from, { react: { text: '❌', key: m.key } });
    return sock.sendMessage(from, {
      text: `❌ Spotify API error.\n${json?.message ? 'Detail: ' + json.message : ''}`
    }, { quoted: m });
  }

  // ambil metadata & audio url
  const meta = json.data || json.result || json; // fleksibel
  const title = sanitizeFileName(meta.title || meta.name || 'spotify_track');
  const artist = meta.artist || meta.artists?.join(', ') || '';
  const audioUrl = findAudioUrl(meta);

  if (!audioUrl) {
    await sock.sendMessage(from, { react: { text: '❌', key: m.key } });
    return sock.sendMessage(from, { text: '❌ Link audio tidak ditemukan dari API.' }, { quoted: m });
  }

  // cek ukuran file via HEAD (jika ada)
  const len = await tryGetContentLength(audioUrl);
  if (len && len > MAX_BYTES) {
    await sock.sendMessage(from, { react: { text: '⚠️', key: m.key } });
    const cap = `🎵 *${title}*${artist ? ` — ${artist}` : ''}\n\nUkuran file besar (${(len/1024/1024).toFixed(1)} MB).\n👉 Unduh sendiri: ${audioUrl}`;
    return sock.sendMessage(from, { text: cap }, { quoted: m });
  }

  // download & kirim audio
  try {
    const r = await axios.get(audioUrl, { responseType: 'arraybuffer', timeout: 60000 });
    const buf = Buffer.from(r.data);

    if (buf.length > MAX_BYTES) {
      await sock.sendMessage(from, { react: { text: '⚠️', key: m.key } });
      const cap = `🎵 *${title}*${artist ? ` — ${artist}` : ''}\n\nUkuran file besar (${(buf.length/1024/1024).toFixed(1)} MB).\n👉 Unduh sendiri: ${audioUrl}`;
      return sock.sendMessage(from, { text: cap }, { quoted: m });
    }

    await sock.sendMessage(
      from,
      {
        audio: buf,
        mimetype: 'audio/mpeg',
        fileName: `${title}.mp3`,
        caption: `🎵 *${title}*${artist ? ` — ${artist}` : ''}`
      },
      { quoted: m }
    );

    await sock.sendMessage(from, { react: { text: '✅', key: m.key } });
  } catch (e) {
    await sock.sendMessage(from, { react: { text: '⚠️', key: m.key } });
    // fallback kirim link
    const cap = `🎵 *${title}*${artist ? ` — ${artist}` : ''}\n\nGagal kirim file. Silakan unduh via link:\n${audioUrl}`;
    return sock.sendMessage(from, { text: cap }, { quoted: m });
  }
};
