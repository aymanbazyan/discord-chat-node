// src/commands/clearHistoryCommand.js
const logger = require("../logger");
const historyManager = require("../utils/historyManager");

module.exports = {
  name: "clearhistory",
  description: "Clears the conversation history for the current channel.",
  /**
   * Executes the clearhistory command.
   * @param {import('discord.js').Message} message The Discord message object.
   */
  async execute(message) {
    logger.debug(
      `Executing 'clearhistory' command for ${message.author.tag} in channel ${message.channel.id}`
    );
    const channelId = message.channel.id;

    if (historyManager.clearChannelHistory(channelId)) {
      await message.channel.send(
        "Conversation history for this channel has been cleared."
      );
    } else {
      await message.channel.send(
        "There was no conversation history to clear for this channel."
      );
    }
  },
};
