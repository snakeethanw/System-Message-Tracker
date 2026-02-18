require("dotenv").config();
const fs = require("fs");
const path = require("path");
const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  Events
} = require("discord.js");

const {
  sendGuildLog,
  sendMasterLog,
  buildModLogEmbed,
  logUnauthorizedOwnerAttempt
} = require("./logging.js");

const muteSystem = require("./muteSystem.js");
const pingPrefix = require("./ping.js");

// Create client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

// Slash commands collection
client.commands = new Collection();

// Load ONLY real slash command definitions
const commandFiles = [
  "moderator.js",
  "backup.js"
];

for (const file of commandFiles) {
  const filePath = path.join(__dirname, file);
  const commandModule = require(filePath);
  client.commands.set(commandModule.data.name, commandModule);
}

// Logic handler modules (no SlashCommandBuilder)
const logicModules = [
  "moderator_actions.js",
  "moderator_setup.js",
  "moderator_leaveguild.js"
];

// Ready event
client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  muteSystem.startScheduler(client);
});

// Interaction handler
client.on(Events.InteractionCreate, async interaction => {
  // Slash commands
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute?.(interaction, client);
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: "There was an error while executing this command.",
        ephemeral: true
      }).catch(() => {});
    }
    return;
  }

  // Modal + select menu handling delegated to logic modules
  for (const file of logicModules) {
    const mod = require(`./${file}`);
    if (typeof mod.handleComponent === "function") {
      try {
        await mod.handleComponent(interaction, client);
      } catch (err) {
        console.error("Component handler error:", err);
      }
    }
  }
});

// Prefix commands
client.on(Events.MessageCreate, async message => {
  if (!message.guild || message.author.bot) return;

  try {
    await pingPrefix.handle(message, client);
  } catch (err) {
    console.error("Prefix command error:", err);
  }
});

// Owner-only guard
client.isOwner = userId => userId === process.env.USER_ID;

// DM helper
client.safeDM = async function (userId, content, options = {}) {
  try {
    const user = await client.users.fetch(userId);
    await user.send({ content, ...options });
  } catch (err) {
    console.error("Failed to DM owner:", err);
  }
};

client.login(process.env.TOKEN);
