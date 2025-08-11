/**
 * plugins/fun.tictactoe.js
 * Permainan Tic-Tac-Toe interaktif untuk dua pemain di grup.
 *
 * Commands:
 * /ttt        -> Memulai sesi permainan baru.
 * /join       -> Bergabung dengan sesi yang ada.
 * <1-9>       -> Membuat gerakan di papan.
 * /tttstop    -> Menghentikan permainan saat ini.
 */

const b = (t) => `*${t}*`;
const c = (t) => `\`\`\`${t}\`\`\``;
const LINE = '────────────────────';

// Fungsi untuk memastikan database siap digunakan
function ensureDB() {
    global.db = global.db || {};
    global.db.tictactoe = global.db.tictactoe || {};
}

/**
 * Menggambar papan permainan dalam format teks.
 * @param {Array<string>} board Array yang merepresentasikan papan.
 * @returns {string} Teks papan permainan.
 */
function renderBoard(board) {
    let boardStr = '┌───┬───┬───┐\n';
    boardStr += `│ ${board[0]} │ ${board[1]} │ ${board[2]} │\n`;
    boardStr += '├───┼───┼───┤\n';
    boardStr += `│ ${board[3]} │ ${board[4]} │ ${board[5]} │\n`;
    boardStr += '├───┼───┼───┤\n';
    boardStr += `│ ${board[6]} │ ${board[7]} │ ${board[8]} │\n`;
    boardStr += '└───┴───┴───┘';
    return c(boardStr);
}

/**
 * Memeriksa apakah ada pemenang.
 * @param {Array<string>} board Array papan permainan.
 * @returns {string|null} Mengembalikan 'X', 'O', atau null.
 */
function checkWinner(board) {
    const winningCombinations = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
        [0, 4, 8], [2, 4, 6]             // Diagonals
    ];
    for (const combo of winningCombinations) {
        const [a, b, c] = combo;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a]; // Mengembalikan 'X' atau 'O'
        }
    }
    return null; // Tidak ada pemenang
}

/**
 * Memeriksa apakah permainan seri.
 * @param {Array<string>} board Array papan permainan.
 * @returns {boolean} True jika seri, false jika tidak.
 */
function checkDraw(board) {
    return board.every(cell => cell === 'X' || cell === 'O');
}

module.exports = async (sock, m, text, from) => {
    ensureDB();
    const raw = (text || '').trim();
    const lower = raw.toLowerCase();
    const session = global.db.tictactoe[from];
    const senderJid = m.key.participant || m.sender;

    // --- Memulai Permainan ---
    if (lower === '/ttt' || lower === '/tictactoe') {
        if (session) {
            return sock.sendMessage(from, { text: `❌ Permainan sudah dimulai oleh @${session.players[0].split('@')[0]}. Tunggu pemain lain bergabung atau hentikan dengan */tttstop*.`, mentions: [session.players[0]] }, { quoted: m });
        }

        global.db.tictactoe[from] = {
            board: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
            players: [senderJid], // Pemain pertama (X)
            currentPlayerIndex: 0, // Indeks pemain saat ini (0 untuk X, 1 untuk O)
            gameOver: false
        };

        const message = [
            `🎮 ${b('Permainan Tic-Tac-Toe Dimulai!')} �`,
            `Pemain 1 (X): @${senderJid.split('@')[0]}`,
            `Menunggu Pemain 2 (O) untuk bergabung dengan mengetik */join*...`,
            "",
            renderBoard(global.db.tictactoe[from].board)
        ].join('\n');

        return sock.sendMessage(from, { text: message, mentions: [senderJid] }, { quoted: m });
    }

    // --- Bergabung dengan Permainan ---
    if (lower === '/join') {
        if (!session) {
            return sock.sendMessage(from, { text: "❌ Tidak ada permainan untuk diikuti. Mulai dengan */ttt*." }, { quoted: m });
        }
        if (session.players.length >= 2) {
            return sock.sendMessage(from, { text: "❌ Permainan sudah penuh." }, { quoted: m });
        }
        if (session.players.includes(senderJid)) {
            return sock.sendMessage(from, { text: "❌ Kamu sudah ada di dalam permainan ini." }, { quoted: m });
        }

        session.players.push(senderJid); // Pemain kedua (O)
        
        const [playerX, playerO] = session.players;
        const message = [
            `✅ @${senderJid.split('@')[0]} telah bergabung sebagai Pemain 2 (O)!`,
            `Permainan dimulai!`,
            LINE,
            `Giliran: @${playerX.split('@')[0]} (X)`,
            renderBoard(session.board)
        ].join('\n');

        return sock.sendMessage(from, { text: message, mentions: [senderJid, playerX] }, { quoted: m });
    }

    // --- Menghentikan Permainan ---
    if (lower === '/tttstop') {
        if (!session) {
            return sock.sendMessage(from, { text: "❌ Tidak ada permainan yang sedang berjalan." }, { quoted: m });
        }
        if (!session.players.includes(senderJid)) {
             return sock.sendMessage(from, { text: "❌ Hanya pemain yang bisa menghentikan permainan." }, { quoted: m });
        }
        delete global.db.tictactoe[from];
        return sock.sendMessage(from, { text: " permainan Tic-Tac-Toe telah dihentikan." }, { quoted: m });
    }

    // --- Membuat Gerakan ---
    const move = parseInt(raw);
    if (session && !isNaN(move) && move >= 1 && move <= 9) {
        if (session.players.length < 2) {
            return sock.sendMessage(from, { text: "⏳ Menunggu pemain kedua bergabung dengan */join*." }, { quoted: m });
        }
        if (session.players[session.currentPlayerIndex] !== senderJid) {
            return sock.sendMessage(from, { text: "❌ Bukan giliranmu!" }, { quoted: m });
        }
        if (session.board[move - 1] === 'X' || session.board[move - 1] === 'O') {
            return sock.sendMessage(from, { text: "❌ Kotak itu sudah terisi. Pilih yang lain." }, { quoted: m });
        }

        const currentPlayerSymbol = session.currentPlayerIndex === 0 ? 'X' : 'O';
        session.board[move - 1] = currentPlayerSymbol;

        const winner = checkWinner(session.board);
        if (winner) {
            const message = [
                `🎉 ${b('Permainan Selesai!')} 🎉`,
                `Pemenangnya adalah @${senderJid.split('@')[0]} (${winner})!`,
                renderBoard(session.board)
            ].join('\n');
            delete global.db.tictactoe[from];
            return sock.sendMessage(from, { text: message, mentions: [senderJid] }, { quoted: m });
        }

        if (checkDraw(session.board)) {
            const message = [
                `🤝 ${b('Permainan Selesai!')} 🤝`,
                `Hasilnya seri!`,
                renderBoard(session.board)
            ].join('\n');
            delete global.db.tictactoe[from];
            return sock.sendMessage(from, { text: message }, { quoted: m });
        }

        // Ganti giliran
        session.currentPlayerIndex = 1 - session.currentPlayerIndex;
        const nextPlayerJid = session.players[session.currentPlayerIndex];
        const nextPlayerSymbol = session.currentPlayerIndex === 0 ? 'X' : 'O';

        const message = [
            `Giliran: @${nextPlayerJid.split('@')[0]} (${nextPlayerSymbol})`,
            renderBoard(session.board)
        ].join('\n');
        return sock.sendMessage(from, { text: message, mentions: [nextPlayerJid] }, { quoted: m });
    }
};
�
