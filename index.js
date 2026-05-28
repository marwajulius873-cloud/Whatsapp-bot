const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');

let phoneNumber = "254113123471"; // ← CHANGE THIS to your WhatsApp number (with country code, no +)

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth');

    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ['Chrome', 'Linux', '4.0.0'],
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                console.log('🔄 Reconnecting...');
                setTimeout(startBot, 5000);
            }
        } else if (connection === 'open') {
            console.log('✅ Bot connected successfully!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Request Pairing Code
    if (!state.creds.registered) {
        try {
            const code = await sock.requestPairingCode(phoneNumber);
            console.log('\n🔥 YOUR PAIRING CODE IS:');
            console.log('━━━━━━━━━━━━━━━━━━━━━━');
            console.log(code);
            console.log('━━━━━━━━━━━━━━━━━━━━━━');
            console.log('Open WhatsApp → Linked Devices → Link with Phone Number → Paste this code');
        } catch (err) {
            console.log('❌ Error getting pairing code:', err.message);
        }
    }

    // ====================== BOT FEATURES ======================
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || !m.key.remoteJid) return;

        const from = m.key.remoteJid;
        const text = m.message.conversation || m.message.extendedTextMessage?.text || '';

        if (from.endsWith('@status')) {
            await sock.readMessages([m.key]);
            console.log(`👀 Viewed status`);
        }

        const lower = text.toLowerCase().trim();
        if (lower === 'hi' || lower === 'hello') {
            await sock.sendMessage(from, { text: 'Hey! How are you? 😊' });
        }
        if (lower === 'ping') {
            await sock.sendMessage(from, { text: 'Pong! Bot is alive 24/7' });
        }
        if (lower === 'menu') {
            await sock.sendMessage(from, { text: 'Commands:\n• hi\n• ping\n• menu' });
        }
    });
}

startBot().catch(console.error);
