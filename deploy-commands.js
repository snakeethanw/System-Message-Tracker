require("dotenv").config();
const { REST, Routes } = require("discord.js");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID_1 = process.env.GUILD_ID_1;
const GUILD_ID_2 = process.env.GUILD_ID_2;

// Load the two real command definitions
const moderator = require("./moderator.js");
const backup = require("./backup.js");

const commands = [
  moderator.data.toJSON(),
  backup.data.toJSON()
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    console.log("Deploying slash commands...");

    if (GUILD_ID_1) {
      await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID_1),
        { body: commands }
      );
      console.log(`✓ Deployed to guild ${GUILD_ID_1}`);
    }

    if (GUILD_ID_2) {
      await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID_2),
        { body: commands }
      );
      console.log(`✓ Deployed to guild ${GUILD_ID_2}`);
    }

    console.log("✓ Slash commands deployed successfully.");
  } catch (err) {
    console.error("❌ Deployment failed:");
    console.error(err);
  }
})();
