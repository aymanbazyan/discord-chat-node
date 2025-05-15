// src/utils/userInfoManager.js
// Manages user information storage and retrieval for personalized AI interactions

const fs = require("fs");
const path = require("path");
const logger = require("../logger");

// Default path for the user info JSON file
const USER_INFO_FILE = path.join(process.cwd(), "data", "usersInfo.json");

// Required fields that users must provide
const REQUIRED_FIELDS = ["name", "city"];

// In-memory cache of user info
let userInfo = {};

/**
 * Creates the data directory and empty user info file if they don't exist
 */
const ensureFileExists = () => {
  try {
    logger.log(`UserInfoManager: Ensuring file exists at: ${USER_INFO_FILE}`);

    // Create data directory if it doesn't exist
    const dataDir = path.dirname(USER_INFO_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      logger.log(`UserInfoManager: Created data directory: ${dataDir}`);
    }

    // Create file if it doesn't exist
    if (!fs.existsSync(USER_INFO_FILE)) {
      fs.writeFileSync(USER_INFO_FILE, JSON.stringify({}, null, 2), "utf8");
      logger.log(`UserInfoManager: Created new empty userInfo.json file`);
    }

    // Verify the file exists and is valid JSON
    const fileContent = fs.readFileSync(USER_INFO_FILE, "utf8");
    try {
      if (fileContent.trim() === "") {
        // File exists but is empty, write empty JSON object
        fs.writeFileSync(USER_INFO_FILE, JSON.stringify({}, null, 2), "utf8");
        logger.log(
          `UserInfoManager: File was empty, initialized with empty JSON object`
        );
      } else {
        // Verify it's valid JSON
        JSON.parse(fileContent);
        logger.log(`UserInfoManager: File exists and contains valid JSON`);
      }
    } catch (jsonError) {
      // File exists but contains invalid JSON, overwrite with empty object
      logger.error(
        `UserInfoManager: File contained invalid JSON, resetting: ${jsonError.message}`
      );
      fs.writeFileSync(USER_INFO_FILE, JSON.stringify({}, null, 2), "utf8");
    }

    return true;
  } catch (error) {
    logger.error(
      `UserInfoManager: Error ensuring file exists: ${error.message}`
    );
    return false;
  }
};

/**
 * Reloads user info from the file
 * @returns {boolean} Success status
 */
const reloadUserInfo = () => {
  try {
    logger.log(`UserInfoManager: Reloading from file: ${USER_INFO_FILE}`);

    if (!fs.existsSync(USER_INFO_FILE)) {
      logger.log("UserInfoManager: File does not exist, nothing to reload");
      return false;
    }

    const data = fs.readFileSync(USER_INFO_FILE, "utf8");
    logger.log(`UserInfoManager: Loaded file content: ${data}`);

    if (data.trim() === "") {
      logger.log("UserInfoManager: File is empty, keeping current data");
      return false;
    }

    try {
      const loadedData = JSON.parse(data);
      userInfo = loadedData;
      logger.log(
        `UserInfoManager: Reloaded user info for ${
          Object.keys(userInfo).length
        } users`
      );
      logger.log(
        `UserInfoManager: User IDs in memory: ${Object.keys(userInfo).join(
          ", "
        )}`
      );
      return true;
    } catch (jsonError) {
      logger.error(
        `UserInfoManager: Failed to parse JSON from file: ${jsonError.message}`
      );
      return false;
    }
  } catch (error) {
    logger.error("UserInfoManager: Error reloading user info:", error);
    return false;
  }
};

/**
 * Initializes the user info manager by loading data from file
 */
const initialize = () => {
  try {
    logger.log(
      `UserInfoManager: Initializing with file path: ${USER_INFO_FILE}`
    );

    // Make sure the file and directory exist
    ensureFileExists();

    // Load user info from file
    const data = fs.readFileSync(USER_INFO_FILE, "utf8");
    logger.log(`UserInfoManager: Loaded file content: ${data}`);

    if (data.trim() === "") {
      logger.log(
        "UserInfoManager: File is empty, initializing with empty object"
      );
      userInfo = {};
      // Save empty object to file to ensure it's properly formatted
      saveUserInfo();
    } else {
      try {
        userInfo = JSON.parse(data);
        logger.log(
          `Loaded user info for ${Object.keys(userInfo).length} users`
        );
        logger.log(
          `UserInfoManager: User IDs in memory: ${Object.keys(userInfo).join(
            ", "
          )}`
        );
      } catch (jsonError) {
        logger.error(
          `Failed to parse JSON from user info file: ${jsonError.message}`
        );
        userInfo = {};
        // Save empty object to file to reset corrupt data
        saveUserInfo();
        logger.log("UserInfoManager: Reset file due to JSON parsing error");
      }
    }

    return true;
  } catch (error) {
    logger.error(`Error initializing user info manager: ${error.message}`);
    logger.error(error.stack);

    // Try to recover by creating a new empty file
    try {
      userInfo = {};
      ensureFileExists();
      saveUserInfo();
      logger.log("UserInfoManager: Created new file after error");
      return true;
    } catch (saveError) {
      logger.error(
        `UserInfoManager: Could not recover from error: ${saveError.message}`
      );
      return false;
    }
  }
};

/**
 * Saves the current user info to file
 */
