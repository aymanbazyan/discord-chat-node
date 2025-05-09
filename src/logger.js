// src/logger.js
// Simple logger utility that respects the DEBUG_MODE flag from config.

const config = require("../config"); // Adjust path as necessary

const logger = {
  log: (...args) => {
    if (config.DEBUG_MODE) {
      console.log("[LOG]", ...args);
    }
  },
  warn: (...args) => {
    // Warnings are usually important, so show them even if debug mode is off,
    // but you can change this behavior if needed.
    console.warn("[WARN]", ...args);
  },
  error: (...args) => {
    console.error("[ERROR]", ...args);
  },
  info: (...args) => {
    // General info, can be tied to DEBUG_MODE or shown always
    if (config.DEBUG_MODE) {
      console.info("[INFO]", ...args);
    }
  },
  debug: (...args) => {
    // Explicit debug level
    if (config.DEBUG_MODE) {
      console.debug("[DEBUG]", ...args);
    }
  },
};

// Initial configuration log
logger.log(
  `Logger initialized. Debug mode is ${config.DEBUG_MODE ? "ON" : "OFF"}.`
);
logger.log(`Selected AI Service: ${config.AI_SERVICE}`);
if (config.TARGET_CHANNEL_ID)
  logger.log(`Target Channel ID: ${config.TARGET_CHANNEL_ID}`);
else
  logger.warn(
    "TARGET_CHANNEL_ID is not set. Bot will respond in all channels."
  );
if (config.BOT_PREFIX) logger.log(`Bot prefix: "${config.BOT_PREFIX}"`);
if (config.IGNORE_PREFIX)
  logger.log(`Ignore prefix: "${config.IGNORE_PREFIX}"`);
if (config.AI_SERVICE === "OLLAMA") {
  logger.log(`Ollama Host: ${config.OLLAMA_HOST}`);
  logger.log(`Ollama Model: ${config.OLLAMA_MODEL}`);
  if (config.OLLAMA_SYSTEM_PROMPT) logger.log("Ollama system prompt is set.");
  if (config.IMAGE_READER_MODEL)
    logger.log(`Image Reader Model: ${config.IMAGE_READER_MODEL}`);
  else
    logger.warn(
      "IMAGE_READER_MODEL is not set for Ollama. Image analysis disabled."
    );
}
if (config.AI_SERVICE === "GEMINI") {
  logger.log(`Gemini Model: ${config.GEMINI_MODEL}`);
  if (!config.GEMINI_API_KEY)
    logger.warn("GEMINI_API_KEY is not set for Gemini service.");
}

module.exports = logger;
