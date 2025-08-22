// KaworiBot v0.1 – Main entry
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const { checkLimit } = require('./lib/limit.js'); // <-- Import limit checker

// ====== KaworiBot Banner ======
console.clear();
console.log(`
╦╔═╔═╗╦ ╦╔═╗╦═╗╦
╠╩╗╠═╣║║║║ ║╠╦╝║
╩ ╩╩ ╩╚╩╝╚═╝╩╚═╩

Kawori-Bot v0.1
made with love by Zireael
`);
console.log('🔗 Repo: https://github.com/zireael-dev/kaworibot (coming soon!)');
console.log('💡 KaworiBot is starting...\n');

// ——— Inisialisasi & Autosave Global DB ———
const dbFile = path.join(__dirname, 'db.json');

// Load dari db.json jika ada, kalau tidak bikin baru
if (fs.existsSync(dbFile)) {
  try {
    global.db = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    console.log('📦 Database loaded from db.json');
  } catch (e) {
    console.warn('⚠️  Gagal load db.json, file rusak atau format salah. Memulai DB baru.');
    global.db = {};
  }
} else {
  global.db = {};
}
// FIX: Inisialisasi yang lebih aman untuk mencegah error '.includes'
global.db.setting      = global.db.setting      || {};
global.db.bannedUsers  = Array.isArray(global.db.bannedUsers) ? global.db.bannedUsers : [];
global.db.users        = Array.isArray(global.db.users) ? global.db.users : [];
global.db.groups       = Array.isArray(global.db.groups) ? global.db.groups : [];


// Autosave DB ke file setiap 10 detik
setInterval(() => {
  try {
    fs.writeFileSync(dbFile, JSON.stringify(global.db, null, 2));
  } catch (e) {
    console.error('❌ Gagal autosave db.json:', e.message);
  }
}, 10_000);

// ——— Plugin loader ———
const pluginsDir = path.join(__dirname, 'plugins');
const plugins = [];
if (fs.existsSync(pluginsDir)) {
  const files = fs.readdirSync(pluginsDir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    try {
      const mod = require(path.join(pluginsDir, file));
      const plugin = mod.default || mod;
      if (typeof plugin === 'function') {
        plugins.push(plugin);
        // Tampilkan plugin yang sukses loading
        console.log(`  ➜  ${file.replace(/\.js$/, '')} loaded`);
      } else {
        console.warn(`  ⚠  Skipped: ${file} (not a function)`);
      }
    } catch (err) {
      console.error(`  ❌  Error loading ${file}:`, err.message);
    }
  }
}
console.log('\n✅ KaworiBot plugin system ready!\n');

// Watermark default (untuk greeting/menu/dll)
const watermark = '⫷ ᴋᴀᴡᴏʀɪ-ʙᴏᴛ, ᴀ sɪᴍᴘʟᴇ ᴡʜᴀᴛsᴀᴘᴘ ʙᴏᴛ ᴍᴀᴅᴇ ʙʏ ᴢɪʀᴇᴀᴇʟ ⫸';

// Greeting function
function greetingWithEmoji(name) {
  const hour = new Date().getHours();
  let greeting, emoji;
  if (hour >= 4 && hour < 11) { greeting = 'Selamat pagi'; emoji = '🌅'; }
  else if (hour < 15)      { greeting = 'Selamat siang'; emoji = '☀️'; }
  else if (hour < 18)      { greeting = 'Selamat sore';  emoji = '🌇'; }
  else                     { greeting = 'Selamat malam'; emoji = '🌙'; }
  return `${emoji} ${greeting}, ${name}!\n${watermark}`;
}

