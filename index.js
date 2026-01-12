const http = require("http");
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("OK");
});
server.listen(process.env.PORT || 3000);

require("dotenv").config();
const token = process.env.TOKEN;

const {
  Client,
  GatewayIntentBits,
  ChannelType,
  SlashCommandBuilder,
  Routes,
  REST,
  EmbedBuilder,
  PermissionsBitField
} = require('discord.js');
const fs = require('fs');

// -------------------------
// BOT CLIENT
// -------------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

client.on("error", console.error);
client.on("debug", console.log);
client.on("shardError", console.error);
process.on("unhandledRejection", console.error);

// -------------------------
// MESSAGE COUNTER STORAGE
// -------------------------
const dataFile = './messageCounts.json';
let messageCounts = {};
let lastUpdate = {};

if (fs.existsSync(dataFile)) {
  try {
    messageCounts = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  } catch {
    messageCounts = {};
  }
}

function saveData() {
  fs.writeFileSync(dataFile, JSON.stringify(messageCounts, null, 2));
}

// -------------------------
// WARNING STORAGE
// -------------------------
const warnFile = './warnCounts.json';
let warnCounts = {};

// Structure:
// warnCounts = {
//   [guildId]: {
//     warnings: { [userId]: number },
//     autopunish: [ { warnings: number, duration: string, reason?: string } ]
//   }
// }

if (fs.existsSync(warnFile)) {
  try {
    warnCounts = JSON.parse(fs.readFileSync(warnFile, 'utf8'));
  } catch {
    warnCounts = {};
  }
}

function saveWarns() {
  fs.writeFileSync(warnFile, JSON.stringify(warnCounts, null, 2));
}

function ensureGuildWarnData(guildId) {
  if (!warnCounts[guildId]) {
    warnCounts[guildId] = {
      warnings: {},
      autopunish: []
    };
  }
  if (!warnCounts[guildId].warnings) warnCounts[guildId].warnings = {};
  if (!Array.isArray(warnCounts[guildId].autopunish)) warnCounts[guildId].autopunish = [];
}

// -------------------------
// CREATE OR FIND COUNTER CHANNEL
// -------------------------
async function getOrCreateCounterChannel(guild) {
  let channel = guild.channels.cache.find(
    ch => ch.type === ChannelType.GuildVoice && ch.name.startsWith("Messages:")
  );

  if (!channel) {
    const count = messageCounts[guild.id]?.count || 0;

    channel = await guild.channels.create({
      name: `Messages: ${count}`,
      type: ChannelType.GuildVoice,
      reason: 'Message counter channel'
    });
  }

  return channel;
}

// -------------------------
// HISTORICAL MESSAGE SCAN
// -------------------------
async function countHistoricalMessages(guild) {
  console.log(`Starting historical scan for guild: ${guild.name}`);

  let total = 0;

  const textChannels = guild.channels.cache.filter(
    ch => ch.type === ChannelType.GuildText
  );

  for (const [id, channel] of textChannels) {
    console.log(`Scanning #${channel.name} in ${guild.name}`);

    let lastId = null;

    while (true) {
      const options = { limit: 100 };
      if (lastId) options.before = lastId;

      let msgs;
      try {
        msgs = await channel.messages.fetch(options);
      } catch {
        console.log(`Skipping #${channel.name} (no access or error).`);
        break;
      }

      if (msgs.size === 0) break;

      total += msgs.size;
      lastId = msgs.last().id;

      await new Promise(res => setTimeout(res, 500));
    }
  }

  console.log(`Historical scan complete for ${guild.name}. Total messages: ${total}`);
  return total;
}

// -------------------------
// MESSAGE EVENT (NEW MESSAGES)
// -------------------------
client.on('messageCreate', async (message) => {
  if (!message.guild || message.author.bot) return;

  const guildId = message.guild.id;

  if (!messageCounts[guildId]) {
    messageCounts[guildId] = { count: 0, scanned: false };
  }

  messageCounts[guildId].count++;
  saveData();

  const now = Date.now();
  if (!lastUpdate[guildId] || now - lastUpdate[guildId] > 30000) {
    lastUpdate[guildId] = now;

    const channel = await getOrCreateCounterChannel(message.guild);
    if (channel && channel.manageable) {
      await channel.setName(`Messages: ${messageCounts[guildId].count}`);
    }
  }
});

// -------------------------
// TIME PARSER
// -------------------------
function parsePeriod(str) {
  const match = str.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return null;

  const num = parseInt(match[1]);
  const unit = match[2];

  const multipliers = {
    s: 1000,
    m: 60000,
    h: 3600000,
    d: 86400000
  };

  return num * multipliers[unit];
}

