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

client.once('ready', async () => {
  console.log(`🔥 ${client.user.tag} online.`);
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  const commands = [{
    name: 'nuke',
    description: '💀 Wipe entire server (Admin only)',
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

// Slash command – defer immediately to avoid 3-sec timeout
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'nuke') return;
  await interaction.deferReply({ ephemeral: true }); // "thinking" state
  await executeNuke(interaction);
});

// Message command – no timeout issue
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

  // Bot admin check
  if (!guild.members.me.permissions.has(PermissionsBitField.Flags.Administrator)) {
    const err = '❌ I need Administrator.';
    if (ctx.editReply) await ctx.editReply(err);
    else await reply(err);
    return;
  }

  // Acknowledge
  if (ctx.editReply) {
    await ctx.editReply('☢️ **NUKE STARTED** – this will take a moment...');
  } else {
    await reply('☢️ **NUKE STARTED** – this will take a moment...');
  }

  // Run nuke in background with error catching per operation
  try {
    // 1. Delete channels (with delay to avoid rate-limit)
    const channels = guild.channels.cache;
    for (const [, ch] of channels) {
      try { await ch.delete(); await sleep(100); } catch (_) {}
    }

    // 2. Delete roles (except @everyone)
    const roles = guild.roles.cache.filter(r => r.id !== guild.id);
    for (const [, role] of roles) {
      try { await role.delete(); await sleep(100); } catch (_) {}
    }

    // 3. Delete emojis
    for (const [, emoji] of guild.emojis.cache) {
      try { await emoji.delete(); await sleep(100); } catch (_) {}
    }

    // 4. Delete stickers
    for (const [, sticker] of guild.stickers.cache) {
      try { await sticker.delete(); await sleep(100); } catch (_) {}
    }

    // 5. Ban members (chunked to avoid memory crash)
    const members = guild.members.cache;
    let count = 0;
    for (const [, member] of members) {
      if (member.id === author.id || member.id === client.user.id) continue;
      try {
        await member.ban({ reason: 'Nuke by ' + (author.user?.tag || author.tag) });
        count++;
        if (count % 10 === 0) await sleep(200); // every 10 bans, chill
      } catch (_) {}
    }

    // 6. Create proof channel
    const ch = await guild.channels.create({
      name: '☢️-nuked',
      type: ChannelType.GuildText,
      permissionOverwrites: [{
        id: guild.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory]
      }]
    });
    await ch.send(`💀 Nuked by ${author.user?.tag || author.tag} at ${new Date().toISOString()}`);

    console.log(`✅ Nuke complete on ${guild.name} (banned ${count} members)`);
    if (ctx.editReply) {
      await ctx.editReply(`✅ Nuke complete. Banned ${count} members.`);
    }
  } catch (err) {
    console.error('Nuke error:', err);
    if (ctx.editReply) {
      await ctx.editReply('⚠️ Nuke partially completed – check logs.');
    }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

client.login(TOKEN);
