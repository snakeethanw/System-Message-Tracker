const fs = require("fs");
const { PermissionFlagsBits } = require("discord.js");

const {
  sendGuildLog,
  sendMasterLog,
  buildModLogEmbed
} = require("./logging.js");

module.exports = {
  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand(false);
    const group = interaction.options.getSubcommandGroup(false);

    // Permissions
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: "You lack permission.", ephemeral: true });
      return;
    }

    // === SETLOG ===
    if (sub === "setlog") {
      const channel = interaction.options.getChannel("channel");

      const file = "./logChannels.json";
      if (!fs.existsSync(file)) fs.writeFileSync(file, "{}");

      const logs = JSON.parse(fs.readFileSync(file, "utf8"));
      logs[interaction.guild.id] = channel.id;

      fs.writeFileSync(file, JSON.stringify(logs, null, 2));

      await interaction.reply({
        content: `Log channel set to ${channel}.`,
        ephemeral: true
      });

      const embed = buildModLogEmbed({
        action: "Set Log Channel",
        moderator: interaction.user,
        guild: interaction.guild,
        reason: `Channel: ${channel.id}`
      });

      await sendGuildLog(interaction.guild, embed);
      await sendMasterLog(client, embed, false);
      return;
    }

    // === SETUPMUTE ===
    if (sub === "setupmute") {
      const role = interaction.options.getRole("role");

      const file = "./muteConfig.json";
      if (!fs.existsSync(file)) fs.writeFileSync(file, "{}");

      const config = JSON.parse(fs.readFileSync(file, "utf8"));
      config[interaction.guild.id] = role.id;

      fs.writeFileSync(file, JSON.stringify(config, null, 2));

      await interaction.reply({
        content: `Mute role set to ${role.name}.`,
        ephemeral: true
      });

      const embed = buildModLogEmbed({
        action: "Setup Mute Role",
        moderator: interaction.user,
        guild: interaction.guild,
        reason: `Role: ${role.id}`
      });

      await sendGuildLog(interaction.guild, embed);
      await sendMasterLog(client, embed, false);
      return;
    }

    // === AUTOPUNISH ===
    if (group === "autopunish") {
      const file = "./autopunish.json";
      if (!fs.existsSync(file)) fs.writeFileSync(file, "{}");

      const rules = JSON.parse(fs.readFileSync(file, "utf8"));
      if (!rules[interaction.guild.id]) rules[interaction.guild.id] = {};

      // ADD
      if (sub === "add") {
        const warnings = interaction.options.getInteger("warnings");
        const action = interaction.options.getString("action");

        rules[interaction.guild.id][warnings] = action;
        fs.writeFileSync(file, JSON.stringify(rules, null, 2));

        await interaction.reply({
          content: `Autopunish rule added: ${warnings} warnings → ${action}`,
          ephemeral: true
        });

        const embed = buildModLogEmbed({
          action: "Autopunish Add",
          moderator: interaction.user,
          guild: interaction.guild,
          reason: `${warnings} warnings → ${action}`
        });

        await sendGuildLog(interaction.guild, embed);
        await sendMasterLog(client, embed, false);
        return;
      }

      // REMOVE
      if (sub === "remove") {
        const warnings = interaction.options.getInteger("warnings");

        delete rules[interaction.guild.id][warnings];
        fs.writeFileSync(file, JSON.stringify(rules, null, 2));

        await interaction.reply({
          content: `Autopunish rule removed for ${warnings} warnings.`,
          ephemeral: true
        });

        const embed = buildModLogEmbed({
          action: "Autopunish Remove",
          moderator: interaction.user,
          guild: interaction.guild,
          reason: `Removed rule for ${warnings} warnings`
        });

        await sendGuildLog(interaction.guild, embed);
        await sendMasterLog(client, embed, false);
        return;
      }

      // LIST
      if (sub === "list") {
        const list = rules[interaction.guild.id];
        const formatted = Object.keys(list)
          .map(w => `${w} warnings → ${list[w]}`)
          .join("\n") || "No rules set.";

        await interaction.reply({
          content: `Autopunish rules:\n${formatted}`,
          ephemeral: true
        });
        return;
      }

      // CLEAR
      if (sub === "clear") {
        rules[interaction.guild.id] = {};
        fs.writeFileSync(file, JSON.stringify(rules, null, 2));

        await interaction.reply({
          content: `All autopunish rules cleared.`,
          ephemeral: true
        });

        const embed = buildModLogEmbed({
          action: "Autopunish Clear",
          moderator: interaction.user,
          guild: interaction.guild
        });

        await sendGuildLog(interaction.guild, embed);
        await sendMasterLog(client, embed, false);
        return;
      }
    }
  }
};
