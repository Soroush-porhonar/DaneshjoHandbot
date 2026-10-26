import express from "express";
import { startPolling } from "./bot/poller.js";
import { config } from "./config.js";
import { logger } from "./logger.js";

const app = express();

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "daneshjohandbot",
  });
});

app.listen(config.port, () => {
  logger.info(`Server listening on port ${config.port}`);
});

void startPolling();
