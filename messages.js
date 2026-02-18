const fs = require("fs");
const path = require("path");

const MESSAGE_FILE = "./messageCounts.json";

/**
 * Ensure messageCounts.json exists
 */
function ensureFile() {
  if (!fs.existsSync(MESSAGE_FILE)) {
    fs.writeFileSync(
      MESSAGE_FILE,
      JSON.stringify(
        {
          live: { count: 0, scanned: 0 },
          channels: {}
        },
        null,
        2
      )
    );
  }
}

/**
 * Load messageCounts.json
 */
function loadCounts() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(MESSAGE_FILE, "utf8"));
  } catch (err) {
    console.error("Failed to load messageCounts.json:", err);
    return { live: { count: 0, scanned: 0 }, channels: {} };
  }
}

/**
 * Save messageCounts.json
 */
function saveCounts(data) {
  try {
    fs.writeFileSync(MESSAGE_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Failed to save messageCounts.json:", err);
  }
}

/**
 * Scan a single channel incrementally
 */
async function scanChannel(channel, counts) {
  const channelId = channel.id;

  if (!counts.channels[channelId]) {
    counts.channels[channelId] = {
      done: false,
      lastMessageId: null
    };
  }

  const state = counts.channels[channelId];

  // If channel is already fully scanned, skip
  if (state.done) return;

  let lastId = state.lastMessageId;
  let finished = false;

  while (!finished) {
    const messages = await channel.messages.fetch({
      limit: 100,
      before: lastId || undefined
    }).catch(() => null);

    if (!messages || messages.size === 0) {
      // No more messages
      state.done = true;
      break;
    }

    for (const msg of messages.values()) {
      lastId = msg.id;

      // Count only human messages
      if (!msg.author.bot && !msg.webhookId) {
        counts.live.count++;
        counts.live.scanned++;
      }
    }

    // If fewer than 100 messages returned, we've reached the end
    if (messages.size < 100) {
      state.done = true;
      finished = true;
    }

    // Update lastMessageId
    state.lastMessageId = lastId;

    // Save progress after each batch
    saveCounts(counts);
  }
}

/**
 * Full rescan across all channels
 */
async function rescanGuild(guild) {
  const counts = loadCounts();

  const channels = guild.channels.cache.filter(
    c => c.isTextBased() && c.viewable
  );

  for (const channel of channels.values()) {
    await scanChannel(channel, counts);
  }

  saveCounts(counts);
  return counts;
}

module.exports = {
  ensureFile,
  loadCounts,
  saveCounts,
  scanChannel,
  rescanGuild
};
