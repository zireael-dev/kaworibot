/**
 * plugins/converter.pdf.js
 * Mengonversi gambar atau dokumen menjadi file PDF.
 *
 * Commands:
 * /topdf -> Reply atau upload gambar/dokumen untuk diubah ke PDF.
 *
 * Note:
 * - Menggunakan API dari api2convert.com
 * - Anda WAJIB mengisi API2CONVERT_KEY di bawah ini.
 * - Dapatkan API Key gratis di https://www.api2convert.com/
 * - Butuh: npm i axios form-data
 */

const axios = require('axios');
const FormData = require('form-data');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

// --- KONFIGURASI ---
const API2CONVERT_KEY = '661922ce1dfc6ea432df08e398355ba5'; // <-- WAJIB DIISI!
// --- ---

const b = (t) => `*${t}*`;

/**
 * Fungsi delay untuk menunggu proses konversi.
 * @param {number} ms Waktu tunggu dalam milidetik.
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Mengunggah buffer file ke layanan hosting sementara.
 * @param {Buffer} buffer Buffer file.
 * @param {string} filename Nama file.
 * @returns {Promise<string>} URL publik dari file yang diunggah.
 */
async function uploadToTmp(buffer, filename) {
    const form = new FormData();
    form.append('file', buffer, filename);
    const { data } = await axios.post('https://tmpfiles.org/api/v1/upload', form, {
        headers: form.getHeaders(),
    });
    if (data.status !== 'success') throw new Error('Gagal mengunggah file sementara.');
    return data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
}

module.exports = async (sock, m, text, from) => {
    const raw = (text || '').trim().toLowerCase();

    // --- 1. Deteksi Pemicu Perintah ---
    const isReply = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const isUpload = m.message?.imageMessage || m.message?.documentMessage;
    const caption = (m.message?.imageMessage?.caption || m.message?.documentMessage?.caption || '').trim().toLowerCase();
    
    const triggerByReply = raw === '/topdf' && (isReply?.imageMessage || isReply?.documentMessage);
    const triggerByUpload = caption === '/topdf' && isUpload;

    if (!triggerByReply && !triggerByUpload) return;
    
    if (!API2CONVERT_KEY || API2CONVERT_KEY === 'GANTI_DENGAN_API_KEY_ANDA') {
        return sock.sendMessage(from, { text: "❌ API Key untuk fitur ini belum diatur oleh owner." }, { quoted: m });
    }

    // --- 2. React & Tentukan Media ---
    await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

    const mediaType = triggerByReply ? 
        (isReply.imageMessage ? 'image' : 'document') : 
        (m.message.imageMessage ? 'image' : 'document');
        
    const mediaMessage = triggerByReply ? 
        (isReply.imageMessage || isReply.documentMessage) : 
        (m.message.imageMessage || m.message.documentMessage);
        
    const originalFilename = mediaMessage.fileName || `file.${mediaType === 'image' ? 'jpg' : 'tmp'}`;

    // --- 3. Download Media ---
    let fileBuffer = Buffer.alloc(0);
    try {
        const stream = await downloadContentFromMessage(mediaMessage, mediaType);
        for await (const chunk of stream) {
            fileBuffer = Buffer.concat([fileBuffer, chunk]);
        }
        if (fileBuffer.length === 0) throw new Error("Buffer kosong");
    } catch (e) {
        console.error('PDF Converter download error:', e);
        return sock.sendMessage(from, { text: '❌ Gagal mengunduh file.' }, { quoted: m });
    }

    try {
        await sock.sendMessage(from, { text: "Mengunggah file..." }, { quoted: m });
        const remoteUrl = await uploadToTmp(fileBuffer, originalFilename);

        // --- 4. Buat Job Konversi ---
        await sock.sendMessage(from, { text: "Memulai proses konversi..." }, { quoted: m });
        const jobResponse = await axios.post('https://api.api2convert.com/v2/jobs', {
            input: [{ type: 'remote', source: remoteUrl }],
            conversion: [{ category: mediaType, target: 'pdf' }]
        }, {
            headers: {
                'x-oc-api-key': API2CONVERT_KEY,
                'Content-Type': 'application/json'
            }
        });

        const jobId = jobResponse.data.id;
        if (!jobId) throw new Error("Gagal mendapatkan Job ID dari API.");

        // --- 5. Polling Status Job ---
        let jobStatus;
        let attempts = 0;
        const maxAttempts = 20; // Maksimal 20 kali cek (total 1 menit)

        do {
            await delay(3000); // Tunggu 3 detik sebelum cek lagi
            const statusResponse = await axios.get(`https://api.api2convert.com/v2/jobs/${jobId}`, {
                headers: { 'x-oc-api-key': API2CONVERT_KEY }
            });
            jobStatus = statusResponse.data;
            attempts++;
        } while (jobStatus.status.code !== 'completed' && attempts < maxAttempts && jobStatus.status.code !== 'failed');

        if (jobStatus.status.code !== 'completed') {
            throw new Error(`Konversi gagal atau memakan waktu terlalu lama. Status: ${jobStatus.status.info}`);
        }

        // --- 6. Kirim Hasil ---
        const outputUrl = jobStatus.output[0].uri;
        const outputFilename = jobStatus.output[0].filename;

        await sock.sendMessage(from, { text: "Mengirim hasil konversi..." }, { quoted: m });
        await sock.sendMessage(from, {
            document: { url: outputUrl },
            mimetype: 'application/pdf',
            fileName: outputFilename
        }, { quoted: m });

        await sock.sendMessage(from, { react: { text: '✅', key: m.key } });

    } catch (e) {
        console.error("PDF Converter process error:", e.message);
        await sock.sendMessage(from, { react: { text: '❌', key: m.key } });
        return sock.sendMessage(from, { text: `❌ Terjadi kesalahan: ${e.message}` }, { quoted: m });
    }
};