// -------------------------
// AUTO-PUNISHMENT HELPER
// -------------------------
async function applyAutoPunish(interaction, member, currentWarnings, lastDurationStr) {
  const guildId = interaction.guild.id;
  ensureGuildWarnData(guildId);

  const rules = warnCounts[guildId].autopunish || [];
  const rule = rules.find(r => r.warnings === currentWarnings);
  if (!rule) return null;

  const durationStr = rule.duration || lastDurationStr;
  const ms = parsePeriod(durationStr);
  if (!ms) return null;

  const reasonTemplate =
    rule.reason ||
    "You have been warned to follow the rules, you are now on timeout for {duration}.";

  // Replace {duration} with actual timeout length
  const reason = reasonTemplate.replace("{duration}", durationStr);

  try {
    await member.timeout(ms, reason);
  } catch (err) {
    console.error("Failed to apply auto-punishment:", err);
    return "Attempted to apply auto-timeout, but I don't have enough permissions or something went wrong.";
  }

  return `Auto-punishment applied: **${member.user.username}** has been timed out for **${durationStr}** (warnings: ${currentWarnings}).`;
}

// -------------------------
// SLASH COMMANDS
// -------------------------
const commands = [
  // Message analysis
  new SlashCommandBuilder()
    .setName('messages')
    .setDescription('Message analysis tools')
    .addSubcommand(sub =>
      sub
        .setName('count')
        .setDescription('Count messages in a channel over a time period')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Channel to analyze')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('period')
            .setDescription('Time period (e.g., 1h, 24h, 7d)')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('users')
        .setDescription('See which users sent messages in a time period')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Channel to analyze')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('period')
            .setDescription('Time period (e.g., 1h, 24h, 7d)')
            .setRequired(true)
        )
    ),

  // Moderator tools
  new SlashCommandBuilder()
    .setName('moderator')
    .setDescription('Moderation tools')
    // /moderator warn
    .addSubcommand(sub =>
      sub
        .setName('warn')
        .setDescription('Warn a member')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('User to warn')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('reason')
            .setDescription('Reason for the warning')
            .setRequired(true)
        )
    )
    // /moderator timeout
    .addSubcommand(sub =>
      sub
        .setName('timeout')
        .setDescription('Timeout a member and add a warning')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('User to timeout')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('duration')
            .setDescription('Duration (e.g., 10m, 1h, 2d)')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('reason')
            .setDescription('Reason for timeout')
            .setRequired(true)
        )
    )
    // /moderator warnings
    .addSubcommand(sub =>
      sub
        .setName('warnings')
        .setDescription('Check how many warnings a member has')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('User to check')
            .setRequired(true)
        )
    )
    // /moderator clearwarns
    .addSubcommand(sub =>
      sub
        .setName('clearwarns')
        .setDescription('Clear all warnings for a member')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('User to clear warnings for')
            .setRequired(true)
        )
    )
    // /moderator autopunish add/remove/list/clear
    .addSubcommandGroup(group =>
      group
        .setName('autopunish')
        .setDescription('Configure auto-punishment rules')
        // /moderator autopunish add
        .addSubcommand(sub =>
          sub
            .setName('add')
            .setDescription('Add an auto-timeout rule')
            .addIntegerOption(opt =>
              opt.setName('warnings')
                .setDescription('Number of warnings to trigger this rule')
                .setRequired(true)
            )
            .addStringOption(opt =>
              opt.setName('duration')
                .setDescription('Timeout duration (e.g., 10m, 1h, 2d)')
                .setRequired(true)
            )
            .addStringOption(opt =>
              opt.setName('reason')
                .setDescription('Optional reason template (use {however long the timeout was})')
                .setRequired(false)
            )
        )
        // /moderator autopunish remove
        .addSubcommand(sub =>
          sub
            .setName('remove')
            .setDescription('Remove an auto-timeout rule by warning count')
            .addIntegerOption(opt =>
              opt.setName('warnings')
                .setDescription('Warning count of the rule to remove')
                .setRequired(true)
            )
        )
        // /moderator autopunish list
        .addSubcommand(sub =>
          sub
            .setName('list')
            .setDescription('List all auto-timeout rules')
        )
        // /moderator autopunish clear
        .addSubcommand(sub =>
          sub
            .setName('clear')
            .setDescription('Clear all auto-timeout rules')
        )
    )
].map(cmd => cmd.toJSON());

// -------------------------
// REGISTER SLASH COMMANDS & STARTUP LOGIC
// -------------------------
client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

 // -------------------------
// ROTATING BOT STATUS
// -------------------------
const statuses = [
  { name: "'How to Track Messages?'🤔", type: 3 },
  { name: " some classical music", type: 2 },
  { name: "live about Discord Messages and how they work", type: 1 },
  { name: "System | Message Tracker", type: 0 }
];

const statusModes = ["online", "idle", "dnd"];

let i = 0;
let statusIndex = 0;

