const projectName: string = "Bale Study Assistant";

console.log(`Starting ${projectName}...`);

import Express = require("express");
import "dotenv/config";

const app = Express();

app.get("/health", (req, res) => {
  res.json({ message: "hey" });
});

app.listen(process.env.PORT, () => {
  console.log(`Server listening on port ${process.env.PORT}`);
});
