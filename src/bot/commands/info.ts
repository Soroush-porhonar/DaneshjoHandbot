import { ABOUT_TEXT, HELP_TEXT, MAIN_MENU, START_TEXT } from "../../messages.js";
import type { CommandHandler } from "./types.js";

// /start and /help (re)send the main menu keyboard at the bottom of the chat.
export const startCommand: CommandHandler = async () => ({
  text: START_TEXT,
  markup: { keyboard: MAIN_MENU },
});
export const helpCommand: CommandHandler = async () => ({
  text: HELP_TEXT,
  markup: { keyboard: MAIN_MENU },
});
export const aboutCommand: CommandHandler = async () => ABOUT_TEXT;