setInterval(() => {
  const activity = statuses[i % statuses.length];

  // Rotate status every 3 cycles (every 30 minutes)
  if (i % 3 === 0) {
    statusIndex = (statusIndex + 1) % statusModes.length;
  }

  client.user.setPresence({
    activities: [activity],
    status: statusModes[statusIndex]
  });

  i++;
}, 600000); // 10 minutes


  // -------------------------
  // SLASH COMMAND REGISTRATION
  // -------------------------
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log("Slash commands registered.");

  for (const [id, guild] of client.guilds.cache) {
    if (!messageCounts[guild.id]) {
      messageCounts[guild.id] = { count: 0, scanned: false };
    }

    if (!messageCounts[guild.id].scanned) {
      const total = await countHistoricalMessages(guild);
      messageCounts[guild.id] = { count: total, scanned: true };
      saveData();
    }

    await getOrCreateCounterChannel(guild);

    // Ensure warn data structure exists
    ensureGuildWarnData(guild.id);
  }
});

// -------------------------
// SLASH COMMAND HANDLER
// -------------------------
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // -------------------------
  // /messages commands
  // -------------------------
  if (interaction.commandName === 'messages') {
    const sub = interaction.options.getSubcommand();
    const channel = interaction.options.getChannel('channel');
    const periodStr = interaction.options.getString('period');
    const ms = parsePeriod(periodStr);

    if (!ms) {
      return interaction.reply({
        content: "Invalid time format. Use formats like `1h`, `30m`, `7d`.",
        ephemeral: true
      });
    }

    const cutoff = Date.now() - ms;

    let fetched = [];
    let lastId;

    while (true) {
      const options = { limit: 100 };
      if (lastId) options.before = lastId;

      const msgs = await channel.messages.fetch(options);
      if (msgs.size === 0) break;

      const filtered = msgs.filter(m => m.createdTimestamp >= cutoff);
      fetched.push(...filtered.values());

      lastId = msgs.last().id;

      if (msgs.last().createdTimestamp < cutoff) break;
    }

    if (sub === 'count') {
      return interaction.reply(
        `📊 **${fetched.length} messages** were sent in <#${channel.id}> over the last **${periodStr}**`
      );
    }

    if (sub === 'users') {
      const counts = {};

      for (const msg of fetched) {
        const id = msg.author.id;
        counts[id] = (counts[id] || 0) + 1;
      }

      const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([id, count]) => {
          const user = interaction.client.users.cache.get(id);
          const name = user ? user.username : `User ${id}`;
          const avatar = user ? user.displayAvatarURL() : null;
          return { name, count, avatar };
        });

      const description = sorted
        .map(u => `**${u.name}** — ${u.count} messages`)
        .join('\n') || "No messages found.";

      const embed = new EmbedBuilder()
        .setTitle(`Users active in #${channel.name}`)
        .setDescription(description)
        .setColor(0x5865F2)
        .setFooter({ text: `Period: ${periodStr}` });

      if (sorted[0] && sorted[0].avatar) {
        embed.setThumbnail(sorted[0].avatar);
      }

      return interaction.reply({ embeds: [embed] });
    }
  }

  // -------------------------
  // /moderator commands
  // -------------------------
  if (interaction.commandName === 'moderator') {
    // Permission check
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return interaction.reply({
        content: "You do not have permission to use moderation commands.",
        ephemeral: true
      });
    }

    const sub = interaction.options.getSubcommand(false);
    const subGroup = interaction.options.getSubcommandGroup(false);

    // Ensure warn storage exists for this guild
    const guildId = interaction.guild.id;
    ensureGuildWarnData(guildId);

    // -------------------------
    // Non-group subcommands
    // -------------------------
    if (!subGroup) {
      // /moderator warn
      if (sub === 'warn') {
        const target = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');
        const member = interaction.guild.members.cache.get(target.id);

        if (!member) {
          return interaction.reply({ content: "User not found in this server.", ephemeral: true });
        }

        const guildData = warnCounts[guildId];
        const warnings = guildData.warnings;

        if (!warnings[target.id]) warnings[target.id] = 0;
        warnings[target.id]++;
        saveWarns();

        const currentWarnings = warnings[target.id];

        let autoMsg = await applyAutoPunish(interaction, member, currentWarnings, null);

        let reply = `⚠️ **${target.username} has been warned.**\nReason: ${reason}\nTotal warnings: **${currentWarnings}**`;
        if (autoMsg) reply += `\n\n${autoMsg}`;

        return interaction.reply(reply);
      }

      // /moderator timeout
      if (sub === 'timeout') {
        const target = interaction.options.getUser('user');
        const durationStr = interaction.options.getString('duration');
        const reason = interaction.options.getString('reason');
        const member = interaction.guild.members.cache.get(target.id);

        if (!member) {
          return interaction.reply({ content: "User not found in this server.", ephemeral: true });
        }

        const ms = parsePeriod(durationStr);
        if (!ms) {
          return interaction.reply({
            content: "Invalid duration format. Use formats like `10m`, `1h`, `2d`.",
            ephemeral: true
          });
        }

        try {
          await member.timeout(ms, reason);
        } catch (err) {
          console.error(err);
          return interaction.reply({
            content: "Failed to timeout this user. I may not have permission.",
            ephemeral: true
          });
        }

        const guildData = warnCounts[guildId];
        const warnings = guildData.warnings;
        if (!warnings[target.id]) warnings[target.id] = 0;
        warnings[target.id]++;
        saveWarns();

        const currentWarnings = warnings[target.id];

        // Note: auto-punish is not triggered again here to avoid double timeouts
        return interaction.reply(
          `⏳ **${target.username} has been timed out for ${durationStr}.**\nReason: ${reason}\nWarnings: **${currentWarnings}**`
        );
      }

      // /moderator warnings
      if (sub === 'warnings') {
        const target = interaction.options.getUser('user');
        const guildData = warnCounts[guildId];
        const warnings = guildData.warnings;
        const count = warnings[target.id] || 0;

        return interaction.reply(
          `📋 **${target.username}** has **${count}** warning${count === 1 ? '' : 's'}.`
        );
      }

      // /moderator clearwarns
      if (sub === 'clearwarns') {
        const target = interaction.options.getUser('user');
        const guildData = warnCounts[guildId];
        const warnings = guildData.warnings;

        const had = warnings[target.id] || 0;
        delete warnings[target.id];
        saveWarns();

        return interaction.reply(
          `🧹 Cleared **${had}** warning${had === 1 ? '' : 's'} for **${target.username}**.`
        );
      }

      return;
    }

    // -------------------------
    // /moderator autopunish ...
    // -------------------------
    if (subGroup === 'autopunish') {
      const guildData = warnCounts[guildId];

      // /moderator autopunish add
      if (sub === 'add') {
        const warningsCount = interaction.options.getInteger('warnings');
        const durationStr = interaction.options.getString('duration');
        const reasonTemplate = interaction.options.getString('reason');

        if (warningsCount <= 0) {
          return interaction.reply({
            content: "Warning count must be greater than 0.",
            ephemeral: true
          });
        }

        const ms = parsePeriod(durationStr);
        if (!ms) {
          return interaction.reply({
            content: "Invalid duration format. Use formats like `10m`, `1h`, `2d`.",
            ephemeral: true
          });
        }

        // Replace existing rule with same warnings, if any
        guildData.autopunish = guildData.autopunish.filter(r => r.warnings !== warningsCount);

        const rule = {
          warnings: warningsCount,
          duration: durationStr
        };

        if (reasonTemplate && reasonTemplate.trim().length > 0) {
          rule.reason = reasonTemplate;
        }

        guildData.autopunish.push(rule);
        // Sort rules by warnings ascending (for cleanliness)
        guildData.autopunish.sort((a, b) => a.warnings - b.warnings);
        saveWarns();

        return interaction.reply(
          `✅ Added auto-timeout rule: **${warningsCount} warnings** → timeout for **${durationStr}**` +
          (rule.reason ? `\nReason template: \`${rule.reason}\`` : "")
        );
      }

      // /moderator autopunish remove
      if (sub === 'remove') {
        const warningsCount = interaction.options.getInteger('warnings');

        const beforeLength = guildData.autopunish.length;
        guildData.autopunish = guildData.autopunish.filter(r => r.warnings !== warningsCount);
        saveWarns();

        if (guildData.autopunish.length === beforeLength) {
          return interaction.reply(
            `❌ No rule found for **${warningsCount} warnings**.`
          );
        }

        return interaction.reply(
          `🗑️ Removed auto-timeout rule for **${warningsCount} warnings**.`
        );
      }

      // /moderator autopunish list
      if (sub === 'list') {
        if (!guildData.autopunish.length) {
          return interaction.reply("There are currently no auto-timeout rules configured.");
        }

        const lines = guildData.autopunish.map(r => {
          let line = `• **${r.warnings} warnings** → timeout **${r.duration}**`;
          if (r.reason) {
            line += `\n   Reason template: \`${r.reason}\``;
          }
          return line;
        });

        return interaction.reply(
          `📜 **Auto-timeout rules:**\n` + lines.join('\n')
        );
      }

      // /moderator autopunish clear
      if (sub === 'clear') {
        const count = guildData.autopunish.length;
        guildData.autopunish = [];
        saveWarns();

        return interaction.reply(
          `🧹 Cleared **${count}** auto-timeout rule${count === 1 ? '' : 's'}.`
        );
      }
    }
  }
});

// -------------------------
// LOGIN
// -------------------------
client.login(process.env.TOKEN);









