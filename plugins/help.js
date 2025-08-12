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
      what: 'Bikin stiker meme dari foto (teks atas|bawah).',
      how: `${p}smeme <atas>|<bawah> (reply/upload foto)`,
      example: `${p}smeme AKU LAPAR|TAPI MALAS MASAK`,
      notes: 'Font Arial putih + outline hitam.'
    },
    snobg: {
      title: 'Sticker No-Background',
      aliases: ['nobg'],
      what: 'Hapus background foto, kirim sebagai stiker.',
      how: `${p}snobg (reply/upload foto)`,
      example: `${p}snobg`,
      notes: 'Pastikan reply ke foto, bukan file dokumen.'
    },
    s: {
      title: 'Buat Sticker',
      aliases: ['stick', 'stiker', 'sticker'],
      what: 'Jadiin foto/video ke stiker.',
      how: `${p}s (reply/upload foto/video)`,
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
    brat: {
        title: 'Brat Generator',
        aliases: [],
        what: 'Membuat stiker meme "brat" dengan teks custom.',
        how: `${p}brat <teks>`,
        example: `${p}brat kawori bot`,
        notes: 'Maksimal 30 karakter.'
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
    antidelete: {
        title: 'Anti Delete',
        aliases: [],
        what: 'Mencegah pesan yang dihapus agar tidak hilang di grup.',
        how: `${p}antidelete on|off`,
        example: `${p}antidelete on`,
        notes: 'Hanya admin. Bot harus online untuk menangkap pesan.'
    },
    antilink: {
      title: 'Anti Link',
      aliases: [],
      what: 'Auto deteksi & tindak link di grup.',
      how: `${p}antilink on|off`,
      example: `${p}antilink on`,
      notes: 'Aksi lanjut (hapus/kick) menyesuaikan setting.'
    },
    antivritex: {
        title: 'Anti Virtex',
        aliases: [],
        what: 'Mendeteksi & menindak pesan virtex/berbahaya.',
        how: `${p}antivritex on|off`,
        example: `${p}antivritex on`,
        notes: 'Hanya admin.'
    },
    everyone: {
      title: 'Tag Everyone (Hidetag)',
      aliases: ['hidetag'],
      what: 'Tag semua member grup tanpa menampilkan daftar nama.',
      how: `${p}everyone <pesan>`,
      example: `${p}everyone Rapat dadakan!`,
      notes: 'Hanya admin.'
    },
    welcome: {
      title: 'Welcome Message',
      aliases: [],
      what: 'Sambut member baru otomatis.',
      how: `${p}welcome on|off`,
      example: `${p}welcome on`,
      notes: 'Pesan sapaan bisa dikustom (WIP).'
    },
    promote: {
        title: 'Promote Member',
        aliases: [],
        what: 'Menjadikan anggota biasa sebagai admin.',
        how: `${p}promote @user`,
        example: `${p}promote @Zireael`,
        notes: 'Hanya admin. Bot juga harus admin.'
    },
    demote: {
        title: 'Demote Admin',
        aliases: [],
        what: 'Menurunkan admin menjadi anggota biasa.',
        how: `${p}demote @user`,
        example: `${p}demote @Zireael`,
        notes: 'Hanya admin. Bot juga harus admin.'
    },
    kick: {
        title: 'Kick Member',
        aliases: [],
        what: 'Mengeluarkan anggota dari grup.',
        how: `${p}kick @user`,
        example: `${p}kick @Zireael`,
        notes: 'Hanya admin. Bot juga harus admin.'
    },

    // ==== UTILITY TOOLS ====
    resi: {
        title: 'Cek Resi',
        aliases: [],
        what: 'Melacak status paket dari berbagai kurir.',
        how: `${p}resi <kurir>|<no_resi>`,
        example: `${p}resi jne|123456789`,
        notes: 'Kurir: jne, jnt, sicepat, dll.'
    },
    ongkir: {
        title: 'Cek Ongkir',
        aliases: [],
        what: 'Memeriksa biaya ongkos kirim.',
        how: `${p}ongkir <asal>|<tujuan>|<berat_gram>`,
        example: `${p}ongkir jakarta|bandung|1000`,
        notes: 'Bot akan menampilkan tarif dari berbagai kurir.'
    },

    // ==== ANIMANGA & WATCHLIST ====
    manga: {
        title: 'Manga Search',
        aliases: [],
        what: 'Mencari informasi detail tentang manga.',
        how: `${p}manga <judul>`,
        example: `${p}manga one piece`,
        notes: 'Gunakan /m <nomor> untuk detail.'
    },
    anime: {
        title: 'Anime Search',
        aliases: [],
        what: 'Mencari informasi & link download anime.',
        how: `${p}anime <judul>`,
        example: `${p}anime jujutsu kaisen`,
        notes: 'Gunakan /a <nomor> untuk detail.'
    },
    film: {
        title: 'Film Search',
        aliases: [],
        what: 'Mencari informasi & link download film.',
        how: `${p}film <judul>`,
        example: `${p}film godzilla`,
        notes: 'Gunakan /f <nomor> untuk detail.'
    },
    series: {
        title: 'Series Search',
        aliases: [],
        what: 'Mencari informasi & link download serial TV.',
        how: `${p}series <judul>`,
        example: `${p}series loki`,
        notes: 'Gunakan /seri <nomor> untuk detail.'
    },
    drakor: {
        title: 'Drakor Search',
        aliases: [],
        what: 'Mencari informasi & link download drama Korea.',
        how: `${p}drakor <judul>`,
        example: `${p}drakor queen of tears`,
        notes: 'Fitur ini masih dalam pengembangan (WIP).'
    },

    // ==== STUDY ZONE ====
    ocr: {
        title: 'OCR (Image to Text)',
        aliases: [],
        what: 'Mengekstrak teks dari gambar.',
        how: `${p}ocr (reply/upload foto)`,
        example: `${p}ocr`,
        notes: 'Akurasi tergantung kualitas gambar.'
    },
    translate: {
        title: 'Translate',
        aliases: ['tr'],
        what: 'Menerjemahkan teks ke bahasa lain.',
        how: `${p}translate <kode_bahasa> <teks>`,
        example: `${p}translate id hello world`,
        notes: 'Gunakan /bahasa untuk daftar kode.'
    },
    eperpus: {
        title: 'E-Perpus Search',
        aliases: [],
        what: 'Mencari dan mengunduh buku dari perpustakaan digital.',
        how: `${p}eperpus <judul buku>`,
        example: `${p}eperpus laskar pelangi`,
        notes: 'Ketersediaan buku tergantung sumber (WIP).'
    },
    topdf: {
        title: 'PDF Converter',
        aliases: [],
        what: 'Mengubah gambar atau dokumen menjadi file PDF.',
        how: `${p}topdf (reply/upload file)`,
        example: `${p}topdf`,
        notes: 'Mendukung gambar dan beberapa format dokumen.'
    },

    // ==== FUN ZONE ====
    tekateki: {
        title: 'Teka-Teki',
        aliases: ['tebak'],
        what: 'Memberikan teka-teki acak untuk dijawab.',
        how: `${p}tekateki`,
        example: `${p}tekateki`,
        notes: 'Jawab di chat untuk melanjutkan.'
    },
    quiz: {
        title: 'Quiz Family 100',
        aliases: [],
        what: 'Bermain kuis interaktif Family 100.',
        how: `${p}quiz`,
        example: `${p}quiz`,
        notes: 'Fitur masih dalam pengembangan (WIP).'
    },
    fakta: {
        title: 'Fakta Acak',
        aliases: ['trivia'],
        what: 'Menampilkan fakta menarik acak yang sudah diterjemahkan.',
        how: `${p}fakta`,
        example: `${p}fakta`,
        notes: 'Fakta baru setiap saat dari internet.'
    },
    story: {
        title: 'Story Interactive',
        aliases: [],
        what: 'Memulai petualangan cerita interaktif yang dibuat oleh AI.',
        how: `${p}story`,
        example: `${p}story`,
        notes: 'Pilihanmu akan menentukan alur cerita.'
    },
    ttt: {
        title: 'Tic-Tac-Toe',
        aliases: [],
        what: 'Bermain game Tic-Tac-Toe di grup.',
        how: `${p}ttt`,
        example: `${p}ttt`,
        notes: 'Pemain kedua bergabung dengan /join.'
    },

    // ==== INFO ====
    userinfo: {
      title: 'User Info',
      aliases: ['me'],
      what: 'Profil singkat kamu.',
      how: `${p}userinfo`,
      example: `${p}userinfo`,
      notes: 'Menampilkan nama, JID, status umum.'
    },
    premium: {
        title: 'Info Premium',
        aliases: ['donasi'],
        what: 'Menampilkan informasi tentang keuntungan dan cara donasi.',
        how: `${p}premium`,
        example: `${p}premium`,
        notes: '-'
    },
    server: {
      title: 'Server Info',
      aliases: [],
      what: 'Ringkasan OS, CPU, RAM, uptime, lokasi.',
      how: `${p}server`,
      example: `${p}server`,
      notes: 'Timezone/ISP dicoba dideteksi otomatis.'
    },
    status: {
      title: 'Bot Status',
      aliases: ['botstat', 'stat'],
      what: 'Statistik bot (users, groups, runtime).',
      how: `${p}status`,
      example: `${p}status`,
      notes: '-'
    },
    aduan: {
        title: 'Form Aduan',
        aliases: [],
        what: 'Menampilkan link untuk mengirim keluhan atau saran.',
        how: `${p}aduan`,
        example: `${p}aduan`,
        notes: 'Link diatur oleh owner.'
    },
    owner: {
      title: 'Kontak Owner',
      aliases: [],
      what: 'Kirim vCard kontak owner.',
      how: `${p}owner`,
      example: `${p}owner`,
      notes: 'Jika vCard gagal, fallback kirim nomor teks.'
    },
    help: {
        title: 'Help',
        aliases: [],
        what: 'Menampilkan menu bantuan ini.',
        how: `${p}help [kategori/command]`,
        example: `${p}help downloader`,
        notes: '-'
    },

    // ==== OWNER ====
    setwm: {
      title: 'Set Watermark Sticker',
      aliases: [],
      what: 'Set pack & author untuk metadata sticker.',
      how: `${p}setwm <Pack> | <Author>`,
      example: `${p}setwm ©Kawori | by Zireael`,
      notes: 'Hanya owner.'
    },
    ban: {
      title: 'Ban User',
      aliases: ['banned'],
      what: 'Blokir akses user ke semua command.',
      how: `${p}ban @user`,
      example: `${p}ban @62812xxxx`,
      notes: 'Hanya owner.'
    },
    unban: {
      title: 'Unban User',
      aliases: [],
      what: 'Buka ban user.',
      how: `${p}unban @user`,
      example: `${p}unban @62812xxxx`,
      notes: 'Hanya owner.'
    },
    block: {
        title: 'Block User',
        aliases: [],
        what: 'Memblokir pengguna dari bot (PM).',
        how: `${p}block @user`,
        example: `${p}block @62812xxxx`,
        notes: 'Hanya owner.'
    },
    unblock: {
        title: 'Unblock User',
        aliases: [],
        what: 'Membuka blokir pengguna.',
        how: `${p}unblock @user`,
        example: `${p}unblock @62812xxxx`,
        notes: 'Hanya owner.'
    },
    addprem: {
        title: 'Add Premium',
        aliases: [],
        what: 'Memberikan status premium kepada pengguna.',
        how: `${p}addprem @user`,
        example: `${p}addprem @Zireael`,
        notes: 'Hanya owner.'
    },
    addcoowner: {
        title: 'Add Co-Owner',
        aliases: [],
        what: 'Menambahkan co-owner baru.',
        how: `${p}addcoowner @user`,
        example: `${p}addcoowner @Zireael`,
        notes: 'Hanya owner.'
    },
    bc: {
      title: 'Broadcast ke Pengguna',
      aliases: [],
      what: 'Kirim pesan massal ke semua user yang pernah chat.',
      how: `${p}bc <pesan>`,
      example: `${p}bc Halo! Bot di-update.`,
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
    prefix: {
        title: 'Set Prefix',
        aliases: [],
        what: 'Mengatur prefix bot.',
        how: `${p}prefix <char>`,
        example: `${p}prefix !`,
        notes: 'Hanya owner.'
    },
    setlink: {
        title: 'Set Link Aduan',
        aliases: [],
        what: 'Mengatur link untuk form aduan.',
        how: `${p}setlink <url>`,
        example: `${p}setlink https://wa.me/628...`,
        notes: 'Hanya owner.'
    },
    setcover: {
        title: 'Set Cover Menu',
        aliases: [],
        what: 'Mengatur gambar cover untuk menu.',
        how: `${p}setcover (reply foto)`,
        example: `${p}setcover`,
        notes: 'Hanya owner.'
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
    downloader: ['fb','tiktok','ig','x','yt','pinterest','spotify'],
    converter:  ['smeme','snobg','s','toimg','brat','emojimix'],
    grouptools: ['antidelete', 'antilink', 'antivritex', 'everyone','welcome', 'promote', 'demote', 'kick'],
    utility:    ['resi', 'ongkir'],
    animanga:   ['manga', 'anime', 'film', 'series', 'drakor'],
    study:      ['ocr','translate','eperpus', 'topdf'],
    fun:        ['tekateki','quiz', 'fakta', 'story', 'ttt'],
    info:       ['userinfo','premium','server','status','aduan','owner','help'],
    owner:      ['setwm','ban','unban', 'block', 'unblock', 'addprem', 'addcoowner', 'bc','bcgc', 'prefix', 'setlink', 'setcover', 'restart','update']
  };

  // ===== Helpers =====
  const renderIndex = () => [
    '🆘 *Help Index*',
    '',
    'Kategori:',
    `• ${p}help downloader`,
    `• ${p}help converter`,
    `• ${p}help grouptools`,
    `• ${p}help utility`,
    `• ${p}help animanga`,
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
    if (n === 'stat' || n === 'botstat') return 'status';
    return null;
  };

  const renderCategory = (key) => {
    const list = K[key];
    if (!list) return null;
    const titleMap = {
      downloader: '⬇️ Downloader',
      converter:  '🔄 Converter',
      grouptools: '🛠️ Group Tools',
      utility:    '🔧 Utility Tools',
      animanga:   '🍿 Animanga & Watchlist',
      study:      '📚 Study Zone',
      fun:        '🎲 Fun Zone',
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
