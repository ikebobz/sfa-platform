import { NextFunction, Request, RequestHandler, Response } from "express";
import { ApiError } from "./api-error";

/** Wraps an async Express handler so thrown errors reach the error middleware. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ statusCode: 404, message: `Route not found: ${req.method} ${req.path}` });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      statusCode: err.statusCode,
      message: err.message,
      errors: err.errors,
    });
  }

  // eslint-disable-next-line no-console
  console.error("Unhandled error:", err);
  return res.status(500).json({ statusCode: 500, message: "Internal server error" });
}
