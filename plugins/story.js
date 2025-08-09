/**
 * plugins/fun.story.js
 * Sebuah permainan cerita interaktif dinamis yang dibuat oleh AI (Gemini).
 *
 * Commands:
 * /story          -> Memulai cerita baru.
 * /pilih <A/B>    -> Memilih opsi dalam cerita.
 * /stop           -> Menghentikan cerita saat ini.
 */

// FIX: Menggunakan node-fetch untuk stabilitas request di server
const fetch = require('node-fetch');

const b = (t) => `*${t}*`;
const i = (t) => `_${t}_`;
const LINE = '────────────────────';

function ensureDB() {
    global.db = global.db || {};
    global.db.storytime = global.db.storytime || {};
}

/**
 * Menghasilkan bagian cerita selanjutnya menggunakan Gemini AI.
 * @param {Array} history Riwayat percakapan/cerita sejauh ini.
 * @returns {object|null} Objek berisi { text, choiceA, choiceB, isEnd } atau null jika gagal.
 */
async function generateStoryNode(history) {
    const apiKey = ""; // Disediakan oleh environment Canvas
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: history })
        });
        
        if (!response.ok) {
            console.error("API request failed with status:", response.status);
            return null;
        }

        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            console.error("Invalid API response structure:", result);
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
        console.error("Error calling Gemini API:", error);
        return null;
    }
}

/**
 * Mengirimkan bagian cerita saat ini kepada pengguna.
 */
function sendStoryNode(sock, from, m, storyNode) {
    let message = `${i(storyNode.text)}\n${LINE}\n`;

    if (!storyNode.isEnd) {
        message += `${b('Apa yang akan Anda lakukan?')}\n`;
        message += `➡️ */pilih A* - ${storyNode.choiceA}\n`;
        message += `➡️ */pilih B* - ${storyNode.choiceB}\n`;
    } else {
        message += `${b('~ SELESAI ~')}\n\nKetik */story* untuk memulai petualangan baru.`;
        delete global.db.storytime[from];
    }

    return sock.sendMessage(from, { text: message.trim() }, { quoted: m });
}

module.exports = async (sock, m, text, from) => {
    ensureDB();
    const raw = (text || '').trim();
    const lower = raw.toLowerCase();
    const session = global.db.storytime[from];

    if (lower === '/story' || lower === '/mulai') {
        if (session) {
            return sock.sendMessage(from, { text: "Anda sedang dalam petualangan! Ketik */stop* untuk mengakhiri cerita saat ini." }, { quoted: m });
        }
        
        await sock.sendMessage(from, { text: "Membuat petualangan baru untukmu..." }, { quoted: m });

        const initialPrompt = "Mulai sebuah cerita petualangan fantasi singkat. Berikan narasi awal, lalu berikan dua pilihan (A dan B) untuk pemain. Format balasan harus: narasi cerita, lalu di baris baru 'A. [teks pilihan A]', dan di baris baru 'B. [teks pilihan B]'. Jangan tambahkan kata-kata pembuka seperti 'Tentu'.";
        const history = [{ role: "user", parts: [{ text: initialPrompt }] }];
        
        const storyNode = await generateStoryNode(history);

        if (storyNode) {
            global.db.storytime[from] = { history, currentNode: storyNode };
            return sendStoryNode(sock, from, m, storyNode);
        } else {
            return sock.sendMessage(from, { text: "❌ Gagal memulai cerita. Coba lagi nanti." }, { quoted: m });
        }
    }

    if (lower.startsWith('/pilih ')) {
        if (!session) {
            return sock.sendMessage(from, { text: "Tidak ada petualangan yang sedang berjalan. Ketik */story* untuk memulai." }, { quoted: m });
        }

        const choiceLabel = raw.slice(7).trim().toUpperCase();
        if (choiceLabel !== 'A' && choiceLabel !== 'B') {
             return sock.sendMessage(from, { text: `❌ Pilihan tidak valid. Silakan pilih */pilih A* atau */pilih B*.` }, { quoted: m });
        }

        await sock.sendMessage(from, { react: { text: '📖', key: m.key } });

        const chosenText = choiceLabel === 'A' ? session.currentNode.choiceA : session.currentNode.choiceB;
        const nextPrompt = `Pemain memilih: "${chosenText}". Lanjutkan cerita. Jika ini adalah akhir yang bagus atau buruk, akhiri narasinya dengan kata 'END.' di baris terpisah. Jika tidak, berikan narasi kelanjutan dan dua pilihan baru (A dan B). Ingat formatnya.`;
        
        // Tambahkan prompt terakhir dan pilihan ke riwayat
        session.history.push({ role: "model", parts: [{ text: `${session.currentNode.text}\nA. ${session.currentNode.choiceA}\nB. ${session.currentNode.choiceB}` }] });
        session.history.push({ role: "user", parts: [{ text: nextPrompt }] });

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
