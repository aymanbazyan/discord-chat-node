// src/commands/inputCommand.js
// Command for users to input their personal information

const userInfoManager = require("../utils/userInfoManager");
const logger = require("../logger");

module.exports = {
  name: "input",
  description: "Set a personal information field",
  /**
   * Execute the input command
   * @param {import('discord.js').Message} message The Discord message
   * @param {Array<string>} args Command arguments
   * @param {object} context Additional context (client, config, etc.)
   */
  async execute(message, args, { config, logger }) {
    // Debug logs
    logger.log(`Input command received. Channel type: ${message.channel.type}`);
    logger.log(`Arguments: ${JSON.stringify(args)}`);
    logger.log(`User ID: ${message.author.id}`);

    // Only allow this command in DMs for privacy
    if (message.channel.type !== 1) {
      // 1 is DM channel
      await message.reply(
        "This command can only be used in direct messages for privacy reasons."
      );
      return;
    }

    // Check arguments
    if (args.length < 2) {
      const fields = userInfoManager.getRequiredFields();
      await message.reply(
        `Please provide a field name and value using: \`${config.COMMAND_PREFIX} input <field> <value>\`\n` +
          `Required fields: ${fields.join(", ")}`
      );
      return;
    }

    const field = args[0].toLowerCase();
    const value = args.slice(1).join(" ");
    const userId = message.author.id;

    // Additional logging to verify arguments
    logger.log(
      `Processing input command: field=${field}, value=${value}, userId=${userId}`
    );

    // Check if it's a valid field
    const validFields = userInfoManager.getRequiredFields();
    if (!validFields.includes(field)) {
      await message.reply(
        `"${field}" is not a valid field. Please use one of: ${validFields.join(
          ", "
        )}`
      );
      return;
    }

    // Set the field value
    logger.log(`Setting field ${field} to ${value} for user ${userId}`);
    if (userInfoManager.setUserField(userId, field, value)) {
      await message.reply(`Successfully set your ${field} to: ${value}`);

      // Check and log user info completion status
      const isComplete = userInfoManager.isUserInfoComplete(userId);
      logger.log(`User info complete? ${isComplete}`);

      // Check if all fields are now complete
      if (isComplete) {
        const userData = userInfoManager.getUserInfo(userId);
        let summaryMessage =
          "Thank you! All required information has been provided:\n\n";

        Object.keys(userData).forEach((field) => {
          summaryMessage += `- ${field}: ${userData[field]}\n`;
        });

        summaryMessage +=
          "\nYou can now chat with me normally. Your information will be used to personalize our conversation.";

        // Force immediate save to ensure data is available
        userInfoManager.saveUserInfo();

        // Re-check completion state after saving
        if (userInfoManager.isUserInfoComplete(userId)) {
          logger.log(`Successfully verified completion state for ${userId}`);
        } else {
          logger.error(`Completion verification failed for ${userId}`);
        }

        await message.reply(summaryMessage);
      } else {
        // Tell the user what fields are still missing
        const missing = userInfoManager.getMissingFields(userId);
        logger.log(`Missing fields: ${missing.join(", ")}`);
        await message.reply(
          `You still need to provide the following information: ${missing.join(
            ", "
          )}\n` +
            `Use \`${config.COMMAND_PREFIX}input field value\` for each remaining field.`
        );
      }
    } else {
      logger.error(`Failed to set field ${field} for user ${userId}`);
      await message.reply(
        `There was an error setting your ${field}. Please try again.`
      );
    }
  },
};
