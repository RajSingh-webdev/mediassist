import express from "express";
import cors from "cors";
import morgan from "morgan";
import { env } from "./config/env.js";
import apiRoutes from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";

const app = express();
const port = env.port;

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.use(apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`MediAssist backend running on http://localhost:${port}`);
});
