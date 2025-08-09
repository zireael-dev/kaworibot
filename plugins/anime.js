/**
 * plugins/anime.js (revisi)
 * Flow:
 *   /anime <query>   -> list hasil
 *   /a <n>           -> detail judul n & daftar episode (urut 1..N)
 *   /ad <n> [480p]   -> ambil link unduh episode n (default 480p)
 *
 * API: otakudesu / otakudesu-get / otakudesu-dl (neoxr)
 */

const axios = require('axios');
const APIKEY = 'UCIELL';

const SESSION = {}; // per-chat state

// --- util: ambil group "Episode List" dan flatten jadi array episode ---
function extractEpisodesFromGet(json) {
    const groups = json?.data?.episodes;
    if (!Array.isArray(groups)) return [];

    // cari group yang mengandung "Episode List"
    let listGroup = groups.find(g => typeof g?.name === 'string' && /episode list/i.test(g.name));
    // fallback: gabung semua lists yang url-nya /episode/
    let lists = [];
    if (listGroup?.lists) {
        lists = listGroup.lists;
    } else {
        for (const g of groups) {
            if (Array.isArray(g?.lists)) {
                lists.push(...g.lists.filter(x => /\/episode\//i.test(String(x?.url || ''))));
            }
        }
    }
    // map minimal: {title, url}
    const episodes = lists
    .filter(v => v?.url)
    .map(v => ({ title: v.episode || v.title || v.name || '(tanpa judul)', url: v.url }));

    // urutkan 1..N berdasarkan angka yang muncul di title
    // fallback kalau ga ketemu angka: biarin urutan asli
    const withNum = episodes.map((e, idx) => {
        const m = String(e.title).match(/episode\s*(\d+)/i) || String(e.title).match(/\b(\d+)\b/);
        return { ...e, _num: m ? parseInt(m[1], 10) : null, _idx: idx };
    });

    // sort by _num asc (null taruh belakang), kalau sama pakai index
    withNum.sort((a, b) => {
        if (a._num == null && b._num == null) return a._idx - b._idx;
        if (a._num == null) return 1;
        if (b._num == null) return -1;
        return a._num - b._num || a._idx - b._idx;
    });

    return withNum.map(({ _num, _idx, ...rest }) => rest);
}

function fmtList(arr, mapLine) {
    return arr.map((v, i) => `${String(i+1).padStart(2, '0')}. ${mapLine(v, i)}`).join('\n');
}

module.exports = async (sock, m, text, from) => {
    const raw = (text || '').trim();
    const lc  = raw.toLowerCase();

    // ===== /anime <query> =====
    if (lc.startsWith('/anime ')) {
        const q = raw.slice(7).trim();
        if (!q) {
            return sock.sendMessage(from, { text: '❌ Format: /anime <judul>\nContoh: /anime jujutsu kaisen' }, { quoted: m });
        }

        await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

        try {
            const url = `https://api.neoxr.eu/api/otakudesu?q=${encodeURIComponent(q)}&apikey=${APIKEY}`;
            const { data: json } = await axios.get(url, { timeout: 20000 });

            if (!json?.status || !Array.isArray(json.data) || json.data.length === 0) {
                return sock.sendMessage(from, { text: `❌ Tidak ditemukan hasil untuk "${q}".` }, { quoted: m });
            }

            SESSION[from] = SESSION[from] || {};
            SESSION[from].search = json.data;

            const listText =
            `🔎 Hasil untuk: *${q}*\n` +
            fmtList(json.data, (v) => `*${v.title}*\n   Genre: ${v.genre}\n   Status: ${v.status}\n   Rating: ${v.rating}`);

            const guide =
            `\nPilih judul: */a <nomor>*\nContoh: */a 1*`;

            await sock.sendMessage(from, { text: listText + guide }, { quoted: m });
        } catch (e) {
            console.error('otakudesu search error:', e.message);
            return sock.sendMessage(from, { text: '❌ Gagal mencari anime. Coba lagi ya.' }, { quoted: m });
        }
        return;
    }

    // ===== /a <n> -> detail judul & daftar episode urut 1..N =====
    if (lc.startsWith('/a ')) {
        const n = parseInt(raw.slice(3).trim(), 10);
        const pool = SESSION[from]?.search;
        if (!pool || !Number.isInteger(n) || n < 1 || n > pool.length) {
            return sock.sendMessage(from, { text: '❌ Pilihan tidak valid.\nGunakan /anime <judul> lalu /a <nomor>.' }, { quoted: m });
        }

        const chosen = pool[n - 1];
        const detailUrl = chosen.url; // pakai persis dari search

        await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

        try {
            const api = `https://api.neoxr.eu/api/otakudesu-get?url=${encodeURIComponent(detailUrl)}&apikey=${APIKEY}`;
            const { data: json } = await axios.get(api, { timeout: 20000 });

            if (!json?.status) {
                return sock.sendMessage(from, { text: `❌ Gagal ambil detail anime.\n(${json?.msg || 'unknown error'})` }, { quoted: m });
            }

            const eps = extractEpisodesFromGet(json);
            if (!eps.length) {
                return sock.sendMessage(from, { text: '❌ Episode tidak ditemukan untuk judul ini.' }, { quoted: m });
            }

            SESSION[from].detail = { title: chosen.title || 'Judul', episodes: eps };

            const view = eps.slice(0, 50);
            const listText =
            `📺 *${chosen.title}*\n` +
            `Total episode: *${eps.length}* (urut 1 → terbaru)\n\n` +
            fmtList(view, (e) => e.title || '(tanpa judul)');

            const guide =
            `\nUnduh: */ad <no> [quality]*  (default 480p)\n` +
            `Contoh: */ad 1*  atau  */ad 10 720p*\n` +
            `_List ditampilkan 50 pertama agar tidak kepanjangan._`;

            await sock.sendMessage(from, { text: listText + guide }, { quoted: m });
        } catch (e) {
            console.error('otakudesu-get error:', e.message);
            return sock.sendMessage(from, { text: '❌ Gagal ambil detail anime. Coba lagi ya.' }, { quoted: m });
        }
        return;
    }

    // ===== /ad <n> [quality] -> link unduh episode =====
    if (lc.startsWith('/ad ')) {
        const [nStr, qStr] = raw.slice(4).trim().split(/\s+/, 2);
        const n = parseInt(nStr, 10);
        const quality = (qStr || '480p').toLowerCase();

        const detail = SESSION[from]?.detail;
        if (!detail) {
            return sock.sendMessage(from, { text: '❌ Belum ada sesi. Mulai dengan /anime <judul> lalu /a <nomor>.' }, { quoted: m });
        }
        const eps = detail.episodes;
        if (!Number.isInteger(n) || n < 1 || n > eps.length) {
            return sock.sendMessage(from, { text: '❌ Nomor episode tidak valid.' }, { quoted: m });
        }

        const ep = eps[n - 1];
        const epUrl = ep.url;
        if (!epUrl) {
            return sock.sendMessage(from, { text: '❌ Episode tidak punya URL valid.' }, { quoted: m });
        }

        await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

        try {
            const api = `https://api.neoxr.eu/api/otakudesu-dl?url=${encodeURIComponent(epUrl)}&quality=${encodeURIComponent(quality)}&apikey=${APIKEY}`;
            const { data: json } = await axios.get(api, { timeout: 25000 });

            if (!json?.status) {
                return sock.sendMessage(from, { text: `❌ Gagal ambil link unduh.\n(${json?.msg || 'unknown error'})` }, { quoted: m });
            }

            // dari contoh raw: data = { filename, size, url }
            const d = json.data || {};
            const text =
            `✅ *Link Unduh*\n` +
            `Judul   : ${detail.title}\n` +
            `Episode : ${n}\n` +
            `Quality : ${quality}\n` +
            (d.size ? `Size    : ${d.size}\n` : '') +
            (d.filename ? `File    : ${d.filename}\n` : '') +
            `URL     : ${d.url || '(tidak tersedia)'}\n\n` +
            `Jika link mati, coba kualitas lain: 360p / 480p / 720p.`;

            await sock.sendMessage(from, { text }, { quoted: m });
        } catch (e) {
            console.error('otakudesu-dl error:', e.message);
            return sock.sendMessage(from, { text: '❌ Gagal mengambil link unduh episode.' }, { quoted: m });
        }
    }
};
