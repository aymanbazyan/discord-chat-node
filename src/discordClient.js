// src/discordClient.js
// Sets up and exports the Discord client instance.

const { Client, GatewayIntentBits } = require("discord.js");
const config = require("../config");
const logger = require("./logger");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // Ensure this is enabled in Discord Developer Portal
  ],
});

// Function to log in the client
const login = () => {
  if (!config.DISCORD_TOKEN) {
    logger.error(
      "DISCORD_TOKEN is not defined in the environment variables. Bot cannot start."
    );
    process.exit(1); // Exit if no token
  }
  client
    .login(config.DISCORD_TOKEN)
    .then(() => {
      // logger.info('Discord client logged in successfully.'); // Logged in readyHandler
    })
    .catch((error) => {
      logger.error("Failed to log in to Discord:", error);
      process.exit(1); // Exit on login failure
    });
};

module.exports = {
  client,
  login,
};
