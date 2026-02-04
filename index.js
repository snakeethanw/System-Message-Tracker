// === SECTION: IMPORTS ===
require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  ChannelType,
  EmbedBuilder,
  SlashCommandBuilder,
  ActivityType,
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");
const fs = require("fs");

// === SECTION: CLIENT INITIALIZATION ===
const client = new Client({
  rest: { timeout: 30000 },
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.DirectMessages
  ],
  partials: ["CHANNEL"]
});

client.on("error", console.error);
client.on("shardError", console.error);
process.on("unhandledRejection", console.error);

// === SECTION: RECONNECT ===
client.on("reconnecting", () => {
  console.log("Reconnecting to Discord...");
});

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

// === SECTION: STORAGE: LOG CHANNELS ===
const logFile = "./logChannels.json";
let logChannels = {};

if (fs.existsSync(logFile)) {
  try {
    logChannels = JSON.parse(fs.readFileSync(logFile, "utf8"));
  } catch {
    logChannels = {};
  }
}

function saveLogChannels() {
  fs.writeFileSync(logFile, JSON.stringify(logChannels, null, 2));
}

// === SECTION: STORAGE: MUTE CONFIG ===
const muteConfigFile = "./muteConfig.json";
let muteConfig = {};

if (fs.existsSync(muteConfigFile)) {
  try {
    muteConfig = JSON.parse(fs.readFileSync(muteConfigFile, "utf8"));
  } catch {
    muteConfig = {};
  }
}

function saveMuteConfig() {
  fs.writeFileSync(muteConfigFile, JSON.stringify(muteConfig, null, 2));
}

// === SECTION: LOGGING HELPER ===
async function sendLog(guild, embed) {
  const channelId = logChannels[guild.id];
  if (!channelId) return;

  const channel = guild.channels.cache.get(channelId);
  if (!channel) return;

  try {
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("Failed to send log:", err);
  }
}

// === SECTION: MUTE LOGGING HELPER ===
async function logMuteAction(guild, data) {
  const embed = new EmbedBuilder()
    .setTitle(
      data.type === "mute"
        ? "Member Muted"
        : data.type === "unmute"
        ? "Member Unmuted"
        : "Auto Unmute"
    )
    .addFields(
      { name: "User", value: `${data.user.tag} (${data.user.id})` },
      { name: "Moderator", value: `${data.moderator}` },
      { name: "Reason", value: data.reason }
    )
    .setColor(data.type === "mute" ? 0xff0000 : 0x00ff00)
    .setTimestamp();

  if (data.duration) {
    embed.addFields({ name: "Duration", value: data.duration });
  }

  await sendLog(guild, embed);
}

