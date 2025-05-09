// src/utils/historyManager.js
// Manages loading, saving, and accessing conversation history.

const fs = require("fs");
const config = require("../../config"); // Adjust path
const logger = require("../logger"); // Adjust path

// Map to store message history per channel: channelId -> Array of messages { role, content }
let conversationHistory = new Map();
let saveIntervalId = null;

/**
 * Loads conversation history from the JSON file.
 */
const loadHistory = () => {
  if (fs.existsSync(config.HISTORY_FILE_PATH)) {
    try {
      const data = fs.readFileSync(config.HISTORY_FILE_PATH, "utf8");
      const historyObject = JSON.parse(data);
      conversationHistory = new Map(Object.entries(historyObject));
      logger.log(`Loaded conversation history from ${config.HISTORY_FILE}`);
    } catch (error) {
      logger.error(
        `Error loading conversation history from ${config.HISTORY_FILE}:`,
        error
      );
      conversationHistory = new Map(); // Start fresh on error
    }
  } else {
    logger.log(
      `No history file found at ${config.HISTORY_FILE}. Starting with empty history.`
    );
    conversationHistory = new Map();
  }
};

/**
 * Saves conversation history to the JSON file.
 */
const saveHistory = () => {
  if (
    conversationHistory.size === 0 &&
    !fs.existsSync(config.HISTORY_FILE_PATH)
  ) {
    logger.debug("No history to save and no existing history file.");
    return;
  }
  try {
    const historyObject = Object.fromEntries(conversationHistory);
    fs.writeFileSync(
      config.HISTORY_FILE_PATH,
      JSON.stringify(historyObject, null, 2),
      "utf8"
    );
    logger.debug(`Saved conversation history to ${config.HISTORY_FILE}`);
  } catch (error) {
    logger.error(
      `Error saving conversation history to ${config.HISTORY_FILE}:`,
      error
    );
  }
};

/**
 * Starts the periodic saving of history.
 */
const startPeriodicSave = () => {
  if (config.SAVE_INTERVAL_MS > 0) {
    if (saveIntervalId) clearInterval(saveIntervalId); // Clear existing interval if any
    saveIntervalId = setInterval(saveHistory, config.SAVE_INTERVAL_MS);
    logger.log(
      `Started history save interval every ${
        config.SAVE_INTERVAL_MS / 1000
      } seconds.`
    );
  } else {
    logger.log("Periodic history saving is disabled (SAVE_INTERVAL_MS <= 0).");
  }
};

/**
 * Stops the periodic saving of history.
 */
const stopPeriodicSave = () => {
  if (saveIntervalId) {
    clearInterval(saveIntervalId);
    saveIntervalId = null;
    logger.log("Stopped periodic history saving.");
  }
};

/**
 * Gets the history for a specific channel.
 * @param {string} channelId The ID of the channel.
 * @returns {Array} The conversation history for the channel.
 */
const getChannelHistory = (channelId) => {
  return conversationHistory.get(channelId) || [];
};

/**
 * Updates the history for a specific channel.
 * @param {string} channelId The ID of the channel.
 * @param {Array} history The new history array for the channel.
 */
const updateChannelHistory = (channelId, history) => {
  conversationHistory.set(channelId, history);
  // Optionally, save immediately after an update, or rely on periodic save
  // saveHistory();
};

/**
 * Clears the history for a specific channel.
 * @param {string} channelId The ID of the channel.
 * @returns {boolean} True if history was cleared, false if no history existed.
 */
const clearChannelHistory = (channelId) => {
  if (conversationHistory.has(channelId)) {
    conversationHistory.delete(channelId);
    saveHistory(); // Save immediately after clearing
    logger.log(`Cleared history for channel ${channelId}`);
    return true;
  }
  logger.log(`No history to clear for channel ${channelId}`);
  return false;
};

/**
 * Adds a message to the channel's history, respecting MAX_HISTORY_SIZE.
 * @param {string} channelId
 * @param {{role: string, content: string}} messageObject
 */
const addMessageToHistory = (channelId, messageObject) => {
  if (config.MAX_HISTORY_SIZE === 0) {
    // One-shot, don't store history
    if (conversationHistory.has(channelId)) {
      // Ensure it's clean for one-shot
      conversationHistory.delete(channelId);
    }
    return;
  }

  let history = getChannelHistory(channelId);
  history.push(messageObject);

  if (config.MAX_HISTORY_SIZE > 0 && history.length > config.MAX_HISTORY_SIZE) {
    // Prune from the beginning to keep the most recent messages
    history = history.slice(history.length - config.MAX_HISTORY_SIZE);
  }
  // If MAX_HISTORY_SIZE is -1 (unlimited), no pruning is done here.

  updateChannelHistory(channelId, history);
  logger.debug(
    `Added message to history for channel ${channelId}. New length: ${history.length}`
  );
};

module.exports = {
  loadHistory,
  saveHistory,
  startPeriodicSave,
  stopPeriodicSave,
  getChannelHistory,
  updateChannelHistory,
  clearChannelHistory,
  addMessageToHistory,
  // For direct access if needed, e.g., for `addhistory` command modifying past
  getRawHistoryMap: () => conversationHistory,
  setRawHistoryMap: (newMap) => {
    conversationHistory = newMap;
  },
};
