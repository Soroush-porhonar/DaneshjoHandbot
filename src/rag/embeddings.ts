import { embed } from "../llm/ollamaClient.js";

export async function generateEmbedding(text: string): Promise<number[]> {
  const [embedding] = await embed([text]);

  if (!embedding) {
    throw new Error("Ollama returned no embedding.");
  }

  return embedding;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  return embed(texts);
}
