// src/eventHandlers/readyHandler.js
// Handles the 'ClientReady' event from Discord.js.

const { Events } = require("discord.js");
const logger = require("../logger");
const historyManager = require("../utils/historyManager");
const aiServiceProvider = require("../aiServiceProvider");

module.exports = {
  name: Events.ClientReady,
  once: true, // This event should only run once
  /**
   * Executes when the client is ready.
   * @param {import('discord.js').Client} client The Discord client instance.
   */
  execute(client) {
    logger.info(`Logged in as ${client.user.tag}! Bot is ready.`);

    // Initialize AI Service Provider
    if (!aiServiceProvider.initialize()) {
      logger.error(
        "AI Service Provider failed to initialize. Bot may have limited functionality."
      );
    } else {
      logger.info(
        `AI Service Provider initialized with ${aiServiceProvider.getCurrentServiceType()}.`
      );
    }

    // Load history from file
    historyManager.loadHistory();

    // Start periodic saving of history
    historyManager.startPeriodicSave();

    // You can add other setup tasks here, like setting bot activity
    client.user.setActivity("for messages", { type: "WATCHING" }); // Example activity
  },
};
