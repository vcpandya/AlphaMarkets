import { Request, Response, NextFunction } from "express";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error("[ErrorHandler]", err.message);
  if (err.stack) {
    console.error(err.stack);
  }

  const statusCode = (err as any).statusCode || 500;
  res.status(statusCode).json({
    error: err.message || "Internal server error",
  });
}
