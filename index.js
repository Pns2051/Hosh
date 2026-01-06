/**
 * ⚡ ULTRA-OPTIMIZED MINECRAFT STATUS BOT
 * Runtime: Node.js 18+ OR Bun v1.0+
 * Specs: < 100MB RAM (Bun) | < 250MB RAM (Node)
 */

const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActivityType, 
    REST, 
    Routes, 
    SlashCommandBuilder,
    Options 
} = require('discord.js');
require('dotenv').config();

// --- CONFIGURATION ---
const CONFIG = {
    IP: '191.96.231.5',
    PORT: 31190,
    UPDATE_INTERVAL: 6000, 
    CHANNEL_ID: 'YOUR_CHANNEL_ID_HERE', 
    MESSAGE_ID: null
};

let lastStatusSignature = ''; 

// --- OPTIMIZED CLIENT ---
const client = new Client({
    intents: [GatewayIntentBits.Guilds],
    makeCache: Options.cacheWithLimits({
        ...Options.DefaultMakeCacheSettings,
        ReactionManager: 0,
        GuildMemberManager: 0,
        UserManager: 0,
        VoiceStateManager: 0,
    }),
});

// --- NATIVE FETCH ---
async function getServerStatus() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const url = `https://api.mcsrvstat.us/3/${CONFIG.IP}:${CONFIG.PORT}`;
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        return null;
    }
}

// --- SLASH COMMANDS ---
const commands = [
    new SlashCommandBuilder().setName('status').setDescription('Check status now'),
    new SlashCommandBuilder().setName('ip').setDescription('Get Server IP')
].map(c => c.toJSON());

async function registerCommands() {
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ Commands Registered');
    } catch (e) { console.error('Command Error:', e); }
}

// --- MAIN LOOP ---
async function updateStatus() {
    if (!client.isReady()) return;

    try {
        const channel = await client.channels.fetch(CONFIG.CHANNEL_ID).catch(() => null);
        if (!channel) return console.log('⚠️  Channel not found (Check ID)');

        const data = await getServerStatus();
        const isOnline = data && data.online;

        const currentSignature = isOnline 
            ? `ONLINE-${data.players.online}-${data.players.max}-${data.motd?.clean?.[0]}` 
            : 'OFFLINE';

        if (CONFIG.MESSAGE_ID && currentSignature === lastStatusSignature) return; 

        const COLOR = { ONLINE: 0xB1F1C1, OFFLINE: 0xF2B8B5 };
        
        const embed = new EmbedBuilder()
            .setTitle(isOnline ? '🟢  Server Online' : '🔴  Server Offline')
            .setColor(isOnline ? COLOR.ONLINE : COLOR.OFFLINE)
            .addFields(
                { name: '👥 Players', value: isOnline ? `${data.players.online} / ${data.players.max}` : 'Unreachable', inline: true },
                { name: '📶 Ping', value: isOnline ? `${data.debug.cachetime || 20}ms` : '--', inline: true },
                { name: '🌐 Address', value: `${CONFIG.IP}`, inline: true }
            )
            .setFooter({ text: `Last Updated: ${new Date().toLocaleTimeString()}` })
            .setTimestamp();

        if (isOnline && data.motd?.clean?.length > 0) {
            embed.setDescription(```${data.motd.clean.join('\n')}```);
        }

        if (CONFIG.MESSAGE_ID) {
            try {
                const msg = await channel.messages.fetch(CONFIG.MESSAGE_ID);
                await msg.edit({ embeds: [embed] });
            } catch (err) { CONFIG.MESSAGE_ID = null; }
        }

        if (!CONFIG.MESSAGE_ID) {
            const msg = await channel.send({ embeds: [embed] });
            CONFIG.MESSAGE_ID = msg.id;
        }

        lastStatusSignature = currentSignature;
        client.user.setActivity(
            isOnline ? `${data.players.online} Players` : 'Offline', 
            { type: ActivityType.Watching }
        );

    } catch (error) { console.error('Loop Error:', error.message); }
}

client.once('ready', () => {
    console.log(`🚀 ${client.user.tag} is running!`);
    registerCommands();
    updateStatus();
    setInterval(updateStatus, CONFIG.UPDATE_INTERVAL);
});

process.on('unhandledRejection', (reason) => console.log('❌ Unhandled Rejection:', reason));

client.login(process.env.DISCORD_TOKEN);
