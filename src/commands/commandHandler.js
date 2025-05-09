// src/commands/commandHandler.js
// Parses messages for commands and executes them.

const config = require("../../config");
const logger = require("../logger");
const infoCommand = require("./infoCommand");
const addHistoryCommand = require("./addHistoryCommand");
const clearHistoryCommand = require("./clearHistoryCommand");
const { client } = require("../discordClient"); // For passing client to commands if needed

// A map of command names to their handler functions/modules
const commands = {
  info: infoCommand,
  addhistory: addHistoryCommand,
  clearhistory: clearHistoryCommand,
  // Add more commands here
  // 'help': helpCommand,
};

/**
 * Handles incoming messages to check for and execute commands.
 * @param {import('discord.js').Message} message The Discord message object.
 * @returns {Promise<boolean>} True if a command was processed, false otherwise.
 */
const handleCommand = async (message) => {
  if (!message.content.startsWith(config.COMMAND_PREFIX)) {
    return false; // Not a command
  }

  const args = message.content
    .slice(config.COMMAND_PREFIX.length)
    .trim()
    .split(/\s+/);
  const commandName = args.shift().toLowerCase();

  const command = commands[commandName];

  if (command) {
    logger.log(
      `Command received: ${commandName} with args: ${args.join(", ")} by ${
        message.author.tag
      }`
    );
    try {
      // Pass the message, args, and potentially other useful things like the client or config
      await command.execute(message, args, { client, config, logger });
      return true; // Command was processed
    } catch (error) {
      logger.error(`Error executing command ${commandName}:`, error);
      await message.reply({
        content: "Oops! Something went wrong while trying to run that command.",
      });
      return true; // Attempted to process a command, even if it failed
    }
  } else if (commandName) {
    // It was a command prefix but unknown command
    logger.log(
      `Unknown command received: ${commandName} by ${message.author.tag}`
    );
    await message.reply({
      content: `I don't know the command "${commandName}". Try \`${config.COMMAND_PREFIX} info\`, \`${config.COMMAND_PREFIX} addhistory N\`, or \`${config.COMMAND_PREFIX} clearhistory\`.`,
    });
    return true; // Recognized as an attempt to use a command
  }
  return false; // No valid command name found after prefix
};

module.exports = {
  handleCommand,
};
