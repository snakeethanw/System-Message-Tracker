const fs = require("fs");
const path = require("path");

const MUTES_FILE = "./mutes.json";

/**
 * Ensure mutes.json exists
 */
function ensureFile() {
  if (!fs.existsSync(MUTES_FILE)) {
    fs.writeFileSync(MUTES_FILE, JSON.stringify({}, null, 2));
  }
}

/**
 * Load mutes.json
 */
function loadMutes() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(MUTES_FILE, "utf8"));
  } catch (err) {
    console.error("Failed to load mutes.json:", err);
    return {};
  }
}

/**
 * Save mutes.json
 */
function saveMutes(data) {
  try {
    fs.writeFileSync(MUTES_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Failed to save mutes.json:", err);
  }
}

/**
 * Apply mute role
 */
async function applyMute(client, guildId, userId, roleId) {
  try {
    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId);

    await member.roles.add(roleId).catch(() => {});
  } catch (err) {
    console.error("Failed to apply mute:", err);
  }
}

/**
 * Remove mute role
 */
async function removeMute(client, guildId, userId, roleId) {
  try {
    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId);

    await member.roles.remove(roleId).catch(() => {});
  } catch (err) {
    console.error("Failed to remove mute:", err);
  }
}

/**
 * Auto-unmute scheduler
 */
function startScheduler(client) {
  setInterval(async () => {
    const mutes = loadMutes();
    const now = Date.now();

    for (const guildId of Object.keys(mutes)) {
      for (const userId of Object.keys(mutes[guildId])) {
        const mute = mutes[guildId][userId];

        if (mute.expires && now >= mute.expires) {
          // Remove mute
          await removeMute(client, guildId, userId, mute.roleId);

          // Delete entry
          delete mutes[guildId][userId];
          if (Object.keys(mutes[guildId]).length === 0) {
            delete mutes[guildId];
          }

          saveMutes(mutes);

          // Log auto-unmute to guild log only
          try {
            const { sendGuildLog, buildModLogEmbed } = require("./logging.js");
            const guild = await client.guilds.fetch(guildId);
            const moderator = { tag: "Auto-Unmute", id: "SYSTEM" };
            const target = await client.users.fetch(userId);

            const embed = buildModLogEmbed({
              action: "Auto-Unmute",
              moderator,
              target,
              guild,
              reason: "Mute duration expired"
            });

            await sendGuildLog(guild, embed);
          } catch (err) {
            console.error("Failed to log auto-unmute:", err);
          }
        }
      }
    }
  }, 30 * 1000); // every 30 seconds
}

/**
 * Add a mute entry
 */
function addMute(guildId, userId, roleId, expires, reason, moderatorId) {
  const mutes = loadMutes();

  if (!mutes[guildId]) mutes[guildId] = {};

  mutes[guildId][userId] = {
    userId,
    guildId,
    roleId,
    expires,
    reason,
    moderatorId
  };

  saveMutes(mutes);
}

/**
 * Remove a mute entry manually
 */
function clearMute(guildId, userId) {
  const mutes = loadMutes();

  if (mutes[guildId] && mutes[guildId][userId]) {
    delete mutes[guildId][userId];

    if (Object.keys(mutes[guildId]).length === 0) {
      delete mutes[guildId];
    }

    saveMutes(mutes);
  }
}

module.exports = {
  startScheduler,
  addMute,
  clearMute,
  applyMute,
  removeMute,
  loadMutes
};
