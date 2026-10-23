import "dotenv/config";

const getEnv = (key: string): string => {
  const value = process.env[key];

  if (!value) {
    throw new Error(`${key} is not defined`);
  }

  return value;
};

const PORT = getEnv("PORT");
const BALE_TOKEN = getEnv("BALE_TOKEN");
const LLM_URL = getEnv("LLM_URL");
const DATABASE_URL = getEnv("DATABASE_URL");
const LLM_MODEL = getEnv("LLM_MODEL");
const EMBEDDING_MODEL = getEnv("EMBEDDING_MODEL");

export { BALE_TOKEN, PORT, LLM_URL, DATABASE_URL, LLM_MODEL, EMBEDDING_MODEL };
