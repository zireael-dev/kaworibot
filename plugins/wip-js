// plugins/wip.js

const asciiArts = [
    `┏━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃   FEATURE INCOMING... ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
`╭──────────────────────╮
│    SYSTEM IN PROGRESS │
╰──────────────────────╯`,
`╔═⦿⦿⦿══════════════════╗
║     W O R K   I N     ║
║      P R O G R E S S  ║
╚════════════════⦿⦿⦿═╝`,
`┌────────────────────┐
│   MODULE UNDER      │
│    CONSTRUCTION     │
└────────────────────┘`,
`╭─[ 🚧 ]──────────────╮
│      NOT READY      │
│    PLEASE WAIT...   │
╰─────────────────────╯`,
`[=== { 🔄 } ===]
Coming Soon!
[==============]`,
`────────────────────────────
⋙  W O R K  ⋘
⋙  I N  P R O G R E S S  ⋘
────────────────────────────`,
`[ SYSTEM MESSAGE ]
Fitur ini akan hadir di update berikutnya!`,
];

const messages = [
    "Fitur ini masih dalam pengembangan. Stay tuned untuk update selanjutnya! 🚀",
"Maaf, command ini belum tersedia. Tunggu kejutan berikutnya!",
"Sedang disiapkan oleh tim pengembang. Sabar ya! 💡",
"Komponen ini belum aktif. Mohon tunggu update rilis.",
"Masih di tahap development. Nantikan fitur barunya!",
"Soon... Fitur ini akan segera hadir jika tidak ada kendala di server 🤞",
"Perintah ini sedang dalam tahap pengembangan. Pantengin terus ya!",
"Work in progress! Kamu bisa request ke owner biar dipercepat 😉",
];

module.exports = async (sock, m, text, from, watermark) => {
    // Prefix dinamis
    let prefix = '/';
    const matched = (text || '').match(/^(\W)/);
    if (matched) prefix = matched[1];

    // Exclude handled commands
    const cmd = (text || '').trim().toLowerCase();
    const ignored = [
        `${prefix}menu`, `${prefix}help`, `${prefix}start`, `${prefix}about`, `${prefix}ping`
        // tambah daftar command lain yang sudah ada
    ];
    if (
        cmd.startsWith(prefix)
        && !ignored.includes(cmd.split(' ')[0])
    ) {
        // Random ascii art dan pesan
        const art = asciiArts[Math.floor(Math.random() * asciiArts.length)];
        const msg = messages[Math.floor(Math.random() * messages.length)];
        const txt = `\`\`\`
        ${art}
        \`\`\`
        ${msg}

        *Command:* ${cmd.split(' ')[0]}
        _Status:_ *Work in Progress*

        _${watermark}_`;
        await sock.sendMessage(from, { text: txt }, { quoted: m });
    }
};
