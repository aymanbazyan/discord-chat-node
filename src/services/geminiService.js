// src/services/geminiService.js
// Handles interactions with the Google Gemini API.

const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");
const config = require("../../config"); // Adjust path if necessary
const logger = require("../logger"); // Adjust path if necessary
const userInfoManager = require("../utils/userInfoManager");

let genAI;
let geminiChatModel;
let geminiVisionModel; // For image processing

const initialize = () => {
  if (!config.GEMINI_API_KEY) {
    logger.error(
      "GEMINI_API_KEY is not configured. Gemini service will not be available."
    );
    return false;
  }
  if (!config.GEMINI_MODEL) {
    logger.error(
      "GEMINI_MODEL is not configured. Gemini service will not be available."
    );
    return false;
  }

  try {
    logger.log(`Initializing Gemini API with model: ${config.GEMINI_MODEL}`);
    genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

    // Initialize the chat model with default system instruction
    // Note: The actual system instruction will be personalized per chat
    geminiChatModel = genAI.getGenerativeModel({
      model: config.GEMINI_MODEL,
      // Default safety settings - adjust as needed
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_UNSPECIFIED,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
      ],
      // We'll set personalized system instructions per chat session
    });
    logger.log(
      `Gemini chat client initialized with model: ${config.GEMINI_MODEL}`
    );

    // Log default system instruction (if any)
    if (config.GEMINI_SYSTEM_INSTRUCTION) {
      logger.log(
        `Default system instruction configured: "${config.GEMINI_SYSTEM_INSTRUCTION.substring(
          0,
          50
        )}..."`
      );
    } else {
      logger.log("No default system instruction configured");
    }

    geminiVisionModel = geminiChatModel; // Use the same model if it's vision-capable

    return true;
  } catch (error) {
    logger.error("Failed to initialize Gemini client:", error);
    return false;
  }
};

const isAvailable = () => !!genAI && !!geminiChatModel;

/**
 * Personalizes the system instruction with user info
 * @param {string} userId Discord user ID
 * @returns {string} Personalized system instruction
 */
const getPersonalizedSystemInstruction = (userId) => {
  logger.log(`Personalizing system instruction for user: ${userId}`);

  if (!config.GEMINI_SYSTEM_INSTRUCTION) {
    logger.log("No system instruction configured, returning undefined");
    return undefined;
  }

  // Ensure userId is a string
  const userIdStr = String(userId);
  const userInfo = userInfoManager.getUserInfo(userIdStr);

  if (!userInfo) {
    logger.log(
      `No user info found for ${userIdStr}, returning default instruction`
    );
    return config.GEMINI_SYSTEM_INSTRUCTION;
  }

  logger.log(`Found user info: ${JSON.stringify(userInfo)}`);
  let instruction = config.GEMINI_SYSTEM_INSTRUCTION;

  // Replace placeholders with user info
  Object.keys(userInfo).forEach((field) => {
    const placeholder = `<${field}>`;
    const value = userInfo[field] || "";

    // Log each replacement
    logger.log(`Replacing placeholder "${placeholder}" with "${value}"`);

    // Use a global regex to replace all instances of the placeholder
    const regex = new RegExp(placeholder, "g");
    instruction = instruction.replace(regex, value);
  });

  logger.log(`Personalized instruction: "${instruction.substring(0, 50)}..."`);
  return instruction;
};

/**
 * Transforms the bot's generic message history to Gemini's format.
 * Gemini expects roles 'user' and 'model'.
 * @param {Array<{role: string, content: string}>} messages Bot's message history.
 * @returns {Array<{role: string, parts: Array<{text: string}>}>} Messages formatted for Gemini.
 */
