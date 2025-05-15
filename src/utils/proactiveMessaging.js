// src/utils/proactiveMessaging.js
// Handles proactive messaging from the bot to users/channels

const { Client } = require("discord.js");
const config = require("../../config");
const logger = require("../logger");
const aiServiceProvider = require("../aiServiceProvider");
const historyManager = require("./historyManager");

// Keep track of messaging timers
let proactiveTimer = null;
let isProactiveMessagingActive = false;

/**
 * Calculate a random time between min and max (in minutes)
 * @param {number} min Minimum minutes
 * @param {number} max Maximum minutes
 * @returns {number} Milliseconds to wait
 */
function getRandomInterval(min, max) {
  // Convert to milliseconds
  return Math.floor(Math.random() * (max - min + 1) + min) * 60 * 1000;
}

/**
 * Choose a random target from the configured targets
 * @returns {string|null} The chosen target ID or null if none available
 */
function chooseRandomTarget() {
  if (!config.PROACTIVE_TARGETS || config.PROACTIVE_TARGETS.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(
    Math.random() * config.PROACTIVE_TARGETS.length
  );
  return config.PROACTIVE_TARGETS[randomIndex];
}

/**
 * Get a message to send proactively
 * @param {string} targetId The ID of the target channel/user
 * @returns {Promise<string>} The message to send
 */
async function generateProactiveMessage(targetId) {
  try {
    // Check if we have conversation history with this target
    const history = historyManager.getConversationByChannelId(targetId);

    const systemPrompt =
      config.PROACTIVE_SYSTEM_PROMPT ||
      "You are initiating a conversation with the user. Start with something engaging, a question, " +
        "or an interesting topic. Keep it brief and friendly.";

    // Add context based on history
    let context = "";
    if (history && history.length > 0) {
      const lastMessages = history.slice(-3); // Last 3 messages
      context =
        "Based on your previous conversation: " +
        lastMessages.map((msg) => `${msg.role}: ${msg.content}`).join("; ");
    }

    const prompt = `${systemPrompt} ${context}`;

    const response = await aiServiceProvider.generateResponse(
      prompt,
      [], // No conversation history for this specific request
      true // Is a system/internal request
    );

    if (!response) {
      throw new Error("AI service returned empty response");
    }

    return response;
  } catch (error) {
    logger.error("Error generating proactive message:", error);
    return config.PROACTIVE_FALLBACK_MESSAGES[
      Math.floor(Math.random() * config.PROACTIVE_FALLBACK_MESSAGES.length)
    ];
  }
}

/**
 * Send a proactive message to a target
 * @param {Client} client Discord client instance
 * @returns {Promise<void>}
 */
async function sendProactiveMessage(client) {
  if (!isProactiveMessagingActive || !config.ENABLE_PROACTIVE_MESSAGING) {
    return;
  }

  try {
    const targetId = chooseRandomTarget();
    if (!targetId) {
      logger.warn("No proactive messaging targets configured.");
      return;
    }

    // Determine if this is a user (DM) or channel
    const isDM = targetId.startsWith("dm_");
    let target;

    if (isDM) {
      const userId = targetId.substring(3); // Remove 'dm_' prefix
      try {
        target = await client.users.fetch(userId);
        if (!target) {
          throw new Error(`User with ID ${userId} not found`);
        }
      } catch (error) {
        logger.error(`Failed to fetch user with ID ${userId}:`, error);
        return;
      }
    } else {
      try {
        target = await client.channels.fetch(targetId);
        if (!target) {
          throw new Error(`Channel with ID ${targetId} not found`);
        }
      } catch (error) {
        logger.error(`Failed to fetch channel with ID ${targetId}:`, error);
        return;
      }
    }

    // Chance to skip sending a message this time
    if (Math.random() > config.PROACTIVE_CHANCE) {
      logger.debug("Random chance decided to skip proactive message this time");
      scheduleNextProactiveMessage(client);
      return;
    }

    // Generate message content
    const message = await generateProactiveMessage(targetId);

    // Send the message
    if (isDM) {
      await target.send(message);
      logger.info(`Sent proactive DM to user ${target.tag}`);
    } else {
      await target.send(message);
      logger.info(`Sent proactive message to channel #${target.name}`);
    }

    // Update conversation history
    historyManager.addMessageToHistory(targetId, {
      role: "assistant",
      content: message,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error sending proactive message:", error);
  }

  // Schedule the next message
  scheduleNextProactiveMessage(client);
}

/**
 * Schedule the next proactive message
 * @param {Client} client Discord client instance
 */
function scheduleNextProactiveMessage(client) {
  if (proactiveTimer) {
    clearTimeout(proactiveTimer);
  }

  if (!config.ENABLE_PROACTIVE_MESSAGING) {
    return;
  }

  const interval = getRandomInterval(
    config.PROACTIVE_MIN_INTERVAL || 60,
    config.PROACTIVE_MAX_INTERVAL || 240
  );

  logger.debug(
    `Scheduling next proactive message in ${interval / 60000} minutes`
  );

  proactiveTimer = setTimeout(() => {
    sendProactiveMessage(client);
  }, interval);
}

/**
 * Start the proactive messaging system
 * @param {Client} client Discord client instance
 */
function startProactiveMessaging(client) {
  if (!config.ENABLE_PROACTIVE_MESSAGING) {
    logger.info("Proactive messaging is disabled in config.");
    return;
  }

  if (!config.PROACTIVE_TARGETS || config.PROACTIVE_TARGETS.length === 0) {
    logger.warn(
      "No proactive messaging targets configured. Proactive messaging will not function."
    );
    return;
  }

  if (isProactiveMessagingActive) {
    logger.debug("Proactive messaging is already active.");
    return;
  }

  isProactiveMessagingActive = true;
  logger.info("Starting proactive messaging system.");
  scheduleNextProactiveMessage(client);
}

/**
 * Stop the proactive messaging system
 */
function stopProactiveMessaging() {
  if (proactiveTimer) {
    clearTimeout(proactiveTimer);
    proactiveTimer = null;
  }

  isProactiveMessagingActive = false;
  logger.info("Proactive messaging system stopped.");
}

module.exports = {
  startProactiveMessaging,
  stopProactiveMessaging,
  sendProactiveMessage, // Exported for manual triggers
};
