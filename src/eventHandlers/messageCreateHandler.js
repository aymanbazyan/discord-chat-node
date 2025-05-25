// src/eventHandlers/messageCreateHandler.js
// Handles the 'MessageCreate' event from Discord.js.

const { Events } = require("discord.js");
const { format } = require("date-fns-tz");
const config = require("../../config");
const logger = require("../logger");
const aiServiceProvider = require("../aiServiceProvider");
const historyManager = require("../utils/historyManager");
const messageUtils = require("../utils/messageUtils");
const commandHandler = require("../commands/commandHandler");
const userInfoManager = require("../utils/userInfoManager");

// Cooldown management
const userCooldowns = new Set();

module.exports = {
  name: Events.MessageCreate,
  /**
   * Executes when a message is created.
   * @param {import('discord.js').Message} message The Discord message object.
   */
  async execute(message) {
    if (message.author.bot) {
      logger.debug(`Ignoring message from bot: ${message.author.tag}`);
      return;
    }

    // Check if message is a DM and if DMs are allowed
    const isDM = message.channel.type === 1;
    if (
      isDM &&
      (!config.ALLOW_PRIVATE_MESSAGES || config.ALLOW_PRIVATE_MESSAGES !== true)
    ) {
      logger.debug(
        `Ignoring direct message from ${message.author.tag} - DMs are disabled.`
      );
      return;
    }

    // For DMs, reload user info to ensure we have the latest data
    if (isDM) {
      // Only reload if it's not an input command to avoid duplicate processing
      if (
        !message.content.startsWith(`${config.COMMAND_PREFIX} input`) &&
        !message.content.startsWith(`${config.COMMAND_PREFIX}input`)
      ) {
        logger.log(
          `Reloading user info for DM from ${message.author.tag} (ID: ${message.author.id})`
        );
        userInfoManager.reloadUserInfo();
      } else {
        logger.log(
          `Skipping reload for input command from ${message.author.tag}`
        );
      }
    }

    // --- 1. Command Handling ---
    // Give command handler a chance to process the message first.
    // If it's a command, it will be handled, and we can return.
    try {
      if (await commandHandler.handleCommand(message)) {
        logger.debug(`Command processed for message ID ${message.id}.`);
        return; // Command was handled, no further AI processing needed.
      }
    } catch (e) {
      logger.error("Error during command handling:", e);
      // Decide if you want to message the user about command processing error
      // await message.reply("There was an error trying to process that command.");
      return; // Stop further processing if command handling itself errored
    }

    // --- 2. AI Response Pre-checks ---
    const channelId = isDM ? `dm_${message.author.id}` : message.channel.id;
    const rawMessageContent = message.content.trim();
    const userMessageContentLower = rawMessageContent.toLowerCase();

    // Ignore messages not in the target channel (if set)
    // Skip this check for DMs as they have their own channel IDs
    if (
      !isDM &&
      config.TARGET_CHANNEL_ID &&
      channelId !== config.TARGET_CHANNEL_ID
    ) {
      logger.debug(`Ignoring message in non-target channel ${channelId}.`);
      return;
    }

    if (
      isDM &&
      config.ONLY_THESE_DM_CHATS &&
      !config.ONLY_THESE_DM_CHATS.some((c) => channelId.includes(c))
    ) {
      return await message.reply("no");
    }

    // Apply ignore prefix filter
    if (
      config.IGNORE_PREFIX &&
      userMessageContentLower.startsWith(config.IGNORE_PREFIX.toLowerCase())
    ) {
      logger.debug(
        `Ignoring message with prefix "${config.IGNORE_PREFIX}" from ${message.author.tag}`
      );
      return;
    }

    let processedMessageContent = rawMessageContent;

    // Apply bot prefix filter (if a prefix is set for AI triggering)
    // For DMs, we can optionally bypass the BOT_PREFIX requirement if configured
    const requiresPrefixInDM = config.REQUIRE_PREFIX_IN_DM !== false;
    if (config.BOT_PREFIX && (!isDM || (isDM && requiresPrefixInDM))) {
      if (
        !userMessageContentLower.startsWith(config.BOT_PREFIX.toLowerCase())
      ) {
        logger.debug(
          `Message from ${message.author.tag} does not have BOT_PREFIX "${config.BOT_PREFIX}". Ignoring for AI response.`
        );
        return;
      }
      processedMessageContent = rawMessageContent
        .substring(config.BOT_PREFIX.length)
        .trim();
    }

    // Cooldown check (after prefix and command checks)
    if (userCooldowns.has(message.author.id)) {
      logger.debug(`User ${message.author.tag} is on cooldown.`);
      // Optionally send a message, or just silently ignore.
      // await message.reply("Please wait a moment before sending another message.");
      return;
    }
    userCooldowns.add(message.author.id);
    setTimeout(
      () => userCooldowns.delete(message.author.id),
      config.COOLDOWN_TIME
    );

    // --- 3. Image Processing ---
    let imageDescriptions = [];
    const imageAttachments = message.attachments.filter((att) =>
      att.contentType?.startsWith("image/")
    );

    if (
      aiServiceProvider.isImageProcessingAvailable() &&
      imageAttachments.size > 0
    ) {
      logger.log(
        `Processing ${imageAttachments.size} image(s) from ${message.author.tag}...`
      );
      await message.channel.sendTyping();

      for (const attachment of imageAttachments.values()) {
        try {
          logger.debug(`Fetching image: ${attachment.url}`);
          const response = await fetch(attachment.url); // Ensure fetch is available (node-fetch or built-in)
          if (!response.ok)
            throw new Error(
              `HTTP error fetching image! status: ${response.status}`
            );

          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const base64Image = buffer.toString("base64");

          logger.debug(
            `Sending image ${attachment.name} to AI service for description.`
          );
          const description = await aiServiceProvider.describeImage(
            base64Image,
            config.IMAGE_READER_PROMPT
          );

          if (description) {
            imageDescriptions.push(
              `[Image Description for file]: ${description}`
            );
            logger.debug(`Successfully described image: ${attachment.name}`);
          } else {
            imageDescriptions.push(
              `[Image Description for ${attachment.name}]: Could not generate description.`
            );
            logger.warn(
              `AI service returned empty description for ${attachment.name}`
            );
          }
        } catch (error) {
          logger.error(`Error processing image ${attachment.name}:`, error);
          imageDescriptions.push(
            `[Image Description for ${attachment.name}]: Unable to process image.`
          );
        }
      }
      logger.debug(
        `Finished processing images. Found ${imageDescriptions.length} descriptions.`
      );
    }

    // --- 4. Construct Final Message for AI ---
    let finalMessageContentForAI = processedMessageContent;
    if (imageDescriptions.length > 0) {
      const imageDescriptionText = imageDescriptions.join("\n");
      finalMessageContentForAI = finalMessageContentForAI
        ? `${finalMessageContentForAI}\n${imageDescriptionText}`
        : imageDescriptionText;
    }

    if (!finalMessageContentForAI) {
      // If only prefix was sent, or images failed and no text
      if (
        config.BOT_PREFIX &&
        rawMessageContent
          .toLowerCase()
          .startsWith(config.BOT_PREFIX.toLowerCase())
      ) {
        logger.debug(
          `Message from ${message.author.tag} was just prefix or unprocessable. Replying with "Hmm?".`
        );
        await message.reply("Hmm? Did you want to tell me something?");
      } else {
        logger.debug("No content for AI after processing. Ignoring.");
      }
      return;
    }

    // --- 5. AI Interaction ---
    try {
      if (!message.channel.typing) await message.channel.sendTyping();

      const now = new Date();
      const formattedTime = format(now, "HH:mm zzz", {
        timeZone: config.TIMEZONE,
      });

      let userMessageForHistory = `[Time: ${formattedTime}] ${finalMessageContentForAI}`;
      if (config.MULTIPLE_CHATTERS) {
        const senderUsername =
          message.author.globalName || message.author.username;
        userMessageForHistory = `${senderUsername}: ${userMessageForHistory}`;
      }

      // Add DM context if applicable
      if (isDM && config.INCLUDE_DM_CONTEXT) {
        userMessageForHistory = `[Direct Message] ${userMessageForHistory}`;
      }

      // For DMs, check if user info is complete before proceeding with AI
      if (isDM) {
        const userId = message.author.id;
        if (!userInfoManager.isUserInfoComplete(userId)) {
          logger.log(
            `User ${userId} has incomplete info. Redirecting to input command instead of AI.`
          );
          await message.channel.send(
            `Before we can chat, pls use the \`${
              config.COMMAND_PREFIX
            } input\` command with the following required fields: ${userInfoManager
              .getRequiredFields()
              .join(", ")}`
          );
          return; // Stop processing - don't send to AI or save to history
        }

        logger.log(
          `User ${userId} has complete info. Proceeding with AI chat.`
        );
      }

      // Prepare messages for AI Service
      let messagesForOllama = [];
      const currentChannelHistory = historyManager.getChannelHistory(channelId);

      // Add system prompt if Ollama and configured
      if (config.AI_SERVICE === "OLLAMA" && config.OLLAMA_SYSTEM_PROMPT) {
        messagesForOllama.push({
          role: "system",
          content: config.OLLAMA_SYSTEM_PROMPT,
        });
      }
      // Note: Gemini might handle system prompts differently (e.g., in initialization or per-call options)

      let historySliceForAI = [];
      if (config.MAX_HISTORY_SIZE === -1) {
        // Unlimited
        historySliceForAI = [...currentChannelHistory];
      } else if (config.MAX_HISTORY_SIZE > 0) {
        // Limited
        const startIndex = Math.max(
          0,
          currentChannelHistory.length - (config.MAX_HISTORY_SIZE - 1)
        ); // -1 because current message is next
        historySliceForAI = currentChannelHistory.slice(startIndex);
      }
      // If MAX_HISTORY_SIZE is 0, historySliceForAI remains empty, only current message is sent.

      messagesForOllama.push(...historySliceForAI);
      messagesForOllama.push({ role: "user", content: userMessageForHistory }); // Add current user message

      logger.debug(
        `Sending ${messagesForOllama.length} message segments to AI service.`
      );

      // Add options for the AI service, including channelId for user identification
      const aiOptions = {
        channelId: channelId,
        temperature: config.AI_TEMPERATURE,
      };

      // Get the AI response
      const aiResponse = await aiServiceProvider.chat(
        messagesForOllama,
        aiOptions
      );

      // Check if the response is null before using replaceAll
      if (!aiResponse) {
        logger.warn(`AI service returned null for message ID ${message.id}.`);

        // For DM channels, this might be because user info is incomplete
        if (isDM) {
          await message.channel.send(
            `I need some information from you before we can chat. Please use the \`${config.COMMAND_PREFIX} input\` command to provide your details.`
          );
        } else {
          await message.channel.send(
            "I... I don't have a response for that right now."
          );
        }

        // Don't add to history when we get a null response
        return;
      }

      // Process the response now that we know it's not null
      let aiResponseContent = aiResponse.replaceAll(
        "\n\n",
        config.MESSAGE_SPLIT_TOKEN
      );

      // Remove single dot (but not double+ dots)
      if (!config.ALLOW_SINGLE_DOT)
        aiResponseContent = aiResponseContent.replace(/(?<!\.)\.(?!\.)/g, "");

      if (aiResponseContent.trim() === "") {
        logger.warn(
          `AI service returned an empty or whitespace-only response for message ID ${message.id}.`
        );
        await message.channel.send(
          "I... I don't have a response for that right now."
        );
        // Add user message to history even if AI fails to respond, to keep context for next turn
        historyManager.addMessageToHistory(channelId, {
          role: "user",
          content: userMessageForHistory,
        });
        historyManager.addMessageToHistory(channelId, {
          role: "assistant",
          content: "[AI failed to generate a response]",
        });
        historyManager.saveHistory();
        return;
      }

      // Add user and AI messages to persistent history
      historyManager.addMessageToHistory(channelId, {
        role: "user",
        content: userMessageForHistory,
      });
      historyManager.addMessageToHistory(channelId, {
        role: "assistant",
        content: aiResponseContent,
      });
      historyManager.saveHistory(); // Save after successful interaction

      // Send response to Discord
      const tokenRegex = new RegExp(
        `([.!?]*)\\s*${messageUtils.escapeRegExp(
          config.MESSAGE_SPLIT_TOKEN
        )}\\s*`,
        "g"
      );
      const rawParts = aiResponseContent.split(tokenRegex);
      const messageParts = [];
      for (let i = 0; i < rawParts.length; i += 2) {
        const currentPart = rawParts[i] || "";
        const punctuation = rawParts[i + 1] || "";
        if (i === rawParts.length - 1) {
          // Last part
          if (currentPart.trim()) messageParts.push(currentPart.trim());
        } else if (currentPart.trim() || punctuation) {
          messageParts.push((currentPart + punctuation).trim());
        }
      }

      if (messageParts.length === 0 && aiResponseContent.trim()) {
        // Fallback if regex split fails
        messageParts.push(
          ...aiResponseContent
            .split(config.MESSAGE_SPLIT_TOKEN)
            .map((p) => p.trim())
            .filter((p) => p)
        );
      }

      logger.debug(
        `AI response split into ${messageParts.length} parts by token.`
      );

      for (let i = 0; i < messageParts.length; i++) {
        const part = messageParts[i];
        if (!part) continue;

        const chunks = messageUtils.splitMessage(
          part,
          config.MESSAGE_CHUNK_SIZE
        );
        for (const chunk of chunks) {
          let processedChunk = chunk;

          // Check if emojis are not allowed
          if (config.ALLOW_EMOJIS === false) {
            // Filter emojis from the chunk
            processedChunk = messageUtils.filterEmojis(chunk);
          }

          // Send the processed chunk (either original or filtered)
          await message.channel.send(processedChunk);
        }
        if (i < messageParts.length - 1 && config.MESSAGE_SPLIT_DELAY_MS > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, config.MESSAGE_SPLIT_DELAY_MS)
          );
        }
      }
      if (
        messageParts.length === 0 ||
        messageParts.every((p) => p.trim() === "")
      ) {
        if (finalMessageContentForAI) {
          // Only if there was something to respond to
          await message.channel.send("... (No substantial response generated)");
        }
      }
    } catch (error) {
      logger.error(
        `Error during AI interaction or response sending for message ID ${message.id}:`,
        error
      );
      // Attempt to rollback history for the user's last message if AI call failed before assistant response was added
      // This is a bit tricky as the user message is added before the call in the current flow.
      // A more robust rollback might involve checking the last item in history.
      // For now, just log and send a generic error.
      // historyManager.removeLastUserMessageIfFailed(channelId, userMessageForHistory); // This function would need careful implementation

      let userErrorMessage =
        "Something unexpected happened, and I couldn't quite process that. So sorry!";
      if (
        error.message &&
        error.message.toLowerCase().includes("econnrefused")
      ) {
        userErrorMessage = `I'm having trouble connecting to my brain right now (${config.AI_SERVICE}). Please ensure it's running and accessible.`;
      } else if (
        error.message &&
        error.message.toLowerCase().includes("model")
      ) {
        userErrorMessage = `There seems to be an issue with the AI model I'm trying to use (${config.AI_SERVICE}). Maybe it's not available?`;
      }
      await message.channel.send(userErrorMessage);
    }
  },
};
