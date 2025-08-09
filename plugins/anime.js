/**
 * plugins/anime.kuronime.js
 * Search & detail anime via Kuronime (neoxr)
 *
 * Commands:
 *   /anime <query>      → cari anime
 *   /a <index>          → detail + daftar episode dari hasil terakhir di chat tsb
 *
 * Catatan:
 * - Simpan sesi per-chat di global.db.kuronime[chatId] = { results: [...] }
 * - Butuh: npm i axios
 */

const axios = require('axios');

const API_BASE = 'https://api.neoxr.eu/api/kuronime';
const APIKEY   = 'UCIELL'; // ganti kalau perlu
const MAX_SHOW = 10;       // jumlah hasil/episode yang ditampilkan per halaman

// util kecil
const b = (t) => `*${t}*`;
const LINE = '────────────────────';

module.exports = async (sock, m, text, from) => {
  const raw = (text || '').trim();
  const lower = raw.toLowerCase();

  // pastikan wadah db
  global.db = global.db || {};
  global.db.kuronime = global.db.kuronime || {};

  // ---- Trigger: /anime <query> ----
  if (lower.startsWith('/anime ')) {
    const query = raw.slice(7).trim();
    if (!query) {
      return sock.sendMessage(from, { text: '❌ Tulis judulnya. Contoh: /anime jujutsu kaisen' }, { quoted: m });
    }

    // react ⏳
    await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

    // call search
    try {
      const url = `${API_BASE}?q=${encodeURIComponent(query)}&apikey=${APIKEY}`;
      const resp = await axios.get(url, { timeout: 20000 });
      const json = resp.data;

      if (!json?.status || !Array.isArray(json.data) || json.data.length === 0) {
        return sock.sendMessage(from, { text: `❌ Tidak ada hasil untuk: ${query}` }, { quoted: m });
      }

      // simpan sesi
      global.db.kuronime[from] = {
        results: json.data,   // array { title, status, rating, url, ... }
        ts: Date.now()
      };

      // render list
      const list = json.data.slice(0, MAX_SHOW).map((it, i) => {
        const idx = i + 1;
        const rate = it.rating ? ` | ⭐ ${it.rating}` : '';
        const st = it.status ? ` • ${it.status}` : '';
        return `${idx}. ${b(it.title)}${st}${rate}`;
      }).join('\n');

      const more = json.data.length > MAX_SHOW ? `\n…dan ${json.data.length - MAX_SHOW} lainnya.` : '';

      const out = [
        `${b('Hasil pencarian:')} ${query}`,
        LINE,
        list,
        more,
        LINE,
        `Lihat detail: ketik */a <nomor>*\nContoh: */a 1*`
      ].join('\n');

      await sock.sendMessage(from, { text: out }, { quoted: m });
      return;
    } catch (e) {
      console.error('kuronime search error:', e?.message);
      return sock.sendMessage(from, { text: '❌ Gagal cari anime. Coba lagi sebentar.' }, { quoted: m });
    }
  }

  // ---- Trigger: /a <index> ----
  if (lower.startsWith('/a ')) {
    const arg = raw.slice(3).trim();
    const idx = parseInt(arg, 10);
    if (!idx || idx < 1) {
      return sock.sendMessage(from, { text: '❌ Format salah. Contoh: /a 1' }, { quoted: m });
    }

    const session = global.db.kuronime[from];
    if (!session || !Array.isArray(session.results) || session.results.length === 0) {
      return sock.sendMessage(from, { text: '❌ Tidak ada sesi pencarian.\nCari dulu: /anime <judul>' }, { quoted: m });
    }

    const item = session.results[idx - 1];
    if (!item) {
      return sock.sendMessage(from, { text: `❌ Nomor tidak valid. Pilih 1 s/d ${session.results.length}` }, { quoted: m });
    }

    // react ⏳
    await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

    // panggil detail pakai url= dari hasil search
    try {
      const detailURL = `${API_BASE}?url=${encodeURIComponent(item.url)}&apikey=${APIKEY}`;
      const resp = await axios.get(detailURL, { timeout: 25000 });
      const json = resp.data;

      if (!json?.status || !json.data) {
        return sock.sendMessage(from, { text: '❌ Gagal ambil detail anime.' }, { quoted: m });
      }

      const d = json.data;
      const title   = d.title || item.title || '-';
      const jp      = d.japanese ? `(${d.japanese})` : '';
      const info1   = [
        d.type ? `Tipe: ${d.type}` : '',
        d.status ? `Status: ${d.status}` : '',
        d.episode ? `Episode: ${d.episode}` : '',
        d.release ? `Rilis: ${d.release}` : '',
        d.studio ? `Studio: ${d.studio}` : '',
        d.rating ? `Rating: ${d.rating}` : ''
      ].filter(Boolean).join(' • ');

      const genres  = d.genre ? d.genre : '-';

      // daftar episode (format bisa bervariasi; aman-kan keduanya)
      // sebagian struktur: d.episodes = [{ name, lists: [{ episode, url }, ...] }, ...]
      // kita cari list yang mengandung link episode
      const epBuckets = Array.isArray(d.episodes) ? d.episodes : [];
      const flatEpisodes = [];
      for (const bucket of epBuckets) {
        const lists = bucket?.lists;
        if (Array.isArray(lists)) {
          for (const ep of lists) {
            // normalisasi: ambil nama & url
            const name = ep.episode || ep.name || ep.title || 'Episode';
            const url  = ep.url;
            if (url) flatEpisodes.push({ name, url });
          }
        }
      }

      let epText = 'Belum ada daftar episode.';
      if (flatEpisodes.length > 0) {
        const show = flatEpisodes.slice(0, MAX_SHOW).map((e, i) => `${i + 1}. ${e.name}`).join('\n');
        const more = flatEpisodes.length > MAX_SHOW ? `\n…dan ${flatEpisodes.length - MAX_SHOW} episode lainnya.` : '';
        epText = show + more;
      }

      const lines = [
        b(title) + (jp ? ` ${jp}` : ''),
        info1 || '-',
        `Genre: ${genres}`,
        LINE,
        b('Episode:'),
        epText,
        LINE,
        `Sumber: ${item.url}`,
        `Tips: copy link episode dari daftar di atas ke browser kalau mau streaming/download.`
      ].join('\n');

      await sock.sendMessage(from, { text: lines }, { quoted: m });
      return;
    } catch (e) {
      console.error('kuronime detail error:', e?.message);
      return sock.sendMessage(from, { text: '❌ Gagal ambil detail anime (network/api).' }, { quoted: m });
    }
  }
};