// ——— START BOT ———
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: state,
    version
  });

  // — Connection lifecycle —
  sock.ev.on('connection.update', ({ connection, qr, lastDisconnect }) => {
    if (qr) {
      console.log('🔍 QR code received, scan please:');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') {
      console.log('✅ Bot connected.');

      // === Auto-PM owner setelah restart (rolling message, non-alay) ===
      const flagFile = path.join(__dirname, 'just_restarted.txt');
      if (fs.existsSync(flagFile)) {
        const rollingMsg = [
          'Bot sudah selesai restart dan kembali online.',
          'KaworiBot is back online. Semua sistem berjalan normal.',
          'Restart berhasil, bot siap digunakan.',
          'Bot aktif lagi setelah restart. Silakan cek fitur baru atau tes bug fix.',
          'Selesai restart. Kalau ada kendala, tinggal chat aja.',
          'Bot sudah nyala lagi. Siap standby seperti biasa.',
          'Restart done. Kalau ada yang perlu dicek, silakan kabari.',
        ];
        let config = {};
        try {
          config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
        } catch {}
        const owners = config.owner || [];
        const pick = rollingMsg[Math.floor(Math.random() * rollingMsg.length)];
        for (let jid of owners) {
          sock.sendMessage(jid, { text: pick });
        }
        fs.unlinkSync(flagFile);
      }
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log(`❌ Terputus: ${DisconnectReason[code] || code}`);
      if (code === DisconnectReason.loggedOut) {
        fs.rmSync('auth', { recursive: true, force: true });
        console.log('🗑️ Credentials cleared. Restarting...');
      }
      startBot();
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // — Message handler —
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;

    // === AUTO READ ALL PESAN ===
    try {
      await sock.readMessages([m.key]);
    } catch (e) {
      console.error('Auto-read failed:', e.message);
    }

    const from = m.key.remoteJid;
    const sender = m.key.participant || from;
    const text = m.message.conversation || m.message.extendedTextMessage?.text || '';
    const lower = text.toLowerCase();

    // — Skip banned users —
    if (global.db.bannedUsers.includes(sender)) return;

    // --- Story Time Game Lock (Updated) ---
global.db.storytime = global.db.storytime || {};
const storySession = global.db.storytime[from];

// Cek hanya jika ada sesi DAN pengirim pesan adalah pemainnya
if (storySession && storySession.playerJid === sender) {
    const allowedCommands = ['/pilih', '/stop', '/berhenti', '/story', '/mulai', '/nama', '/acak'];
    const isStoryCommand = allowedCommands.some(cmd => lower.startsWith(cmd));
    
    // Jika sesi ada, pemainnya adalah pengirim, DAN perintahnya BUKAN perintah cerita
    if (!isStoryCommand) {
        // Kirim peringatan dan HENTIKAN eksekusi lebih lanjut
        return sock.sendMessage(from, { text: "Kamu sedang dalam petualangan! Ketik */stop* untuk mengakhiri cerita sebelum menggunakan perintah lain." }, { quoted: m });
    }
}
// --- End of Game Lock ---

    // --- Sistem Limit Harian ---
    const downloaderCommands = ['/fb', '/vt', '/tiktok', '/ig', '/x', '/twit', '/tw', '/yt', '/pinterest', '/spotify'];
    const isDownloaderCommand = downloaderCommands.some(cmd => lower.startsWith(cmd));

    if (isDownloaderCommand) {
        if (checkLimit(sender)) {
            const limitMessage = `⚠️ *Limit Harian Habis* ⚠️\n\nLimit penggunaan harian Anda untuk fitur downloader telah tercapai. Limit akan direset besok.\n\nUpgrade ke *Premium* untuk penggunaan tanpa batas!\nKetik */premium* untuk info lebih lanjut.`;
            return sock.sendMessage(from, { text: limitMessage }, { quoted: m });
        }
    }
    // --- End of Limit System ---

    // — Simpan list pengguna unik untuk broadcast (/bc) —
    if (!global.db.users.includes(sender)) global.db.users.push(sender);

    // — Simpan list grup unik untuk broadcast (/bcgc) —
    if (from.endsWith('@g.us') && !global.db.groups.includes(from)) {
      global.db.groups.push(from);
    }

    // Jalankan setiap plugin
    for (const plugin of plugins) {
      try {
        await plugin(sock, m, text, from, watermark);
      } catch (err) {
        console.error('❌ Plugin error:', err.message);
      }
    }
  });

  // — Welcome message for group —
  sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
    if (action === 'add') {
      for (const p of participants) {
        const name = `@${p.split('@')[0]}`;
        const greet = greetingWithEmoji(name);
        await sock.sendMessage(id, { text: greet, mentions: [p] });
      }
    }
  });
}

startBot();
