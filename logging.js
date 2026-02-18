const {
  EmbedBuilder,
  PermissionFlagsBits
} = require("discord.js");
const fs = require("fs");

const MASTER_LOG_CHANNEL = process.env.MASTER_LOG_CHANNEL;
const OWNER_ID = process.env.USER_ID;

/**
 * Build a consistent moderator log embed
 */
function buildModLogEmbed({
  action,
  moderator,
  target = null,
  guild,
  reason = null,
  duration = null
}) {
  const embed = new EmbedBuilder()
    .setTitle(`Moderator Action: ${action}`)
    .setColor("#ffcc00")
    .addFields(
      {
        name: "Moderator",
        value: `${moderator.tag}\nID: ${moderator.id}`,
        inline: true
      },
      {
        name: "Guild",
        value: `${guild.name}\nID: ${guild.id}`,
        inline: true
      }
    )
    .setTimestamp();

  if (target) {
    embed.addFields({
      name: "Target User",
      value: `${target.tag}\nID: ${target.id}`,
      inline: false
    });
  }

  if (reason) {
    embed.addFields({
      name: "Reason",
      value: reason,
      inline: false
    });
  }

  if (duration) {
    embed.addFields({
      name: "Duration",
      value: duration,
      inline: false
    });
  }

  return embed;
}

/**
 * Send to the guild's log channel
 */
async function sendGuildLog(guild, embed) {
  try {
    const logConfig = JSON.parse(fs.readFileSync("./logChannels.json", "utf8"));
    const channelId = logConfig[guild.id];

    if (!channelId) return;

    const channel = guild.channels.cache.get(channelId);
    if (!channel) return;

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("Guild log error:", err);
  }
}

/**
 * Send to master log channel
 */
async function sendMasterLog(client, embed, pingOwner = false) {
  try {
    const channel = await client.channels.fetch(MASTER_LOG_CHANNEL);
    if (!channel) return;

    if (pingOwner) {
      await channel.send({
        content: `<@${OWNER_ID}>`,
        embeds: [embed]
      });
    } else {
      await channel.send({ embeds: [embed] });
    }
  } catch (err) {
    console.error("Master log error:", err);
  }
}

/**
 * Log unauthorized attempts
 */
async function logUnauthorizedOwnerAttempt(client, interaction, attemptedCommand) {
  const user = interaction.user;
  const guild = interaction.guild;

  const embed = new EmbedBuilder()
    .setTitle("Unauthorized Owner Command Attempt")
    .setColor("#ff0000")
    .addFields(
      {
        name: "User",
        value: `${user.tag}\nID: ${user.id}`,
        inline: true
      },
      {
        name: "Guild",
        value: `${guild.name}\nID: ${guild.id}`,
        inline: true
      },
      {
        name: "Command Attempted",
        value: attemptedCommand,
        inline: false
      }
    )
    .setTimestamp();

  // DM owner
  try {
    const owner = await client.users.fetch(OWNER_ID);
    await owner.send({
      content: `⚠ Unauthorized attempt detected.`,
      embeds: [embed]
    });
  } catch (err) {
    console.error("Failed to DM owner:", err);
  }

  // Log to master log (ping owner)
  await sendMasterLog(client, embed, true);
}

/**
 * Log bot startup
 */
async function logBotStartup(client) {
  const embed = new EmbedBuilder()
    .setTitle("Bot Started")
    .setColor("#00ff99")
    .setDescription("The bot has successfully started.")
    .setTimestamp();

  await sendMasterLog(client, embed, false);
}

module.exports = {
  buildModLogEmbed,
  sendGuildLog,
  sendMasterLog,
  logUnauthorizedOwnerAttempt,
  logBotStartup
};
