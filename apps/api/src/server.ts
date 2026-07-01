import { createApp } from "./app.js";
import { env } from "./config/env.js";

const app = createApp();

app.listen(env.apiPort, () => {
  console.log(`Doble S ERP API listening on port ${env.apiPort}`);
});

