require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField, ChannelType, REST, Routes } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent // required to read message content
  ]
});

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID; // add this to .env
const GUILD_ID = process.env.GUILD_ID;   // optional – for instant testing (guild-only)

client.once('ready', async () => {
  console.log(`🔥 ${client.user.tag} online.`);

  // Register slash commands
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  const commands = [
    {
      name: 'nuke',
      description: '💀 Wipe the entire server (Admin only)',
      default_member_permissions: PermissionsBitField.Flags.Administrator.toString()
    }
  ];

  try {
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
      console.log('✅ Slash command registered to guild (instant).');
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
      console.log('✅ Slash command registered globally (may take 5-10 min).');
    }
  } catch (e) {
    console.error('Command registration failed:', e);
  }
});

// Slash command handler
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'nuke') return;
  await executeNuke(interaction);
});

// Message command handler (fallback)
client.on('messageCreate', async msg => {
  if (msg.author.bot || !msg.guild || msg.content !== '!nuke') return;
  if (!msg.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return msg.reply('❌ Admin required.');
  }
  await executeNuke(msg);
});

// Core nuke function (works for both interaction and message)
async function executeNuke(ctx) {
  const guild = ctx.guild;
  const author = ctx.member || ctx.author;
  const reply = ctx.reply || ctx.channel.send.bind(ctx.channel);

  // Check bot perms
  const botMember = guild.members.me;
  if (!botMember.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return reply('❌ I need Administrator. Grant it first.');
  }

  await reply('☢️ **NUKE LAUNCHED** – erasing everything.');

  // Delete all channels
  for (const [, ch] of guild.channels.cache) {
    try { await ch.delete(); } catch (_) {}
  }

  // Delete all roles except @everyone
  for (const [, role] of guild.roles.cache.filter(r => r.id !== guild.id)) {
    try { await role.delete(); } catch (_) {}
  }

  // Delete emojis
  for (const [, emoji] of guild.emojis.cache) {
    try { await emoji.delete(); } catch (_) {}
  }

  // Delete stickers
  for (const [, sticker] of guild.stickers.cache) {
    try { await sticker.delete(); } catch (_) {}
  }

  // Ban all members except executor and bot
  for (const [, member] of guild.members.cache) {
    if (member.id === author.id || member.id === client.user.id) continue;
    try { await member.ban({ reason: 'Nuke by ' + author.user?.tag || author.tag }); } catch (_) {}
  }

  // Create proof channel
  const ch = await guild.channels.create({
    name: '☢️-nuked',
    type: ChannelType.GuildText,
    permissionOverwrites: [{
      id: guild.id,
      allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory]
    }]
  });
  await ch.send(`💀 Nuked by ${author.user?.tag || author.tag} at ${new Date().toISOString()}`);

  console.log(`✅ Nuke complete on ${guild.name}`);
}

client.login(TOKEN);
