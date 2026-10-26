import { ABOUT_TEXT, HELP_TEXT, START_TEXT } from "../messages.js";
import type { CommandHandler } from "./types.js";

export const startCommand: CommandHandler = async () => START_TEXT;
export const helpCommand: CommandHandler = async () => HELP_TEXT;
export const aboutCommand: CommandHandler = async () => ABOUT_TEXT;
