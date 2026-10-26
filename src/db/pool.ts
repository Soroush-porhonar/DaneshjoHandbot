import { Pool } from "pg";
import { config } from "../config.js";
import { logger } from "../logger.js";

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
});

pool.on("error", (error) => {
  logger.error("Unexpected PostgreSQL pool error:", error);
});
