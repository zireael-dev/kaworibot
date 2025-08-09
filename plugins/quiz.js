/**
 * plugins/quiz.js
 * Family 100 – /quiz, /jawab <teks>, /lewat
 * Skor user disimpan otomatis ke db.json (auto-create kalau belum ada).
 * API: https://api.neoxr.eu/api/quiz?apikey=UCIELL
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const API_KEY = 'UCIELL';
const QUIZ_TIMEOUT_MS = 60 * 1000; // 60 detik

// Map sesi kuis per chat
global.quizSessions = global.quizSessions || new Map();

// ---------- Util DB ----------
const DB_PATH = path.join(__dirname, '..', 'db.json');

function loadDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      const initial = { users: {} };
      fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
      return initial;
    }
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(raw || '{"users":{}}');
  } catch {
    return { users: {} };
  }
}

function saveDB(db) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error('[quiz] gagal save db.json:', e.message);
  }
}

function addScore(jid, name, delta = 10) {
  const db = loadDB();
  if (!db.users[jid]) db.users[jid] = { name: name || jid, quiz_score: 0 };
  db.users[jid].quiz_score = (db.users[jid].quiz_score || 0) + delta;
  if (name) db.users[jid].name = name;
  saveDB(db);
  return db.users[jid].quiz_score;
}

// ---------- Helpers ----------
function norm(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')      // strip diacritics
    .replace(/[^a-z0-9\s]/g, ' ')         // keep alnum & space
    .replace(/\s+/g, ' ')                 // collapse spaces
    .trim();
}

function unique(arr) {
  return [...new Set(arr.filter(Boolean))];
}

// ---------- Plugin ----------
module.exports = async (sock, m, text, from) => {
  const raw = (text || '').trim();
  const lower = raw.toLowerCase();

  // Deteksi command
  const isQuiz   = /^\/quiz\b/.test(lower);
  const isAnswer = /^\/jawab\s+/.test(lower);
  const isSkip   = /^\/lewat\b/.test(lower);

  if (!isQuiz && !isAnswer && !isSkip) return;

  // React helper
  async function react(emoji) {
    try {
      await sock.sendMessage(from, { react: { text: emoji, key: m.key } });
    } catch {}
  }

  // ============ START QUIZ ============
  if (isQuiz) {
    // Cek sesi aktif
    if (global.quizSessions.has(from)) {
      const s = global.quizSessions.get(from);
      const remaining = s.remainingAnswers.length;
      return sock.sendMessage(from, {
        text: `❗ Kuis masih berjalan.\nPertanyaan: *${s.question}*\nJawaban tersisa: *${remaining}*.\nBalas dengan */jawab <teks>* atau ketik */lewat* untuk menyerah.`
      }, { quoted: s.msgKey || m });
    }

    await react('⏳');

    // Fetch soal
    let q;
    try {
      const { data } = await axios.get(`https://api.neoxr.eu/api/quiz?apikey=${API_KEY}`);
      // Ekspektasi bentuk:
      // { status: true, data: { question: '...', answers: ['...', ...] } }
      if (!data || !data.status || !data.data) throw new Error('Bad response');
      const question = data.data.question || data.data.soal || data.data.pertanyaan;
      const answers  = data.data.answers || data.data.jawaban || data.data.answer || [];
      if (!question || !answers.length) throw new Error('Empty question/answers');

      q = { question, answers: unique(answers.map(norm)) };
    } catch (e) {
      console.error('quiz fetch error:', e.message);
      return sock.sendMessage(from, { text: '❌ Gagal mengambil soal. Coba lagi ya.' }, { quoted: m });
    }

    // Simpan sesi
    const startMsg = await sock.sendMessage(from, {
      text:
`🎮 *KUIS FAMILY 100*
Pertanyaan:
“*${q.question}*”

Cara main:
• Jawab dengan ketik: */jawab <teks>*
• Menyerah? ketik: */lewat*

⏱️ Waktu: ${Math.floor(QUIZ_TIMEOUT_MS/1000)} detik
Selamat bermain!`
    }, { quoted: m });

    const timer = setTimeout(async () => {
      const s = global.quizSessions.get(from);
      if (!s) return;
      global.quizSessions.delete(from);
      const reveal = s.remainingAnswers.length
        ? `❌ Waktu habis!\nJawaban yang benar:\n• ${s.allAnswers.map(a => a.toUpperCase()).join('\n• ')}`
        : '⏱️ Waktu habis!';
      await sock.sendMessage(from, { text: reveal }, { quoted: s.msgKey });
    }, QUIZ_TIMEOUT_MS);

    global.quizSessions.set(from, {
      question: q.question,
      allAnswers: q.answers,
      remainingAnswers: [...q.answers],
      foundBy: {}, // key=answer, val={jid,name}
      msgKey: startMsg.key,
      timer
    });

    return;
  }

  // ============ ANSWER ============
  if (isAnswer) {
    const s = global.quizSessions.get(from);
    if (!s) {
      return sock.sendMessage(from, { text: 'ℹ️ Belum ada kuis aktif di chat ini. Mulai dengan */quiz*.' }, { quoted: m });
    }

    const given = norm(raw.replace(/^\/jawab\s+/i, ''));
    if (!given) {
      return sock.sendMessage(from, { text: '❓ Format: */jawab <teks>*' }, { quoted: m });
    }

    await react('⏳');

    // Cek jawaban
    const hitIndex = s.remainingAnswers.findIndex(ans => ans === given);
    if (hitIndex === -1) {
      return sock.sendMessage(from, { text: '🙅 Salah/Belum tepat. Coba lagi!' }, { quoted: s.msgKey });
    }

    // Benar → hapus dari remaining + tambah skor
    const found = s.remainingAnswers.splice(hitIndex, 1)[0];
    const sender = m.key.participant || m.key.remoteJid;
    const name = m.pushName || sender.split('@')[0];
    s.foundBy[found] = { jid: sender, name };

    const newScore = addScore(sender, name, 10);
    await react('✅');

    // Progress report
    const left = s.remainingAnswers.length;
    if (left > 0) {
      return sock.sendMessage(from, {
        text:
`✅ *Benar!* +10 poin untuk *${name}* (Total: *${newScore}*)
Jawaban: *${found.toUpperCase()}*
Sisa jawaban: *${left}*

Lanjut: */jawab <teks>* atau menyerah: */lewat*`
      }, { quoted: s.msgKey });
    }

    // Semua terjawab → akhiri sesi
    clearTimeout(s.timer);
    global.quizSessions.delete(from);

    // Rekap pemenang per jawaban
    const lines = Object.entries(s.foundBy).map(([ans, who], i) =>
      `${i + 1}. ${ans.toUpperCase()} — ${who.name}`
    ).join('\n');

    return sock.sendMessage(from, {
      text:
`🎉 *Semua jawaban berhasil ditemukan!*
Pertanyaan: “*${s.question}*”

Rekap:
${lines}

Terima kasih sudah main! Ketik */quiz* lagi untuk soal baru.`
    }, { quoted: s.msgKey });
  }

  // ============ SKIP ============
  if (isSkip) {
    const s = global.quizSessions.get(from);
    if (!s) {
      return sock.sendMessage(from, { text: 'ℹ️ Tidak ada kuis aktif. Mulai dengan */quiz*.' }, { quoted: m });
    }
    clearTimeout(s.timer);
    global.quizSessions.delete(from);

    return sock.sendMessage(from, {
      text:
`➡️ Kamu memilih *lewat*.
Jawaban yang benar:
• ${s.allAnswers.map(a => a.toUpperCase()).join('\n• ')}

Mau coba lagi? Ketik */quiz*.`
    }, { quoted: s.msgKey });
  }
};
