// main.js - Main entry point for the Discord Bot

const fs = require("fs");
const path = require("path");
const config = require("./config"); // Ensure config is loaded first
const logger = require("./src/logger"); // Then logger
const { client, login: discordLogin } = require("./src/discordClient");
const historyManager = require("./src/utils/historyManager"); // For shutdown hook

// --- Graceful Shutdown ---
const shutdown = (signal) => {
  logger.log(`Received ${signal}. Shutting down gracefully...`);
  historyManager.stopPeriodicSave(); // Stop interval timer
  logger.log("Attempting to save final history...");
  historyManager.saveHistory(); // Ensure history is saved before exiting

  if (client && client.isReady()) {
    logger.log("Destroying Discord client...");
    client.destroy();
  }
  logger.log("Shutdown complete. Exiting.");
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT")); // Ctrl+C
process.on("SIGTERM", () => shutdown("SIGTERM")); // Termination signal
process.on("uncaughtException", (err, origin) => {
  logger.error("----------------------------------------");
  logger.error("UNCAUGHT EXCEPTION!");
  logger.error("----------------------------------------");
  logger.error("Error:", err);
  logger.error("Origin:", origin);
  logger.error("----------------------------------------");
  logger.error("Attempting to save history before crashing...");
  historyManager.saveHistory();
  // No client.destroy() here as it might be part of the issue or cause further errors.
  // Let the process exit naturally or be handled by a process manager.
  process.exit(1); // Exit with failure code
});
process.on("unhandledRejection", (reason, promise) => {
  logger.error("----------------------------------------");
  logger.error("UNHANDLED REJECTION!");
  logger.error("----------------------------------------");
  logger.error("Reason:", reason);
  logger.error("Promise:", promise);
  logger.error("----------------------------------------");
  // No history save or exit here, as it might be a non-fatal issue.
  // Log it for debugging.
});

// --- Register Event Handlers ---
const eventsPath = path.join(__dirname, "src", "eventHandlers");
try {
  const eventFiles = fs
    .readdirSync(eventsPath)
    .filter((file) => file.endsWith(".js"));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client)); // Pass client to execute
      logger.debug(
        `Registered 'once' event handler: ${event.name} from ${file}`
      );
    } else {
      client.on(event.name, (...args) => event.execute(...args, client)); // Pass client to execute
      logger.debug(`Registered 'on' event handler: ${event.name} from ${file}`);
    }
  }
  logger.log("All event handlers registered.");
} catch (error) {
  logger.error("Error registering event handlers:", error);
  process.exit(1);
}

// --- Start the Bot ---
logger.log("Starting bot...");
discordLogin(); // This will attempt to log in to Discord

// Basic check for .env file existence to guide user
if (!fs.existsSync(path.join(__dirname, ".env"))) {
  logger.warn(
    "--------------------------------------------------------------------"
  );
  logger.warn(
    "IMPORTANT: The .env file was not found in the project root directory."
  );
  logger.warn(
    "Please create a .env file with your bot token and other configurations."
  );
  logger.warn("Example .env content:");
  logger.warn("DISCORD_TOKEN=your_discord_bot_token_here");
  logger.warn("OLLAMA_MODEL=your_ollama_model_name");
  logger.warn("# AI_SERVICE=OLLAMA (or GEMINI)");
  logger.warn("# DEBUG_MODE=true");
  logger.warn(
    "--------------------------------------------------------------------"
  );
}

logger.log(
  "Main script execution finished. Bot is running if login was successful."
);
