// === SECTION: IMPORTS ===
const { REST, Routes, SlashCommandBuilder } = require("discord.js");
require("dotenv").config();

// === SECTION: COMMAND ARRAY ===
const guildCommands = [];
const globalCommands = [];

// === SECTION: /messages COMMAND (GUILD) ===
guildCommands.push(
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
    )
    .toJSON()
);

// === SECTION: /moderator COMMAND (GUILD) ===
guildCommands.push(
  new SlashCommandBuilder()
    .setName("moderator")
    .setDescription("Moderation tools")

    // === setlog ===
    .addSubcommand(sub =>
      sub
        .setName("setlog")
        .setDescription("Set the moderation log channel")
        .addChannelOption(o =>
          o.setName("channel").setDescription("Log channel").setRequired(true)
        )
    )

    // === warn ===
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

    // === warnings ===
    .addSubcommand(sub =>
      sub
        .setName("warnings")
        .setDescription("Check warnings")
        .addUserOption(o =>
          o.setName("user").setDescription("User").setRequired(true)
        )
    )

    // === clearwarns ===
    .addSubcommand(sub =>
      sub
        .setName("clearwarns")
        .setDescription("Clear warnings")
        .addUserOption(o =>
          o.setName("user").setDescription("User").setRequired(true)
        )
    )

    // === backupwarns ===
    .addSubcommand(sub =>
      sub.setName("backupwarns").setDescription("Backup warn data")
    )

    // === backupmessages ===
    .addSubcommand(sub =>
      sub.setName("backupmessages").setDescription("Backup message data")
    )

    // === backuplogchannels ===
    .addSubcommand(sub =>
      sub
        .setName("backuplogchannels")
        .setDescription("Backup log channel settings for all guilds")
    )

    // === autopunish group (auto-mute rules) ===
    .addSubcommandGroup(group =>
      group
        .setName("autopunish")
        .setDescription("Auto-mute rules")

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

    // === mute ===
    .addSubcommand(sub =>
      sub
        .setName("mute")
        .setDescription("Mute a member with optional duration")
        .addUserOption(o =>
          o.setName("user").setDescription("User to mute").setRequired(true)
        )
        .addStringOption(o =>
          o
            .setName("duration")
            .setDescription("Duration (10m, 1h, 1d)")
            .setRequired(false)
        )
        .addStringOption(o =>
          o
            .setName("reason")
            .setDescription("Reason for mute")
            .setRequired(true)
        )
    )

    // === unmute ===
    .addSubcommand(sub =>
      sub
        .setName("unmute")
        .setDescription("Unmute a member")
        .addUserOption(o =>
          o.setName("user").setDescription("User to unmute").setRequired(true)
        )
        .addStringOption(o =>
          o
            .setName("reason")
            .setDescription("Reason for unmute")
            .setRequired(false)
        )
    )

    // === setupmute ===
    .addSubcommand(sub =>
      sub
        .setName("setupmute")
        .setDescription("Configure which channels muted users can use")
    )

    .toJSON()
);

// === SECTION: /backup COMMAND (GLOBAL) ===
globalCommands.push(
  new SlashCommandBuilder()
    .setName("backup")
    .setDescription("Backup tools")
    .addSubcommand(sub =>
      sub
        .setName("muteconfig")
        .setDescription("Backup mute configuration for all servers")
    )
    .addSubcommand(sub =>
      sub
        .setName("master")
        .setDescription("Master backup of all JSON data (requires passcode)")
    )
    .toJSON()
);

// === SECTION: DEPLOY ===
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    console.log("Deploying slash commands...");

    const GUILDS = [process.env.GUILD_ID_1, process.env.GUILD_ID_2].filter(
      Boolean
    );

    // Deploy guild commands
    for (const guildId of GUILDS) {
      await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, guildId),
        { body: guildCommands }
      );
      console.log(`Guild commands deployed to guild ${guildId}`);
    }

    // Deploy global commands
    await rest.put(Routes.applicationCommands(CLIENT_ID), {
      body: globalCommands
    });
    console.log("Global commands deployed.");

    console.log("Slash commands deployed successfully.");
  } catch (err) {
    console.error(err);
  }
})();