// === SECTION: HELPERS ===
function parsePeriod(str) {
  const match = str?.match(/^(\d+)(s|m|h|d)$/);
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

function parseMuteDuration(str) {
  return parsePeriod(str);
}

async function ensureMutedRole(guild) {
  let mutedRole = guild.roles.cache.find(r => r.name === "Muted");
  if (mutedRole) return mutedRole;

  mutedRole = await guild.roles.create({
    name: "Muted",
    color: "#555555",
    reason: "Muted role for moderation"
  });

  for (const [, channel] of guild.channels.cache) {
    await channel.permissionOverwrites
      .edit(mutedRole, {
        SendMessages: false,
        AddReactions: false,
        Speak: false,
        Connect: false,
        SendMessagesInThreads: false,
        CreatePublicThreads: false,
        CreatePrivateThreads: false
      })
      .catch(() => {});
  }

  return mutedRole;
}

async function scanGuildHistory(guild) {
  const guildId = guild.id;

  if (!messageCounts[guildId]) {
    messageCounts[guildId] = { count: 0, scanned: false };
  }

  if (messageCounts[guildId].scanned) {
    console.log(`Historical scan skipped for ${guild.name} (already scanned).`);
    return;
  }

  console.log(`Starting historical scan for ${guild.name}...`);

  let total = 0;

  for (const channel of guild.channels.cache.values()) {
    if (channel.type !== ChannelType.GuildText) continue;

    console.log(`Scanning #${channel.name}...`);

    let lastId = null;

    while (true) {
      const options = { limit: 100 };
      if (lastId) options.before = lastId;

      let messages;
      try {
        messages = await channel.messages.fetch(options);
      } catch {
        break;
      }

      if (messages.size === 0) break;

      total += messages.size;
      lastId = messages.last().id;

      if (messages.size < 100) break;

      await new Promise(res => setTimeout(res, 350));
    }
  }

  messageCounts[guildId].count += total;
  messageCounts[guildId].scanned = true;
  saveMessageCounts();

  console.log(
    `Historical scan complete for ${guild.name}. Added ${total} messages.`
  );
}

async function applyAutoPunish(interaction, member, currentWarnings) {
  const guildId = interaction.guild.id;
  ensureGuildWarnData(guildId);

  const rules = warnCounts[guildId].autopunish;
  const rule = rules.find(r => r.warnings === currentWarnings);
  if (!rule) return null;

  const ms = parsePeriod(rule.duration);
  if (!ms) return null;

  const mutedRole = await ensureMutedRole(interaction.guild);

  const reasonTemplate =
    rule.reason || "Muted for {duration} due to warning threshold.";
  const reason = reasonTemplate.replace("{duration}", rule.duration);

  try {
    await member.roles.add(mutedRole, reason);
  } catch {
    return "Attempted auto-mute but lacked permissions.";
  }

  setTimeout(async () => {
    const fresh = await interaction.guild.members
      .fetch(member.id)
      .catch(() => null);
    if (!fresh) return;
    if (!fresh.roles.cache.has(mutedRole.id)) return;

    await fresh.roles.remove(mutedRole, "Auto-mute duration expired").catch(
      () => {}
    );

    await logMuteAction(interaction.guild, {
      type: "auto_unmute",
      user: fresh.user,
      moderator: "System",
      reason: "Auto-mute duration expired"
    });
  }, ms);

  return `Auto-mute applied for **${rule.duration}**.`;
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

// === SECTION: SLASH COMMAND HANDLER ===
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;
  const guild = interaction.guild;
  const guildId = guild?.id;

  // === /messages ===
  if (interaction.commandName === "messages") {
    if (!guild) {
      return interaction.reply({
        content: "This command can only be used in a server.",
        ephemeral: true
      });
    }

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

      const sorted =
        Object.entries(counts)
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
    if (!guild) {
      return interaction.reply({
        content: "This command can only be used in a server.",
        ephemeral: true
      });
    }

    const sub = interaction.options.getSubcommand(false);
    const subGroup = interaction.options.getSubcommandGroup(false);

    ensureGuildWarnData(guildId);

    // === /moderator setlog ===
    if (sub === "setlog") {
      const channel = interaction.options.getChannel("channel");

      logChannels[guildId] = channel.id;
      saveLogChannels();

      const embed = new EmbedBuilder()
        .setTitle("Moderation Log Channel Set")
        .setDescription(`Logs will now be sent to <#${channel.id}>`)
        .setColor(0x00ff99);

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // === /moderator backupwarns ===
    if (sub === "backupwarns") {
      if (userId !== process.env.USER_ID) {
        return interaction.reply({
          content: "Not authorized.",
          ephemeral: true
        });
      }

      const backup = {};

      for (const g of client.guilds.cache.values()) {
        const id = g.id;

        backup[id] = {
          warnings: warnCounts[id]?.warnings || {},
          autopunish: warnCounts[id]?.autopunish || []
        };
      }

      return interaction.reply({
        content: "Warn backup for all servers:",
        files: [
          {
            attachment: Buffer.from(JSON.stringify(backup, null, 2)),
            name: "warn-backup.json"
          }
        ],
        ephemeral: true
      });
    }

    // === /moderator backupmessages ===
    if (sub === "backupmessages") {
      if (userId !== process.env.USER_ID) {
        return interaction.reply({
          content: "Not authorized.",
          ephemeral: true
        });
      }

      const backup = {};

      for (const g of client.guilds.cache.values()) {
        const id = g.id;

        backup[id] = {
          live: messageCounts[id] || {}
        };
      }

      return interaction.reply({
        content: "Message backup for all servers:",
        files: [
          {
            attachment: Buffer.from(JSON.stringify(backup, null, 2)),
            name: "message-backup.json"
          }
        ],
        ephemeral: true
      });
    }

    // === /moderator backuplogchannels ===
    if (sub === "backuplogchannels") {
      if (userId !== process.env.USER_ID) {
        return interaction.reply({
          content: "Not authorized.",
          ephemeral: true
        });
      }

      const backup = {};

      for (const g of client.guilds.cache.values()) {
        const id = g.id;

        backup[id] = {
          logChannel: logChannels[id] || null
        };
      }

      return interaction.reply({
        content: "Log channel backup for all servers:",
        files: [
          {
            attachment: Buffer.from(JSON.stringify(backup, null, 2)),
            name: "logchannel-backup.json"
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

      const replyText =
        `Warned **${target.username}**.\nReason: ${reason}\nWarnings: **${warnings[target.id]}**` +
        (auto ? `\n${auto}` : "");

      await interaction.reply(replyText);

      const logEmbed = new EmbedBuilder()
        .setTitle("Member Warned")
        .addFields(
          { name: "User", value: `${target.username} (${target.id})` },
          { name: "Reason", value: reason },
          { name: "Total Warnings", value: `${warnings[target.id]}` },
          { name: "Moderator", value: `${interaction.user.username}` }
        )
        .setColor(0xffcc00)
        .setTimestamp();

      await sendLog(interaction.guild, logEmbed);
      return;
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

      await interaction.reply(
        `Cleared **${warnings}** warning(s) for **${target.username}**.`
      );

      const logEmbed = new EmbedBuilder()
        .setTitle("Warnings Cleared")
        .addFields(
          { name: "User", value: `${target.username} (${target.id})` },
          { name: "Cleared Count", value: `${warnings}` },
          { name: "Moderator", value: `${interaction.user.username}` }
        )
        .setColor(0x00aaff)
        .setTimestamp();

      await sendLog(interaction.guild, logEmbed);
      return;
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

        await interaction.reply(
          `Added auto-mute rule: **${count} warnings** → **${duration}**`
        );

        const logEmbed = new EmbedBuilder()
          .setTitle("Autopunish Rule Added")
          .addFields(
            { name: "Warnings", value: `${count}` },
            { name: "Duration", value: duration },
            { name: "Reason Template", value: reason || "None" },
            { name: "Moderator", value: `${interaction.user.username}` }
          )
          .setColor(0x33cc33)
          .setTimestamp();

        await sendLog(interaction.guild, logEmbed);
        return;
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

        await interaction.reply(
          `Removed auto-mute rule for **${count} warnings**.`
        );

        const logEmbed = new EmbedBuilder()
          .setTitle("Autopunish Rule Removed")
          .addFields(
            { name: "Warnings", value: `${count}` },
            { name: "Moderator", value: `${interaction.user.username}` }
          )
          .setColor(0xcc3333)
          .setTimestamp();

        await sendLog(interaction.guild, logEmbed);
        return;
      }

      if (sub === "list") {
        if (!rules.length) {
          return interaction.reply("No auto-mute rules configured.");
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

        await interaction.reply(
          `Cleared **${count}** auto-mute rule(s).`
        );

        const logEmbed = new EmbedBuilder()
          .setTitle("Autopunish Rules Cleared")
          .addFields(
            { name: "Moderator", value: `${interaction.user.username}` }
          )
          .setColor(0xaa00aa)
          .setTimestamp();

        await sendLog(interaction.guild, logEmbed);
        return;
      }
    }

    // === /moderator mute ===
    if (sub === "mute") {
      const user = interaction.options.getUser("user");
      const durationStr = interaction.options.getString("duration");
      const reason = interaction.options.getString("reason");

      const member = interaction.guild.members.cache.get(user.id);
      if (!member) {
        return interaction.reply({
          content: "User not found.",
          ephemeral: true
        });
      }

      const mutedRole = await ensureMutedRole(interaction.guild);

      if (member.roles.cache.has(mutedRole.id)) {
        return interaction.reply({
          content: "That user is already muted.",
          ephemeral: true
        });
      }

      await member.roles.add(mutedRole, reason);

      let durationLabel = "Indefinite";
      const ms = parseMuteDuration(durationStr);

      if (ms) {
        durationLabel = durationStr;

        setTimeout(async () => {
          const fresh = await interaction.guild.members
            .fetch(user.id)
            .catch(() => null);
          if (!fresh) return;
          if (!fresh.roles.cache.has(mutedRole.id)) return;

          await fresh.roles
            .remove(mutedRole, "Timed mute expired")
            .catch(() => {});

          await logMuteAction(interaction.guild, {
            type: "auto_unmute",
            user,
            moderator: "System",
            reason: "Timed mute expired"
          });
        }, ms);
      }

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Member Muted")
            .setDescription(
              `${user} has been muted.\n**Reason:** ${reason}\n**Duration:** ${durationLabel}`
            )
            .setColor(0xff0000)
        ]
      });

      await logMuteAction(interaction.guild, {
        type: "mute",
        user,
        moderator: interaction.user.tag,
        reason,
        duration: durationLabel
      });

      return;
    }

    // === /moderator unmute ===
    if (sub === "unmute") {
      const user = interaction.options.getUser("user");
      const reason =
        interaction.options.getString("reason") || "No reason provided";

      const member = interaction.guild.members.cache.get(user.id);
      if (!member) {
        return interaction.reply({
          content: "User not found.",
          ephemeral: true
        });
      }

      const mutedRole = await ensureMutedRole(interaction.guild);

      if (!member.roles.cache.has(mutedRole.id)) {
        return interaction.reply({
          content: "That user is not muted.",
          ephemeral: true
        });
      }

      await member.roles.remove(mutedRole, reason);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Member Unmuted")
            .setDescription(`${user} has been unmuted.\n**Reason:** ${reason}`)
            .setColor(0x00ff00)
        ]
      });

      await logMuteAction(interaction.guild, {
        type: "unmute",
        user,
        moderator: interaction.user.tag,
        reason
      });

      return;
    }

    // === /moderator setupmute ===
    if (sub === "setupmute") {
      if (!muteConfig[guildId]) {
        muteConfig[guildId] = { appeal: [], tickets: [] };
        saveMuteConfig();
      }

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Muted Role Setup")
            .setDescription(
              "Select which channels muted users are allowed to use for **appeals** and **tickets**.\nMuted users remain blocked everywhere else."
            )
            .setColor(0x5865f2)
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ChannelSelectMenuBuilder()
              .setCustomId("mute_appeal_channels")
              .setPlaceholder("Select appeal channels")
              .setMinValues(1)
              .setMaxValues(5)
          ),
          new ActionRowBuilder().addComponents(
            new ChannelSelectMenuBuilder()
              .setCustomId("mute_ticket_channels")
              .setPlaceholder("Select ticket channels")
              .setMinValues(1)
              .setMaxValues(5)
          )
        ]
      });
    }
  }

  // === /backup (GLOBAL) ===
  if (interaction.commandName === "backup") {
    if (interaction.user.id !== process.env.USER_ID) {
      return interaction.reply({
        content: "Not authorized.",
        ephemeral: true
      });
    }

    const sub = interaction.options.getSubcommand();

    // /backup muteconfig
    if (sub === "muteconfig") {
      const backup = {};

      for (const g of client.guilds.cache.values()) {
        const id = g.id;
        backup[id] = muteConfig[id] || { appeal: [], tickets: [] };
      }

      return interaction.reply({
        content: "Mute configuration backup for all servers:",
        files: [
          {
            attachment: Buffer.from(JSON.stringify(backup, null, 2)),
            name: "muteconfig-backup.json"
          }
        ],
        ephemeral: true
      });
    }

    // /backup master (modal-based)
    if (sub === "master") {
      const modal = new ModalBuilder()
        .setCustomId("master_backup_modal")
        .setTitle("Enter Backup Passcode")
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("backup_passcode")
              .setLabel("Passcode")
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          )
        );

      return interaction.showModal(modal);
    }
  }
});

