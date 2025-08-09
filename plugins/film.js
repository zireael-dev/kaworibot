/**
 * plugins/movie.movieku.js
 * Search & get movie download links from movieku.fit, with details from TMDb.
 *
 * Commands:
 * /film <query>        → Cari film
 * /f <index>            → Detail + link ke halaman download (info dari TMDb)
 *
 * Note:
 * - Target: movieku.fit (untuk link), themoviedb.org (untuk detail)
 * - Butuh: npm i axios cheerio
 * - Anda WAJIB mengisi TMDB_API_KEY di bawah ini.
 */

const axios = require('axios');
const cheerio = require('cheerio');

// --- KONFIGURASI ---
const TMDB_API_KEY = '6c6e6a890d39cfe40a8d8e22c81de2b3'; // <-- WAJIB DIISI!
const BASE_URL = 'https://movieku.fit';
const MAX_SHOW = 10;
// --- ---

const b = (t) => `*${t}*`;
const i = (t) => `_${t}_`;
const c = (t) => `\`\`\`${t}\`\`\``;
const LINE = '────────────────────';

// Helper untuk request dengan User-Agent standar
const client = axios.create({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
    },
    timeout: 30000
});

function ensureDB() {
    global.db = global.db || {};
    global.db.movieku = global.db.movieku || {};
}

/**
 * Mengambil data film dari The Movie Database (TMDb)
 * @param {string} movieTitle Judul film yang akan dicari.
 * @returns {object|null} Data film dari TMDb atau null jika tidak ditemukan.
 */
async function getTMDbDetails(movieTitle) {
    if (!TMDB_API_KEY || TMDB_API_KEY === 'GANTI_DENGAN_API_KEY_ANDA') {
        console.error("TMDb API Key belum diisi di dalam script.");
        return null;
    }
    try {
        // Ekstrak tahun dari judul jika ada (misal: "Godzilla (2014)")
        let year = '';
        const yearMatch = movieTitle.match(/\((\d{4})\)/);
        if (yearMatch) {
            year = yearMatch[1];
            movieTitle = movieTitle.replace(yearMatch[0], '').trim();
        }

        const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(movieTitle)}&language=id-ID&year=${year}`;
        const { data } = await client.get(searchUrl);

        if (data.results && data.results.length > 0) {
            const movie = data.results[0];
            return {
                synopsis: movie.overview || 'Sinopsis tidak tersedia dalam bahasa Indonesia.',
                poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null
            };
        }
        return null;
    } catch (error) {
        console.error("Gagal mengambil data dari TMDb:", error.message);
        return null;
    }
}


module.exports = async (sock, m, text, from) => {
    ensureDB();
    const raw = (text || '').trim();
    const lower = raw.toLowerCase();
    const session = global.db.movieku[from] || {};

    // Command: /film <query>
    if (lower.startsWith('/film ')) {
        const query = raw.slice(6).trim();
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Tulis judul filmnya. Contoh: /film godzilla' }, { quoted: m });
        }

        await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

        try {
            const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
            const { data: html } = await client.get(searchUrl);
            const $ = cheerio.load(html);

            const results = [];
            $('article.box').each((idx, el) => {
                const linkElement = $(el).find('a.tip');
                const title = linkElement.attr('title');
                const url = linkElement.attr('href');
                if (title && url) {
                    results.push({ title, url });
                }
            });

            if (results.length === 0) {
                return sock.sendMessage(from, { text: `❌ Tidak ada hasil untuk: ${query}` }, { quoted: m });
            }

            global.db.movieku[from] = { results, ts: Date.now() };

            const list = results.slice(0, MAX_SHOW).map((it, i) => `${i + 1}. ${b(it.title)}`).join('\n');
            const more = results.length > MAX_SHOW ? `\n…dan ${results.length - MAX_SHOW} lainnya.` : '';

            const out = [
                `${b('Hasil pencarian:')} ${query}`,
                LINE,
                list,
                more,
                LINE,
                `Lihat detail & link: ketik */f <nomor>* (contoh: */f 1*)`
            ].join('\n');

            return sock.sendMessage(from, { text: out }, { quoted: m });
        } catch (e) {
            console.error('movieku search error:', e.message);
            return sock.sendMessage(from, { text: '❌ Gagal mencari film (network/api). Coba lagi.' }, { quoted: m });
        }
    }

    // Command: /f <index>
    if (lower.startsWith('/f ')) {
        const idx = parseInt(raw.slice(3).trim(), 10);
        if (!idx || idx < 1) {
            return sock.sendMessage(from, { text: '❌ Format salah. Contoh: /f 1' }, { quoted: m });
        }

        if (!session.results || session.results.length === 0) {
            return sock.sendMessage(from, { text: '❌ Tidak ada sesi pencarian.\nCari dulu: /film <judul>' }, { quoted: m });
        }

        const item = session.results[idx - 1];
        if (!item) {
            return sock.sendMessage(from, { text: `❌ Nomor tidak valid. Pilih 1 s/d ${session.results.length}` }, { quoted: m });
        }

        await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

        try {
            // Ambil data dari movieku (untuk link) dan TMDb (untuk detail) secara bersamaan
            const [moviekuResponse, tmdbDetails] = await Promise.all([
                client.get(item.url),
                                                                     getTMDbDetails(item.title)
            ]);

            const { data: html } = moviekuResponse;
            const $ = cheerio.load(html);

            const title = $('h1.entry-title').text().trim();

            // Prioritaskan data dari TMDb, jika gagal gunakan data dari movieku
            const synopsis = tmdbDetails?.synopsis || $('div[itemprop="description"] p').map((i, el) => $(el).text()).get().join('\n\n').trim();
            const poster = tmdbDetails?.poster || $('img.attachment-post-thumbnail').attr('src');

            const linksByQuality = {};
            $('#smokeddl .smokeurl p').each((idx, el) => {
                const quality = $(el).find('strong').text().trim();
                if (quality) {
                    linksByQuality[quality] = [];
                    $(el).find('a').each((a_idx, a_el) => {
                        const provider = $(a_el).text().trim();
                        const link = $(a_el).attr('href');
                        if (provider && link) {
                            linksByQuality[quality].push({ provider, link });
                        }
                    });
                }
            });

            let linksText = '';
            if (Object.keys(linksByQuality).length > 0) {
                for (const quality in linksByQuality) {
                    linksText += `${b(quality)}\n`;
                    const links = linksByQuality[quality].map(l => `• ${l.provider}: ${l.link}`).join('\n');
                    linksText += `${links}\n\n`;
                }
            } else {
                linksText = 'Link download tidak ditemukan.';
            }

            const out = [
                b(title),
                i(synopsis),
                LINE,
                linksText.trim()
            ].join('\n\n');

            // Jika ada poster, kirim pesan dengan Rich Preview. Jika tidak, kirim teks biasa.
            if (poster) {
                await sock.sendMessage(from, {
                    text: out,
                    contextInfo: {
                        externalAdReply: {
                            title: title,
                            body: "Sinopsis & Link Download",
                            thumbnailUrl: poster,
                            sourceUrl: item.url, // URL saat preview diklik
                            mediaType: 1, // 1 untuk gambar
                            renderLargerThumbnail: true
                        }
                    }
                }, { quoted: m });
            } else {
                await sock.sendMessage(from, { text: out }, { quoted: m });
            }

        } catch (e) {
            console.error('movieku detail error:', e.message);
            return sock.sendMessage(from, { text: '❌ Gagal mengambil detail film (network/api).' }, { quoted: m });
        }
    }
};
