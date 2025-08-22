/**
 * plugins/fun.story.js
 * Sebuah permainan cerita interaktif dinamis yang dibuat oleh Mistral AI.
 *
 * Commands:
 * /story          -> Memulai sesi cerita dan meminta nama karakter.
 * /nama <nama>    -> Menentukan nama karakter.
 * /acak           -> Menggunakan nama acak dari AI.
 * /pilih <A/B>    -> Memilih opsi dalam cerita.
 * /stop           -> Menghentikan cerita saat ini.
 */

const axios = require('axios');

// --- KONFIGURASI ---
// Dapatkan API Key Anda dari platform Mistral AI
const MISTRAL_API_KEY = 'ueGPejjmfh84yoM41j2QebLKfjlvwuDy'; // <-- WAJIB DIISI!
// --- ---

const b = (t) => `*${t}*`;
const i = (t) => `_${t}_`;
const LINE = '────────────────────';

function ensureDB() {
    global.db = global.db || {};
    global.db.storytime = global.db.storytime || {};
}

/**
 * Menghasilkan bagian cerita selanjutnya menggunakan Mistral AI.
 * @param {Array} history Riwayat percakapan/cerita sejauh ini.
 * @returns {object|null} Objek berisi { text, choiceA, choiceB, isEnd } atau null jika gagal.
 */
async function generateStoryNode(history) {
    if (!MISTRAL_API_KEY || MISTRAL_API_KEY === 'GANTI_DENGAN_API_KEY_ANDA') {
        console.error("Mistral API Key belum diisi di dalam script.");
        return null;
    }
    const apiUrl = 'https://api.mistral.ai/v1/chat/completions';

    try {
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

        if (!text) {
            console.error("Invalid API response structure:", response.data);
            return null;
        }

        // Parsing respons dari AI
        const lines = text.split('\n').filter(line => line.trim() !== '');
        const storyText = lines.filter(line => !line.startsWith('A.') && !line.startsWith('B.') && !line.startsWith('END.')).join('\n');
        const choiceA = lines.find(line => line.startsWith('A.'))?.substring(2).trim();
        const choiceB = lines.find(line => line.startsWith('B.'))?.substring(2).trim();
        const isEnd = text.includes('END.');

        if (isEnd) {
            return { text: storyText, choiceA: null, choiceB: null, isEnd: true };
        }

        if (!storyText || !choiceA || !choiceB) {
            console.error("Failed to parse AI response:", text);
            return null; // Gagal mem-parsing
        }
        
        return { text: storyText, choiceA, choiceB, isEnd: false };

    } catch (error) {
        console.error("Error calling Mistral API:", error.response ? error.response.data : error.message);
        return null;
    }
}

/**
 * Mengirimkan bagian cerita saat ini kepada pengguna.
 */
function sendStoryNode(sock, from, m, storyNode) {
    let message = `${i(storyNode.text)}\n${LINE}\n`;

    if (!storyNode.isEnd) {
        message += `${b('Apa yang akan kamu lakukan?')}\n`;
        message += `➡️ */pilih A* - ${storyNode.choiceA}\n`;
        message += `➡️ */pilih B* - ${storyNode.choiceB}\n`;
    } else {
        message += `${b('~ SELESAI ~')}\n\nKetik */story* untuk memulai petualangan baru.`;
        delete global.db.storytime[from];
    }

    return sock.sendMessage(from, { text: message.trim() }, { quoted: m });
}

async function startStory(sock, m, from, characterName) {
    await sock.sendMessage(from, { text: "Membuat petualangan baru untukmu..." }, { quoted: m });

    let initialPrompt;
    if (characterName) {
        initialPrompt = `Mulai sebuah cerita petualangan fantasi singkat dengan karakter utama bernama '${characterName}'. PENTING: Saat menarasikan cerita, gunakan gaya bahasa informal dan kata ganti orang kedua seperti 'kamu', '-mu', atau 'dirimu' (contoh: 'angin menerpa wajahmu', 'kamu menemukan sebuah pedang'). Namun, jika ada dialog dari karakter lain (NPC), NPC tersebut harus memanggil karakter utama dengan namanya, yaitu '${characterName}'. Berikan narasi awal, lalu berikan dua pilihan (A dan B). Format balasan harus: narasi cerita, lalu di baris baru 'A. [teks pilihan A]', dan di baris baru 'B. [teks pilihan B]'. Jangan tambahkan kata-kata pembuka seperti 'Tentu'.`;
    } else {
        initialPrompt = "Mulai sebuah cerita petualangan fantasi singkat dengan karakter yang namanya dibuat oleh AI. PENTING: Saat menarasikan cerita, gunakan gaya bahasa informal dan kata ganti orang kedua seperti 'kamu', '-mu', atau 'dirimu' (contoh: 'angin menerpa wajahmu', 'kamu menemukan sebuah pedang'). Namun, jika ada dialog dari karakter lain (NPC), NPC tersebut harus memanggil karakter utama dengan namanya. Berikan narasi awal, lalu berikan dua pilihan (A dan B). Format balasan harus: narasi cerita, lalu di baris baru 'A. [teks pilihan A]', dan di baris baru 'B. [teks pilihan B]'. Jangan tambahkan kata-kata pembuka seperti 'Tentu'.";
    }
    
    const history = [{ role: "user", content: initialPrompt }];
    const storyNode = await generateStoryNode(history);

    if (storyNode) {
        const session = global.db.storytime[from];
        session.state = 'playing';
        session.history = history;
        session.currentNode = storyNode;
        session.characterName = characterName;
        return sendStoryNode(sock, from, m, storyNode);
    } else {
        delete global.db.storytime[from];
        return sock.sendMessage(from, { text: "❌ Gagal memulai cerita. Pastikan API Key sudah benar." }, { quoted: m });
    }
}

