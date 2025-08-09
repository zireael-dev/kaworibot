/**
 * plugins/yt.js
 * YouTube downloader interaktif (Video/Audio) pakai Neoxr API.
 * Default: VIDEO=480p, AUDIO=128kbps (ubah lewat konstanta di bawah).
 *
 * npm i axios
 */

const axios = require('axios');

// ==== KONFIG YANG MUDAH DIGANTI ====
const API_KEY = 'UCIELL';
const DEFAULT_VIDEO_QUALITY = '480p';
const DEFAULT_AUDIO_QUALITY = '128kbps';

// Simpan sesi pilihan per user
global.db = global.db || {};
global.db._ytSessions = global.db._ytSessions || {}; // { [senderJid]: { url, title, thumb, ts } }

function isYouTubeUrl(u = '') {
  return /(youtube\.com|youtu\.be)/i.test(u);
}

function parseArgs(raw) {
  // contoh:
  // "/yt https://..." -> { mode:null, quality:null, url:"https://..." }
  // "/yt video 720p https://..." -> { mode:"video", quality:"720p", url:"https://..." }
  // "/yt audio https://..." -> { mode:"audio", quality:null, url:"https://..." }
  const parts = raw.trim().split(/\s+/).slice(1); // buang /yt
  let mode = null, quality = null, url = null;

  // cari url (bagian yang mengandung youtube)
  for (let i = parts.length - 1; i >= 0; i--) {
    if (isYouTubeUrl(parts[i])) {
      url = parts[i];
      parts.splice(i, 1);
      break;
    }
  }

  // sisanya: mungkin mode & quality
  if (parts[0] && /^(video|audio)$/i.test(parts[0])) {
    mode = parts[0].toLowerCase();
    parts.shift();
  }
  if (parts[0]) {
    // quality bisa "720p" atau "128kbps"
    quality = parts[0].toLowerCase();
  }

  return { mode, quality, url };
}

async function fetchMeta(url) {
  const api = `https://api.neoxr.eu/api/yt-fetch?url=${encodeURIComponent(url)}&apikey=${API_KEY}`;
  const { data } = await axios.get(api, { timeout: 20000 });
  return data; // harapannya: { status:true, data:{ title, duration, channel, thumbnail,... } }
}

async function getVideo(url, quality) {
  const api = `https://api.neoxr.eu/api/youtube?url=${encodeURIComponent(url)}&type=video&quality=${encodeURIComponent(quality)}&apikey=${API_KEY}`;
  const { data } = await axios.get(api, { timeout: 30000 });
  return data; // harapannya: { status:true, data:{ url, ... } }
}

async function getAudio(url, quality) {
  const api = `https://api.neoxr.eu/api/youtube?url=${encodeURIComponent(url)}&type=audio&quality=${encodeURIComponent(quality)}&apikey=${API_KEY}`;
  const { data } = await axios.get(api, { timeout: 30000 });
  return data; // harapannya: { status:true, data:{ url, ... } }
}

function makeChoiceText(meta, usedPrefix = '/') {
  const t = meta?.data?.title || 'Video YouTube';
  const d = meta?.data?.duration ? `⏱️ Durasi: ${meta.data.duration}\n` : '';
  const c = meta?.data?.channel ? `👤 Channel: ${meta.data.channel}\n` : '';
  return [
    `📺 *${t}*`,
    d + c,
    `Pilih format:`,
    `• Ketik *video* (default ${DEFAULT_VIDEO_QUALITY})`,
    `• Ketik *audio* (default ${DEFAULT_AUDIO_QUALITY})`,
    ``,
    `_Tips:_ Kamu juga bisa langsung:`,
    `• *${usedPrefix}yt video 720p <link>*`,
    `• *${usedPrefix}yt audio 192kbps <link>*`
  ].join('\n');
}

