/**
 * plugins/utility.shipping.js
 * Cek resi pengiriman dan ongkos kirim berbagai kurir di Indonesia.
 *
 * Commands:
 * /resi <nomor resi>
 * /ongkir <kota asal>|<kota tujuan>|<berat_gram>|<kurir>
 *
 * Note:
 * - Menggunakan API dari binderbyte.com
 * - Anda WAJIB mengisi BINDERBYTE_API_KEY di bawah ini.
 * - Dapatkan API Key gratis di https://binderbyte.com/pricing
 * - Butuh: npm i axios
 */

const axios = require('axios');

// --- KONFIGURASI ---
const BINDERBYTE_API_KEY = 'e1c3bcd4dbb4bb91a31600c6d1ebcf39c53d1fb0362fdabecbb3d07e1e515bb0'; // <-- WAJIB DIISI!
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

module.exports = async (sock, m, text, from) => {
    const raw = (text || '').trim();
    const lower = raw.toLowerCase();

    // --- Cek Resi ---
    if (lower.startsWith('/resi ')) {
        if (!BINDERBYTE_API_KEY || BINDERBYTE_API_KEY === 'e1c3bcd4dbb4bb91a31600c6d1ebcf39c53d1fb0362fdabecbb3d07e1e515bb0') {
            return sock.sendMessage(from, { text: "❌ API Key untuk fitur ini belum diatur oleh owner." }, { quoted: m });
        }

        const resi = raw.slice(6).trim();
        if (!resi) {
            return sock.sendMessage(from, { text: `❌ Masukkan nomor resi.\nContoh: ${c('/resi JP1234567890')}` }, { quoted: m });
        }

        await sock.sendMessage(from, { react: { text: '🚚', key: m.key } });

        try {
            const apiUrl = `https://api.binderbyte.com/v1/track?api_key=${BINDERBYTE_API_KEY}&courier=auto&awb=${resi}`;
            const { data } = await client.get(apiUrl);

            if (data.status !== 200) {
                return sock.sendMessage(from, { text: `❌ Gagal melacak resi: ${data.message}` }, { quoted: m });
            }

            const d = data.data;
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
                resultText += `\n\n${i(h.date)}\n${h.desc}`;
            });

            return sock.sendMessage(from, { text: resultText }, { quoted: m });

        } catch (e) {
            console.error("Cek resi error:", e.response ? e.response.data : e.message);
            const errorMessage = e.response?.data?.message || "Terjadi kesalahan pada server API.";
            return sock.sendMessage(from, { text: `❌ Gagal melacak resi. ${errorMessage}` }, { quoted: m });
        }
    }

    // --- Cek Ongkir ---
    if (lower.startsWith('/ongkir ')) {
        if (!BINDERBYTE_API_KEY || BINDERBYTE_API_KEY === 'GANTI_DENGAN_API_KEY_ANDA') {
            return sock.sendMessage(from, { text: "❌ API Key untuk fitur ini belum diatur oleh owner." }, { quoted: m });
        }

        const args = raw.slice(8).trim().split('|');
        if (args.length !== 4) {
            const helpText = [
                `❌ Format salah. Gunakan pemisah '|'.`,
                `Contoh: ${c('/ongkir Jakarta|Bandung|1000|jne')}`,
                "",
                "Kurir yang didukung: jne, pos, tiki, sicepat, jnt, anteraja, wahana, ninja, lion, ide, sap."
            ].join('\n');
            return sock.sendMessage(from, { text: helpText }, { quoted: m });
        }

        const [origin, destination, weight, courier] = args.map(arg => arg.trim());
        
        await sock.sendMessage(from, { react: { text: '✈️', key: m.key } });

        try {
            const apiUrl = `https://api.binderbyte.com/v1/cost?api_key=${BINDERBYTE_API_KEY}&origin=${origin}&destination=${destination}&weight=${weight}&courier=${courier}`;
            const { data } = await client.get(apiUrl);

            if (data.status !== 200) {
                return sock.sendMessage(from, { text: `❌ Gagal cek ongkir: ${data.message}` }, { quoted: m });
            }

            const d = data.data;
            const costs = d.costs;

            if (!costs || costs.length === 0) {
                 return sock.sendMessage(from, { text: `❌ Tidak ada layanan pengiriman yang tersedia untuk rute tersebut.` }, { quoted: m });
            }

            let resultText = [
                b('💸 Cek Ongkos Kirim 💸'),
                LINE,
                `Asal: ${d.origin.city}`,
                `Tujuan: ${d.destination.city}`,
                `Berat: ${d.query.weight} gram`,
                `Kurir: ${d.query.courier.toUpperCase()}`,
                LINE,
                b('Layanan Tersedia:'),
            ].join('\n');

            costs.forEach(cost => {
                resultText += `\n\n• Layanan: ${b(cost.service)}\n  Deskripsi: ${cost.description}\n  Biaya: Rp ${cost.cost[0].value.toLocaleString('id-ID')}\n  Estimasi: ${cost.cost[0].etd} hari`;
            });

            return sock.sendMessage(from, { text: resultText }, { quoted: m });

        } catch (e) {
            console.error("Cek ongkir error:", e.response ? e.response.data : e.message);
            const errorMessage = e.response?.data?.message || "Terjadi kesalahan pada server API.";
            return sock.sendMessage(from, { text: `❌ Gagal cek ongkir. ${errorMessage}` }, { quoted: m });
        }
    }
};