module.exports = async (sock, m, text, from) => {
    ensureDB();
    const raw = (text || '').trim();
    const lower = raw.toLowerCase();
    const session = global.db.storytime[from];

    if (lower === '/story' || lower === '/mulai') {
        if (session) {
            return sock.sendMessage(from, { text: "Kamu sedang dalam petualangan! Ketik */stop* untuk mengakhiri cerita saat ini sebelum memulai yang baru." }, { quoted: m });
        }
        
        global.db.storytime[from] = { state: 'awaiting_name', ts: Date.now() };
        
        const promptMessage = [
            "Petualangan akan segera dimulai!",
            "Ketik nama untuk karaktermu atau pilih nama acak.",
            LINE,
            "➡️ */nama <namamu>*",
            "➡️ */acak*"
        ].join('\n');
        return sock.sendMessage(from, { text: promptMessage }, { quoted: m });
    }

    if (session && session.state === 'awaiting_name') {
        if (lower.startsWith('/nama ')) {
            const characterName = raw.slice(6).trim();
            if (!characterName) {
                return sock.sendMessage(from, { text: "❌ Nama tidak boleh kosong. Contoh: */nama Zirael*" }, { quoted: m });
            }
            return startStory(sock, m, from, characterName);
        }
        if (lower === '/acak') {
            return startStory(sock, m, from, null); // null for random name
        }
        // Abaikan pesan lain jika sedang menunggu nama
        return;
    }

    if (lower.startsWith('/pilih ')) {
        if (!session || session.state !== 'playing') {
            return sock.sendMessage(from, { text: "Tidak ada petualangan yang sedang berjalan. Ketik */story* untuk memulai." }, { quoted: m });
        }

        const choiceLabel = raw.slice(7).trim().toUpperCase();
        if (choiceLabel !== 'A' && choiceLabel !== 'B') {
             return sock.sendMessage(from, { text: `❌ Pilihan tidak valid. Silakan pilih */pilih A* atau */pilih B*.` }, { quoted: m });
        }

        await sock.sendMessage(from, { react: { text: '📖', key: m.key } });

        const characterName = session.characterName;
        const chosenText = choiceLabel === 'A' ? session.currentNode.choiceA : session.currentNode.choiceB;
        
        let nextPrompt;
        if (characterName) {
             nextPrompt = `Karakter '${characterName}' memilih: "${chosenText}". Lanjutkan cerita. Ingat aturannya: narasi menggunakan gaya bahasa informal dan kata ganti orang kedua ('kamu', '-mu', 'dirimu'), dan dialog NPC menggunakan nama '${characterName}'. Jika ini adalah akhir yang bagus atau buruk, akhiri narasinya dengan kata 'END.' di baris terpisah. Jika tidak, berikan narasi kelanjutan dan dua pilihan baru (A dan B). Ingat formatnya.`;
        } else {
             nextPrompt = `Pemain memilih: "${chosenText}". Lanjutkan cerita. Ingat aturannya: narasi menggunakan gaya bahasa informal dan kata ganti orang kedua ('kamu', '-mu', 'dirimu'), dan dialog NPC menggunakan nama karakter yang sudah dibuat AI. Jika ini adalah akhir yang bagus atau buruk, akhiri narasinya dengan kata 'END.' di baris terpisah. Jika tidak, berikan narasi kelanjutan dan dua pilihan baru (A dan B). Ingat formatnya.`;
        }
        
        session.history.push({ role: "assistant", content: `${session.currentNode.text}\nA. ${session.currentNode.choiceA}\nB. ${session.currentNode.choiceB}` });
        session.history.push({ role: "user", content: nextPrompt });

        const storyNode = await generateStoryNode(session.history);

        if (storyNode) {
            session.currentNode = storyNode;
            return sendStoryNode(sock, from, m, storyNode);
        } else {
            delete global.db.storytime[from];
            return sock.sendMessage(from, { text: "❌ Terjadi kesalahan saat melanjutkan cerita. Petualangan dihentikan." }, { quoted: m });
        }
    }

    if (lower === '/stop' || lower === '/berhenti') {
        if (!session) {
            return sock.sendMessage(from, { text: "Tidak ada petualangan yang sedang berjalan." }, { quoted: m });
        }
        delete global.db.storytime[from];
        return sock.sendMessage(from, { text: "Petualangan telah dihentikan." }, { quoted: m });
    }
};
