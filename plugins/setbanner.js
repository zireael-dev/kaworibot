module.exports = {
  name: 'setbanner',
  async exec({ sock, m, isOwner }) {
    if (!isOwner) {
      return sock.sendMessage(m.key.remoteJid, { text: '❌ Hanya owner yang bisa menggunakan perintah ini.' }, { quoted: m });
    }

    const isImage = m.message.imageMessage;

    if (isImage) {
      const buffer = await sock.downloadMediaMessage(m);
      const filePath = './media/banner.jpg';
      require('fs').writeFileSync(filePath, buffer);
      db.data.settings.banner = filePath;
      await sock.sendMessage(m.key.remoteJid, { text: '✅ Banner berhasil disetel dari gambar.' }, { quoted: m });
    } else {
      const url = m.message?.conversation || m.message?.extendedTextMessage?.text;
      if (!url || !/^https?:\/\//.test(url)) {
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Kirim gambar atau link gambar untuk set banner.' }, { quoted: m });
        return;
      }
      db.data.settings.banner = url;
      await sock.sendMessage(m.key.remoteJid, { text: '✅ Banner berhasil disetel dari link.' }, { quoted: m });
    }
  }
};
