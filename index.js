const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');

console.log("🚀 Starting WhatsApp Bot...");

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
            console.log('✅ Bot Connected Successfully! 🎉');
            // Safe presence update
            sock.sendPresenceUpdate('available').catch(() => {});
        }

        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
            console.log("🔄 Reconnecting...");
            setTimeout(startBot, 10000);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Always Online
    setInterval(() => {
        sock.sendPresenceUpdate('available').catch(() => {});
    }, 30000);

    // Auto View Status
    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            if (msg.key?.remoteJid?.endsWith('@status')) {
                await sock.readMessages([{
                    remoteJid: msg.key.remoteJid,
                    id: msg.key.id,
                    participant: msg.key.participant
                }]).catch(() => {});
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
                    else if (msg.imageMessage) content = "[🖼️ Image]";
                    else if (msg.videoMessage) content = "[🎥 Video]";
                }

                if (isGroup) {
                    await sock.sendMessage(key.remoteJid, {
                        text: `🛡️ *ANTI-DELETE*\nDeleted by: @${deleter.split('@')[0]}\n\n> ${content}`,
                        mentions: [deleter]
                    }).catch(() => {});
                } else {
                    await sock.sendMessage(key.remoteJid, { text: `🛡️ *Message Deleted*\n\n> ${content}` }).catch(() => {});
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
        if (['hi', 'hello', 'hey'].includes(text)) {
            await sock.sendMessage(from, { text: "👋 Hello! How can I help you today?" });
        }
        else if (text.includes('how are you')) {
            await sock.sendMessage(from, { text: "I'm doing great, thank you! 😊 How about you?" });
        }
        else if (text.includes('good morning')) {
            await sock.sendMessage(from, { text: "🌅 Good morning! Have a wonderful day!" });
        }
        else if (text.includes('good night')) {
            await sock.sendMessage(from, { text: "🌙 Good night! Sweet dreams." });
        }
        else if (text === 'time') {
            const time = new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' });
            await sock.sendMessage(from, { text: `🕒 ${time}` });
        }
        else if (text === 'ping') {
            await sock.sendMessage(from, { text: '🏓 Pong! Bot is active ✅' });
        }
        else if (text === 'menu') {
            await sock.sendMessage(from, { text: "📋 *Bot Menu*\n\nQuick: hi, how are you, good morning, good night, time, ping\n\nAdmin: .mute .unmute .kick @user" });
        }

        // Admin Commands
        if (isGroup) {
            if (text === '.mute') {
                await sock.groupSettingUpdate(from, "announcement");
                await sock.sendMessage(from, { text: "🔇 Group Muted" });
            }
            if (text === '.unmute') {
                await sock.groupSettingUpdate(from, "not_announcement");
                await sock.sendMessage(from, { text: "🔊 Group Unmuted" });
            }
            if (text.startsWith('.kick')) {
                const mentioned = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                if (mentioned) {
                    await sock.groupParticipantsUpdate(from, [mentioned], "remove");
                    await sock.sendMessage(from, { text: `✅ Kicked user`, mentions: [mentioned] });
                }
            }
        }
    });

    console.log("✅ Final Stable Bot Ready for 24/7");
}

startBot();
