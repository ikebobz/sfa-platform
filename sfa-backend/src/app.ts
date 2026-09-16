import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./common/http";

import { authRouter } from "./modules/auth/auth.routes";
import { usersRouter } from "./modules/users/users.routes";
import { territoriesRouter } from "./modules/territories/territories.routes";
import { productsRouter } from "./modules/products/products.routes";
import { customersRouter } from "./modules/customers/customers.routes";
import { visitPlansRouter } from "./modules/visit-plans/visit-plans.routes";
import { visitLogsRouter } from "./modules/visit-logs/visit-logs.routes";
import { salesRouter } from "./modules/sales/sales.routes";
import { ledgerRouter } from "./modules/ledger/ledger.routes";
import { expensesRouter } from "./modules/expenses/expenses.routes";
import { stockRouter } from "./modules/stock/stock.routes";
import { incentivesRouter } from "./modules/incentives/incentives.routes";
import { invoicesRouter } from "./modules/invoices/invoices.routes";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json({ limit: "5mb" }));
  app.use(morgan(env.nodeEnv === "development" ? "dev" : "combined"));

  app.get("/health", (_req, res) => res.json({ status: "ok", env: env.nodeEnv }));

  const api = express.Router();
  api.use("/auth", authRouter);
  api.use("/users", usersRouter);
  api.use("/territories", territoriesRouter);
  api.use("/products", productsRouter);
  api.use("/customers", customersRouter);
  api.use("/visit-plans", visitPlansRouter);
  api.use("/visit-logs", visitLogsRouter);
  api.use("/sales", salesRouter);
  api.use("/ledger", ledgerRouter);
  api.use("/expenses", expensesRouter);
  api.use("/stock", stockRouter);
  api.use("/incentives", incentivesRouter);
  api.use("/invoices", invoicesRouter);
  api.use("/dashboard", dashboardRouter);

  app.use("/api/v1", api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