const formatMessagesForGemini = (messages) => {
  const geminiMessages = [];
  let currentRole = null;
  let currentParts = [];

  for (const msg of messages) {
    const role = msg.role === "assistant" ? "model" : "user"; // Map 'assistant' to 'model'

    // Gemini requires alternating user/model roles for conversational history.
    // If consecutive messages have the same role, they should be merged or handled.
    // For simplicity, this example assumes history is already somewhat alternating
    // or that the API/SDK can handle minor consecutive same roles by merging.
    // A more robust solution might merge consecutive messages of the same role.

    if (role === currentRole) {
      // Append to current message parts if same role
      currentParts.push({ text: msg.content });
    } else {
      // Push previous role's message if it exists
      if (currentRole && currentParts.length > 0) {
        geminiMessages.push({ role: currentRole, parts: currentParts });
      }
      // Start new message
      currentRole = role;
      currentParts = [{ text: msg.content }];
    }
  }
  // Push the last message
  if (currentRole && currentParts.length > 0) {
    geminiMessages.push({ role: currentRole, parts: currentParts });
  }

  // Ensure the history ends with a 'user' message if the last input was from the user.
  // The `chat` function below will append the latest user message separately.
  // So, this history should contain all messages *before* the current user turn.

  // Filter out empty parts or messages, which can cause errors
  return geminiMessages.filter((msg) =>
    msg.parts.every((part) => part.text && part.text.trim() !== "")
  );
};

/**
 * Sends a chat request to the Gemini API.
 * @param {Array<{role: string, content: string}>} messages The messages array for the chat.
 * @param {string} modelName - This is passed by aiServiceProvider but might be ignored if geminiChatModel is pre-initialized with a specific model.
 * @param {object} options Additional options for the Gemini API (e.g., temperature).
 * @returns {Promise<string|null>} The AI's response content, or null on error.
 */
