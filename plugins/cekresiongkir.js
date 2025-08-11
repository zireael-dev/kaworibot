/**
 * plugins/utility.shipping.js
 * Cek resi pengiriman dan ongkos kirim berbagai kurir di Indonesia.
 *
 * Commands:
 * /resi <kode kurir>|<nomor resi>
 * /ongkir <kota asal>|<kota tujuan>|<berat_gram>
 *
 * Note:
 * - Semua fitur menggunakan API dari RapidAPI (cek-resi-cek-ongkir).
 * - Anda WAJIB mengisi RAPIDAPI_KEY di bawah ini.
 */

const axios = require('axios');

// --- KONFIGURASI ---
const RAPIDAPI_KEY = 'ebbf66c115msh5db839e4003caf9p1dfa5cjsnb50dfdd7ea6f'; // Dari rapidapi.com
// --- ---

const b = (t) => `*${t}*`;
const i = (t) => `_${t}_`;
const c = (t) => `\`\`\`${t}\`\`\``;
const LINE = '────────────────────';

/**
 * Mencari Area ID dari nama kota menggunakan RapidAPI.
 * @param {string} cityName Nama kota atau kecamatan.
 * @returns {string|null} Area ID atau null jika tidak ditemukan.
 */
async function getAreaId(cityName) {
    try {
        const response = await axios.request({
            method: 'GET',
            url: 'https://cek-resi-cek-ongkir.p.rapidapi.com/area',
            params: { q: cityName },
            headers: {
                'x-rapidapi-key': RAPIDAPI_KEY,
                'x-rapidapi-host': 'cek-resi-cek-ongkir.p.rapidapi.com'
            }
        });
        if (response.data && response.data.status === 200 && response.data.areas.length > 0) {
            return response.data.areas[0].areaId;
        }
        return null;
    } catch (error) {
        console.error(`Gagal mencari Area ID untuk "${cityName}":`, error.message);
        return null;
    }
}