const saveUserInfo = () => {
  try {
    logger.log(`UserInfoManager: Saving user info to ${USER_INFO_FILE}`);
    logger.log(`UserInfoManager: Data to save: ${JSON.stringify(userInfo)}`);

    // Ensure directory exists
    const dataDir = path.dirname(USER_INFO_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      logger.log(`Created data directory: ${dataDir}`);
    }

    // Format the JSON with indentation for readability
    const jsonData = JSON.stringify(userInfo, null, 2);

    // Use fs.writeFileSync with explicit encoding
    fs.writeFileSync(USER_INFO_FILE, jsonData, { encoding: "utf8" });

    // Double-check the file content by reading it back
    const savedData = fs.readFileSync(USER_INFO_FILE, "utf8");
    logger.log(`UserInfoManager: Verification - file contains: ${savedData}`);

    // Verify the file was actually written
    if (fs.existsSync(USER_INFO_FILE)) {
      const stats = fs.statSync(USER_INFO_FILE);
      logger.log(
        `UserInfoManager: File saved successfully, size: ${stats.size} bytes`
      );

      if (stats.size === 0 || stats.size === 2) {
        // If file is empty or just "{}"
        logger.error(
          "UserInfoManager: WARNING! File appears to be empty or just '{}' after save"
        );
      }
    } else {
      logger.error("UserInfoManager: File doesn't exist after save attempt!");
    }

    return true;
  } catch (error) {
    logger.error("Error saving user info:", error);
    logger.error(error.stack); // Log the stack trace
    return false;
  }
};

/**
 * Gets user info for a specific user
 * @param {string} userId Discord user ID
 * @returns {object|null} User info object or null if not found
 */
const getUserInfo = (userId) => {
  logger.log(`UserInfoManager: Getting info for user ID: "${userId}"`);
  logger.log(
    `UserInfoManager: Available user IDs: ${Object.keys(userInfo).join(", ")}`
  );

  if (!userId) {
    logger.error(
      "UserInfoManager: getUserInfo called with null or undefined userId"
    );
    return null;
  }

  // Ensure userId is treated as a string for comparison
  const userIdStr = String(userId);
  const result = userInfo[userIdStr];

  if (result) {
    logger.log(
      `UserInfoManager: Found info for user ${userIdStr}: ${JSON.stringify(
        result
      )}`
    );
  } else {
    logger.log(`UserInfoManager: No info found for user ${userIdStr}`);

    // Check if the issue might be a string vs number mismatch
    const numericId = parseInt(userId, 10);
    if (!isNaN(numericId) && userInfo[numericId]) {
      logger.log(
        `UserInfoManager: Found info using numeric ID ${numericId} instead of string ID`
      );
      return userInfo[numericId];
    }
  }

  return result || null;
};

/**
 * Checks if a user has completed their information profile
 * @param {string} userId Discord user ID
 * @returns {boolean} True if all required fields are filled
 */
const isUserInfoComplete = (userId) => {
  logger.log(`UserInfoManager: Checking if user ${userId} info is complete`);

  if (!userId) {
    logger.error(
      "UserInfoManager: isUserInfoComplete called with null or undefined userId"
    );
    return false;
  }

  // Ensure userId is treated as a string
  const userIdStr = String(userId);
  const info = getUserInfo(userIdStr);

  if (!info) {
    logger.log(`UserInfoManager: User ${userIdStr} has no info record`);
    return false;
  }

  const hasAllFields = REQUIRED_FIELDS.every((field) => info[field]);
  logger.log(
    `UserInfoManager: User ${userIdStr} info complete? ${hasAllFields}`
  );
  return hasAllFields;
};

/**
 * Gets the list of missing fields for a user
 * @param {string} userId Discord user ID
 * @returns {Array<string>} Array of missing field names
 */
const getMissingFields = (userId) => {
  const info = getUserInfo(userId);
  if (!info) return REQUIRED_FIELDS;

  const missingFields = REQUIRED_FIELDS.filter((field) => !info[field]);
  logger.log(
    `UserInfoManager: User ${userId} missing fields: ${missingFields.join(
      ", "
    )}`
  );
  return missingFields;
};

/**
 * Sets a specific field for a user
 * @param {string} userId Discord user ID
 * @param {string} field Field name
 * @param {string} value Field value
 * @returns {boolean} True if successful
 */
const setUserField = (userId, field, value) => {
  try {
    logger.log(
      `UserInfoManager: Setting field ${field}=${value} for user ${userId}`
    );

    if (!userInfo[userId]) {
      logger.log(`UserInfoManager: Creating new record for user ${userId}`);
      userInfo[userId] = {};
    }

    userInfo[userId][field] = value;
    logger.log(
      `UserInfoManager: Updated user data: ${JSON.stringify(userInfo[userId])}`
    );

    const saveResult = saveUserInfo();
    logger.log(`UserInfoManager: Save result: ${saveResult}`);

    return saveResult;
  } catch (error) {
    logger.error(`Error setting user field ${field} for ${userId}:`, error);
    return false;
  }
};

/**
 * Gets all the required fields that users need to provide
 * @returns {Array<string>} Array of required field names
 */
const getRequiredFields = () => {
  return [...REQUIRED_FIELDS];
};

/**
 * Adds a new required field (for future extensibility)
 * @param {string} fieldName Name of the new required field
 * @returns {boolean} True if successful
 */
const addRequiredField = (fieldName) => {
  if (REQUIRED_FIELDS.includes(fieldName)) {
    return false;
  }

  REQUIRED_FIELDS.push(fieldName);
  return true;
};

// Export functions
module.exports = {
  initialize,
  getUserInfo,
  isUserInfoComplete,
  getMissingFields,
  setUserField,
  getRequiredFields,
  addRequiredField,
  saveUserInfo,
  reloadUserInfo,
  ensureFileExists, // Export the new function
};
