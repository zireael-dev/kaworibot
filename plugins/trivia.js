/**
 * plugins/fun.fakta.js
 * Memberikan fakta atau trivia acak dari API publik, lalu menerjemahkannya ke Bahasa Indonesia.
 *
 * Commands:
 * /fakta   -> Menampilkan fakta acak
 * /trivia  -> Alias untuk /fakta
 * * Note:
 * - Menggunakan Useless Facts API dan API terjemahan gratis.
 * - Butuh: npm i axios
 */

const axios = require('axios');

// Alamat API untuk mendapatkan fakta acak dalam bahasa Inggris
const FAKTA_API_URL = 'https://uselessfacts.jsph.pl/api/v2/facts/random?language=en';

const b = (t) => `*${t}*`;

/**
 * Menerjemahkan teks ke Bahasa Indonesia menggunakan API gratis.
 * @param {string} text Teks yang akan diterjemahkan.
 * @returns {Promise<string>} Teks yang sudah diterjemahkan.
 */
async function translateToID(text) {
    try {
        const encodedText = encodeURIComponent(text);
        // Menggunakan API terjemahan sederhana yang tidak memerlukan kunci
        const translateUrl = `https://api.popcat.xyz/translate?text=${encodedText}&to=id`;
        const { data } = await axios.get(translateUrl);
        // Kembalikan hasil terjemahan jika berhasil, jika tidak, kembalikan teks asli
        return data?.translated || text;
    } catch (error) {
        console.error("Gagal menerjemahkan teks:", error.message);
        // Jika ada error saat menerjemahkan, kembalikan teks asli agar tidak gagal total
        return text;
    }
}

module.exports = async (sock, m, text, from) => {
    const raw = (text || '').trim();
    const lower = raw.toLowerCase();

    // Cek apakah perintah yang digunakan adalah /fakta atau /trivia
    if (lower === '/fakta' || lower === '/trivia') {
        
        await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

        try {
            // 1. Ambil fakta dalam bahasa Inggris
            const { data: factData } = await axios.get(FAKTA_API_URL);
            if (!factData || !factData.text) {
                throw new Error('Respons API fakta tidak valid.');
            }
            const englishFact = factData.text;

            // 2. Terjemahkan fakta ke Bahasa Indonesia
            const indonesianFact = await translateToID(englishFact);

            // Format pesan balasan
            const out = [
                b('Tahukah Kamu?'),
                '', // Baris kosong untuk spasi
                `💡 ${indonesianFact}`
            ].join('\n');

            // Kirim pesan ke pengguna
            return sock.sendMessage(from, { text: out }, { quoted: m });

        } catch (error) {
            console.error("Gagal mengambil atau menerjemahkan fakta:", error.message);
            return sock.sendMessage(from, { text: '❌ Gagal mengambil fakta baru. Coba lagi nanti.' }, { quoted: m });
        }
    }
};
