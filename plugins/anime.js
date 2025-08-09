/**
 * plugins/anime.animebatch.js
 * Search & detail anime via Animebatch (neoxr)
 *
 * Commands:
 *   /anime <query>          → cari anime
 *   /a <index>              → detail + daftar episode ringkas dari hasil terakhir di chat tsb
 *   /al <epIndex> [quality] → link server utk 1 episode (default 480P)
 *
 * Catatan:
 * - Simpan sesi per-chat di global.db.animebatch[chatId] = { results, detail }
 * - Quality yang tersedia biasanya: 1080P, 720P, 480P, 360P, 240P
 * - Butuh: npm i axios
 */

const axios = require('axios');

const API_SEARCH = 'https://api.neoxr.eu/api/anime';
const API_GET    = 'https://api.neoxr.eu/api/anime-get';
const APIKEY     = 'UCIELL';    // ganti kalau perlu
const MAX_SHOW   = 10;          // jumlah hasil/episode yang ditampilkan
const DEFAULT_QUALITY = '480P'; // ubah sewaktu-waktu

const b = (t) => `*${t}*`;
const LINE = '────────────────────';

function ensureDB() {
  global.db = global.db || {};
  global.db.animebatch = global.db.animebatch || {};
}

module.exports = async (sock, m, text, from) => {
  ensureDB();
  const raw = (text || '').trim();
  const lower = raw.toLowerCase();

  // /anime <query>
  if (lower.startsWith('/anime ')) {
    const query = raw.slice(7).trim();
    if (!query) {
      return sock.sendMessage(from, { text: '❌ Tulis judulnya. Contoh: /anime jujutsu kaisen' }, { quoted: m });
    }

    await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

    try {
      const url = `${API_SEARCH}?q=${encodeURIComponent(query)}&apikey=${APIKEY}`;
      const { data: json } = await axios.get(url, { timeout: 20000 });

      if (!json?.status || !Array.isArray(json.data) || json.data.length === 0) {
        return sock.sendMessage(from, { text: `❌ Tidak ada hasil untuk: ${query}` }, { quoted: m });
      }

      global.db.animebatch[from] = {
        results: json.data, // [{ title, score, type, url }]
        detail: null,
        ts: Date.now()
      };

      const list = json.data.slice(0, MAX_SHOW).map((it, i) => {
        const idx = i + 1;
        const type = it.type ? ` • ${it.type}` : '';
        const score = it.score ? ` • ⭐ ${it.score}` : '';
        return `${idx}. ${b(it.title)}${type}${score}`;
      }).join('\n');
      const more = json.data.length > MAX_SHOW ? `\n…dan ${json.data.length - MAX_SHOW} lainnya.` : '';

      const out = [
        `${b('Hasil pencarian:')} ${query}`,
        LINE,
        list,
        more,
        LINE,
        `Lihat detail: ketik */a <nomor>*  (contoh: */a 1*)`
      ].join('\n');

      return sock.sendMessage(from, { text: out }, { quoted: m });
    } catch (e) {
      console.error('animebatch search error:', e?.message);
      return sock.sendMessage(from, { text: '❌ Gagal cari anime (network/api). Coba lagi ya.' }, { quoted: m });
    }
  }

  // /a <index> → ambil detail + daftar episode ringkas
  if (lower.startsWith('/a ')) {
    const arg = raw.slice(3).trim();
    const idx = parseInt(arg, 10);
    if (!idx || idx < 1) {
      return sock.sendMessage(from, { text: '❌ Format salah. Contoh: /a 1' }, { quoted: m });
    }

    const session = global.db.animebatch[from];
    if (!session || !Array.isArray(session.results) || session.results.length === 0) {
      return sock.sendMessage(from, { text: '❌ Tidak ada sesi pencarian.\nCari dulu: /anime <judul>' }, { quoted: m });
    }

    const item = session.results[idx - 1];
    if (!item) {
      return sock.sendMessage(from, { text: `❌ Nomor tidak valid. Pilih 1 s/d ${session.results.length}` }, { quoted: m });
    }

    await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

    try {
      const detailURL = `${API_GET}?url=${encodeURIComponent(item.url)}&apikey=${APIKEY}`;
      const { data: json } = await axios.get(detailURL, { timeout: 25000 });

      if (!json?.status || !json.data) {
        return sock.sendMessage(from, { text: '❌ Gagal ambil detail anime.' }, { quoted: m });
      }

      const d = json.data;
      // simpan detail penuh ke sesi
      session.detail = d;

      const title = d.title || item.title || '-';
      const info = [
        d.type && `Tipe: ${d.type}`,
        d.status && `Status: ${d.status}`,
        d.release && `Rilis: ${d.release}`,
        d.studio && `Studio: ${d.studio}`,
        d.duration && `Durasi: ${d.duration}`,
        (d.score && d.score !== 'N/A') && `Skor: ${d.score}`
      ].filter(Boolean).join(' • ') || '-';

      // ambil episode list (array of { episode, link: [{quality, url: [{server,url}...]}...] })
      const eps = Array.isArray(d.episode) ? d.episode : [];
      let epText = 'Belum ada daftar episode.';
      if (eps.length > 0) {
        const show = eps.slice(0, MAX_SHOW).map((e, i) => {
          // deteksi quality yang tersedia pada episode ini
          const qualities = Array.isArray(e.link) ? e.link.map(q => q.quality).filter(Boolean) : [];
          const qStr = qualities.length ? ` [${qualities.join(', ')}]` : '';
          return `${i + 1}. ${e.episode || 'Episode'}${qStr}`;
        }).join('\n');
        const more = eps.length > MAX_SHOW ? `\n…dan ${eps.length - MAX_SHOW} episode lainnya.` : '';
        epText = show + more;
      }

      const lines = [
        b(title),
        info,
        d.genre ? `Genre: ${d.genre}` : '',
        LINE,
        b('Episode (ringkas):'),
        epText,
        LINE,
        `Lihat link server utk satu episode:`,
        `• ${b('/al <nomor_ep> [quality]')}  (default ${DEFAULT_QUALITY})`,
        `Contoh: /al 3 720P   atau   /al 5`
      ].filter(Boolean).join('\n');

      return sock.sendMessage(from, { text: lines }, { quoted: m });
    } catch (e) {
      console.error('animebatch detail error:', e?.message);
      return sock.sendMessage(from, { text: '❌ Gagal ambil detail anime (network/api).' }, { quoted: m });
    }
  }

  // /al <epIndex> [quality] → tampilkan daftar link server utk satu episode
  if (lower.startsWith('/al ')) {
    const parts = raw.slice(4).trim().split(/\s+/);
    const epIdx = parseInt(parts[0], 10);
    const wantedQuality = (parts[1] || DEFAULT_QUALITY).toUpperCase();

    if (!epIdx || epIdx < 1) {
      return sock.sendMessage(from, { text: `❌ Format salah.\nContoh: /al 4 ${DEFAULT_QUALITY}` }, { quoted: m });
    }

    const session = global.db.animebatch[from];
    const d = session?.detail;
    if (!d || !Array.isArray(d.episode) || d.episode.length === 0) {
      return sock.sendMessage(from, { text: '❌ Belum ada detail anime aktif.\nJalankan /a <nomor> dulu.' }, { quoted: m });
    }

    const ep = d.episode[epIdx - 1];
    if (!ep) {
      return sock.sendMessage(from, { text: `❌ Nomor episode tidak valid. Pilih 1 s/d ${d.episode.length}` }, { quoted: m });
    }

    // cari quality block yang cocok
    const qBlocks = Array.isArray(ep.link) ? ep.link : [];
    // prioritas: quality yang diminta → fallback ke 480P → 720P → pertama yang ada
    let qBlock = qBlocks.find(q => (q.quality || '').toUpperCase() === wantedQuality);
    if (!qBlock) qBlock = qBlocks.find(q => (q.quality || '').toUpperCase() === DEFAULT_QUALITY);
    if (!qBlock) qBlock = qBlocks.find(q => (q.quality || '').toUpperCase() === '720P') || qBlocks[0];

    if (!qBlock) {
      return sock.sendMessage(from, { text: '❌ Tidak menemukan daftar link untuk episode ini.' }, { quoted: m });
    }

    const links = Array.isArray(qBlock.url) ? qBlock.url : [];
    if (links.length === 0) {
      return sock.sendMessage(from, { text: '❌ Link kosong untuk quality tsb.' }, { quoted: m });
    }

    const header = `${b(ep.episode || `Episode ${epIdx}`)} • Quality: ${qBlock.quality || '-'}\n${LINE}`;
    const body = links.map((x, i) => `• ${x.server || 'Server'}: ${x.url}`).join('\n');

    const hintQual = `\n\nGanti quality: /al ${epIdx} 720P  (opsi umum: 1080P, 720P, 480P, 360P, 240P)`;
    return sock.sendMessage(from, { text: header + '\n' + body + hintQual }, { quoted: m });
  }
};
