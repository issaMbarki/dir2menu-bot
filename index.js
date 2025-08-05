require('dotenv').config();
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const path = require("path");

const TOKEN = process.env.BOT_TOKEN;
const bot = new TelegramBot(TOKEN, { polling: true });

// Base directory to serve files from
const BASE_DIR = path.resolve(process.env.BASE_DIR);

// Helper to list directory contents
function listDir(dirPath) {
  return fs.readdirSync(dirPath, { withFileTypes: true }).map((dirent) => ({
    name: dirent.name,
    isDir: dirent.isDirectory(),
  }));
}

// Send a menu with folder/file buttons
function sendMenu(chatId, currentPath) {
  const absPath = path.join(BASE_DIR, currentPath);

  // Safety check to avoid going above BASE_DIR
  if (!absPath.startsWith(BASE_DIR)) {
    return bot.sendMessage(chatId, "Access denied.");
  }

  const items = listDir(absPath);

  const buttons = items.map((item) => {
    // Encode path relative to BASE_DIR
    const itemPath = path.join(currentPath, item.name);
    return [
      {
        text: item.isDir ? `📁 ${item.name}` : `📄 ${item.name}`,
        callback_data: item.isDir ? `DIR:${itemPath}` : `FILE:${itemPath}`,
      },
    ];
  });

  // Add back button if not root
  if (currentPath) {
    const parent = path.dirname(currentPath);
    buttons.unshift([
      {
        text: "⬅️ Back",
        callback_data: `DIR:${parent === "." ? "" : parent}`,
      },
    ]);
  }

  bot.sendMessage(chatId, "Select an item:", {
    reply_markup: { inline_keyboard: buttons },
  });
}

// Start command
bot.onText(/\/start/, (msg) => {
  sendMenu(msg.chat.id, "");
});

// Handle button presses
bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data.startsWith("DIR:")) {
    const dirPath = data.substring(4);
    sendMenu(chatId, dirPath);
  } else if (data.startsWith("FILE:")) {
    const filePath = data.substring(5);
    const absPath = path.join(BASE_DIR, filePath);

    // Safety check
    if (!absPath.startsWith(BASE_DIR)) {
      return bot.answerCallbackQuery(query.id, {
        text: "Access denied.",
        show_alert: true,
      });
    }

    bot.sendDocument(chatId, absPath).catch((err) => {
      bot.answerCallbackQuery(query.id, {
        text: "Failed to send file.",
        show_alert: true,
      });
    });
  }

  // Acknowledge the callback query to remove the loading state
  bot.answerCallbackQuery(query.id);
});
