/**
 * plugins/userinfo.js
 * Cek profil user dengan ornamen emoji dan info stylish
 * Trigger: /userinfo  (atau /me, bisa kamu tambah alias)
 * Data limit/premium: placeholder To Be Updated
 */
const axios = require('axios');

module.exports = async (sock, m, text, from) => {
  const cmd = (text || '').trim().toLowerCase();
  if (!['/userinfo', '/me'].includes(cmd.split(' ')[0])) return;

  // Info dasar user
  const jid      = m.key.participant || m.key.remoteJid || from;
  const name     = m.pushName || jid.split('@')[0];
  const number   = jid.replace(/[^0-9]/g, '');
  const joinDate = '[Coming Soon]';
  const limit    = '[Coming Soon]';
  const premium  = '[To Be Updated]';
  const status   = '[Coming Soon]';
  const warning  = '[To Be Updated]';
  const exp      = '[Soon]';

  // Dapatkan foto profil user
  let profilePic;
  try {
    profilePic = await sock.profilePictureUrl(jid, 'image');
  } catch {
    profilePic = 'https://i.ibb.co/Fz65b7Q/blank-profile-picture.png'; // default
  }

  // Tampilkan info stylish
  let caption = `╭─────[ *👤 USER PROFILE* ]─────
  │ 🏷️ *Nama*      : ${name}
  │ 📱 *Nomor*     : wa.me/${number}
  │ 🗓️ *Join*      : ${joinDate}
  │ 🧧 *Limit*     : ${limit}
  │ 💎 *Premium*   : ${premium}
  │ ⚠️ *Warning*   : ${warning}
  │ ⏳ *Expired*   : ${exp}
  │ 💬 *Status*    : ${status}
  ╰──────────────────────────

  *Tips:*
  - Cek limit, premium, atau masa aktif? Fitur ini akan hadir segera!
  - Ingin jadi premium? Hubungi owner: /owner

  ━━━━━━━━━━━━━━━━━━━
  📅 *Request at:* ${new Date().toLocaleString('id-ID')}
  `;

  // Kirim dengan thumbnail PP user
  await sock.sendMessage(from, {
    image: { url: profilePic },
    caption: caption,
  }, { quoted: m });
};
