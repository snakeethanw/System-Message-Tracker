const {
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder
} = require("discord.js");

const {
  sendMasterLog,
  sendGuildLog,
  logUnauthorizedOwnerAttempt
} = require("./logging.js");

const OWNER_ID = process.env.USER_ID;
const FORCE_LEAVE_PASSWORD = process.env.FORCE_LEAVE_PASSWORD;
const PROTECTED_GUILD = process.env.GUILD_ID_1;

module.exports = {
  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    if (sub !== "leaveguild") return;

    if (interaction.user.id !== OWNER_ID) {
      await interaction.reply({ content: "Not authorized.", ephemeral: true });
      await logUnauthorizedOwnerAttempt(client, interaction, "/moderator leaveguild");
      return;
    }

    const guildOptions = client.guilds.cache
      .filter(g => g.id !== PROTECTED_GUILD)
      .map(g => ({
        label: g.name,
        value: g.id
      }));

    if (guildOptions.length === 0) {
      await interaction.reply({
        content: "No guilds available to leave.",
        ephemeral: true
      });
      return;
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId("leaveguild_select")
      .setPlaceholder("Select a guild to leave")
      .addOptions(guildOptions);

    const row = new ActionRowBuilder().addComponents(menu);

    await interaction.reply({
      content: "Select a guild for the bot to leave:",
      components: [row],
      ephemeral: true
    });
  },

  async handleComponent(interaction, client) {
    // Step 1: Guild selection
    if (interaction.isStringSelectMenu() && interaction.customId === "leaveguild_select") {
      const guildId = interaction.values[0];
      const guild = client.guilds.cache.get(guildId);

      if (!guild) {
        await interaction.reply({ content: "Guild not found.", ephemeral: true });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId(`leaveguild_password_${guildId}`)
        .setTitle(`Confirm Leaving ${guild.name}`);

      const input = new TextInputBuilder()
        .setCustomId("password")
        .setLabel("Enter FORCE_LEAVE_PASSWORD")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(input));

      await interaction.showModal(modal);
      return;
    }

    // Step 2: Password modal
    if (interaction.isModalSubmit() && interaction.customId.startsWith("leaveguild_password_")) {
      const guildId = interaction.customId.replace("leaveguild_password_", "");
      const password = interaction.fields.getTextInputValue("password");

      if (password !== FORCE_LEAVE_PASSWORD) {
        await interaction.reply({ content: "Incorrect password.", ephemeral: true });
        return;
      }

      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        await interaction.reply({ content: "Guild not found.", ephemeral: true });
        return;
      }

      await client.safeDM(
        OWNER_ID,
        `Bot is leaving **${guild.name}** (${guild.id}).`
      );

      const embed = new EmbedBuilder()
        .setTitle("Bot Leaving Guild")
        .setColor("#ff4444")
        .addFields(
          { name: "Guild", value: `${guild.name}\nID: ${guild.id}` },
          { name: "Initiated By", value: `<@${OWNER_ID}>` }
        )
        .setTimestamp();

      await sendMasterLog(client, embed, true);

      const guildEmbed = new EmbedBuilder()
        .setTitle("Bot Leaving This Guild")
        .setColor("#ff4444")
        .setDescription("This server has been removed by the bot owner.")
        .setTimestamp();

      await sendGuildLog(guild, guildEmbed);

      await interaction.reply({
        content: `Leaving **${guild.name}**...`,
        ephemeral: true
      });

      await guild.leave().catch(() => {});
    }
  }
};
