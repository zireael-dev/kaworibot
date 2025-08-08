/**
 * plugins/menu.js
 * Menu interaktif KaworiBot, versi mobile-friendly, vertikal, ornamen garis.
 */
const fetch = require('node-fetch');
const { PrayerTimes, CalculationMethod, Coordinates } = require('adhan');

// Garis horizontal tebal dan tipis
const LINE_BOLD = '━━━━━━━━━━━━━━';
const LINE_THIN = '────────────────────';

// Helper fungsi bold
const b = (t) => `*${t}*`;

module.exports = async (sock, m, text, from, watermark) => {
  const cmd = (text || '').trim().toLowerCase();
  if (!cmd.startsWith('/menu')) return;

  // Rolling sapaan
  const rolls = [
    'Semoga harimu penuh energi dan produktif! ⚡',
    'Ada cerita seru hari ini? Yuk, sharing!',
    'Jangan lupa minum air putih, ya! 💧',
    'Kerja bagus! Jangan lupa rehat sebentar 😊',
    'Langit cerah, semangat pun berkobar! ☀️',
    'Apapun cuacanya, mood tetap ceria! 🎶'
  ];
  const randomRoll = rolls[Math.floor(Math.random() * rolls.length)];

  // Info waktu & greeting
  const now = new Date();
  const h = now.getHours();
  const emoji = h >= 4 && h < 11 ? '🌅' : h < 15 ? '☀️' : h < 18 ? '🌇' : '🌙';
  const greet = h >= 4 && h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
  const userName = m.pushName || from.split('@')[0];

  // Cuaca Jakarta
  let weatherText = '☁️ Cuaca: tidak tersedia';
  try {
    const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-6.2&longitude=106.8167&current_weather=true');
    const data = await res.json();
    const cw = data.current_weather;
    weatherText = `☁️ ${cw.temperature}°C, angin ${cw.windspeed} km/h`;
  } catch {}

  // Jadwal sholat
  let prayerText = '🕌 Jadwal sholat tidak tersedia';
  try {
    const coords = new Coordinates(-6.2, 106.8167);
    const params = CalculationMethod.MuslimWorldLeague();
    const times = new PrayerTimes(coords, now, params);
    const prayers = ['fajr','sunrise','dhuhr','asr','maghrib','isha'];
    const next = prayers.find(p => times[p] > now) || 'fajr';
    const nt = times[next];
    const diff = Math.max(0, Math.floor((nt - now) / 60000));
    prayerText = `🕌 ${next} dalam ${Math.floor(diff/60)}j ${diff%60}m (pukul ${nt.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})})`;
  } catch {}

  let lines = [];
  switch (cmd) {
    // ================= MENU UTAMA =================
    case '/menu':
      lines = [
        LINE_BOLD,
        `${emoji} ${b(greet)}, ${b(userName)}!`,
        randomRoll,
        weatherText,
        prayerText,
        LINE_BOLD,
        '',
        '📂 ' + b('MENU UTAMA'),
        LINE_BOLD,
        '⬇️ Downloader\n/menu downloader',
        LINE_THIN,
        '🛠️ Group Tools\n/menu grouptools',
        LINE_THIN,
        '🔄 Converter\n/menu converter',
        LINE_THIN,
        '📚 Study Zone\n/menu study',
        LINE_THIN,
        '🎲 Fun Zone\n/menu fun',
        LINE_THIN,
        'ℹ️ Info\n/menu info',
        LINE_THIN,
        '👑 Owner\n/menu owner',
        LINE_BOLD,
        `≪${watermark.replace(/\s+/g, ' ').trim()}≫`
      ];
      break;

      // =============== MENU OWNER ===============
    case '/menu owner':
      lines = [
        LINE_BOLD,
        '👑 ' + b('OWNER TOOLS'),
        LINE_BOLD,
        '🌟 Set watermark sticker\n/setwm <text>',
        LINE_THIN,
        '🚫 Ban user\n/ban @user',
        LINE_THIN,
        '✅ Unban user\n/unban @user',
        LINE_THIN,
        '🔒 Block user\n/block @user',
        LINE_THIN,
        '🔓 Unblock user\n/unblock @user',
        LINE_THIN,
        '👑 Add premium\n/addprem @user',
        LINE_THIN,
        '🧑‍🤝‍🧑 Add Co-Owner\n/addcoowner @user',
        LINE_THIN,
        '📣 Broadcast users\n/bc <text>',
        LINE_THIN,
        '📢 Broadcast groups\n/bcgc <text>',
        LINE_THIN,
        '🔤 Set prefix\n/prefix <char>',
        LINE_THIN,
        '🔗 Set link aduan\n/setlink <url>',
        LINE_THIN,
        '🖼️ Set cover menu\n/setcover <url>',
        LINE_THIN,
        '🔄 Restart Bot\n/restart',
        LINE_BOLD,
        '⬅️ Kembali\n/menu',
        LINE_BOLD,
        `≪${watermark.replace(/\s+/g, ' ').trim()}≫`
      ];
      break;

      // =============== MENU DOWNLOADER ===============
    case '/menu downloader':
      lines = [
        LINE_BOLD,
        '⬇️ ' + b('DOWNLOADER'),
        LINE_BOLD,
        '📺 Facebook\n/fb [url]',
        LINE_THIN,
        '🎵 TikTok\n/tiktok [url]',
        LINE_THIN,
        '📸 Instagram\n/ig [url]',
        LINE_THIN,
        '🐦 X/Twitter\n/x [url]',
        LINE_THIN,
        '📌 Pinterest\n/pinterest [url]',
        LINE_THIN,
        '▶️ YouTube\n/yt [url]',
        LINE_THIN,
        '🎧 Spotify\n/spotify [url]',
        LINE_BOLD,
        '⬅️ Kembali\n/menu',
        LINE_BOLD,
        `≪${watermark.replace(/\s+/g, ' ').trim()}≫`
      ];
      break;

      // =============== MENU GROUPTOOLS ===============
    case '/menu grouptools':
      lines = [
        LINE_BOLD,
        '🛠️ ' + b('GROUP TOOLS'),
        LINE_BOLD,
        '🗑️ Anti delete\n/antidelete on|off',
        LINE_THIN,
        '🔗 Anti link\n/antilink on|off',
        LINE_THIN,
        '💥 Anti virtex\n/antivritex on|off',
        LINE_THIN,
        '📢 Tag everyone\n/tageveryone on|off',
        LINE_THIN,
        '👋 Sapaan grup\n/welcome on|off',
        LINE_THIN,
        '👢 Kick member\n/kick @user',
        LINE_BOLD,
        '⬅️ Kembali\n/menu',
        LINE_BOLD,
        `≪${watermark.replace(/\s+/g, ' ').trim()}≫`
      ];
      break;

      // =============== MENU CONVERTER ===============
    case '/menu converter':
      lines = [
        LINE_BOLD,
        '🔄 ' + b('CONVERTER'),
        LINE_BOLD,
        '🤣 Sticker meme\n/smeme (reply/upload)',
        LINE_THIN,
        '✂️ Remove background\n/snobg',
        LINE_THIN,
        '🌟 Buat stiker\n/sticker',
        LINE_THIN,
        '🖼️ Stiker ke gambar\n/toimg',
        LINE_THIN,
        '🤝 Gabung emoji\n/emojimix e1+e2',
        LINE_BOLD,
        '⬅️ Kembali\n/menu',
        LINE_BOLD,
        `≪${watermark.replace(/\s+/g, ' ').trim()}≫`
      ];
      break;

      // =============== MENU STUDY ===============
    case '/menu study':
      lines = [
        LINE_BOLD,
        '📚 ' + b('STUDY ZONE'),
        LINE_BOLD,
        '📷 OCR text\n/ocr',
        LINE_THIN,
        '🌐 Terjemahan teks\n/translate [teks]',
        LINE_THIN,
        '📚 Cari buku\n/eperpus [query]',
        LINE_THIN,
        '📄 PDF converter\n/pdf [file]',
        LINE_BOLD,
        '⬅️ Kembali\n/menu',
        LINE_BOLD,
        `≪${watermark.replace(/\s+/g, ' ').trim()}≫`
      ];
      break;

      // =============== MENU FUN ===============
    case '/menu fun':
      lines = [
        LINE_BOLD,
        '🎲 ' + b('FUN ZONE'),
        LINE_BOLD,
        '🧩 Tebak-tebakan\nTebak kata',
        LINE_THIN,
        '❓ Quiz sederhana\nPertanyaan acak',
        LINE_THIN,
        '💡 Trivia acak\nFakta menarik',
        LINE_THIN,
        '📖 Story time\nKisah interaktif',
        LINE_BOLD,
        '⬅️ Kembali\n/menu',
        LINE_BOLD,
        `≪${watermark.replace(/\s+/g, ' ').trim()}≫`
      ];
      break;

      // =============== MENU INFO ===============
    case '/menu info':
      lines = [
        LINE_BOLD,
        'ℹ️ ' + b('INFO'),
        LINE_BOLD,
        '🙋 Profil kamu\n/userinfo',
        LINE_THIN,
        '💎 Premium & donasi\n/premium',
        LINE_THIN,
        '🖥️ Status server\n/server',
        LINE_THIN,
        '🤖 Status bot\n/status',
        LINE_THIN,
        '📬 Form aduan\n/aduan',
        LINE_THIN,
        '👑 Kontak owner\n/owner',
        LINE_BOLD,
        '⬅️ Kembali\n/menu',
        LINE_BOLD,
        `≪${watermark.replace(/\s+/g, ' ').trim()}≫`
      ];
      break;

      // =============== MENU DEFAULT (ERROR) ===============
    default:
      lines = [
        LINE_BOLD,
        b('Perintah tidak dikenali!'),
        'Ketik /menu untuk membuka menu utama.',
        LINE_BOLD,
        `≪${watermark.replace(/\s+/g, ' ').trim()}≫`
      ];
  }

  await sock.sendMessage(from, { text: lines.join('\n') });
};
