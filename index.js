// === SECTION: SERVER KEEP-ALIVE ===
const http = require("http");
http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("OK");
  })
  .listen(process.env.PORT || 3000);

// === SECTION: IMPORTS ===
require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  ChannelType,
  EmbedBuilder,
  SlashCommandBuilder
} = require("discord.js");
const fs = require("fs");

// === SECTION: CLIENT INITIALIZATION ===
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences
  ]
});

client.on("error", console.error);
client.on("debug", console.log);
client.on("shardError", console.error);
process.on("unhandledRejection", console.error);

// === SECTION: STORAGE: MESSAGE COUNTS ===
const messageFile = "./messageCounts.json";
let messageCounts = {};
let lastUpdate = {};

if (fs.existsSync(messageFile)) {
  try {
    messageCounts = JSON.parse(fs.readFileSync(messageFile, "utf8"));
  } catch {
    messageCounts = {};
  }
}

function saveMessageCounts() {
  fs.writeFileSync(messageFile, JSON.stringify(messageCounts, null, 2));
}

// === SECTION: STORAGE: WARN COUNTS ===
const warnFile = "./warnCounts.json";
let warnCounts = {};

if (fs.existsSync(warnFile)) {
  try {
    warnCounts = JSON.parse(fs.readFileSync(warnFile, "utf8"));
  } catch {
    warnCounts = {};
  }
}

function saveWarns() {
  fs.writeFileSync(warnFile, JSON.stringify(warnCounts, null, 2));
}

function ensureGuildWarnData(guildId) {
  if (!warnCounts[guildId]) {
    warnCounts[guildId] = { warnings: {}, autopunish: [] };
  }
}

// === SECTION: STORAGE: HISTORICAL COUNTS ===
const historicalFile = "./historicalCounts.json";
let historicalCounts = null;

if (fs.existsSync(historicalFile)) {
  try {
    historicalCounts = JSON.parse(fs.readFileSync(historicalFile, "utf8"));
  } catch {
    historicalCounts = null;
  }
}

// === SECTION: HELPERS ===
function parsePeriod(str) {
  const match = str.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return null;

  const num = parseInt(match[1]);
  const unit = match[2];

  const map = {
    s: 1000,
    m: 60000,
    h: 3600000,
    d: 86400000
  };

  return num * map[unit];
}

async function applyAutoPunish(interaction, member, currentWarnings) {
  const guildId = interaction.guild.id;
  ensureGuildWarnData(guildId);

  const rules = warnCounts[guildId].autopunish;
  const rule = rules.find(r => r.warnings === currentWarnings);
  if (!rule) return null;

  const ms = parsePeriod(rule.duration);
  if (!ms) return null;

  const reason = (rule.reason || "Timeout applied for {duration}.").replace(
    "{duration}",
    rule.duration
  );

  try {
    await member.timeout(ms, reason);
  } catch {
    return "Attempted auto-timeout but lacked permissions.";
  }

  return `Auto-timeout applied for **${rule.duration}**.`;
}

// === SECTION: MESSAGE EVENT ===
client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot) return;

  const guildId = message.guild.id;

  if (!messageCounts[guildId]) {
    messageCounts[guildId] = { count: 0, scanned: false };
  }

  messageCounts[guildId].count++;
  saveMessageCounts();

  const now = Date.now();
  if (!lastUpdate[guildId] || now - lastUpdate[guildId] > 30000) {
    lastUpdate[guildId] = now;

    let channel = message.guild.channels.cache.find(
      ch => ch.type === ChannelType.GuildVoice && ch.name.startsWith("Messages:")
    );

    if (!channel) {
      channel = await message.guild.channels.create({
        name: `Messages: ${messageCounts[guildId].count}`,
        type: ChannelType.GuildVoice
      });
    }

    if (channel.manageable) {
      await channel.setName(`Messages: ${messageCounts[guildId].count}`);
    }
  }
});

