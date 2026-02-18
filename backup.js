const fs = require("fs");
const path = require("path");
const {
  SlashCommandBuilder,
  AttachmentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require("discord.js");

const {
  sendMasterLog,
  buildModLogEmbed,
  logUnauthorizedOwnerAttempt
} = require("./logging.js");

const OWNER_ID = process.env.USER_ID;
const MASTER_BACKUP_PASSWORD = process.env.MASTER_BACKUP_PASSWORD;
const FORCE_LEAVE_PASSWORD = process.env.FORCE_LEAVE_PASSWORD;
const RESCAN_PASSWORD = process.env.RESCAN_PASSWORD;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("backup")
    .setDescription("Backup system files (owner only)")
    .addSubcommand(sub =>
      sub
        .setName("messages")
        .setDescription("Backup messageCounts.json")
    )
    .addSubcommand(sub =>
      sub
        .setName("warn")
        .setDescription("Backup warnCounts.json")
    )
    .addSubcommand(sub =>
      sub
        .setName("logchannels")
        .setDescription("Backup logChannels.json")
    )
    .addSubcommand(sub =>
      sub
        .setName("muteconfig")
        .setDescription("Backup muteConfig.json")
    )
    .addSubcommand(sub =>
      sub
        .setName("master")
        .setDescription("Backup ALL JSON files into a zip")
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    // OWNER CHECK
    if (interaction.user.id !== OWNER_ID) {
      await interaction.reply({ content: "Not authorized.", ephemeral: true });
      await logUnauthorizedOwnerAttempt(client, interaction, `/backup ${sub}`);
      return;
    }

    // PASSWORD MODAL
    const modal = new ModalBuilder()
      .setCustomId(`backup_password_${sub}`)
      .setTitle("Backup Password Required");

    const input = new TextInputBuilder()
      .setCustomId("password")
      .setLabel("Enter MASTER_BACKUP_PASSWORD")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));

    await interaction.showModal(modal);
  },

  async handleComponent(interaction, client) {
    if (!interaction.isModalSubmit()) return;

    if (!interaction.customId.startsWith("backup_password_")) return;

    const sub = interaction.customId.replace("backup_password_", "");
    const password = interaction.fields.getTextInputValue("password");

    // PASSWORD CHECK
    if (password !== MASTER_BACKUP_PASSWORD) {
      await interaction.reply({ content: "Incorrect password.", ephemeral: true });
      return;
    }

    // Perform backup
    if (sub === "messages") {
      await backupFile(interaction, client, "messageCounts.json");
      return;
    }

    if (sub === "warn") {
      await backupFile(interaction, client, "warnCounts.json");
      return;
    }

    if (sub === "logchannels") {
      await backupFile(interaction, client, "logChannels.json");
      return;
    }

    if (sub === "muteconfig") {
      await backupFile(interaction, client, "muteConfig.json");
      return;
    }

    if (sub === "master") {
      await backupMasterZip(interaction, client);
      return;
    }
  }
};

/**
 * Backup a single JSON file EXACTLY as-is
 */
async function backupFile(interaction, client, filename) {
  const filePath = path.join("./", filename);

  if (!fs.existsSync(filePath)) {
    await interaction.reply({ content: `${filename} does not exist.`, ephemeral: true });
    return;
  }

  const fileData = fs.readFileSync(filePath);

  const attachment = new AttachmentBuilder(fileData, {
    name: `${filename.replace(".json", "")}-${Date.now()}.json`
  });

  // DM the file
  await interaction.user.send({
    content: `Here is your backup of **${filename}**.`,
    files: [attachment]
  });

  await interaction.reply({ content: `Backup sent to your DMs.`, ephemeral: true });

  // Log to master log
  const embed = buildModLogEmbed({
    action: `Backup: ${filename}`,
    moderator: interaction.user,
    guild: interaction.guild
  });

  await sendMasterLog(client, embed, false);
}

/**
 * Backup ALL JSON files into a zip
 */
async function backupMasterZip(interaction, client) {
  const AdmZip = require("adm-zip");
  const zip = new AdmZip();

  const files = fs.readdirSync("./").filter(f => f.endsWith(".json"));

  for (const file of files) {
    const data = fs.readFileSync(file);
    zip.addFile(file, data);
  }

  const buffer = zip.toBuffer();

  const attachment = new AttachmentBuilder(buffer, {
    name: `master-backup-${Date.now()}.zip`
  });

  await interaction.user.send({
    content: "Here is your **MASTER BACKUP** containing ALL JSON files.",
    files: [attachment]
  });

  await interaction.reply({ content: "Master backup sent to your DMs.", ephemeral: true });

  // Log to master log
  const embed = buildModLogEmbed({
    action: "Backup: MASTER ZIP",
    moderator: interaction.user,
    guild: interaction.guild
  });

  await sendMasterLog(client, embed, false);
}
