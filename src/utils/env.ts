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

export { BALE_TOKEN, PORT, LLM_URL, DATABASE_URL };