// === SECTION: COMPONENT HANDLER (MUTE SETUP + BACKUP BUTTONS/MODALS) ===
client.on("interactionCreate", async interaction => {
  // Channel select menus for mute setup
  if (interaction.isChannelSelectMenu()) {
    const guild = interaction.guild;
    if (!guild) return;
    const guildId = guild.id;

    const mutedRole = await ensureMutedRole(guild);

    if (!muteConfig[guildId]) {
      muteConfig[guildId] = { appeal: [], tickets: [] };
    }

    if (interaction.customId === "mute_appeal_channels") {
      muteConfig[guildId].appeal = interaction.values;
      saveMuteConfig();

      for (const id of interaction.values) {
        const ch = guild.channels.cache.get(id);
        if (!ch) continue;

        await ch.permissionOverwrites
          .edit(mutedRole, {
            SendMessages: true,
            UseApplicationCommands: true
          })
          .catch(() => {});
      }

      return interaction.reply({
        content: "Appeal channels updated for muted users.",
        ephemeral: true
      });
    }

    if (interaction.customId === "mute_ticket_channels") {
      muteConfig[guildId].tickets = interaction.values;
      saveMuteConfig();

      for (const id of interaction.values) {
        const ch = guild.channels.cache.get(id);
        if (!ch) continue;

        await ch.permissionOverwrites
          .edit(mutedRole, {
            SendMessages: true,
            UseApplicationCommands: true
          })
          .catch(() => {});
      }

      return interaction.reply({
        content: "Ticket channels updated for muted users.",
        ephemeral: true
      });
    }
  }

  // Buttons (scheduled backup unlock)
  if (interaction.isButton()) {
    if (interaction.customId === "scheduled_backup_unlock") {
      if (interaction.user.id !== process.env.USER_ID) {
        return interaction.reply({
          content: "Not authorized.",
          ephemeral: true
        });
      }

      const modal = new ModalBuilder()
        .setCustomId("scheduled_backup_modal")
        .setTitle("Enter Backup Passcode")
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("backup_passcode")
              .setLabel("Passcode")
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          )
        );

      return interaction.showModal(modal);
    }
  }

  // Modals (master backup + scheduled backup)
  if (interaction.isModalSubmit()) {
    if (
      interaction.customId === "master_backup_modal" ||
      interaction.customId === "scheduled_backup_modal"
    ) {
      if (interaction.user.id !== process.env.USER_ID) {
        return interaction.reply({
          content: "Not authorized.",
          ephemeral: true
        });
      }

      const passcode = interaction.fields.getTextInputValue("backup_passcode");
      if (passcode !== process.env.MASTER_BACKUP_PASSWORD) {
        return interaction.reply({
          content: "Incorrect passcode. Backup cancelled.",
          ephemeral: true
        });
      }

      const files = [];

      if (fs.existsSync(warnFile)) {
        files.push({
          attachment: fs.readFileSync(warnFile),
          name: "warnCounts.json"
        });
      }

      if (fs.existsSync(messageFile)) {
        files.push({
          attachment: fs.readFileSync(messageFile),
          name: "messageCounts.json"
        });
      }

      if (fs.existsSync(logFile)) {
        files.push({
          attachment: fs.readFileSync(logFile),
          name: "logChannels.json"
        });
      }

      if (fs.existsSync(muteConfigFile)) {
        files.push({
          attachment: fs.readFileSync(muteConfigFile),
          name: "muteConfig.json"
        });
      }

      if (!files.length) {
        return interaction.reply({
          content: "No backup files found.",
          ephemeral: true
        });
      }

      await interaction.reply({
        content: "Master backup files:",
        files,
        ephemeral: true
      });
    }
  }
});

