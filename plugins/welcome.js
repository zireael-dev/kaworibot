module.exports = async (sock, update) => {
  const { id, participants, action } = update
  const metadata = await sock.groupMetadata(id)

  if (action === 'add') {
    for (const user of participants) {
      const name = (await sock.onWhatsApp(user))[0]?.notify || 'kamu'
      const hour = new Date().getHours()
      let greeting = 'Halo'
      let emoji = '✨'

      if (hour >= 4 && hour < 11) {
        greeting = 'Selamat pagi'
        emoji = '🌅'
      } else if (hour >= 11 && hour < 15) {
        greeting = 'Selamat siang'
        emoji = '🌤'
      } else if (hour >= 15 && hour < 18) {
        greeting = 'Selamat sore'
        emoji = '🌇'
      } else {
        greeting = 'Selamat malam'
        emoji = '🌙'
      }

      const watermark = '\n\nᴋᴀᴡᴏʀɪ-ʙᴏᴛ, ᴀ sɪᴍᴘʟᴇ ᴡʜᴀᴛsᴀᴘᴘ ʙᴏᴛ ᴍᴀᴅᴇ ʙʏ ʏᴜsʀɪʟ ꜰᴀʟᴀʜ'

      const welcomeText = `
${greeting} ${emoji}

Selamat datang *@${user.split('@')[0]}* di *${metadata.subject}*!
Jangan lupa perkenalkan diri ya ✨
${watermark}
`.trim()

      await sock.sendMessage(id, {
        text: welcomeText,
        mentions: [user],
      })
    }
  }
}
