# KaworiBot

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-%3E=18.x-green)
![Status: WIP](https://img.shields.io/badge/status-development-yellow)

> **KaworiBot** — Simple WhatsApp Bot powered by Baileys, made with ❤️ by Yusril Falah (Zireael)

---

## ✨ Fitur Utama

- Modular plugin: sticker, downloader, meme, converter, dsb
- Owner tools, group tools, broadcast, ban/unban, multi-prefix (coming soon!)
- Simple database (JSON), config gampang, bisa custom watermark stiker

---

## 📦 Instalasi & Persiapan

1. **Clone repository**
    ```bash
    git clone https://github.com/zireael-dev/kaworibot.git
    cd kaworibot
    ```

2. **Install dependencies**
    ```bash
    npm install
    ```

3. **Edit config**
    - Ubah `config.json` (data owner, packname stiker, dsb)
    - Contoh format:
      ```json
      {
        "owner": ["628xxxxxx@s.whatsapp.net"],
        "botName": "KaworiBot",
        "stickerPack": "Kawori Stickers",
        "stickerAuthor": "KaworiBot by Zireael"
      }
      ```

---

## 🚀 Menjalankan Bot

### **Di PC/laptop lokal**
```bash
node index.js