module.exports = async (sock, m, text, from, watermark) => {
  const raw = (text || '').trim();
  const lower = raw.toLowerCase();

  // Cek tombol balasan
  const btn = m.message?.buttonsResponseMessage?.selectedButtonId || '';
  const simpleReply = m.message?.conversation?.trim().toLowerCase();

  // Prefix aktif
  const setting = global.db?.setting || {};
  const PREFIXES = setting.multiprefix ? (setting.prefix || ['/', '!']) : [setting.onlyprefix || '/'];
  const usedPrefix = PREFIXES.find(p => lower.startsWith(p + 'yt')) || '/';

  const isYTCommand = PREFIXES.some(p => lower.startsWith(p + 'yt'));
  const hasPending = !!global.db._ytSessions[(m.key.participant || m.key.remoteJid)];

  // 1) Handle follow-up pilihan (tombol atau balasan "video"/"audio")
  if (!isYTCommand && hasPending) {
    const session = global.db._ytSessions[(m.key.participant || m.key.remoteJid)];
    if (!session || Date.now() - session.ts > 3 * 60 * 1000) {
      delete global.db._ytSessions[(m.key.participant || m.key.remoteJid)];
      return;
    }

    let choice = null;
    if (/^yt_video/.test(btn) || simpleReply === 'video') choice = 'video';
    if (/^yt_audio/.test(btn) || simpleReply === 'audio') choice = 'audio';
    if (!choice) return; // bukan jawaban format

    await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

    try {
      if (choice === 'video') {
        const v = await getVideo(session.url, DEFAULT_VIDEO_QUALITY);
        if (!v.status) throw new Error(v.message || 'Gagal ambil video.');
        const fileUrl = v.data?.url;
        if (!fileUrl) throw new Error('URL video kosong.');

        // coba kirim video langsung
        try {
          await sock.sendMessage(from, {
            video: { url: fileUrl },
            caption: `🎬 *${session.title || 'Video'}*\nQuality: ${DEFAULT_VIDEO_QUALITY}\n\n${watermark}`
          }, { quoted: m });
        } catch (e) {
          await sock.sendMessage(from, {
            text: `⚠️ File terlalu besar untuk dikirim langsung.\nLink unduhan:\n${fileUrl}`
          }, { quoted: m });
        }
      } else {
        const a = await getAudio(session.url, DEFAULT_AUDIO_QUALITY);
        if (!a.status) throw new Error(a.message || 'Gagal ambil audio.');
        const fileUrl = a.data?.url;
        if (!fileUrl) throw new Error('URL audio kosong.');

        try {
          await sock.sendMessage(from, {
            audio: { url: fileUrl },
            mimetype: 'audio/mpeg',
            ptt: false,
            fileName: (session.title || 'audio') + '.mp3'
          }, { quoted: m });
        } catch (e) {
          await sock.sendMessage(from, {
            text: `⚠️ File terlalu besar untuk dikirim langsung.\nLink unduhan:\n${fileUrl}`
          }, { quoted: m });
        }
      }
    } catch (err) {
      console.error('yt follow-up error:', err.message);
      await sock.sendMessage(from, { text: `❌ ${err.message || 'Gagal memproses pilihan.'}` }, { quoted: m });
    } finally {
      delete global.db._ytSessions[(m.key.participant || m.key.remoteJid)];
    }
    return;
  }

  // 2) Hanya proses kalau /yt...
  if (!isYTCommand) return;

  // Parsing argumen
  const { mode, quality, url } = parseArgs(raw);

  // Jika mode+quality+url lengkap → langsung eksekusi tanpa sesi
  if (url && isYouTubeUrl(url) && (mode === 'video' || mode === 'audio')) {
    await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });
    try {
      if (mode === 'video') {
        const q = quality || DEFAULT_VIDEO_QUALITY;
        const v = await getVideo(url, q);
        if (!v.status) throw new Error(v.message || 'Gagal ambil video.');
        const fileUrl = v.data?.url;
        if (!fileUrl) throw new Error('URL video kosong.');
        try {
          await sock.sendMessage(from, {
            video: { url: fileUrl },
            caption: `🎬 Quality: ${q}\n\n${watermark}`
          }, { quoted: m });
        } catch {
          await sock.sendMessage(from, { text: `⚠️ Terlalu besar. Link unduhan:\n${fileUrl}` }, { quoted: m });
        }
      } else {
        const q = quality || DEFAULT_AUDIO_QUALITY;
        const a = await getAudio(url, q);
        if (!a.status) throw new Error(a.message || 'Gagal ambil audio.');
        const fileUrl = a.data?.url;
        if (!fileUrl) throw new Error('URL audio kosong.');
        try {
          await sock.sendMessage(from, {
            audio: { url: fileUrl },
            mimetype: 'audio/mpeg',
            ptt: false,
            fileName: 'audio.mp3'
          }, { quoted: m });
        } catch {
          await sock.sendMessage(from, { text: `⚠️ Terlalu besar. Link unduhan:\n${fileUrl}` }, { quoted: m });
        }
      }
    } catch (e) {
      console.error('yt direct error:', e.message);
      await sock.sendMessage(from, { text: `❌ ${e.message || 'Gagal memproses.'}` }, { quoted: m });
    }
    return;
  }

  // Jika user belum kasih URL → minta
  if (!url) {
    return sock.sendMessage(from, {
      text: `❓ Kirim seperti ini:\n*${usedPrefix}yt <link YouTube>*\n\nContoh:\n${usedPrefix}yt https://youtu.be/abcdef`
    }, { quoted: m });
  }

  // 3) Alur interaktif: /yt <url> → fetch meta → tanya pilihan + tombol
  if (!isYouTubeUrl(url)) {
    return sock.sendMessage(from, { text: '❌ Link YouTube tidak valid.' }, { quoted: m });
  }

  await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

  try {
    const meta = await fetchMeta(url);
    if (!meta.status) throw new Error(meta.message || 'Gagal ambil metadata.');

    // simpan sesi
    const sender = m.key.participant || m.key.remoteJid;
    global.db._ytSessions[sender] = {
      url,
      title: meta.data?.title || '',
      thumb: meta.data?.thumbnail || '',
      ts: Date.now()
    };

    // kirim prompt + tombol
    const textChoice = makeChoiceText(meta, usedPrefix);
    const buttons = [
      { buttonId: 'yt_video', buttonText: { displayText: `Video (${DEFAULT_VIDEO_QUALITY})` }, type: 1 },
      { buttonId: 'yt_audio', buttonText: { displayText: `Audio (${DEFAULT_AUDIO_QUALITY})` }, type: 1 }
    ];

    await sock.sendMessage(from, {
      text: textChoice,
      buttons,
      headerType: 1
    }, { quoted: m });
  } catch (e) {
    console.error('yt fetch meta error:', e.message);
    await sock.sendMessage(from, { text: `❌ ${e.message || 'Gagal ambil info video.'}` }, { quoted: m });
  }
};
