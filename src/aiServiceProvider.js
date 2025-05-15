// src/aiServiceProvider.js
// Provides a unified interface for AI interactions, switching between configured services.

const config = require("../config");
const logger = require("./logger");
const ollamaService = require("./services/ollamaService");
const geminiService = require("./services/geminiService"); // Placeholder
const userInfoManager = require("./utils/userInfoManager");

let currentService = null;

const initialize = () => {
  logger.log(`Attempting to initialize AI Service: ${config.AI_SERVICE}`);
  let initializedSuccessfully = false;

  // Initialize user info manager first
  if (!userInfoManager.initialize()) {
    logger.warn(
      "User info manager failed to initialize. Personalization features may not work properly."
    );
  }

  if (config.AI_SERVICE === "OLLAMA") {
    if (ollamaService.initialize()) {
      currentService = ollamaService;
      initializedSuccessfully = true;
    } else {
      logger.error("Failed to initialize Ollama Service.");
    }
  } else if (config.AI_SERVICE === "GEMINI") {
    if (geminiService.initialize()) {
      // This will call the placeholder initialize
      currentService = geminiService;
      initializedSuccessfully = true; // Assuming placeholder initializes "successfully"
    } else {
      logger.error("Failed to initialize Gemini Service.");
    }
  } else {
    logger.error(
      `Unsupported AI_SERVICE: ${config.AI_SERVICE}. Please choose OLLAMA or GEMINI.`
    );
    return false;
  }

  if (initializedSuccessfully) {
    logger.log(`AI Service Provider initialized with ${config.AI_SERVICE}.`);
  } else {
    logger.error(
      `AI Service Provider FAILED to initialize with ${config.AI_SERVICE}. Bot may not function correctly.`
    );
  }
  return initializedSuccessfully;
};

/**
 * Send messages to the AI service for chat
 * @param {Array} messages Array of message objects
 * @param {Object} options Options including channelId
 * @returns {Promise<string>} AI response
 */
const chat = async (messages, options = {}) => {
  if (!currentService || !currentService.isAvailable()) {
    logger.error(
      `No AI service available or ${config.AI_SERVICE} is not ready. Cannot process chat.`
    );
    return null;
  }

  // Extract channelId from the original options if available
  const serviceOptions = { ...options };

  // Add debug logging
  logger.log(
    `AIServiceProvider: Chat request with options: ${JSON.stringify({
      channelId: serviceOptions.channelId,
      model:
        options.model ||
        (config.AI_SERVICE === "OLLAMA"
          ? config.OLLAMA_MODEL
          : config.GEMINI_MODEL),
    })}`
  );

  // Pass to the appropriate service
  return currentService.chat(
    messages,
    options.model ||
      (config.AI_SERVICE === "OLLAMA"
        ? config.OLLAMA_MODEL
        : config.GEMINI_MODEL),
    serviceOptions
  );
};

const describeImage = async (base64Image, prompt) => {
  if (!currentService || !currentService.isAvailable()) {
    logger.error(
      `No AI service available or ${config.AI_SERVICE} is not ready. Cannot process image description.`
    );
    return null;
  }
  if (!currentService.describeImage) {
    logger.warn(
      `${config.AI_SERVICE} does not support describeImage function.`
    );
    return `[Image description not supported by ${config.AI_SERVICE}]`;
  }
  // Use service-specific default prompt if not overridden
  const servicePrompt = config.IMAGE_READER_PROMPT
    ? config.IMAGE_READER_PROMPT
    : "Describe this image.";
  return currentService.describeImage(base64Image, prompt || servicePrompt);
};

const isImageProcessingAvailable = () => {
  if (
    !currentService ||
    !currentService.isAvailable() ||
    !currentService.describeImage
  ) {
    return false;
  }
  if (config.AI_SERVICE === "OLLAMA") {
    return !!config.IMAGE_READER_MODEL;
  }
  if (config.AI_SERVICE === "GEMINI") {
    // Add logic here if Gemini has specific model requirements for vision
    // e.g., return config.GEMINI_MODEL.includes("vision");
    return true; // Placeholder, assume Gemini can if service is active
  }
  return false;
};

module.exports = {
  initialize,
  chat,
  describeImage,
  isImageProcessingAvailable,
  getCurrentServiceType: () => config.AI_SERVICE,
};
