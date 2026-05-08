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
        presence: 'available',
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) qrcode.generate(qr, { small: true });
        
        if (connection === 'open') {
            console.log('✅ Bot Connected Successfully! 🎉');
            sock.sendPresenceUpdate('available');
        }
        
        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
            setTimeout(startBot, 10000);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Always Online
    setInterval(() => sock.sendPresenceUpdate('available'), 25000);

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
            if (m.key?.id) messageCache.set(m.key.id, m);
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
                    else if (msg.imageMessage) content = "[🖼️ Image]";
                    else if (msg.videoMessage) content = "[🎥 Video]";
                }

                if (isGroup) {
                    await sock.sendMessage(key.remoteJid, {
                        text: `🛡️ *𝔄𝔫𝔱𝔦 𝔇𝔢𝔩𝔢𝔱𝔢🚫*\nDeleted by: @${deleter.split('@')[0]}\n\n> ${content}`,
                        mentions: [deleter]
                    });
                } else {
                    await sock.sendMessage(key.remoteJid, { text: `🛡️ *𝔄𝔫𝔱𝔦 𝔇𝔢𝔩𝔢𝔱𝔢🚫*\n\n> ${content}` });
                }
            }
        }
    });

    // Quick Replies + Admin Commands
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const text = (m.message.conversation || m.message.extendedTextMessage?.text || '').toLowerCase().trim();
        const from = m.key.remoteJid;
        const isGroup = from.endsWith('@g.us');

        const now = Date.now();
        if (lastReply.has(from) && now - lastReply.get(from) < 3500) return;
        lastReply.set(from, now);

        // Quick Replies
        if (text === 'hi' || text === 'hello') await sock.sendMessage(from, { text: "👋 Hello! How can I help you?" });
        if (text.includes('how are you')) await sock.sendMessage(from, { text: "I'm doing great! 😊 How about you?" });
        if (text.includes('good morning')) await sock.sendMessage(from, { text: "🌅 Good morning!" });
        if (text.includes('good night')) await sock.sendMessage(from, { text: "🌙 Good night!" });
        if (text === 'time') {
            const time = new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' });
            await sock.sendMessage(from, { text: `🕒 ${time}` });
        }
        if (text === 'ping') await sock.sendMessage(from, { text: '🏓 Pong! Bot is active' });
        if (text === 'menu') {
            await sock.sendMessage(from, { text: "📋 *Menu*\n\nhi, how are you, good morning, time, ping\n\nAdmin: .mute .unmute .kick @user" });
        }

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