module.exports = async (sock, m, text, from) => {
    const raw = (text || '').trim();
    const lower = raw.toLowerCase();

    // --- Cek Resi (Menggunakan RapidAPI) ---
    if (lower.startsWith('/resi ')) {
        if (!RAPIDAPI_KEY || RAPIDAPI_KEY === 'ebbf66c115msh5db839e4003caf9p1dfa5cjsnb50dfdd7ea6f') {
            return sock.sendMessage(from, { text: "❌ API Key untuk fitur ini belum diatur oleh owner." }, { quoted: m });
        }

        const args = raw.slice(6).trim().split('|');
        if (args.length !== 2) {
            const helpText = [
                `❌ Format salah. Gunakan pemisah '|'.`,
                `Contoh: ${c('/resi jne|JP1234567890')}`,
                "",
                "Kode kurir umum: jne, jnt, sicepat, anteraja, tiki, pos, ninja, sap, lion."
            ].join('\n');
            return sock.sendMessage(from, { text: helpText }, { quoted: m });
        }

        const [courier, awb] = args.map(arg => arg.trim());

        await sock.sendMessage(from, { react: { text: '🚚', key: m.key } });

        try {
            const response = await axios.request({
                method: 'GET',
                url: 'https://cek-resi-cek-ongkir.p.rapidapi.com/track',
                params: { courierCode: courier, awb: awb },
                headers: {
                    'x-rapidapi-key': RAPIDAPI_KEY,
                    'x-rapidapi-host': 'cek-resi-cek-ongkir.p.rapidapi.com'
                }
            });
            
            const { data } = response;
            if (data.status !== 200) {
                return sock.sendMessage(from, { text: `❌ Gagal melacak resi: ${data.message}` }, { quoted: m });
            }

            const d = data.result;
            const summary = d.summary;
            const history = d.history;

            let resultText = [
                b('📦 Lacak Resi 📦'),
                LINE,
                `Status: ${b(summary.status)}`,
                `Kurir: ${summary.courier}`,
                `Layanan: ${summary.service}`,
                `Tanggal: ${summary.date}`,
                `Penerima: ${summary.receiver}`,
                LINE,
                b('Riwayat Perjalanan:'),
            ].join('\n');

            history.forEach(h => {
                resultText += `\n\n${i(h.date)}\n${h.description}`;
            });

            return sock.sendMessage(from, { text: resultText }, { quoted: m });

        } catch (e) {
            console.error("Cek resi error:", e.response ? e.response.data : e.message);
            const errorMessage = e.response?.data?.message || "Terjadi kesalahan pada server API.";
            return sock.sendMessage(from, { text: `❌ Gagal melacak resi. Pastikan kode kurir dan nomor resi benar. (${errorMessage})` }, { quoted: m });
        }
    }

    // --- Cek Ongkir (Menggunakan RapidAPI) ---
    if (lower.startsWith('/ongkir ')) {
        if (!RAPIDAPI_KEY || RAPIDAPI_KEY === 'GANTI_DENGAN_API_KEY_ANDA') {
            return sock.sendMessage(from, { text: "❌ API Key untuk fitur ongkir belum diatur oleh owner." }, { quoted: m });
        }

        const args = raw.slice(8).trim().split('|');
        if (args.length !== 3) {
            const helpText = [
                `❌ Format salah. Gunakan pemisah '|'.`,
                `Contoh: ${c('/ongkir Jakarta|Bandung|1000')}`
            ].join('\n');
            return sock.sendMessage(from, { text: helpText }, { quoted: m });
        }

        const [originCity, destCity, weight] = args.map(arg => arg.trim());
        
        await sock.sendMessage(from, { react: { text: '✈️', key: m.key } });

        try {
            // Langkah 1 & 2: Dapatkan ID Area untuk kota asal dan tujuan
            const [originAreaId, destAreaId] = await Promise.all([
                getAreaId(originCity),
                getAreaId(destCity)
            ]);

            if (!originAreaId) return sock.sendMessage(from, { text: `❌ Kota asal "${originCity}" tidak ditemukan.`}, { quoted: m });
            if (!destAreaId) return sock.sendMessage(from, { text: `❌ Kota tujuan "${destCity}" tidak ditemukan.`}, { quoted: m });

            // Langkah 3: Cek ongkir menggunakan ID yang didapat
            const response = await axios.request({
                method: 'GET',
                url: 'https://cek-resi-cek-ongkir.p.rapidapi.com/shipping-cost',
                params: { originAreaId, destinationAreaId: destAreaId, weight },
                headers: {
                    'x-rapidapi-key': RAPIDAPI_KEY,
                    'x-rapidapi-host': 'cek-resi-cek-ongkir.p.rapidapi.com'
                }
            });

            const { data } = response;
            if (data.status !== 200 || !data.results) {
                throw new Error(data.message || 'Respons API tidak valid');
            }

            let resultText = [
                b('💸 Cek Ongkos Kirim 💸'),
                LINE,
                `Asal: ${data.origin.areaName}`,
                `Tujuan: ${data.destination.areaName}`,
                `Berat: ${weight} gram`,
                LINE,
                b('Layanan Tersedia:'),
            ].join('\n');

            data.results.forEach(courier => {
                resultText += `\n\n${b(courier.courier.toUpperCase())}`;
                courier.costs.forEach(cost => {
                    resultText += `\n• Layanan: ${cost.service}\n  Biaya: Rp ${cost.cost.toLocaleString('id-ID')}\n  Estimasi: ${cost.etd} hari`;
                });
            });

            return sock.sendMessage(from, { text: resultText }, { quoted: m });

        } catch (e) {
            console.error("Cek ongkir error:", e.response ? e.response.data : e.message);
            const errorMessage = e.response?.data?.message || "Terjadi kesalahan pada server API.";
            return sock.sendMessage(from, { text: `❌ Gagal cek ongkir. ${errorMessage}` }, { quoted: m });
        }
    }
};
