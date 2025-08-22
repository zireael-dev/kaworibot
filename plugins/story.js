/**
 * plugins/fun.story.js
 * Cerita interaktif dinamis dengan teks dari Mistral dan gambar dari AI Horde.
 *
 * Commands:
 * /story          -> Memulai sesi cerita.
 * /nama <nama>    -> Menentukan nama karakter.
 * /acak           -> Menggunakan nama acak.
 * /pilih <A/B>    -> Memilih opsi dalam cerita.
 * /stop           -> Menghentikan cerita.
 */

const axios = require('axios');
const FormData = require('form-data');

// --- KONFIGURASI ---
const MISTRAL_API_KEY = 'ueGPejjmfh84yoM41j2QebLKfjlvwuDy'; // Dari platform Mistral AI
const AI_HORDE_API_KEY = 'cYCbhuuG8qIIpvqvh0eZ_A'; // Kunci anonim untuk AI Horde
// --- ---

const b = (t) => `*${t}*`;
const i = (t) => `_${t}_`;
const LINE = '────────────────────';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function ensureDB() {
    global.db = global.db || {};
    global.db.storytime = global.db.storytime || {};
}

/**
 * Menghasilkan teks cerita menggunakan Mistral AI.
 */
async function generateStoryText(history) {
    if (!MISTRAL_API_KEY || MISTRAL_API_KEY === 'GANTI_DENGAN_API_KEY_ANDA') {
        throw new Error("Mistral API Key belum diisi.");
    }
    const apiUrl = 'https://api.mistral.ai/v1/chat/completions';
    const response = await axios.post(apiUrl, {
        model: 'mistral-medium-2505',
        messages: history
    }, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${MISTRAL_API_KEY}`
        }
    });
    const text = response.data.choices?.[0]?.message?.content;
    if (!text) throw new Error("Respons teks AI tidak valid.");
    return text;
}

/**
 * Menghasilkan gambar dari teks menggunakan AI Horde.
 */
async function generateImage(prompt) {
    // 1. Kirim permintaan untuk membuat gambar
    const requestUrl = 'https://stablehorde.net/api/v2/generate/async';
    const payload = {
        prompt: `fantasy art, cinematic, digital painting, epic, detailed, ${prompt} ### low quality, worst quality, blurry`,
        params: {
            sampler_name: "k_euler_a",
            cfg_scale: 7.5,
            width: 1024,
            height: 576, // Rasio 16:9
            steps: 25
        }
    };
    const jobResponse = await axios.post(requestUrl, payload, {
        headers: { 'apikey': AI_HORDE_API_KEY }
    });
    const jobId = jobResponse.data?.id;
    if (!jobId) throw new Error("Gagal membuat job generasi gambar di AI Horde.");

    // 2. Tunggu dan periksa status gambar
    const checkUrl = `https://stablehorde.net/api/v2/generate/check/${jobId}`;
    let imageUrl = null;
    for (let i = 0; i < 30; i++) { // Cek maksimal 30 kali (total ~90 detik)
        await delay(3000); // Tunggu 3 detik
        const statusResponse = await axios.get(checkUrl);
        if (statusResponse.data?.done) {
            imageUrl = statusResponse.data.generations[0]?.img;
            break;
        }
    }
    if (!imageUrl) throw new Error("Gambar gagal dibuat atau waktu tunggu habis.");
    return imageUrl;
}

/**
 * Mengunggah gambar dari URL ke telegra.ph agar link-nya lebih stabil.
 */
async function uploadToTelegraph(imageUrl) {
    const imageBuffer = (await axios.get(imageUrl, { responseType: 'arraybuffer' })).data;
    const form = new FormData();
    form.append('file', imageBuffer, { filename: 'story.jpg', contentType: 'image/jpeg' });
    const { data } = await axios.post('https://telegra.ph/upload', form, {
        headers: { 
            ...form.getHeaders(),
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
        }
    });
    if (!Array.isArray(data) || !data[0]?.src) throw new Error('Gagal mengunggah gambar ke telegra.ph.');
    return `https://telegra.ph${data[0].src}`;
}

