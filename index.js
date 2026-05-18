const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');

console.log("🚀 WhatsApp Bot Starting...");

const messageCache = new Map();
const lastReply = new Map();

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        markReads: true,
        browser: ["Chrome", "Windows", "131.0"],
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) qrcode.generate(qr, { small: true });

        if (connection === 'open') {
            console.log('✅ Bot Connected Successfully!');
        }
        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
            setTimeout(startBot, 8000);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Auto View Status
    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            if (msg.key?.remoteJid?.endsWith('@status')) {
                await sock.readMessages([{
                    remoteJid: msg.key.remoteJid,
                    id: msg.key.id,
                    participant: msg.key.participant
                }]);
            }
        }
    });

    // Cache for Anti-Delete
    sock.ev.on('messages.upsert', ({ messages }) => {
        messages.forEach(m => {
            if (m.key?.id && m.message) messageCache.set(m.key.id, m);
        });
    });

    // Anti-Delete
    sock.ev.on('messages.update', async (updates) => {
        for (const { key, update } of updates) {
            if (update.message === null) {
                const isGroup = key.remoteJid.endsWith('@g.us');
                const deleter = key.participant || key.remoteJid;
                const cached = messageCache.get(key.id);

                let content = "*(Deleted too fast)*";
                if (cached?.message) {
                    const msg = cached.message;
                    if (msg.conversation) content = msg.conversation;
                    else if (msg.extendedTextMessage?.text) content = msg.extendedTextMessage.text;
                    else if (msg.imageMessage) content = "[Image]";
                    else if (msg.videoMessage) content = "[Video]";
                }

                const text = isGroup 
                    ? `🛡️ *ANTI-DELETE*\nDeleted by: @${deleter.split('@')[0]}\n\n> ${content}`
                    : `🛡️ *Message Deleted*\n\n> ${content}`;

                await sock.sendMessage(key.remoteJid, { text });
            }
        }
    });

    // Quick Replies & Admin Commands
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const text = (m.message.conversation || m.message.extendedTextMessage?.text || '').toLowerCase().trim();
        const from = m.key.remoteJid;
        const isGroup = from.endsWith('@g.us');

        if (lastReply.has(from) && Date.now() - lastReply.get(from) < 4000) return;
        lastReply.set(from, Date.now());

        // Quick Replies
        if (['hi', 'hello', 'hey'].includes(text)) await sock.sendMessage(from, { text: "👋 Hello! How can I help you?" });
        if (text.includes('how are you')) await sock.sendMessage(from, { text: "I'm fine, thank you! 😊 How about you?" });
        if (text.includes('good morning')) await sock.sendMessage(from, { text: "🌅 Good morning!" });
        if (text.includes('good night')) await sock.sendMessage(from, { text: "🌙 Good night!" });
        if (text === 'menu') await sock.sendMessage(from, { text: "📋 Menu: hi, time, ping, .mute, .unmute, .kick @user" });

        // Admin Commands
        if (isGroup) {
            if (text === '.mute') await sock.groupSettingUpdate(from, "announcement");
            if (text === '.unmute') await sock.groupSettingUpdate(from, "not_announcement");
            if (text.startsWith('.kick')) {
                const mentioned = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                if (mentioned) await sock.groupParticipantsUpdate(from, [mentioned], "remove");
            }
        }
    });
}

startBot();