// === SECTION: SCHEDULED FRIDAY 8PM PST BACKUP ===
let lastScheduledBackupKey = null;

async function checkScheduledBackup() {
  try {
    const now = new Date();
    const pstString = now.toLocaleString("en-US", {
      timeZone: "America/Los_Angeles"
    });
    const pst = new Date(pstString);

    const day = pst.getDay(); // 5 = Friday
    const hour = pst.getHours(); // 20 = 8 PM
    const minute = pst.getMinutes();

    const key = `${pst.getFullYear()}-${pst.getMonth()}-${pst.getDate()}-${hour}-${minute}`;

    if (day === 5 && hour === 20 && minute === 0) {
      if (lastScheduledBackupKey === key) return;
      lastScheduledBackupKey = key;

      const userId = process.env.USER_ID;
      if (!userId) return;

      const user = await client.users.fetch(userId).catch(() => null);
      if (!user) return;

      const embed = new EmbedBuilder()
        .setTitle("Scheduled Backup Ready")
        .setDescription(
          "Press the button below and enter your passcode to unlock your full backup."
        )
        .setColor(0x5865f2)
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("scheduled_backup_unlock")
          .setLabel("Unlock Backup")
          .setStyle(ButtonStyle.Primary)
      );

      await user.send({ embeds: [embed], components: [row] }).catch(() => {});
    }
  } catch (err) {
    console.error("Scheduled backup check failed:", err);
  }
}

