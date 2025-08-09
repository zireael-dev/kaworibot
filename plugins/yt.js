/**
 * plugins/yt.js
 * YouTube downloader tanpa fetcher metadata.
 * Alur:
 *   1) /yt <url>  -> bot simpan state & tanya mau /video atau /audio
 *   2) reply /video -> kirim MP4 (default 480p)
 *      reply /audio -> kirim MP3 (default 128kbps)
 *
 * Catatan:
 * - Hanya /video /audio yang membalas pesan prompt /yt yang diproses.
 * - State kedaluwarsa 10 menit.
 * - Tidak ada size check: langsung kirim ke WhatsApp.
 *
 * Dependensi: npm i axios
 */

const axios = require('axios');

// ====== KONFIGURASI MUDAH DIUBAH ======
const NEOXR_KEY = 'UCIELL';
const DEFAULT_VIDEO_QUALITY = '480p';     // ubah sewaktu-waktu (mis. '360p' | '720p')
const DEFAULT_AUDIO_QUALITY = '128kbps';  // ubah sewaktu-waktu (mis. '192kbps')
// ======================================

// state sementara per-chat (tidak dipersist)
global.__ytPending = global.__ytPending || {}; // { [chatJid]: { url, promptKey, ts } }
const EXP_MIN = 10; // menit

// util kecil
const isYt = (u='') => /(youtube\.com|youtu\.be)/i.test(u);
const pickUrl = (data = {}) => {
    // coba beberapa kemungkinan field yang sering dipakai API
    return (
        data.url ||
        data.link ||
        data.download_url ||
        data.result ||
        data.video ||
        data.audio ||
        null
    );
};

module.exports = async (sock, m, text, from) => {
    const raw = (text || '').trim();
    const low = raw.toLowerCase();

    // 1) HANDLE /yt <url>
    if (low.startsWith('/yt ')) {
        const url = raw.slice(4).trim();
        if (!isYt(url)) {
            return sock.sendMessage(from, { text: '❌ Link YouTube nggak valid. Contoh:\n/yt https://youtu.be/abcDEF123' }, { quoted: m });
        }

        // simpan state
        global.__ytPending[from] = {
            url,
            ts: Date.now(),
            promptKey: m.key // supaya reply bisa dicek
        };

        const msg = [
            '📺 **YouTube Downloader**',
            'Pilih format kiriman:',
            '• Balas pesan ini dengan **/video** untuk MP4',
            '• Atau **/audio** untuk MP3',
            '',
            `Default: video ${DEFAULT_VIDEO_QUALITY}, audio ${DEFAULT_AUDIO_QUALITY}.`,
            'Tips: kalau ragu, pilih /video dulu 😉'
        ].join('\n');

        return sock.sendMessage(from, { text: msg }, { quoted: m });
    }

    // 2) HANDLE /video atau /audio — HANYA jika membalas prompt /yt
    if (low === '/video' || low === '/audio') {
        const pend = global.__ytPending[from];
        // harus ada state & harus reply pesan prompt (atau setidaknya masih dalam waktu)
        const replyingToKey = m.message?.extendedTextMessage?.contextInfo?.stanzaId
        || m.message?.extendedTextMessage?.contextInfo?.stanzaID
        || m.message?.extendedTextMessage?.contextInfo?.quotedMessageId;

        if (
            !pend ||
            (Date.now() - pend.ts) > EXP_MIN * 60 * 1000 ||
            (replyingToKey && pend.promptKey?.id && replyingToKey !== pend.promptKey.id)
        ) {
            return sock.sendMessage(from, {
                text: '⏳ Sesi YouTube kamu sudah habis / tidak valid.\nKirim ulang link dengan:\n/yt <link YouTube>'
            }, { quoted: m });
        }

        const want = low === '/video' ? 'video' : 'audio';
        const quality = want === 'video' ? DEFAULT_VIDEO_QUALITY : DEFAULT_AUDIO_QUALITY;
        const encUrl = encodeURIComponent(pend.url);

        // react ⏳
        try { await sock.sendMessage(from, { react: { text: '⏳', key: m.key } }); } catch {}

        try {
            const api = `https://api.neoxr.eu/api/youtube?url=${encUrl}&type=${want}&quality=${encodeURIComponent(quality)}&apikey=${NEOXR_KEY}`;
            const { data: json } = await axios.get(api, { timeout: 60_000 });

            if (!json || json.status === false) {
                const reason = json?.message || 'Gagal memproses.';
                return sock.sendMessage(from, { text: `❌ ${reason}` }, { quoted: m });
            }

            const fileUrl = pickUrl(json.data || {});
            if (!fileUrl) {
                return sock.sendMessage(from, { text: '❌ Link unduhan tidak ditemukan dari API.' }, { quoted: m });
            }

            if (want === 'video') {
                await sock.sendMessage(from, {
                    video: { url: fileUrl },
                    caption: `✅ YouTube → MP4 (${quality})\nJika macet, coba /audio atau resolusi lain.`
                }, { quoted: m });
            } else {
                await sock.sendMessage(from, {
                    audio: { url: fileUrl },
                    mimetype: 'audio/mpeg',
                    ptt: false
                }, { quoted: m });
            }

            // sukses → bersihkan state
            delete global.__ytPending[from];
        } catch (e) {
            console.error('yt download error:', e?.message || e);
            await sock.sendMessage(from, { text: '❌ Gagal mengunduh. Coba lagi atau kirim ulang /yt.' }, { quoted: m });
        } finally {
            // react ✅
            try { await sock.sendMessage(from, { react: { text: '✅', key: m.key } }); } catch {}
        }

        return;
    }

    // kalau bukan /yt, /video, /audio → plugin ini diam
};
