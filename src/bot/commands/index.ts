import {
  cancelDeleteCommand,
  confirmDeleteCommand,
  deleteCommand,
  documentsCommand,
  selectCommand,
} from "./documents.js";
import { aboutCommand, helpCommand, startCommand } from "./info.js";
import type { CommandContext, CommandHandler } from "./types.js";

const COMMANDS: Record<string, CommandHandler> = {
  "/start": startCommand,
  "/help": helpCommand,
  "/about": aboutCommand,
  "/documents": documentsCommand,
  "/select": selectCommand,
  "/delete": deleteCommand,
  "/confirm_delete": confirmDeleteCommand,
  "/cancel_delete": cancelDeleteCommand,
};

export interface ParsedCommand {
  handler: CommandHandler;
  args: string[];
}

/** Returns the matching command for a message, or null for plain text. */
export function parseCommand(text: string): ParsedCommand | null {
  const [name, ...args] = text.trim().split(/\s+/);
  const handler =
    name && Object.hasOwn(COMMANDS, name) ? COMMANDS[name] : undefined;

  return handler ? { handler, args } : null;
}

export type { CommandContext };
