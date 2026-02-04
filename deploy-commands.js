// === SECTION: IMPORTS ===
const { REST, Routes, SlashCommandBuilder } = require("discord.js");
require("dotenv").config();

// === SECTION: COMMAND ARRAY ===
const commands = [];

// === SECTION: /messages COMMAND ===
commands.push(
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

// === SECTION: /moderator COMMAND ===
commands.push(
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

    // === timeout ===
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

    // === autopunish group ===
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

      // === MUTE ===
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
          .setRequired(false)
      )
  )

  // === UNMUTE ===
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

  // === SETUP MUTE ===
  .addSubcommand(sub =>
    sub
      .setName("setupmute")
      .setDescription("Configure which channels muted users can use")
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

    const GUILDS = [
      process.env.GUILD_ID_1,
      process.env.GUILD_ID_2
    ];

    for (const guildId of GUILDS) {
      await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, guildId),
        { body: commands }
      );
      console.log(`Commands deployed to guild ${guildId}`);
    }

    console.log("Slash commands deployed successfully.");
  } catch (err) {
    console.error(err);
  }
})();
//