const chat = async (messages, modelName, options = {}) => {
  if (!isAvailable()) {
    logger.error(
      "Gemini client is not initialized or configured. Cannot send chat request."
    );
    return null;
  }

  if (!messages || messages.length === 0) {
    logger.warn("Gemini chat called with no messages.");
    return null;
  }

  // Extract user ID from the channel ID, which is formatted as "dm_userId"
  // This assumes the message is from a DM channel with the format our bot uses
  let userId = null;
  if (options.channelId) {
    logger.log(
      `Gemini: Processing request with channelId: "${options.channelId}"`
    );

    const channelIdMatch = options.channelId.match(/^dm_(\d+)$/);
    if (channelIdMatch && channelIdMatch[1]) {
      userId = channelIdMatch[1];
      logger.log(`Gemini: Extracted user ID from channel ID: "${userId}"`);

      // Convert possible numeric ID to string for consistency
      userId = String(userId);

      // Log for debugging
      logger.log(`Gemini: Processing request for user ID: ${userId}`);

      // Check if user info exists and is complete
      const userExists = userInfoManager.getUserInfo(userId) !== null;
      logger.log(`Gemini: User exists in database? ${userExists}`);

      const isComplete = userInfoManager.isUserInfoComplete(userId);
      logger.log(`Gemini: User info complete? ${isComplete}`);

      // If we have a user ID and user info isn't complete, return instructions instead of processing
      if (!isComplete) {
        const missingFields = userInfoManager.getMissingFields(userId);
        logger.log(
          `Gemini: User ${userId} has incomplete info. Missing fields: ${missingFields.join(
            ", "
          )}`
        );

        let commandPrefix = require("../../config").COMMAND_PREFIX;

        return (
          `Before we can chat, pls provide the following:${config.MESSAGE_SPLIT_TOKEN}` +
          `${missingFields
            .map(
              (field) =>
                `- ${field}: Use \`${commandPrefix} input ${field} your_${field}\``
            )
            .join("\n")}${config.MESSAGE_SPLIT_TOKEN}` +
          `pls.`
        );
      }

      // Log the user info for debugging
      const userInfo = userInfoManager.getUserInfo(userId);
      logger.log(
        `Gemini: User ${userId} info is complete: ${JSON.stringify(userInfo)}`
      );
    } else {
      logger.log(
        `Gemini: Could not extract user ID from channel ID: "${options.channelId}"`
      );
    }
  } else {
    logger.log("Gemini: No channelId provided in options");
  }

  // The last message in `messages` is the current user's turn.
  const currentUserMessage = messages[messages.length - 1];
  // The history is all messages *before* the current user's turn.
  const historyMessages = messages.slice(0, messages.length - 1);

  const formattedHistory = formatMessagesForGemini(historyMessages);

  logger.debug(
    `Sending chat to Gemini. History length: ${
      formattedHistory.length
    }, Current message: "${currentUserMessage.content.substring(0, 50)}..."`
  );
  logger.debug(
    "Formatted History for Gemini:",
    JSON.stringify(formattedHistory, null, 2)
  );

  try {
    // Get personalized system instruction if user ID is available
    const systemInstruction = userId
      ? getPersonalizedSystemInstruction(userId)
      : config.GEMINI_SYSTEM_INSTRUCTION;

    logger.debug(
      `Using ${
        userId ? "personalized" : "default"
      } system instruction for Gemini chat.`
    );

    // For Gemini 1.5 models and later, the system instruction format is different
    // For newer models it may need to be passed as a regular message with role 'system'
    const modelIsGemini2x =
      config.GEMINI_MODEL &&
      (config.GEMINI_MODEL.includes("gemini-2") ||
        config.GEMINI_MODEL.includes("flash-preview"));

    let chatOptions = {
      history: formattedHistory,
      generationConfig: {
        temperature: options.temperature || 0.7,
      },
    };

    // Handle system instruction based on model version
    if (modelIsGemini2x) {
      // For Gemini 2.x models, we need a different approach
      // The API doesn't allow system messages at the beginning
      // Instead, we'll append the system instruction to the first user message
      if (systemInstruction && formattedHistory.length > 0) {
        logger.debug(
          "For Gemini 2.x: Adding system instruction to the first user message"
        );

        // Find the first user message
        for (let i = 0; i < formattedHistory.length; i++) {
          if (formattedHistory[i].role === "user") {
            logger.debug(
              "Found first user message, appending system instruction"
            );

            // Add the system instruction to the user's message
            const firstUserMessage = formattedHistory[i];
            const lastPartIndex = firstUserMessage.parts.length - 1;

            if (lastPartIndex >= 0) {
              // Add system instruction to the user's message
              firstUserMessage.parts[
                lastPartIndex
              ].text = `[SYSTEM INSTRUCTION: ${systemInstruction}]\n\n${firstUserMessage.parts[lastPartIndex].text}`;

              logger.debug(
                "Modified first user message with system instruction"
              );
            }

            break;
          }
        }
      } else if (systemInstruction && formattedHistory.length === 0) {
        // If no history but we have a system instruction, add it to the current message
        logger.debug(
          "No history, adding system instruction to current user message"
        );

        // Create a modified version of the current user message with the system instruction
        const originalContent = currentUserMessage.content;
        currentUserMessage.content = `[SYSTEM INSTRUCTION: ${systemInstruction}]\n\n${originalContent}`;
        logger.debug("Modified current user message with system instruction");
      } else {
        logger.debug(
          "No system instruction or no messages to modify for Gemini 2.x"
        );
      }
    } else {
      // For Gemini 1.x models, use systemInstruction parameter
      logger.debug(
        "Using standard systemInstruction parameter for Gemini 1.x model"
      );
      chatOptions.systemInstruction = systemInstruction || undefined;
    }

    // Start a chat session with history and appropriate system instruction format
    const chatSession = geminiChatModel.startChat(chatOptions);

    const result = await chatSession.sendMessage(currentUserMessage.content); // Send only the latest user message content
    const response = result.response;

    logger.debug(
      "Full Gemini API Response:",
      JSON.stringify(response, null, 2)
    );

    if (response.promptFeedback && response.promptFeedback.blockReason) {
      logger.error(
        `Gemini API blocked the prompt. Reason: ${response.promptFeedback.blockReason}`
      );
      logger.error(
        "Block Reason Details:",
        response.promptFeedback.blockReasonMessage || "No details provided."
      );
      logger.error(
        "Safety Ratings:",
        JSON.stringify(response.promptFeedback.safetyRatings, null, 2)
      );
      return `[AI response blocked due to: ${response.promptFeedback.blockReason}. Please rephrase your message or check safety settings.]`;
    }

    if (
      !response.candidates ||
      response.candidates.length === 0 ||
      !response.candidates[0].content
    ) {
      logger.warn("Gemini API returned no candidates or empty content.");
      if (
        response.candidates &&
        response.candidates[0] &&
        response.candidates[0].finishReason
      ) {
        logger.warn(
          `Candidate Finish Reason: ${response.candidates[0].finishReason}`
        );
        if (response.candidates[0].finishReason === "SAFETY") {
          logger.error(
            "Gemini API blocked the response due to safety settings."
          );
          logger.error(
            "Safety Ratings for candidate:",
            JSON.stringify(response.candidates[0].safetyRatings, null, 2)
          );
          return "[AI response blocked by safety filters.]";
        }
      }
      return null;
    }

    const text = response.candidates[0].content.parts
      .map((part) => part.text)
      .join("");
    return text;
  } catch (error) {
    logger.error("Error interacting with Gemini API (chat):", error);
    if (error.message) logger.error("Error message:", error.message);
    if (error.response && error.response.data) {
      // For axios-like errors if the SDK wraps HTTP errors
      logger.error(
        "Error response data:",
        JSON.stringify(error.response.data, null, 2)
      );
    }
    return null;
  }
};

/**
 * Helper function to convert image buffer to Gemini Part.
 * @param {Buffer} imageBuffer Buffer of the image.
 * @param {string} mimeType Mime type of the image (e.g., 'image/png', 'image/jpeg').
 * @returns {object} Gemini InlineDataPart object.
 */
function fileToGenerativePart(imageBuffer, mimeType) {
  return {
    inlineData: {
      data: imageBuffer.toString("base64"),
      mimeType,
    },
  };
}

/**
 * Describes an image using the Gemini API.
 * @param {string} base64Image The base64 encoded image string.
 * @param {string} prompt The prompt to use for image description.
 * @returns {Promise<string|null>} The image description, or null on error.
 */
const describeImage = async (
  base64Image,
  prompt = config.IMAGE_READER_PROMPT
) => {
  if (!isAvailable()) {
    // General check
    logger.error("Gemini client is not initialized. Cannot describe image.");
    return null;
  }
  if (!geminiVisionModel) {
    // Specific check for vision model
    logger.warn(
      `No dedicated Gemini vision model initialized. Attempting with ${config.GEMINI_MODEL}, which may not support images.`
    );
    // Fallback or error if config.GEMINI_MODEL is not vision capable
    if (
      !config.GEMINI_MODEL.includes("vision") &&
      !config.GEMINI_MODEL.startsWith("gemini-1.5")
    ) {
      logger.error(
        `Gemini model ${config.GEMINI_MODEL} does not support image input. Cannot describe image.`
      );
      return "[Image processing not supported by the current Gemini model configuration]";
    }
    // If it is vision capable, geminiVisionModel should have been assigned to geminiChatModel
  }

  if (!base64Image) {
    logger.warn("describeImage called with no base64Image.");
    return null;
  }

  try {
    const imageBuffer = Buffer.from(base64Image, "base64");
    // Attempt to infer mimeType or require it to be passed. For now, assume PNG or JPEG.
    // A more robust solution would inspect image headers or require mimeType.
    const imagePart = fileToGenerativePart(imageBuffer, "image/png"); // Assuming PNG, adjust if needed

    const contents = [
      {
        role: "user",
        parts: [{ text: config.IMAGE_READER_PROMPT }, imagePart],
      },
    ];

    logger.debug(
      `Sending image and prompt to Gemini Vision model (${
        config.GEMINI_MODEL
      }). Prompt: "${prompt.substring(0, 50)}..."`
    );

    // Use generateContent for multimodal prompts directly if not using a chat session
    const result = await geminiVisionModel.generateContent({ contents });
    const response = result.response;

    logger.debug(
      "Full Gemini API Vision Response:",
      JSON.stringify(response, null, 2)
    );

    if (response.promptFeedback && response.promptFeedback.blockReason) {
      logger.error(
        `Gemini API (vision) blocked the prompt. Reason: ${response.promptFeedback.blockReason}`
      );
      return `[Image description blocked due to: ${response.promptFeedback.blockReason}]`;
    }

    if (
      !response.candidates ||
      response.candidates.length === 0 ||
      !response.candidates[0].content
    ) {
      logger.warn(
        "Gemini API (vision) returned no candidates or empty content for image description."
      );
      if (
        response.candidates &&
        response.candidates[0] &&
        response.candidates[0].finishReason === "SAFETY"
      ) {
        logger.error(
          "Gemini API (vision) blocked the image response due to safety settings."
        );
        return "[Image description blocked by safety filters.]";
      }
      return null;
    }

    const text = response.candidates[0].content.parts
      .map((part) => part.text)
      .join("");
    return text.trim();
  } catch (error) {
    logger.error("Error describing image with Gemini API:", error);
    if (error.message) logger.error("Error message:", error.message);
    return null;
  }
};

module.exports = {
  initialize,
  isAvailable,
  chat,
  describeImage,
};
