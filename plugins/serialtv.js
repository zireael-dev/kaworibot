/**
 * plugins/series.movieku.js
 * Search & get TV series download links from movieku.fit, with details from TMDb.
 *
 * Commands:
 * /series <query>      → Cari serial TV
 * /seri <index>         → Detail + daftar episode (info dari TMDb)
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
const MAX_EPISODES_SHOW = 20; // Batas episode yang ditampilkan
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
    global.db.seriesku = global.db.seriesku || {};
}

/**
 * Mengambil data serial TV dan daftar episodenya dari The Movie Database (TMDb)
 * @param {string} seriesTitle Judul serial yang akan dicari.
 * @returns {object|null} Data serial dari TMDb atau null jika tidak ditemukan.
 */
async function getTMDbSeriesDetails(seriesTitle) {
    if (!TMDB_API_KEY || TMDB_API_KEY === 'GANTI_DENGAN_API_KEY_ANDA') {
        console.error("TMDb API Key belum diisi di dalam script.");
        return null;
    }
    try {
        let originalTitle = seriesTitle;
        // Ekstrak nomor season dari judul
        const seasonMatch = originalTitle.match(/season\s*(\d+)/i);
        const seasonNumber = seasonMatch ? parseInt(seasonMatch[1]) : 1;

        // Membersihkan judul dari embel-embel episode/end/season
        seriesTitle = seriesTitle
            .replace(/episode\s*\d{1,2}-\d{1,2}\s*end/i, '')
            .replace(/season\s*\d+/i, '')
            .trim();
        
        let year = '';
        const yearMatch = seriesTitle.match(/\((\d{4})\)/);
        if (yearMatch) {
            year = yearMatch[1];
            seriesTitle = seriesTitle.replace(yearMatch[0], '').trim();
        }

        const searchUrl = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(seriesTitle)}&language=id-ID&first_air_date_year=${year}`;
        const { data } = await client.get(searchUrl);

        if (data.results && data.results.length > 0) {
            const series = data.results[0];
            const seriesId = series.id;
            let episodes = [];

            try {
                // Ambil detail untuk season yang cocok
                const seasonDetailsUrl = `https://api.themoviedb.org/3/tv/${seriesId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}&language=id-ID`;
                const { data: seasonData } = await client.get(seasonDetailsUrl);
                if (seasonData.episodes) {
                    episodes = seasonData.episodes.map(ep => ({
                        number: ep.episode_number,
                        title: ep.name
                    }));
                }
            } catch (seasonError) {
                console.error(`Tidak bisa mengambil detail season ${seasonNumber} dari TMDb:`, seasonError.message);
            }

            return {
                title: series.name || seriesTitle,
                synopsis: series.overview || 'Sinopsis tidak tersedia dalam bahasa Indonesia.',
                poster: series.poster_path ? `https://image.tmdb.org/t/p/w500${series.poster_path}` : null,
                episodes: episodes
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
    const session = global.db.seriesku[from] || {};

    // Command: /series <query>
    if (lower.startsWith('/series ')) {
        const query = raw.slice(8).trim();
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Tulis judul seriesnya. Contoh: /series loki' }, { quoted: m });
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
                if (title && url && (title.toLowerCase().includes('episode') || title.toLowerCase().includes('season'))) {
                    results.push({ title, url });
                }
            });

            if (results.length === 0) {
                return sock.sendMessage(from, { text: `❌ Tidak ada hasil untuk: ${query}` }, { quoted: m });
            }

            global.db.seriesku[from] = { results, ts: Date.now() };

            const list = results.slice(0, MAX_SHOW).map((it, i) => `${i + 1}. ${b(it.title)}`).join('\n');
            const more = results.length > MAX_SHOW ? `\n…dan ${results.length - MAX_SHOW} lainnya.` : '';

            const out = [
                `${b('Hasil pencarian:')} ${query}`,
                LINE,
                list,
                more,
                LINE,
                `Lihat detail & episode: ketik */seri <nomor>* (contoh: */seri 1*)`
            ].join('\n');

            return sock.sendMessage(from, { text: out }, { quoted: m });
        } catch (e) {
            console.error('movieku series search error:', e.message);
            return sock.sendMessage(from, { text: '❌ Gagal mencari series (network/api). Coba lagi.' }, { quoted: m });
        }
    }

    // Command: /seri <index>
    if (lower.startsWith('/seri ')) {
        const idx = parseInt(raw.slice(5).trim(), 10);
        if (!idx || idx < 1) {
            return sock.sendMessage(from, { text: '❌ Format salah. Contoh: /seri 1' }, { quoted: m });
        }

        if (!session.results || session.results.length === 0) {
            return sock.sendMessage(from, { text: '❌ Tidak ada sesi pencarian.\nCari dulu: /series <judul>' }, { quoted: m });
        }

        const item = session.results[idx - 1];
        if (!item) {
            return sock.sendMessage(from, { text: `❌ Nomor tidak valid. Pilih 1 s/d ${session.results.length}` }, { quoted: m });
        }

        await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

        try {
            const [moviekuResponse, tmdbDetails] = await Promise.all([
                client.get(item.url),
                getTMDbSeriesDetails(item.title)
            ]);

            const { data: html } = moviekuResponse;
            const $ = cheerio.load(html);

            const title = tmdbDetails?.title || $('h1.entry-title').text().trim();
            const synopsis = tmdbDetails?.synopsis || $('div[itemprop="description"] p').map((i, el) => $(el).text()).get().join('\n\n').trim();
            const poster = tmdbDetails?.poster || $('img.ts-post-image').attr('src');
            const tmdbEpisodes = tmdbDetails?.episodes || [];

            const scrapedEpisodes = [];
            // FIX: Selector baru untuk halaman detail serial
            $('#smokeddl .smokeurl h3.smokettl').each((idx, el) => {
                const episodeTitleRaw = $(el).text().trim();
                const episodeNumberMatch = episodeTitleRaw.match(/episode\s*(\d+)/i);
                if (!episodeNumberMatch) return;

                const episodeNumber = parseInt(episodeNumberMatch[1]);
                const links = [];
                // Ambil semua paragraf <p> setelah <h3> sampai <h3> berikutnya
                $(el).nextUntil('h3.smokettl', 'p').find('a').each((a_idx, a_el) => {
                    const provider = $(a_el).text().trim();
                    const link = $(a_el).attr('href');
                    if (provider && link) {
                        links.push({ provider, link });
                    }
                });

                if (links.length > 0) {
                    scrapedEpisodes.push({ number: episodeNumber, links });
                }
            });

            let linksText = '';
            if (scrapedEpisodes.length > 0) {
                const episodesToShow = scrapedEpisodes.slice(0, MAX_EPISODES_SHOW);

                for (const scrapedEp of episodesToShow) {
                    const tmdbEp = tmdbEpisodes.find(t => t.number === scrapedEp.number);
                    const episodeTitle = (tmdbEp && tmdbEp.title && tmdbEp.title.toLowerCase() !== `episode ${scrapedEp.number}`) 
                        ? tmdbEp.title 
                        : `Episode ${String(scrapedEp.number).padStart(2, '0')}`;
                    
                    linksText += `${b(`${scrapedEp.number}. ${episodeTitle}`)}\n`;

                    const linksByQuality = {};
                    scrapedEp.links.forEach(l => {
                        const match = l.provider.match(/(\d{3,4}p)/i);
                        const quality = match ? match[1].toUpperCase() : 'Lainnya';
                        if (!linksByQuality[quality]) {
                            linksByQuality[quality] = [];
                        }
                        linksByQuality[quality].push(l);
                    });

                    const sortedQualities = Object.keys(linksByQuality).sort((a, b) => (parseInt(b) || 0) - (parseInt(a) || 0));
                    
                    for (const quality of sortedQualities) {
                        linksText += `${i(quality)}: `;
                        linksText += linksByQuality[quality].map(link => `${link.provider}`).join(', ');
                        linksText += '\n';
                    }
                    linksText += '\n';
                }

                if (scrapedEpisodes.length > MAX_EPISODES_SHOW) {
                    linksText += `...dan ${scrapedEpisodes.length - MAX_EPISODES_SHOW} episode lainnya.`;
                }
            } else {
                linksText = 'Daftar episode tidak ditemukan.';
            }

            const out = [
                b(title),
                i(synopsis),
                LINE,
                linksText.trim()
            ].join('\n\n');

            if (poster) {
                await sock.sendMessage(from, {
                    text: out,
                    contextInfo: {
                        externalAdReply: {
                            title: title,
                            body: "Sinopsis & Daftar Episode",
                            thumbnailUrl: poster,
                            sourceUrl: item.url,
                            mediaType: 1,
                            renderLargerThumbnail: true
                        }
                    }
                }, { quoted: m });
            } else {
                await sock.sendMessage(from, { text: out }, { quoted: m });
            }

        } catch (e) {
            console.error('movieku series detail error:', e.message);
            return sock.sendMessage(from, { text: '❌ Gagal mengambil detail series (network/api).' }, { quoted: m });
        }
    }
};
