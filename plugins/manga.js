/**
 * plugins/manga.js
 * Cari manga (Komikcast), lihat detail, pilih baca di chat / link, dan list full chapter (paginated).
 *
 * Command:
 *   /manga <judul>           -> cari
 *   /m <nomor>               -> buka detail hasil pencarian + simpan list chapter ascending (chapter 1 = index 1)
 *   /chapters [page]         -> tampilkan daftar chapter lengkap per halaman (default 1)
 *   /c <nomor>               -> render halaman chapter di chat (dibatasi MAX_PAGES)
 *   /cl <nomor>              -> kirim link chapter saja (tanpa render)
 *
 * Dependensi: npm i axios
 */

const axios = require('axios');

// ======= CONFIG =======
const API_KEY     = 'UCIELL';
const MAX_PAGES   = 20;   // batas halaman yang dikirim agar chat tidak banjir
const DELAY_MS    = 500;  // jeda antar pengiriman gambar
const PAGE_SIZE   = 30;   // jumlah chapter per halaman saat menampilkan /chapters

// helper delay
const delay = (ms) => new Promise(r => setTimeout(r, ms));

function ensureDb() {
    global.db = global.db || {};
    global.db.mangaSessions = global.db.mangaSessions || {}; // per chat
}
function getSession(chatId) {
    ensureDb();
    if (!global.db.mangaSessions[chatId]) {
        global.db.mangaSessions[chatId] = {
            lastSearch: [],        // [{title,url}]
            chaptersAsc: [],       // [{title,url}] urutan naik (chapter 1 paling atas)
            lastDetailTitle: '',   // judul komik terakhir
            lastSourceUrl: ''      // URL detail komik terakhir
        };
    }
    return global.db.mangaSessions[chatId];
}

// Normalisasi daftar chapter -> ASCENDING (chapter 1 = index 0)
function normalizeChapters(rawChapters = []) {
    const mapped = rawChapters
    .map(c => ({
        title: c.title || c.nama || c.judul || '',
        url: c.url || c.link || ''
    }))
    .filter(c => c.url);

    if (mapped.length <= 1) return mapped;

    // Kebanyakan API return terbaru dulu (descending), kita balikin jadi ascending:
    // Cara simple & aman: reverse.
    // (Jika suatu saat butuh deteksi pintar, bisa parse angka chapter dari title dan sort numerik.)
    return mapped.slice().reverse();
}

