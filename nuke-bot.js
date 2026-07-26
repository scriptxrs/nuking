require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField, ChannelType } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const TOKEN = process.env.DISCORD_TOKEN;
const NUKE_COMMAND = '!nuke';

client.once('ready', () => {
  console.log(`🔥 ${client.user.tag} armed on Render.`);
});

client.on('messageCreate', async msg => {
  if (msg.author.bot || !msg.guild || msg.content !== NUKE_COMMAND) return;
  
  if (!msg.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return msg.reply('❌ Admin required.');
  }
  
  const botMember = msg.guild.members.me;
  if (!botMember.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return msg.reply('❌ Grant me Administrator.');
  }
  
  await msg.reply('☢️ **NUKE LAUNCHED** – erasing everything.');
  
  // Delete channels
  for (const [, ch] of msg.guild.channels.cache) {
    try { await ch.delete(); } catch (_) {}
  }
  
  // Delete roles (keep @everyone)
  for (const [, role] of msg.guild.roles.cache.filter(r => r.id !== msg.guild.id)) {
    try { await role.delete(); } catch (_) {}
  }
  
  // Delete emojis
  for (const [, emoji] of msg.guild.emojis.cache) {
    try { await emoji.delete(); } catch (_) {}
  }
  
  // Delete stickers
  for (const [, sticker] of msg.guild.stickers.cache) {
    try { await sticker.delete(); } catch (_) {}
  }
  
  // Ban all except executor & bot
  for (const [, member] of msg.guild.members.cache) {
    if (member.id === msg.author.id || member.id === client.user.id) continue;
    try { await member.ban({ reason: 'Nuke by ' + msg.author.tag }); } catch (_) {}
  }
  
  // Proof channel
  const ch = await msg.guild.channels.create({
    name: '☢️-nuked',
    type: ChannelType.GuildText,
    permissionOverwrites: [{
      id: msg.guild.id,
      allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory]
    }]
  });
  await ch.send(`💀 Nuked by ${msg.author.tag} at ${new Date().toISOString()}`);
  
  console.log(`✅ Nuke complete on ${msg.guild.name}`);
});

client.login(TOKEN);