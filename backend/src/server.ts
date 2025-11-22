import express from "express";
import cors from "cors";
import pino from "pino";
import decodeRouter from "./routes/decode.js";
import riskRouter from "./routes/risk.js";
import explainRouter from "./routes/explain.js";

const app = express();
const logger = pino({ level: process.env.LOG_LEVEL || "info" });

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use((req, _res, next) => {
  logger.info({ path: req.path, method: req.method }, "incoming request");
  next();
});

app.use("/decode", decodeRouter);
app.use("/risk", riskRouter);
app.use("/explain", explainRouter);

const port = Number(process.env.PORT || 4000);

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    logger.info(`Backend listening on :${port}`);
  });
}

export default app;
