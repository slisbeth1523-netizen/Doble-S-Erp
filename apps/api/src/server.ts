import { createApp } from "./app.js";
import { config } from "./shared/config/config.js";

const app = createApp();

app.listen(config.apiPort, () => {
  console.log(`Doble S ERP API listening on port ${config.apiPort}`);
});
