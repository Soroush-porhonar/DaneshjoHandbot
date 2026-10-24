import "dotenv/config";

const getEnv = (key: string): string => {
  const value = process.env[key];

  if (!value) {
    throw new Error(`${key} is not defined`);
  }

  return value;
};

export const PORT = getEnv("PORT");
export const BALE_TOKEN = getEnv("BALE_TOKEN");
export const LLM_URL = getEnv("LLM_URL");
export const DATABASE_URL = getEnv("DATABASE_URL");
export const LLM_MODEL = getEnv("LLM_MODEL");
export const EMBEDDING_MODEL = getEnv("EMBEDDING_MODEL");
export const POSTGRES_PASSWORD = getEnv("POSTGRES_PASSWORD");
export const POSTGRES_DB = getEnv("POSTGRES_DB");
export const POSTGRES_USER = getEnv("POSTGRES_USER");
