// config.js
// Loads environment variables and sets up configuration for the bot.

require("dotenv").config();
const path = require("path");

const config = {
  // Discord Configuration
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  TARGET_CHANNEL_ID: process.env.TARGET_CHANNEL_ID, // Optional: Bot listens in this channel
  BOT_PREFIX: process.env.BOT_PREFIX || "", // Optional: Prefix for AI responses
  IGNORE_PREFIX: process.env.IGNORE_PREFIX || "!ignore", // Optional: Prefix to ignore messages
  COMMAND_PREFIX: process.env.COMMAND_PREFIX || "!ollama", // Prefix for utility commands

  // AI Service Configuration
  AI_SERVICE: process.env.AI_SERVICE
    ? process.env.AI_SERVICE.toUpperCase()
    : "OLLAMA", // "OLLAMA" or "GEMINI"
  DEBUG_MODE: (process.env.DEBUG_MODE || "false") === "true", // Enable debug logging

  // Ollama Configuration (if AI_SERVICE is OLLAMA)
  OLLAMA_HOST: process.env.OLLAMA_HOST || "http://127.0.0.1:11434",
  OLLAMA_MODEL: process.env.OLLAMA_MODEL,
  OLLAMA_SYSTEM_PROMPT: process.env.OLLAMA_SYSTEM_PROMPT || "",
  IMAGE_READER_MODEL: process.env.IMAGE_READER_MODEL, // Ollama model for image reading (e.g., llava)
  IMAGE_READER_PROMPT:
    process.env.IMAGE_READER_PROMPT || "Describe this image in detail.",

  // Gemini Configuration (if AI_SERVICE is GEMINI)
  GEMINI_API_KEY: process.env.GEMINI_API_KEY, // Placeholder for Gemini API Key
  GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-pro", // Placeholder for Gemini Model
  GEMINI_SYSTEM_INSTRUCTION: process.env.GEMINI_SYSTEM_INSTRUCTION,

  // Bot Behavior
  MESSAGE_CHUNK_SIZE: parseInt(process.env.MESSAGE_CHUNK_SIZE || "1900", 10),
  COOLDOWN_TIME: parseInt(process.env.COOLDOWN_TIME || "2000", 10), // Milliseconds
  MAX_HISTORY_SIZE: parseInt(process.env.MAX_HISTORY_SIZE || "20", 10), // -1 unlimited, 0 one-shot
  MULTIPLE_CHATTERS: (process.env.MULTIPLE_CHATTERS || "false") === "true",
  MESSAGE_SPLIT_TOKEN: process.env.MESSAGE_SPLIT_TOKEN || "[NEXT_MSG]",
  MESSAGE_SPLIT_DELAY_MS: parseInt(
    process.env.MESSAGE_SPLIT_DELAY_MS || "1000",
    10
  ),
  TIMEZONE: process.env.TIMEZONE || "UTC",

  // Persistence
  HISTORY_FILE: process.env.HISTORY_FILE || "./conversationHistory.json",
  SAVE_INTERVAL_MS: parseInt(process.env.SAVE_INTERVAL_MS || "300000", 10), // 5 minutes

  // Paths
  HISTORY_FILE_PATH: path.resolve(
    __dirname,
    "./",
    process.env.HISTORY_FILE || "conversationHistory.json"
  ), // Adjusted path

  // Validations (Basic)
  validate: function () {
    if (!this.DISCORD_TOKEN) {
      console.error("FATAL ERROR: DISCORD_TOKEN is not set in your .env file.");
      process.exit(1);
    }
    if (this.AI_SERVICE === "OLLAMA" && !this.OLLAMA_MODEL) {
      console.error(
        "FATAL ERROR: OLLAMA_MODEL is not set in your .env file, but AI_SERVICE is OLLAMA."
      );
      process.exit(1);
    }
    if (this.AI_SERVICE === "GEMINI" && !this.GEMINI_API_KEY) {
      // You might want to make this a warning if Gemini is optional or has other auth methods
      console.warn(
        "WARNING: GEMINI_API_KEY is not set in your .env file, but AI_SERVICE is GEMINI."
      );
    }
    if (this.AI_SERVICE === "GEMINI" && !this.GEMINI_MODEL) {
      console.warn(
        "WARNING: GEMINI_MODEL is not set for Gemini service. Using default."
      );
    }
    if (!this.TARGET_CHANNEL_ID) {
      console.warn(
        "Warning: TARGET_CHANNEL_ID is not set. Bot will respond in all channels it can see."
      );
    }
  },
};

config.validate(); // Run validation on import

module.exports = config;