/**
 * Mengirimkan bagian cerita saat ini kepada pengguna.
 */
async function sendStoryNode(sock, from, m, storyNode) {
    let message = `${i(storyNode.text)}\n${LINE}\n`;

    if (!storyNode.isEnd) {
        message += `${b('Apa yang akan kamu lakukan?')}\n`;
        message += `➡️ */pilih A* - ${storyNode.choiceA}\n`;
        message += `➡️ */pilih B* - ${storyNode.choiceB}\n`;
    } else {
        message += `${b('~ SELESAI ~')}\n\nKetik */story* untuk memulai petualangan baru.`;
        delete global.db.storytime[from];
    }

    if (storyNode.imageUrl) {
        await sock.sendMessage(from, {
            text: message.trim(),
            contextInfo: {
                externalAdReply: {
                    title: "Story Time",
                    body: "Petualanganmu berlanjut...",
                    thumbnailUrl: storyNode.imageUrl,
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: m });
    } else {
        await sock.sendMessage(from, { text: message.trim() }, { quoted: m });
    }
}

async function processAndSendStory(sock, m, from, history) {
    try {
        const storyTextContent = await generateStoryText(history);
        const lines = storyTextContent.split('\n').filter(line => line.trim() !== '');
        const storyText = lines.filter(line => !line.startsWith('A.') && !line.startsWith('B.') && !line.startsWith('END.')).join('\n');
        const choiceA = lines.find(line => line.startsWith('A.'))?.substring(2).trim();
        const choiceB = lines.find(line => line.startsWith('B.'))?.substring(2).trim();
        const isEnd = storyTextContent.includes('END.');

        if (!isEnd && (!storyText || !choiceA || !choiceB)) throw new Error("Gagal mem-parsing teks cerita.");

        let finalImageUrl = null;
        if (storyText) {
            await sock.sendMessage(from, { text: "🎨 _Sedang melukis ilustrasi..._" }, { quoted: m });
            const imagePrompt = storyText.split('.').slice(0, 2).join('.'); // Ambil 2 kalimat pertama untuk prompt gambar
            const generatedImageUrl = await generateImage(imagePrompt);
            finalImageUrl = await uploadToTelegraph(generatedImageUrl);
        }

        const storyNode = { text: storyText, choiceA, choiceB, isEnd, imageUrl: finalImageUrl };
        
        const session = global.db.storytime[from];
        session.currentNode = storyNode;
        if (session.state === 'awaiting_name') {
            session.state = 'playing';
        }

        return sendStoryNode(sock, from, m, storyNode);

    } catch (error) {
        console.error("Story process error:", error);
        delete global.db.storytime[from];
        return sock.sendMessage(from, { text: `❌ Gagal memproses cerita: ${error.message}` }, { quoted: m });
    }
}

module.exports = async (sock, m, text, from) => {
    ensureDB();
    const raw = (text || '').trim();
    const lower = raw.toLowerCase();
    const session = global.db.storytime[from];
    const senderJid = m.key.participant || m.key.remoteJid;

    if (lower === '/story' || lower === '/mulai') {
        if (session) {
            return sock.sendMessage(from, { text: "Kamu sedang dalam petualangan! Ketik */stop* untuk mengakhiri." }, { quoted: m });
        }
        
        global.db.storytime[from] = { state: 'awaiting_name', playerJid: senderJid, ts: Date.now() };
        
        const promptMessage = ["Petualangan akan segera dimulai!", "Ketik nama untuk karaktermu atau pilih nama acak.", LINE, "➡️ */nama <namamu>*", "➡️ */acak*"].join('\n');
        return sock.sendMessage(from, { text: promptMessage }, { quoted: m });
    }

    if (session && session.state === 'awaiting_name') {
        if (senderJid !== session.playerJid) return;
        
        let characterName = null;
        if (lower.startsWith('/nama ')) {
            characterName = raw.slice(6).trim();
            if (!characterName) return sock.sendMessage(from, { text: "❌ Nama tidak boleh kosong." }, { quoted: m });
        } else if (lower !== '/acak') {
            return;
        }

        await sock.sendMessage(from, { text: "Membuat petualangan baru untukmu (ini mungkin butuh waktu)..." }, { quoted: m });
        
        let initialPrompt;
        if (characterName) {
            initialPrompt = `Mulai sebuah cerita petualangan fantasi singkat dengan karakter utama bernama '${characterName}'. PENTING: Saat menarasikan cerita, gunakan gaya bahasa informal dan kata ganti orang kedua seperti 'kamu', '-mu', atau 'dirimu'. Namun, jika ada dialog dari karakter lain (NPC), NPC tersebut harus memanggil karakter utama dengan namanya, yaitu '${characterName}'. Berikan narasi awal, lalu berikan dua pilihan (A dan B). Format balasan harus: narasi cerita, lalu di baris baru 'A. [teks pilihan A]', dan di baris baru 'B. [teks pilihan B]'. Jangan tambahkan kata-kata pembuka seperti 'Tentu'.`;
        } else {
            initialPrompt = "Mulai sebuah cerita petualangan fantasi singkat dengan karakter yang namanya dibuat oleh AI. PENTING: Saat menarasikan cerita, gunakan gaya bahasa informal dan kata ganti orang kedua seperti 'kamu', '-mu', atau 'dirimu'. Namun, jika ada dialog dari karakter lain (NPC), NPC tersebut harus memanggil karakter utama dengan namanya. Berikan narasi awal, lalu berikan dua pilihan (A dan B). Format balasan harus: narasi cerita, lalu di baris baru 'A. [teks pilihan A]', dan di baris baru 'B. [teks pilihan B]'. Jangan tambahkan kata-kata pembuka seperti 'Tentu'.";
        }
        
        const history = [{ role: "user", content: initialPrompt }];
        session.history = history;
        session.characterName = characterName;
        return processAndSendStory(sock, m, from, history);
    }

    if (lower.startsWith('/pilih ')) {
        if (!session || session.state !== 'playing' || senderJid !== session.playerJid) return;

        const choiceLabel = raw.slice(7).trim().toUpperCase();
        if (choiceLabel !== 'A' && choiceLabel !== 'B') {
             return sock.sendMessage(from, { text: `❌ Pilihan tidak valid. Pilih */pilih A* atau */pilih B*.` }, { quoted: m });
        }

        await sock.sendMessage(from, { react: { text: '📖', key: m.key } });

        const characterName = session.characterName;
        const chosenText = choiceLabel === 'A' ? session.currentNode.choiceA : session.currentNode.choiceB;
        
        let nextPrompt;
        if (characterName) {
             nextPrompt = `Karakter '${characterName}' memilih: "${chosenText}". Lanjutkan cerita. Ingat aturannya: narasi informal ('kamu', '-mu'), dialog NPC pakai nama '${characterName}'. Jika ini akhir cerita, akhiri dengan kata 'END.'. Jika tidak, berikan narasi dan dua pilihan baru (A dan B).`;
        } else {
             nextPrompt = `Pemain memilih: "${chosenText}". Lanjutkan cerita. Ingat aturannya: narasi informal ('kamu', '-mu'), dialog NPC pakai nama karakter AI. Jika ini akhir cerita, akhiri dengan kata 'END.'. Jika tidak, berikan narasi dan dua pilihan baru (A dan B).`;
        }
        
        session.history.push({ role: "assistant", content: `${session.currentNode.text}\nA. ${session.currentNode.choiceA}\nB. ${session.currentNode.choiceB}` });
        session.history.push({ role: "user", content: nextPrompt });

        return processAndSendStory(sock, m, from, session.history);
    }

    if (lower === '/stop' || lower === '/berhenti') {
        if (!session || senderJid !== session.playerJid) return;
        delete global.db.storytime[from];
        return sock.sendMessage(from, { text: "Petualangan telah dihentikan." }, { quoted: m });
    }
};
