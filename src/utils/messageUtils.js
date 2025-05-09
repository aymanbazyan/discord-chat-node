// src/utils/messageUtils.js
// Contains utility functions for message manipulation.

const config = require("../../config"); // Adjust path
const logger = require("../logger"); // Adjust path

// Function to filter out emojis from a string
function filterEmojis(text) {
  // This regex attempts to match common emoji patterns.
  // It might not catch all emojis, as the Unicode standard is vast and evolving.
  // A more comprehensive solution might involve a dedicated library.
  const emojiRegex =
    /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udeff]|\ud83d[\ud000-\udeff]|\ud83e[\ud000-\udeff])/g;
  return text.replace(emojiRegex, "");
}

/**
 * Splits a long message into chunks that respect Discord's character limit.
 * Attempts to split by natural separators (newlines, sentences) first.
 * @param {string} text The text to split.
 * @param {number} maxLength The maximum length of each chunk.
 * @returns {string[]} An array of message chunks.
 */
function splitMessage(text, maxLength = config.MESSAGE_CHUNK_SIZE) {
  if (!text || text.length === 0) return ["..."]; // Default for empty or null text

  const chunks = [];
  let currentChunk = "";

  // Normalize newlines and split by them first, keeping the delimiter if possible
  const parts = text.replace(/\r\n/g, "\n").split(/(\n)/);

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isNewlineDelimiter = part === "\n";

    // If current chunk + part (and a potential space) exceeds maxLength
    if (
      currentChunk.length +
        part.length +
        (currentChunk.length > 0 && !isNewlineDelimiter ? 1 : 0) >
      maxLength
    ) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }

      // If the part itself is too long, hard split it
      if (part.length > maxLength) {
        for (let j = 0; j < part.length; j += maxLength) {
          chunks.push(part.substring(j, Math.min(j + maxLength, part.length)));
        }
        // If this long part was followed by a newline, and we consumed it, skip it
        if (
          isNewlineDelimiter &&
          i + 1 < parts.length &&
          parts[i + 1] === "\n"
        ) {
          // This logic might be tricky; the goal is to not lose newlines if they were part of the split
        }
      } else {
        currentChunk = part; // Start new chunk with this part
      }
    } else {
      // Add part to current chunk
      if (
        currentChunk.length > 0 &&
        !isNewlineDelimiter &&
        part.trim().length > 0
      ) {
        currentChunk += " "; // Add space if not a newline and current chunk has content
      }
      currentChunk += part;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  // Fallback if no chunks were created but text exists (e.g., single long line without natural breaks)
  if (chunks.length === 0 && text.trim().length > 0) {
    logger.warn(
      "Natural splitting failed for a non-empty message, falling back to character split.",
      { textLength: text.length }
    );
    for (let i = 0; i < text.length; i += maxLength) {
      chunks.push(text.substring(i, Math.min(i + maxLength, text.length)));
    }
  }

  // Ensure all chunks are within maxLength (safeguard)
  const finalChunks = [];
  for (const chunk of chunks) {
    if (chunk.length > maxLength) {
      logger.warn(
        `Chunk still too large after split (${chunk.length} > ${maxLength}), force splitting.`,
        { chunkPreview: chunk.substring(0, 50) }
      );
      for (let i = 0; i < chunk.length; i += maxLength) {
        finalChunks.push(
          chunk.substring(i, Math.min(i + maxLength, chunk.length))
        );
      }
    } else if (chunk.trim().length > 0) {
      // Only add non-empty chunks
      finalChunks.push(chunk);
    }
  }
  logger.debug(`Split message into ${finalChunks.length} chunks.`);
  return finalChunks.length > 0 ? finalChunks : ["..."]; // Ensure something is returned
}

/**
 * Escapes special regex characters in a string.
 * @param {string} string The string to escape.
 * @returns {string} The escaped string.
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

module.exports = {
  splitMessage,
  escapeRegExp,
  filterEmojis,
};
