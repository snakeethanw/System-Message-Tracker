const fs = require("fs");
const {
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require("discord.js");

const {
  sendGuildLog,
  sendMasterLog,
  buildModLogEmbed,
  logUnauthorizedOwnerAttempt
} = require("./logging.js");

const muteSystem = require("./muteSystem.js");

const OWNER_ID = process.env.USER_ID;
const RESCAN_PASSWORD = process.env.RESCAN_PASSWORD;

module.exports = {
  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    // === RESCAN (owner-only) ===
    if (sub === "rescan") {
      if (interaction.user.id !== OWNER_ID) {
        await interaction.reply({ content: "Not authorized.", ephemeral: true });
        await logUnauthorizedOwnerAttempt(client, interaction, "/moderator rescan");
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId("rescan_password_modal")
        .setTitle("Rescan Password Required");

      const input = new TextInputBuilder()
        .setCustomId("password")
        .setLabel("Enter RESCAN_PASSWORD")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(input));

      await interaction.showModal(modal);
      return;
    }

    // === All other actions require ManageMessages ===
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      await interaction.reply({ content: "You lack permission.", ephemeral: true });
      return;
    }

    // Load warnCounts.json
    const warnFile = "./warnCounts.json";
    if (!fs.existsSync(warnFile)) fs.writeFileSync(warnFile, "{}");
    const warns = JSON.parse(fs.readFileSync(warnFile, "utf8"));

    // === WARN ===
    if (sub === "warn") {
      const user = interaction.options.getUser("user");
      const reason = interaction.options.getString("reason") || "No reason provided";

      if (!warns[interaction.guild.id]) warns[interaction.guild.id] = {};
      if (!warns[interaction.guild.id][user.id]) warns[interaction.guild.id][user.id] = 0;

      warns[interaction.guild.id][user.id]++;
      fs.writeFileSync(warnFile, JSON.stringify(warns, null, 2));

      await interaction.reply({ content: `${user.tag} has been warned.`, ephemeral: true });

      const embed = buildModLogEmbed({
        action: "Warn",
        moderator: interaction.user,
        target: user,
        guild: interaction.guild,
        reason
      });

      await sendGuildLog(interaction.guild, embed);
      await sendMasterLog(client, embed, false);
      return;
    }

    // === WARNINGS ===
    if (sub === "warnings") {
      const user = interaction.options.getUser("user");
      const count = warns[interaction.guild.id]?.[user.id] || 0;

      await interaction.reply({
        content: `${user.tag} has **${count}** warnings.`,
        ephemeral: true
      });
      return;
    }

    // === CLEARWARNS ===
    if (sub === "clearwarns") {
      const user = interaction.options.getUser("user");

      if (warns[interaction.guild.id]?.[user.id]) {
        delete warns[interaction.guild.id][user.id];
        fs.writeFileSync(warnFile, JSON.stringify(warns, null, 2));
      }

      await interaction.reply({ content: `Warnings cleared for ${user.tag}.`, ephemeral: true });

      const embed = buildModLogEmbed({
        action: "Clear Warnings",
        moderator: interaction.user,
        target: user,
        guild: interaction.guild
      });

      await sendGuildLog(interaction.guild, embed);
      await sendMasterLog(client, embed, false);
      return;
    }

    // === MUTE ===
    if (sub === "mute") {
      const user = interaction.options.getUser("user");
      const duration = interaction.options.getInteger("duration");
      const reason = interaction.options.getString("reason") || "No reason provided";

      const muteConfig = JSON.parse(fs.readFileSync("./muteConfig.json", "utf8"));
      const roleId = muteConfig[interaction.guild.id];

      if (!roleId) {
        await interaction.reply({ content: "Mute role not configured.", ephemeral: true });
        return;
      }

      const expires = Date.now() + duration * 60000;

      muteSystem.addMute(interaction.guild.id, user.id, roleId, expires, reason, interaction.user.id);
      await muteSystem.applyMute(client, interaction.guild.id, user.id, roleId);

      await interaction.reply({ content: `${user.tag} muted for ${duration} minutes.`, ephemeral: true });

      const embed = buildModLogEmbed({
        action: "Mute",
        moderator: interaction.user,
        target: user,
        guild: interaction.guild,
        reason,
        duration: `${duration} minutes`
      });

      await sendGuildLog(interaction.guild, embed);
      await sendMasterLog(client, embed, false);
      return;
    }

    // === UNMUTE ===
    if (sub === "unmute") {
      const user = interaction.options.getUser("user");

      const muteConfig = JSON.parse(fs.readFileSync("./muteConfig.json", "utf8"));
      const roleId = muteConfig[interaction.guild.id];

      muteSystem.clearMute(interaction.guild.id, user.id);
      await muteSystem.removeMute(client, interaction.guild.id, user.id, roleId);

      await interaction.reply({ content: `${user.tag} has been unmuted.`, ephemeral: true });

      const embed = buildModLogEmbed({
        action: "Unmute",
        moderator: interaction.user,
        target: user,
        guild: interaction.guild
      });

      await sendGuildLog(interaction.guild, embed);
      await sendMasterLog(client, embed, false);
      return;
    }
  },

  async handleComponent(interaction, client) {
    if (!interaction.isModalSubmit()) return;
    if (interaction.customId !== "rescan_password_modal") return;

    const password = interaction.fields.getTextInputValue("password");

    if (password !== RESCAN_PASSWORD) {
      await interaction.reply({ content: "Incorrect password.", ephemeral: true });
      return;
    }

    await interaction.reply({ content: "Rescan started. Check your DMs.", ephemeral: true });

    await client.safeDM(
      OWNER_ID,
      `Rescan started in **${interaction.guild.name}** (${interaction.guild.id}).`
    );

    const embed = buildModLogEmbed({
      action: "Rescan Started",
      moderator: interaction.user,
      guild: interaction.guild
    });

    await sendMasterLog(client, embed, false);
  }
};
