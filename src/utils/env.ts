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
const GREETING_TEXT = getEnv("GREETING_TEXT");

export { BALE_TOKEN, PORT, GREETING_TEXT };