// === SECTION: PRESENCE ROTATION ===
const presenceStates = [
  { type: ActivityType.Watching, text: "⚡ server activity" },
  { type: ActivityType.Watching, text: "🟦 logs and warnings" },
  { type: ActivityType.Listening, text: "💬 conversations" },
  { type: ActivityType.Listening, text: "🎧 voice channels" },
  { type: ActivityType.Playing, text: "🛡️ moderation tools" },
  { type: ActivityType.Playing, text: "📊 message analytics" },
  { type: ActivityType.Watching, text: "👀 over the community" },
  { type: ActivityType.Watching, text: "📡 live server metrics" },
  { type: ActivityType.Listening, text: "📝 user reports" },
  { type: ActivityType.Playing, text: "🧩 with server data" },
  { type: ActivityType.Watching, text: "🔌 connections and shards" },
  { type: ActivityType.Listening, text: "🕒 activity over time" }
];

const statusCycle = ["online", "idle", "dnd"];
let presenceIndex = 0;
let statusIndex = 0;

client.on("ready", async () => {
  console.log(`Ready as ${client.user.tag}`);

  setTimeout(() => {
    for (const guild of client.guilds.cache.values()) {
      scanGuildHistory(guild); // no await
    }
  }, 5000);

  const updatePresence = () => {
    const current = presenceStates[presenceIndex];
    const status = statusCycle[statusIndex];

    client.user.setPresence({
      activities: [{ name: current.text, type: current.type }],
      status
    });

    presenceIndex = (presenceIndex + 1) % presenceStates.length;
    statusIndex = (statusIndex + 1) % statusCycle.length;
  };

  updatePresence();
  setInterval(updatePresence, 45000);

  // Scheduled backup check every minute
  setInterval(checkScheduledBackup, 60000);
});

// === SECTION: LOGIN ===
client.login(process.env.TOKEN);

client.on("debug", msg => {
  if (
    msg.includes("Connecting") ||
    msg.includes("IDENTIFY") ||
    msg.includes("READY")
  ) {
    console.log("[DEBUG]", msg);
  }
});


