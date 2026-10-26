export interface CommandContext {
  chatId: number;
  userId: number;
  /** Whitespace-separated arguments following the command name. */
  args: string[];
}

/** A command returns the reply text to send back to the user. */
export type CommandHandler = (context: CommandContext) => Promise<string>;
