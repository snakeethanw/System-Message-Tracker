const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("moderator")
    .setDescription("Moderator commands")

    // --- ACTIONS ---
    .addSubcommand(sub =>
      sub
        .setName("warn")
        .setDescription("Warn a user")
        .addUserOption(o =>
          o.setName("user").setDescription("User to warn").setRequired(true)
        )
        .addStringOption(o =>
          o.setName("reason").setDescription("Reason for the warning")
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("warnings")
        .setDescription("View warnings for a user")
        .addUserOption(o =>
          o.setName("user").setDescription("User to check").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("clearwarns")
        .setDescription("Clear warnings for a user")
        .addUserOption(o =>
          o.setName("user").setDescription("User to clear").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("mute")
        .setDescription("Mute a user")
        .addUserOption(o =>
          o.setName("user").setDescription("User to mute").setRequired(true)
        )
        .addIntegerOption(o =>
          o.setName("duration").setDescription("Duration in minutes").setRequired(true)
        )
        .addStringOption(o =>
          o.setName("reason").setDescription("Reason for mute")
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("unmute")
        .setDescription("Unmute a user")
        .addUserOption(o =>
          o.setName("user").setDescription("User to unmute").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("rescan")
        .setDescription("Owner-only: rescan message history")
    )

    // --- SETUP ---
    .addSubcommand(sub =>
      sub
        .setName("setlog")
        .setDescription("Set the log channel for this server")
        .addChannelOption(o =>
          o.setName("channel").setDescription("Log channel").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("setupmute")
        .setDescription("Set the mute role for this server")
        .addRoleOption(o =>
          o.setName("role").setDescription("Mute role").setRequired(true)
        )
    )

    // --- AUTOPUNISH GROUP ---
    .addSubcommandGroup(group =>
      group
        .setName("autopunish")
        .setDescription("Configure autopunish rules")
        .addSubcommand(sub =>
          sub
            .setName("add")
            .setDescription("Add an autopunish rule")
            .addIntegerOption(o =>
              o.setName("warnings").setDescription("Warnings threshold").setRequired(true)
            )
            .addStringOption(o =>
              o.setName("action").setDescription("Action to take").setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName("remove")
            .setDescription("Remove an autopunish rule")
            .addIntegerOption(o =>
              o.setName("warnings").setDescription("Warnings threshold").setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName("list")
            .setDescription("List autopunish rules")
        )
        .addSubcommand(sub =>
          sub
            .setName("clear")
            .setDescription("Clear all autopunish rules")
        )
    )

    // --- LEAVEGUILD ---
    .addSubcommand(sub =>
      sub
        .setName("leaveguild")
        .setDescription("Owner-only: remove bot from a guild")
    )
};