module.exports = async (sock, m, text, from) => {
    const raw   = (text || '').trim();
    const lower = raw.toLowerCase();

    const isSearch   = lower.startsWith('/manga ');
    const isOpen     = lower.startsWith('/m ');
    const isChapters = lower.startsWith('/chapters');
    const isReadChat = lower.startsWith('/c ');   // render di chat
    const isReadLink = lower.startsWith('/cl ');  // link saja

    if (!isSearch && !isOpen && !isChapters && !isReadChat && !isReadLink) return;

    // react start
    try { await sock.sendMessage(from, { react: { text: '⏳', key: m.key } }); } catch {}

    const session = getSession(from);

    try {
        // ==================== /manga <query> ====================
        if (isSearch) {
            const q = raw.slice(7).trim();
            if (!q) {
                await sock.sendMessage(from, { text: '❌ Format: /manga <judul>' }, { quoted: m });
                return;
            }
            const url = `https://api.neoxr.eu/api/comic?q=${encodeURIComponent(q)}&apikey=${API_KEY}`;
            const { data } = await axios.get(url);

            if (!data?.status || !Array.isArray(data?.data) || data.data.length === 0) {
                await sock.sendMessage(from, { text: '⚠️ Tidak ditemukan. Coba judul lain ya.' }, { quoted: m });
                return;
            }

            const list = data.data.slice(0, 10).map(v => ({ title: v.title || v.judul || 'Tanpa Judul', url: v.url }));
            session.lastSearch     = list;
            session.chaptersAsc    = [];
            session.lastDetailTitle= '';
            session.lastSourceUrl  = '';

            const out = [];
            out.push(`🔎 *Hasil pencarian "${q}"*`);
            out.push('');
            list.forEach((v, i) => {
                out.push(`${i + 1}. ${v.title}`);
                out.push(`   ${v.url}`);
            });
            out.push('');
            out.push('➡️ Lanjut: */m <nomor>* untuk lihat detail & daftar chapter (ascending).');
            out.push('Contoh: */m 1*');

            await sock.sendMessage(from, { text: out.join('\n') }, { quoted: m });
            await sock.sendMessage(from, { react: { text: '✅', key: m.key } });
            return;
        }

        // ==================== /m <index> ====================
        if (isOpen) {
            const idx = parseInt(raw.slice(2).trim(), 10);
            if (isNaN(idx) || idx < 1 || idx > (session.lastSearch?.length || 0)) {
                await sock.sendMessage(from, { text: '❌ Nomor tidak valid atau belum ada hasil. Cari dulu: */manga <judul>*' }, { quoted: m });
                return;
            }

            const pick = session.lastSearch[idx - 1];
            const url  = `https://api.neoxr.eu/api/comic-get?url=${encodeURIComponent(pick.url)}&apikey=${API_KEY}`;
            const { data } = await axios.get(url);

            if (!data?.status || !data?.data) {
                await sock.sendMessage(from, { text: '⚠️ Gagal mengambil detail komik.' }, { quoted: m });
                return;
            }

            const chaptersRaw = data.data.chapters || data.data.chapter || data.data.list || [];
            const chaptersAsc = normalizeChapters(chaptersRaw);

            session.chaptersAsc     = chaptersAsc;
            session.lastDetailTitle = data.data.title || pick.title;
            session.lastSourceUrl   = pick.url;

            const lines = [];
            lines.push(`📖 *${session.lastDetailTitle}*`);
            if (data.data.status) lines.push(`Status: ${data.data.status}`);
            if (data.data.genre && Array.isArray(data.data.genre)) lines.push(`Genre: ${data.data.genre.join(', ')}`);
            if (data.data.synopsis) {
                const syn = String(data.data.synopsis).replace(/\s+/g, ' ').trim();
                lines.push('');
                lines.push(`_Sinopsis:_ ${syn.length > 300 ? syn.slice(0, 300) + '…' : syn}`);
            }

            lines.push('');
            if (chaptersAsc.length === 0) {
                lines.push('⚠️ Chapter tidak ditemukan.');
            } else {
                const preview = chaptersAsc.slice(0, 15);
                lines.push('*Chapter (ascending) — preview:*');
                preview.forEach((c, i) => {
                    lines.push(`${i + 1}. ${c.title || 'Chapter'}`);
                });
                if (chaptersAsc.length > preview.length) {
                    lines.push(`… dan ${chaptersAsc.length - preview.length} lagi.`);
                }
                lines.push('');
                lines.push('➡️ Baca di chat: */c <nomor>*  (contoh: */c 1*)');
                lines.push('➡️ Link saja : */cl <nomor>* (contoh: */cl 1*)');
                lines.push('➡️ Daftar lengkap (paginated): */chapters* atau */chapters 2*');
            }

            await sock.sendMessage(from, { text: lines.join('\n') }, { quoted: m });
            await sock.sendMessage(from, { react: { text: '✅', key: m.key } });
            return;
        }

        // ==================== /chapters [page] ====================
        if (isChapters) {
            if (!session.chaptersAsc?.length) {
                await sock.sendMessage(from, { text: '❌ Belum ada daftar chapter. Buka detail dulu: */m <nomor>*' }, { quoted: m });
                return;
            }
            const parts = raw.split(/\s+/);
            const page  = Math.max(1, parseInt(parts[1] || '1', 10) || 1);

            const start = (page - 1) * PAGE_SIZE;
            const end   = Math.min(start + PAGE_SIZE, session.chaptersAsc.length);
            if (start >= session.chaptersAsc.length) {
                await sock.sendMessage(from, { text: `❌ Halaman tidak valid. Maks: ${Math.ceil(session.chaptersAsc.length / PAGE_SIZE)}` }, { quoted: m });
                return;
            }

            const slice = session.chaptersAsc.slice(start, end);
            const lines = [];
            lines.push(`📚 *${session.lastDetailTitle}* — Chapter (ASC)`);
            lines.push(`Halaman ${page}/${Math.ceil(session.chaptersAsc.length / PAGE_SIZE)} — total ${session.chaptersAsc.length}`);
            lines.push('');
            slice.forEach((c, i) => {
                lines.push(`${start + i + 1}. ${c.title || 'Chapter'}`);
            });
            lines.push('');
            lines.push('➡️ Baca di chat: */c <nomor>*   |   Link: */cl <nomor>*');
            if (end < session.chaptersAsc.length) {
                lines.push(`➡️ Lanjut: */chapters ${page + 1}*`);
            }

            await sock.sendMessage(from, { text: lines.join('\n') }, { quoted: m });
            await sock.sendMessage(from, { react: { text: '✅', key: m.key } });
            return;
        }

        // ==================== /cl <index> (link only) ====================
        if (isReadLink) {
            if (!session.chaptersAsc?.length) {
                await sock.sendMessage(from, { text: '❌ Belum ada daftar chapter. Buka detail dulu: */m <nomor>*' }, { quoted: m });
                return;
            }
            const idx = parseInt(raw.slice(3).trim(), 10);
            if (isNaN(idx) || idx < 1 || idx > session.chaptersAsc.length) {
                await sock.sendMessage(from, { text: '❌ Nomor chapter tidak valid.' }, { quoted: m });
                return;
            }
            const chap = session.chaptersAsc[idx - 1];
            await sock.sendMessage(from, {
                text: `🔗 *${session.lastDetailTitle}*\n${chap.title || 'Chapter'}\n${chap.url}`
            }, { quoted: m });
            await sock.sendMessage(from, { react: { text: '✅', key: m.key } });
            return;
        }

        // ==================== /c <index> (render in chat) ====================
        if (isReadChat) {
            if (!session.chaptersAsc?.length) {
                await sock.sendMessage(from, { text: '❌ Belum ada daftar chapter. Buka detail dulu: */m <nomor>*' }, { quoted: m });
                return;
            }
            const idx = parseInt(raw.slice(2).trim(), 10);
            if (isNaN(idx) || idx < 1 || idx > session.chaptersAsc.length) {
                await sock.sendMessage(from, { text: '❌ Nomor chapter tidak valid.' }, { quoted: m });
                return;
            }

            const chap = session.chaptersAsc[idx - 1];
            const url  = `https://api.neoxr.eu/api/comic-render?url=${encodeURIComponent(chap.url)}&apikey=${API_KEY}`;
            const { data } = await axios.get(url);

            if (!data?.status || !Array.isArray(data?.data)) {
                await sock.sendMessage(from, { text: '⚠️ Gagal render halaman chapter.' }, { quoted: m });
                return;
            }

            const pages = data.data;
            const total = pages.length;
            const sendCount = Math.min(total, MAX_PAGES);

            await sock.sendMessage(from, { text: `📖 *${session.lastDetailTitle}*\n🧩 ${chap.title || 'Chapter'}\n🖼️ Mengirim ${sendCount}/${total} halaman…` }, { quoted: m });

            for (let i = 0; i < sendCount; i++) {
                const imgUrl = pages[i];
                try {
                    await sock.sendMessage(from, { image: { url: imgUrl }, caption: `Halaman ${i + 1}/${sendCount}` }, { quoted: m });
                    await delay(DELAY_MS);
                } catch { /* skip gagal */ }
            }

            if (total > sendCount) {
                await sock.sendMessage(from, {
                    text: `ℹ️ Halaman terlalu banyak (${total}). Ditampilkan ${sendCount} dulu agar chat tidak banjir.\nBaca lengkap: ${chap.url}`
                }, { quoted: m });
            }

            await sock.sendMessage(from, { react: { text: '✅', key: m.key } });
            return;
        }
    } catch (err) {
        console.error('manga plugin error:', err?.message || err);
        await sock.sendMessage(from, { text: '❌ Terjadi kesalahan saat memproses permintaan.' }, { quoted: m });
        try { await sock.sendMessage(from, { react: { text: '❌', key: m.key } }); } catch {}
    }
};