// === SECTION: SLASH COMMAND DEFINITIONS ===
const commands = [
  new SlashCommandBuilder()
    .setName("messages")
    .setDescription("Message analysis tools")
    .addSubcommand(sub =>
      sub
        .setName("count")
        .setDescription("Count messages in a channel over a time period")
        .addChannelOption(o =>
          o.setName("channel").setDescription("Channel").setRequired(true)
        )
        .addStringOption(o =>
          o.setName("period").setDescription("1h, 24h, 7d").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("users")
        .setDescription("List users active in a time period")
        .addChannelOption(o =>
          o.setName("channel").setDescription("Channel").setRequired(true)
        )
        .addStringOption(o =>
          o.setName("period").setDescription("1h, 24h, 7d").setRequired(true)
        )
    ),

  new SlashCommandBuilder()
    .setName("moderator")
    .setDescription("Moderation tools")
    .addSubcommand(sub =>
      sub
        .setName("warn")
        .setDescription("Warn a member")
        .addUserOption(o =>
          o.setName("user").setDescription("User").setRequired(true)
        )
        .addStringOption(o =>
          o.setName("reason").setDescription("Reason").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("timeout")
        .setDescription("Timeout a member")
        .addUserOption(o =>
          o.setName("user").setDescription("User").setRequired(true)
        )
        .addStringOption(o =>
          o.setName("duration").setDescription("10m, 1h, 2d").setRequired(true)
        )
        .addStringOption(o =>
          o.setName("reason").setDescription("Reason").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("warnings")
        .setDescription("Check warnings")
        .addUserOption(o =>
          o.setName("user").setDescription("User").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("clearwarns")
        .setDescription("Clear warnings")
        .addUserOption(o =>
          o.setName("user").setDescription("User").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName("backupwarns").setDescription("Backup warn data")
    )
    .addSubcommand(sub =>
      sub.setName("backupmessages").setDescription("Backup message data")
    )
    .addSubcommandGroup(group =>
      group
        .setName("autopunish")
        .setDescription("Auto-timeout rules")
        .addSubcommand(sub =>
          sub
            .setName("add")
            .setDescription("Add rule")
            .addIntegerOption(o =>
              o.setName("warnings").setDescription("Count").setRequired(true)
            )
            .addStringOption(o =>
              o.setName("duration").setDescription("10m, 1h").setRequired(true)
            )
            .addStringOption(o =>
              o.setName("reason").setDescription("Template").setRequired(false)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName("remove")
            .setDescription("Remove rule")
            .addIntegerOption(o =>
              o.setName("warnings").setDescription("Count").setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub.setName("list").setDescription("List rules")
        )
        .addSubcommand(sub =>
          sub.setName("clear").setDescription("Clear rules")
        )
    )
].map(c => c.toJSON());

// === SECTION: SLASH COMMAND HANDLER ===
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const guildId = interaction.guild.id;

  // === /messages ===
  if (interaction.commandName === "messages") {
    const sub = interaction.options.getSubcommand();
    const channel = interaction.options.getChannel("channel");
    const periodStr = interaction.options.getString("period");
    const ms = parsePeriod(periodStr);

    if (!ms) {
      return interaction.reply({
        content: "Invalid time format.",
        ephemeral: true
      });
    }

    const cutoff = Date.now() - ms;
    let fetched = [];
    let lastId;

    while (true) {
      const opts = { limit: 100 };
      if (lastId) opts.before = lastId;

      const msgs = await channel.messages.fetch(opts);
      if (msgs.size === 0) break;

      const filtered = msgs.filter(m => m.createdTimestamp >= cutoff);
      fetched.push(...filtered.values());

      lastId = msgs.last().id;
      if (msgs.last().createdTimestamp < cutoff) break;
    }

    if (sub === "count") {
      return interaction.reply(
        `**${fetched.length} messages** in <#${channel.id}> over **${periodStr}**`
      );
    }

    if (sub === "users") {
      const counts = {};
      for (const msg of fetched) {
        counts[msg.author.id] = (counts[msg.author.id] || 0) + 1;
      }

      const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([id, count]) => {
          const user = client.users.cache.get(id);
          return `**${user ? user.username : id}** — ${count}`;
        })
        .join("\n") || "No messages.";

      const embed = new EmbedBuilder()
        .setTitle(`Users active in #${channel.name}`)
        .setDescription(sorted)
        .setColor(0x5865f2);

      return interaction.reply({ embeds: [embed] });
    }
  }

  // === /moderator ===
  if (interaction.commandName === "moderator") {
    const sub = interaction.options.getSubcommand(false);
    const subGroup = interaction.options.getSubcommandGroup(false);

    ensureGuildWarnData(guildId);

    // === backupwarns ===
    if (sub === "backupwarns") {
      if (interaction.user.id !== "1262577043309072426") {
        return interaction.reply({
          content: "Not authorized.",
          ephemeral: true
        });
      }

      const backup = {
        warnings: warnCounts[guildId].warnings,
        autopunish: warnCounts[guildId].autopunish
      };

      return interaction.reply({
        content: "Warn backup:",
        files: [
          {
            attachment: Buffer.from(JSON.stringify(backup, null, 2)),
            name: "warn-backup.json"
          }
        ],
        ephemeral: true
      });
    }

    // === backupmessages ===
    if (sub === "backupmessages") {
      if (interaction.user.id !== "1262577043309072426") {
        return interaction.reply({
          content: "Not authorized.",
          ephemeral: true
        });
      }

      if (!historicalCounts) {
        return interaction.reply({
          content: "Historical data not found. Run a historical scan first.",
          ephemeral: true
        });
      }

      const backup = {
        live: messageCounts[guildId] || {},
        historical: historicalCounts[guildId] || {}
      };

      return interaction.reply({
        content: "Message backup:",
        files: [
          {
            attachment: Buffer.from(JSON.stringify(backup, null, 2)),
            name: "message-backup.json"
          }
        ],
        ephemeral: true
      });
    }

    // === warn ===
    if (sub === "warn") {
      const target = interaction.options.getUser("user");
      const reason = interaction.options.getString("reason");
      const member = interaction.guild.members.cache.get(target.id);

      if (!member) {
        return interaction.reply({
          content: "User not found.",
          ephemeral: true
        });
      }

      const warnings = warnCounts[guildId].warnings;
      warnings[target.id] = (warnings[target.id] || 0) + 1;
      saveWarns();

      const auto = await applyAutoPunish(
        interaction,
        member,
        warnings[target.id]
      );

      return interaction.reply(
        `Warned **${target.username}**.\nReason: ${reason}\nWarnings: **${warnings[target.id]}**` +
          (auto ? `\n${auto}` : "")
      );
    }

    // === timeout ===
    if (sub === "timeout") {
      const target = interaction.options.getUser("user");
      const durationStr = interaction.options.getString("duration");
      const reason = interaction.options.getString("reason");
      const member = interaction.guild.members.cache.get(target.id);

      if (!member) {
        return interaction.reply({
          content: "User not found.",
          ephemeral: true
        });
      }

      const ms = parsePeriod(durationStr);
      if (!ms) {
        return interaction.reply({
          content: "Invalid duration.",
          ephemeral: true
        });
      }

      try {
        await member.timeout(ms, reason);
      } catch {
        return interaction.reply({
          content: "Failed to timeout user.",
          ephemeral: true
        });
      }

      const warnings = warnCounts[guildId].warnings;
      warnings[target.id] = (warnings[target.id] || 0) + 1;
      saveWarns();

      return interaction.reply(
        `Timed out **${target.username}** for **${durationStr}**.\nReason: ${reason}\nWarnings: **${warnings[target.id]}**`
      );
    }

    // === warnings ===
    if (sub === "warnings") {
      const target = interaction.options.getUser("user");
      const warnings = warnCounts[guildId].warnings[target.id] || 0;

      return interaction.reply(
        `**${target.username}** has **${warnings}** warning(s).`
      );
    }

    // === clearwarns ===
    if (sub === "clearwarns") {
      const target = interaction.options.getUser("user");
      const warnings = warnCounts[guildId].warnings[target.id] || 0;

      delete warnCounts[guildId].warnings[target.id];
      saveWarns();

      return interaction.reply(
        `Cleared **${warnings}** warning(s) for **${target.username}**.`
      );
    }

    // === autopunish ===
    if (subGroup === "autopunish") {
      const rules = warnCounts[guildId].autopunish;

      if (sub === "add") {
        const count = interaction.options.getInteger("warnings");
        const duration = interaction.options.getString("duration");
        const reason = interaction.options.getString("reason");

        const ms = parsePeriod(duration);
        if (!ms) {
          return interaction.reply({
            content: "Invalid duration.",
            ephemeral: true
          });
        }

        warnCounts[guildId].autopunish = rules.filter(
          r => r.warnings !== count
        );

        const rule = { warnings: count, duration };
        if (reason) rule.reason = reason;

        warnCounts[guildId].autopunish.push(rule);
        warnCounts[guildId].autopunish.sort(
          (a, b) => a.warnings - b.warnings
        );
        saveWarns();

        return interaction.reply(
          `Added rule: **${count} warnings** → **${duration}**`
        );
      }

      if (sub === "remove") {
        const count = interaction.options.getInteger("warnings");
        const before = rules.length;

        warnCounts[guildId].autopunish = rules.filter(
          r => r.warnings !== count
        );
        saveWarns();

        if (rules.length === before) {
          return interaction.reply(
            `No rule found for **${count} warnings**.`
          );
        }

        return interaction.reply(
          `Removed rule for **${count} warnings**.`
        );
      }

      if (sub === "list") {
        if (!rules.length) {
          return interaction.reply("No auto-timeout rules configured.");
        }

        const lines = rules.map(r => {
          let line = `• **${r.warnings} warnings** → **${r.duration}**`;
          if (r.reason) line += `\n  Reason: ${r.reason}`;
          return line;
        });

        return interaction.reply(lines.join("\n"));
      }

      if (sub === "clear") {
        const count = rules.length;
        warnCounts[guildId].autopunish = [];
        saveWarns();

        return interaction.reply(
          `Cleared **${count}** auto-timeout rule(s).`
        );
      }
    }
  }
});

// === SECTION: LOGIN ===
client.login(process.env.TOKEN);



