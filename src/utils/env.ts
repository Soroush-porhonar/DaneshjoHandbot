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

export { BALE_TOKEN, PORT };
