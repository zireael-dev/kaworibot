/**
 * plugins/help.js
 * Help ringkas & jelas (ramah Gen Z)
 * Pakai: /help, /help <kategori>, /help <command>
 */
module.exports = async (sock, m, text, from, watermark) => {
  const raw = (text || '').trim();
  const lower = raw.toLowerCase();

  // Prefix dinamis
  const setting = global.db?.setting || {};
  const PREFIX = setting.multiprefix ? (setting.prefix || ['/', '!']) : [setting.onlyprefix || '/'];
  const usedPrefix = PREFIX.find(p => lower.startsWith(p + 'help')) || '/';
  if (!PREFIX.some(p => lower.startsWith(p + 'help'))) return;

  const arg = raw.slice((usedPrefix + 'help').length).trim().toLowerCase();
  const p = usedPrefix; // biar singkat

  // ===== Data Help =====
  const C = {
    // ==== DOWNLOADER ====
    fb: {
      title: 'Facebook Downloader',
      aliases: ['fbdl', 'fbvid'],
      what: 'Download video FB (prioritas HD).',
      how: `${p}fb <link FB>`,
      example: `${p}fb https://fb.watch/abc123/`,
      notes: 'Kalau >50MB, bot kirim link unduhan.'
    },
    tiktok: {
      title: 'TikTok No-WM',
      aliases: ['tt', 'vt'],
      what: 'Download video TikTok tanpa watermark (foto slide didukung).',
      how: `${p}tiktok <link TT>`,
      example: `${p}tiktok https://www.tiktok.com/@user/video/1234567890`,
      notes: 'Jika file besar, bisa terkirim sebagai link.'
    },
    tikwm: {
      title: 'TikTok With WM',
      aliases: [],
      what: 'Download TikTok dengan watermark.',
      how: `${p}tikwm <link TT>`,
      example: `${p}tikwm https://vt.tiktok.com/abcdef/`,
      notes: 'Alternatif kalau no-WM bermasalah.'
    },
    tikmp3: {
      title: 'TikTok MP3',
      aliases: ['tikmp3'],
      what: 'Ekstrak audio MP3 dari video TikTok.',
      how: `${p}tikmp3 <link TT>`,
      example: `${p}tikmp3 https://m.tiktok.com/v/12345.html`,
      notes: 'Hasil berupa file MP3.'
    },
    ig: {
      title: 'Instagram Downloader',
      aliases: ['igdl'],
      what: 'Download Post/Reels (bisa multi-media).',
      how: `${p}ig <link IG>`,
      example: `${p}ig https://www.instagram.com/p/CK0tLXyAzEI/`,
      notes: 'Akan mengirim semua foto/video pada postingan.'
    },
    x: {
      title: 'X/Twitter Downloader',
      aliases: ['twitter'],
      what: 'Download video dari X/Twitter.',
      how: `${p}x <link X>`,
      example: `${p}x https://x.com/user/status/1234567890`,
      notes: 'Jika belum tersedia, akan ditandai WIP.'
    },
    yt: {
      title: 'YouTube Downloader',
      aliases: ['ytdl'],
      what: 'Download video YouTube (MP4) atau kirim link jika besar.',
      how: `${p}yt <link YouTube>`,
      example: `${p}yt https://youtu.be/abcdef`,
      notes: 'Resolusi & limit ukuran menyesuaikan server.'
    },
    pinterest: {
      title: 'Pinterest Downloader',
      aliases: ['pin', 'pindl'],
      what: 'Download gambar/video dari Pinterest.',
      how: `${p}pinterest <link Pin>`,
      example: `${p}pinterest https://www.pinterest.com/pin/1234567/`,
      notes: 'Jika belum aktif, ditandai WIP.'
    },
    spotify: {
      title: 'Spotify (Info/Preview)',
      aliases: [],
      what: 'Ambil info/preview track/album (bukan full audio).',
      how: `${p}spotify <link Spotify>`,
      example: `${p}spotify https://open.spotify.com/track/123abc`,
      notes: 'Full download tidak didukung (hak cipta).'
    },

    // ==== CONVERTER ====
    smeme: {
      title: 'Sticker Meme',
      aliases: [],
      what: 'Bikin stiker meme dari foto (teks atas|bawah, otomatis UPPERCASE).',
      how: `${p}smeme <atas>|<bawah> (reply/upload foto)`,
      example: `${p}smeme AKU LAPAR|TAPI MALAS MASAK`,
      notes: 'Font Arial putih + outline hitam, size 100.'
    },
    snobg: {
      title: 'Sticker No-Background',
      aliases: ['nobg'],
      what: 'Hapus background foto, kirim sebagai stiker transparan.',
      how: `${p}snobg (reply foto / caption ${p}snobg)`,
      example: `${p}snobg`,
      notes: 'Pastikan reply ke foto, bukan file dokumen.'
    },
    s: {
      title: 'Buat Sticker',
      aliases: ['stick', 'stiker', 'sticker'],
      what: 'Jadiin foto/video ke stiker. Bisa reply atau caption.',
      how: `${p}s  (reply/upload foto/video)`,
      example: `${p}s`,
      notes: 'Video = CROPPED; Foto = FULL. Metadata pakai /setwm.'
    },
    toimg: {
      title: 'Sticker → Gambar',
      aliases: [],
      what: 'Ubah stiker (non-animasi) jadi gambar.',
      how: `${p}toimg (reply stiker)`,
      example: `${p}toimg`,
      notes: 'Stiker animasi tidak didukung.'
    },
    emojimix: {
      title: 'Emoji Mix',
      aliases: ['mix', 'emomix'],
      what: 'Gabung 2 emoji jadi 1 stiker emoji.',
      how: `${p}emojimix 😳+😩`,
      example: `${p}emojimix 😺+🌮`,
      notes: 'Format: emoji1+emoji2.'
    },

    // ==== GROUP TOOLS ====
    tageveryone: {
      title: 'Tag Everyone',
      aliases: ['hidetag'],
      what: 'Tag semua member grup.',
      how: `${p}tageveryone on  (atau off)`,
      example: `${p}tageveryone on`,
      notes: 'Hanya admin/owner bot dapat menyalakan.'
    },
    antilink: {
      title: 'Anti Link',
      aliases: [],
      what: 'Auto deteksi & tindak link di grup.',
      how: `${p}antilink on (atau off)`,
      example: `${p}antilink on`,
      notes: 'Aksi lanjut (hapus/kick) menyesuaikan setting.'
    },
    welcome: {
      title: 'Welcome Message',
      aliases: [],
      what: 'Sambut member baru otomatis.',
      how: `${p}welcome on (atau off)`,
      example: `${p}welcome on`,
      notes: 'Pesan sapaan bisa dikustom (WIP).'
    },

    // ==== INFO ====
    userinfo: {
      title: 'User Info',
      aliases: ['me'],
      what: 'Profil singkat kamu (limit/premium: Coming Soon).',
      how: `${p}userinfo`,
      example: `${p}userinfo`,
      notes: 'Menampilkan nama, JID, status umum.'
    },
    server: {
      title: 'Server Info',
      aliases: [],
      what: 'Ringkasan OS, CPU, RAM, uptime, lokasi (tanpa IP publik).',
      how: `${p}server`,
      example: `${p}server`,
      notes: 'Timezone/ISP dicoba dideteksi otomatis.'
    },
    stat: {
      title: 'Bot Status',
      aliases: ['botstat'],
      what: 'Statistik bot (users, groups, hitstat, runtime) + system flags.',
      how: `${p}stat`,
      example: `${p}stat`,
      notes: 'Sebagian nilai “Coming Soon” sampai fitur aktif.'
    },
    owner: {
      title: 'Kontak Owner',
      aliases: [],
      what: 'Kirim vCard kontak owner.',
      how: `${p}owner`,
      example: `${p}owner`,
      notes: 'Jika vCard gagal, fallback kirim nomor teks.'
    },

    // ==== OWNER ====
    setwm: {
      title: 'Set Watermark Sticker',
      aliases: [],
      what: 'Set pack & author untuk metadata sticker.',
      how: `${p}setwm <Pack> | <Author>`,
      example: `${p}setwm ©Organisasi Pencinta Masakan | Kawori-Bot by Zireael`,
      notes: 'Hanya owner.'
    },
    ban: {
      title: 'Ban User',
      aliases: ['banned'],
      what: 'Blokir akses user ke semua command.',
      how: `${p}ban @user`,
      example: `${p}ban @62812xxxx`,
      notes: 'Owner/Co-owner.'
    },
    unban: {
      title: 'Unban User',
      aliases: [],
      what: 'Buka ban user.',
      how: `${p}unban @user`,
      example: `${p}unban @62812xxxx`,
      notes: 'Owner/Co-owner.'
    },
    bc: {
      title: 'Broadcast ke Pengguna',
      aliases: [],
      what: 'Kirim pesan massal ke semua user yang pernah chat.',
      how: `${p}bc <pesan>`,
      example: `${p}bc Halo! Bot di-update. Coba /menu ya.`,
      notes: 'Hati-hati spam. Owner saja.'
    },
    bcgc: {
      title: 'Broadcast ke Grup',
      aliases: [],
      what: 'Kirim pesan ke semua grup yang bot ikuti.',
      how: `${p}bcgc <pesan>`,
      example: `${p}bcgc Info: maintenance jam 02.00 WIB.`,
      notes: 'Owner saja.'
    },
    restart: {
      title: 'Restart Bot',
      aliases: [],
      what: 'Restart proses bot (pm2/forever disarankan).',
      how: `${p}restart`,
      example: `${p}restart`,
      notes: 'Owner saja. Bot PM konfirmasi setelah hidup.'
    },
    update: {
      title: 'Update dari Git',
      aliases: [],
      what: 'git pull lalu restart otomatis.',
      how: `${p}update`,
      example: `${p}update`,
      notes: 'Pastikan repo & remote sudah diset di VPS.'
    }
  };

  // ===== Kategori → daftar command =====
  const K = {
    downloader: ['fb','tiktok','tikwm','tikmp3','ig','x','yt','pinterest','spotify'],
    converter:  ['smeme','snobg','s','toimg','emojimix'],
    grouptools: ['tageveryone','antilink','welcome'],
    study:      ['ocr','translate','pdf'],  // jika belum ada: WIP
    fun:        ['tebak','quiz'],           // jika belum ada: WIP
    info:       ['userinfo','server','stat','owner','help'],
    owner:      ['setwm','ban','unban','bc','bcgc','restart','update']
  };

  // ===== Helpers =====
  const renderIndex = () => [
    '🆘 *Help Index*',
    '',
    'Kategori:',
    `• ${p}help downloader`,
    `• ${p}help converter`,
    `• ${p}help grouptools`,
    `• ${p}help study`,
    `• ${p}help fun`,
    `• ${p}help info`,
    `• ${p}help owner`,
    '',
    'Atau detail command:',
    `• ${p}help smeme`,
    `• ${p}help tiktok`,
    `• ${p}help sticker`,
    '',
    `_Prefix aktif: ${PREFIX.join(' ')}_`,
    '',
    watermark
  ].join('\n');

  const resolveCommandKey = (name) => {
    const n = name.replace(/^[-/!#.]/, ''); // buang 1 prefix kalau ada
    if (C[n]) return n;
    for (const key of Object.keys(C)) {
      const a = C[key].aliases || [];
      if (a.map(s => s.toLowerCase()).includes(n)) return key;
    }
    if (n === 'sticker' || n === 'stiker' || n === 'stick') return 's';
    return null;
  };

  const renderCategory = (key) => {
    const list = K[key];
    if (!list) return null;
    const titleMap = {
      downloader: '⬇️ Downloader',
      converter:  '🔄 Converter',
      grouptools: '🛠️ Group Tools',
      study:      '📚 Study Zone',
      fun:        '🎲 Fun',
      info:       'ℹ️ Info',
      owner:      '👑 Owner'
    };
    const lines = [`*${titleMap[key]}*`, ''];
    for (const cmdKey of list) {
      const c = C[cmdKey] || {
        title: cmdKey.toUpperCase(),
        what: 'Work in Progress',
        how: `${p}${cmdKey}`,
        example: `${p}${cmdKey}`,
        notes: 'Segera hadir.'
      };
      const alts = (c.aliases && c.aliases.length) ? ` (alias: ${c.aliases.join(', ')})` : '';
      lines.push(`• *${p}${cmdKey}*${alts}`);
      lines.push(`  - ${c.what}`);
      lines.push(`  - Cara: ${c.how}`);
      lines.push(`  - Contoh: ${c.example}`);
      if (c.notes) lines.push(`  - Catatan: ${c.notes}`);
      lines.push('');
    }
    lines.push(watermark);
    return lines.join('\n');
  };

  const renderCommand = (key) => {
    const c = C[key];
    if (!c) return null;
    const alts = (c.aliases && c.aliases.length) ? ` (alias: ${c.aliases.join(', ')})` : '';
    const lines = [
      `*${c.title}*${alts}`,
      `- ${c.what}`,
      `- Cara: ${c.how}`,
      `- Contoh: ${c.example}`
    ];
    if (c.notes) lines.push(`- Catatan: ${c.notes}`);
    lines.push('', watermark);
    return lines.join('\n');
  };

  // ===== Routing =====
  if (!arg) {
    return sock.sendMessage(from, { text: renderIndex() }, { quoted: m });
  }

  if (K[arg]) {
    const out = renderCategory(arg);
    if (out) return sock.sendMessage(from, { text: out }, { quoted: m });
  }

  const k = resolveCommandKey(arg);
  if (k) {
    const out = renderCommand(k);
    if (out) return sock.sendMessage(from, { text: out }, { quoted: m });
  }

  return sock.sendMessage(from, {
    text: `❓ Nggak nemu *${arg}*.\nCoba: *${p}help* lalu pilih kategori/command.`
  }, { quoted: m });
};
