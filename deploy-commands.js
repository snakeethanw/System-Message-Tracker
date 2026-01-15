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

    .addSubcommand(sub =>
  sub
    .setName("setlog")
    .setDescription("Set the moderation log channel")
    .addChannelOption(o =>
      o.setName("channel").setDescription("Log channel").setRequired(true)
    )
)

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
  "1434679299549564960",
  "1323106269745381396"
];

for (const guildId of GUILDS) {
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, guildId),
    { body: commands }
  );
  console.log(`Commands deployed to guild ${guildId}`);
}


    console.log("Slash commands deployed globally.");
  } catch (err) {
    console.error(err);
  }
})();
//repurpose





