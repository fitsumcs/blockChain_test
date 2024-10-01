import express from "express";

import { initializeDatabase } from "./db/database";
import { processBlock } from "./controllers/blockController";
import { getBalance } from "./controllers/balanceController";
import { rollbackToHeight } from "./controllers/rollbackController";

const app = express();
app.use(express.json());

app.post("/blocks", processBlock);
app.get("/balance/:address", getBalance);
app.post("/rollback", rollbackToHeight);

await initializeDatabase();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

export default app;
