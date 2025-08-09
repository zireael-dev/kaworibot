/**
 * plugins/yt.js
 * YouTube downloader tanpa fetcher (langsung hit endpoint neoxr).
 * Alur:
 *   1) /yt <url>  -> simpan sesi 10 menit
 *   2) /audio [128kbps|192kbps|320kbps]  -> kirim MP3
 *   3) /video [360p|480p|720p]           -> kirim MP4
 *
 * React: ⏳ saat mulai, ✅ saat sukses, ❌ saat gagal.
 *
 * npm i axios
 */

const axios = require('axios');

// ====== KONFIGURASI MUDAH DIUBAH ======
const NEOXR_KEY = 'UCIELL';                 // ganti kalau perlu
const VIDEO_QUALITY_DEFAULT = '480p';       // default video
const AUDIO_QUALITY_DEFAULT = '128kbps';    // default audio
const SESSION_TTL_MS = 10 * 60 * 1000;      // 10 menit
const AXIOS_TIMEOUT_MS = 120_000;           // 120 detik

// Simpan sesi per-pengirim (JID pengirim)
global.ytSessions = global.ytSessions || {}; // { [senderJid]: { url, expires } }

function isYtUrl(u='') {
  return /youtu\.be|youtube\.com/i.test(u);
}

function getSenderJid(m) {
  return m.key.participant || m.key.remoteJid;
}

function setSession(sender, url) {
  global.ytSessions[sender] = { url, expires: Date.now() + SESSION_TTL_MS };
}

function getSession(sender) {
  const s = global.ytSessions[sender];
  if (!s) return null;
  if (Date.now() > s.expires) {
    delete global.ytSessions[sender];
    return null;
  }
  return s;
}

function clearSession(sender) {
  delete global.ytSessions[sender];
}

async function sendReact(sock, from, key, emoji) {
  try {
    await sock.sendMessage(from, { react: { text: emoji, key } });
  } catch {}
}

module.exports = async (sock, m, text, from) => {
  const raw = (text || '').trim();
  const lower = raw.toLowerCase();
  const sender = getSenderJid(m);

  // ========== STEP 1: /yt <url> ==========
  if (lower.startsWith('/yt ')) {
    await sendReact(sock, from, m.key, '⏳');

    const url = raw.slice(4).trim();
    if (!isYtUrl(url)) {
      await sendReact(sock, from, m.key, '❌');
      return sock.sendMessage(from, { text: '❌ Link YouTube tidak valid. Contoh:\n/yt https://youtu.be/dQw4w9WgXcQ' }, { quoted: m });
    }

    setSession(sender, url);

    await sock.sendMessage(from, {
      text:
`✅ Link diterima.

Mau format apa?
• Balas: */audio* [bitrate]  → contoh: /audio 128kbps
• Balas: */video* [resolusi] → contoh: /video 480p

Default:
• Audio: ${AUDIO_QUALITY_DEFAULT}
• Video: ${VIDEO_QUALITY_DEFAULT}

Tips:
• Kamu _harus_ membalas pesan ini (reply). 
• Perintah /audio /video hanya aktif 10 menit setelah /yt.`,
    }, { quoted: m });

    await sendReact(sock, from, m.key, '✅');
    return;
  }

  // ========== STEP 2: /audio [bitrate] ==========
  if (lower.startsWith('/audio')) {
    await sendReact(sock, from, m.key, '⏳');

    const s = getSession(sender);
    if (!s) {
      await sendReact(sock, from, m.key, '❌');
      return sock.sendMessage(from, { text: '❌ Belum ada sesi aktif.\nKetik: /yt <link YouTube> dulu ya.' }, { quoted: m });
    }

    const parts = raw.split(/\s+/).slice(1);
    const bitrate = (parts[0] || AUDIO_QUALITY_DEFAULT).toLowerCase(); // 128kbps, 192kbps, 320kbps

    const endpoint = `https://api.neoxr.eu/api/youtube?url=${encodeURIComponent(s.url)}&type=audio&quality=${encodeURIComponent(bitrate)}&apikey=${NEOXR_KEY}`;

    try {
      const meta = await axios.get(endpoint, { timeout: AXIOS_TIMEOUT_MS });
      const j = meta.data || {};
      if (!j.status) throw new Error(j.message || 'API error');

      // Cari field url hasil
      const downloadUrl = j.data?.url || j.data?.audio || j.result?.url || j.result;
      if (!downloadUrl) throw new Error('URL unduhan tidak ditemukan.');

      // Ambil buffer
      const file = await axios.get(downloadUrl, { responseType: 'arraybuffer', timeout: AXIOS_TIMEOUT_MS });
      const buf = Buffer.from(file.data);

      await sock.sendMessage(from, {
        audio: buf,
        mimetype: 'audio/mpeg',
        ptt: false
      }, { quoted: m });

      await sendReact(sock, from, m.key, '✅');
      // (Opsional) jangan clear biar user bisa ganti kualitas tanpa /yt ulang.
      return;
    } catch (e) {
      console.error('yt audio error:', e?.message || e);
      await sendReact(sock, from, m.key, '❌');
      return sock.sendMessage(from, { text: `❌ Gagal unduh audio.\nAlasan: ${e.message || e}` }, { quoted: m });
    }
  }

  // ========== STEP 3: /video [resolusi] ==========
  if (lower.startsWith('/video')) {
    await sendReact(sock, from, m.key, '⏳');

    const s = getSession(sender);
    if (!s) {
      await sendReact(sock, from, m.key, '❌');
      return sock.sendMessage(from, { text: '❌ Belum ada sesi aktif.\nKetik: /yt <link YouTube> dulu ya.' }, { quoted: m });
    }

    const parts = raw.split(/\s+/).slice(1);
    const quality = (parts[0] || VIDEO_QUALITY_DEFAULT).toLowerCase(); // 360p, 480p, 720p, ...

    const endpoint = `https://api.neoxr.eu/api/youtube?url=${encodeURIComponent(s.url)}&type=video&quality=${encodeURIComponent(quality)}&apikey=${NEOXR_KEY}`;

    try {
      const meta = await axios.get(endpoint, { timeout: AXIOS_TIMEOUT_MS });
      const j = meta.data || {};
      if (!j.status) throw new Error(j.message || 'API error');

      // Cari field url hasil
      const downloadUrl = j.data?.url || j.data?.video || j.result?.url || j.result;
      if (!downloadUrl) throw new Error('URL unduhan tidak ditemukan.');

      // Ambil buffer
      const file = await axios.get(downloadUrl, { responseType: 'arraybuffer', timeout: AXIOS_TIMEOUT_MS });
      const buf = Buffer.from(file.data);

      await sock.sendMessage(from, {
        video: buf,
        mimetype: 'video/mp4',
        caption: `✅ Video ${quality.toUpperCase()}`
      }, { quoted: m });

      await sendReact(sock, from, m.key, '✅');
      // (Opsional) tetap simpan sesi agar user bisa minta kualitas lain.
      return;
    } catch (e) {
      console.error('yt video error:', e?.message || e);
      await sendReact(sock, from, m.key, '❌');
      return sock.sendMessage(from, { text: `❌ Gagal unduh video.\nAlasan: ${e.message || e}` }, { quoted: m });
    }
  }

  // selain 3 command di atas: plugin ini diam
};
