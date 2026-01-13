const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

// -------------------------
// DEFINE SLASH COMMANDS
// -------------------------
const commands = [

  // -------------------------
  // /messages
  // -------------------------
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

  // -------------------------
  // /moderator
  // -------------------------
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

    // /moderator backupwarns (NEW)
    .addSubcommand(sub =>
      sub
        .setName('backupwarns')
        .setDescription('Get a full JSON backup of all warnings and autopunish rules')
    )

    // -------------------------
    // /moderator autopunish
    // -------------------------
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
// DEPLOY COMMANDS
// -------------------------
const TOKEN = process.env.token;
const CLIENT_ID = '1458665352853586057';

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('🚀 Deploying slash commands...');

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );

    console.log('✅ Slash commands deployed globally.');
  } catch (error) {
    console.error(error);
  }
})();
