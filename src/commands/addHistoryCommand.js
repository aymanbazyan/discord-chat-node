// src/commands/addHistoryCommand.js
const config = require("../../config");
const logger = require("../logger");
const historyManager = require("../utils/historyManager");

module.exports = {
  name: "addhistory",
  description:
    "Adds recent messages from the channel to the conversation history.",
  /**
   * Executes the addhistory command.
   * @param {import('discord.js').Message} message The Discord message object.
   * @param {string[]} args Command arguments.
   */
  async execute(message, args, { client }) {
    logger.debug(
      `Executing 'addhistory' command for ${
        message.author.tag
      } with args: ${args.join(" ")}`
    );
    const channelId = message.channel.id;

    if (config.MAX_HISTORY_SIZE === 0) {
      await message.channel.send(
        "History is disabled (`MAX_HISTORY_SIZE=0`), so I can't add past messages."
      );
      return;
    }

    const currentHistory = historyManager.getChannelHistory(channelId);
    if (config.MAX_HISTORY_SIZE > 0 && currentHistory.length > 0) {
      await message.channel.send(
        `Warning: Adding history to a channel with existing, limited history may result in older messages being pruned to fit the \`MAX_HISTORY_SIZE\` limit (${config.MAX_HISTORY_SIZE}).`
      );
    } else if (config.MAX_HISTORY_SIZE === -1 && currentHistory.length > 0) {
      await message.channel.send(
        `History is unlimited. Adding more from Discord might duplicate entries if those messages are already in history.`
      );
    }

    const numMessagesStr = args[0];
    const numMessages = parseInt(numMessagesStr, 10);

    if (isNaN(numMessages) || numMessages <= 0 || numMessages > 200) {
      await message.channel.send(
        `Please specify a valid number of recent messages to add (1-200), e.g., \`${config.COMMAND_PREFIX} addhistory 20\`.`
      );
      return;
    }

    try {
      await message.channel.sendTyping();
      const fetchedMessages = await message.channel.messages.fetch({
        limit: numMessages + 1, // +1 to exclude the command message itself if it's among the most recent
        before: message.id,
      });

      const recentUserMessages = Array.from(fetchedMessages.values())
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp) // Oldest first
        .filter(
          (msg) =>
            msg.id !== message.id &&
            msg.author.id !== client.user.id &&
            !msg.author.bot
        ) // Exclude command, bot's own, other bots
        .map((msg) => {
          let content = msg.content || "[No text content]";
          if (config.MULTIPLE_CHATTERS) {
            const authorName = msg.author.globalName || msg.author.username;
            content = `${authorName}: ${content}`;
          }
          // Note: Fetched messages won't have time prefixes or image descriptions like live ones.
          // This is a simplification. For full fidelity, one might need to re-process attachments.
          return { role: "user", content: content };
        });

      if (recentUserMessages.length === 0) {
        await message.channel.send(
          "No recent user messages found to add (excluding my own and the command)."
        );
        return;
      }

      let existingHistory = historyManager.getChannelHistory(channelId);

      // Simple check to avoid adding exact duplicate content
      const newUniqueMessages = recentUserMessages.filter(
        (newMessage) =>
          !existingHistory.some(
            (existingMessage) => existingMessage.content === newMessage.content
          )
      );

      if (newUniqueMessages.length === 0) {
        await message.channel.send(
          "No new unique messages found to add to the history."
        );
        return;
      }

      let combinedHistory = [...newUniqueMessages, ...existingHistory]; // Prepend new messages

      if (config.MAX_HISTORY_SIZE > 0) {
        combinedHistory = combinedHistory.slice(0, config.MAX_HISTORY_SIZE); // Keep most recent, including newly added
      } else if (config.MAX_HISTORY_SIZE === -1) {
        // Unlimited, keep all
      }
      // MAX_HISTORY_SIZE === 0 is handled at the start.

      historyManager.updateChannelHistory(channelId, combinedHistory);
      historyManager.saveHistory(); // Save immediately

      await message.channel.send(
        `Added ${newUniqueMessages.length} recent unique user messages to the history. The history now contains ${combinedHistory.length} messages.`
      );
    } catch (error) {
      logger.error("Error fetching history for 'addhistory' command:", error);
      await message.channel.send(
        "Sorry, I couldn't fetch the message history. Something went wrong."
      );
    }
  },
};
