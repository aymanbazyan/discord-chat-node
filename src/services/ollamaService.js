// src/services/ollamaService.js
// Handles interactions with the Ollama API.

const { Ollama } = require("ollama");
const config = require("../../config"); // Adjust path
const logger = require("../logger"); // Adjust path

let ollamaClient;

const initialize = () => {
  if (!config.OLLAMA_HOST || !config.OLLAMA_MODEL) {
    logger.warn(
      "Ollama host or model not configured. Ollama service will not be available."
    );
    return false;
  }
  try {
    ollamaClient = new Ollama({ host: config.OLLAMA_HOST });
    logger.log(`Ollama client initialized for host: ${config.OLLAMA_HOST}`);
    return true;
  } catch (error) {
    logger.error("Failed to initialize Ollama client:", error);
    return false;
  }
};

const isAvailable = () => !!ollamaClient;

/**
 * Sends a chat request to the Ollama API.
 * @param {Array<{role: string, content: string, images?: string[]}>} messages The messages array for the chat.
 * @param {string} modelName The name of the Ollama model to use (overrides default).
 * @param {object} options Additional options for the Ollama API.
 * @returns {Promise<string|null>} The AI's response content, or null on error.
 */
const chat = async (
  messages,
  modelName = config.OLLAMA_MODEL,
  options = {}
) => {
  if (!isAvailable()) {
    logger.error("Ollama client is not initialized. Cannot send chat request.");
    return null;
  }
  if (!messages || messages.length === 0) {
    logger.warn("Ollama chat called with no messages.");
    return null;
  }

  logger.debug(
    `Sending ${messages.length} messages to Ollama model ${modelName}.`
  );
  logger.debug("Messages payload:", JSON.stringify(messages, null, 2));

  try {
    const response = await ollamaClient.chat({
      model: modelName,
      messages: messages,
      options: {
        temperature: 0.7, // Default, can be overridden by options
        num_predict: 1000, // Default, can be overridden
        ...options, // Spread any additional passed options
      },
      // stream: false, // Ensure stream is false for single response
    });
    logger.debug(
      "Ollama response received:",
      JSON.stringify(response, null, 2)
    );
    return response.message.content;
  } catch (error) {
    logger.error(`Error interacting with Ollama model ${modelName}:`, error);
    if (error.cause && error.cause.code === "ECONNREFUSED") {
      logger.error(
        `Connection refused by Ollama server at ${config.OLLAMA_HOST}. Is Ollama running?`
      );
    } else if (error.message && error.message.includes("model")) {
      // This could be a model not found error or other model-related issue
      logger.error(
        `It seems there's an issue with the Ollama model '${modelName}'. Is it pulled/available?`
      );
    }
    return null;
  }
};

/**
 * Describes an image using the configured Ollama image reader model.
 * @param {string} base64Image The base64 encoded image string.
 * @param {string} prompt The prompt to use for image description.
 * @returns {Promise<string|null>} The image description, or null on error.
 */
const describeImage = async (
  base64Image,
  prompt = config.IMAGE_READER_PROMPT
) => {
  if (!isAvailable()) {
    logger.error("Ollama client is not initialized. Cannot describe image.");
    return null;
  }
  if (!config.IMAGE_READER_MODEL) {
    logger.warn(
      "IMAGE_READER_MODEL is not configured for Ollama. Cannot describe image."
    );
    return null;
  }
  if (!base64Image) {
    logger.warn("describeImage called with no base64Image.");
    return null;
  }

  logger.debug(
    `Sending image to Ollama model ${config.IMAGE_READER_MODEL} for description.`
  );
  try {
    const response = await ollamaClient.chat({
      model: config.IMAGE_READER_MODEL,
      messages: [
        {
          role: "user",
          content: prompt,
          images: [base64Image],
        },
      ],
      options: {
        temperature: 0.5, // Often lower for descriptive tasks
        num_predict: 500, // Limit description length
      },
    });
    logger.debug(
      "Ollama image description response:",
      JSON.stringify(response, null, 2)
    );
    return response.message.content.trim();
  } catch (error) {
    logger.error(
      `Error describing image with Ollama model ${config.IMAGE_READER_MODEL}:`,
      error
    );
    return null;
  }
};

module.exports = {
  initialize,
  isAvailable,
  chat,
  describeImage,
};
