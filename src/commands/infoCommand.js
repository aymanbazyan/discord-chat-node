// src/commands/infoCommand.js
const config = require("../../config");
const logger = require("../logger");
const historyManager = require("../utils/historyManager");
const aiServiceProvider = require("../aiServiceProvider");

module.exports = {
  name: "info",
  description: "Displays information about the bot.",
  /**
   * Executes the info command.
   * @param {import('discord.js').Message} message The Discord message object.
   * @param {string[]} args Command arguments.
   * @param {object} dependencies Shared dependencies like client, config, logger.
   */
  async execute(message, args, { client }) {
    logger.debug(`Executing 'info' command for ${message.author.tag}`);
    const channelId = message.channel.id;
    const channelHistory = historyManager.getChannelHistory(channelId);

    let ollamaInfo = "Ollama Service Not Active";
    if (config.AI_SERVICE === "OLLAMA") {
      ollamaInfo = `
    Main Ollama Model:     ${config.OLLAMA_MODEL || "Not set"}
    Image Ollama Model:    ${config.IMAGE_READER_MODEL || "Not set (disabled)"}
    Ollama Host:           ${config.OLLAMA_HOST}`;
    }

    let geminiInfo = "Gemini Service Not Active";
    if (config.AI_SERVICE === "GEMINI") {
      geminiInfo = `
    Gemini Model:          ${config.GEMINI_MODEL || "Not set"}
    Gemini API Key Set:    ${config.GEMINI_API_KEY ? "Yes" : "No"}`;
    }

    const infoMessage = `\`\`\`
Bot Information:
--------------------
Discord Tag:           ${client.user.tag}
AI Service Active:     ${aiServiceProvider.getCurrentServiceType()}
Debug Mode:            ${config.DEBUG_MODE ? "ON" : "OFF"}

Target Channel ID:     ${config.TARGET_CHANNEL_ID || "Not set (all channels)"}
${ollamaInfo}
${geminiInfo}

BOT_PREFIX:            "${config.BOT_PREFIX}" ${
      config.BOT_PREFIX ? "(AI trigger)" : "(Not set)"
    }
IGNORE_PREFIX:         "${config.IGNORE_PREFIX}" ${
      config.IGNORE_PREFIX ? "(AI ignore)" : "(Not set)"
    }
COMMAND_PREFIX:        "${config.COMMAND_PREFIX}"

Message Chunk Size:    ${config.MESSAGE_CHUNK_SIZE}
Cooldown Time (ms):    ${config.COOLDOWN_TIME}
Max History Size:      ${
      config.MAX_HISTORY_SIZE === -1
        ? "Unlimited"
        : config.MAX_HISTORY_SIZE === 0
        ? "One-shot"
        : config.MAX_HISTORY_SIZE
    }
Multiple Chatters:     ${config.MULTIPLE_CHATTERS}
System Prompt Set:     ${
      (config.AI_SERVICE === "OLLAMA" && config.OLLAMA_SYSTEM_PROMPT) ||
      (config.AI_SERVICE === "GEMINI" && "N/A (configure per call)")
        ? "Yes"
        : "No"
    }

History File:          ${config.HISTORY_FILE}
Save Interval (ms):    ${
      config.SAVE_INTERVAL_MS > 0 ? config.SAVE_INTERVAL_MS : "Disabled"
    }
AI Message Split Token:"${config.MESSAGE_SPLIT_TOKEN}"
AI Message Split Delay:${config.MESSAGE_SPLIT_DELAY_MS}ms
Timezone:              ${config.TIMEZONE}

History for this channel: ${channelHistory.length} messages
\`\`\``;
    try {
      await message.channel.send(infoMessage);
    } catch (error) {
      logger.error("Failed to send info message:", error);
      await message.channel.send(
        "Sorry, I couldn't display the info right now."
      );
    }
  },
};
