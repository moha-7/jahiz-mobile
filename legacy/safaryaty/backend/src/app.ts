import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import path from "path";
import { env } from "./config/env.js";
import authRoutes from "./modules/auth/auth.routes.js";
import tripRoutes from "./modules/trips/trips.routes.js";
import itemRoutes from "./modules/trips/items.routes.js";
import suggestionRoutes from "./modules/suggestions/suggestions.routes.js";
import userRoutes from "./modules/users/users.routes.js";
import fxRoutes from "./modules/fx/fx.routes.js";
import externalRoutes from "./modules/external/external.routes.js";
import recommendationRoutes from "./modules/recommendations/recommendation.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import { ok } from "./utils/response.js";
import { databaseProvider, prisma } from "./lib/prisma.js";

export const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
const allowedOrigins = new Set(
  env.NODE_ENV === "production"
    ? [env.APP_ORIGIN]
    : [env.APP_ORIGIN, "http://127.0.0.1:5173", "http://localhost:5173"]
);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true
}));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(morgan("dev"));
app.use("/uploads", express.static(path.join(process.cwd(), env.UPLOAD_DIR)));

app.get("/", (_req, res) => res.json(ok({ service: "safaryaty-backend", version: "4.29.52.1", docs: "/api/health" })));
app.get("/api/health", (_req, res) => res.json(ok({ service: "safaryaty-backend", version: "4.29.52.1", databaseProvider })));
app.get("/api/health/database", async (_req, res, next) => {
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    res.json(ok({ service: "safaryaty-backend", version: "4.29.52.1", databaseProvider, database: "reachable" }));
  } catch (error) {
    next(error);
  }
});
app.use("/api/fx", fxRoutes);
app.use("/api/external", externalRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api", itemRoutes);
app.use("/api", suggestionRoutes);
app.use("/api", recommendationRoutes);
app.use("/api/users", userRoutes);

app.use(notFound);
app.use(errorHandler);
