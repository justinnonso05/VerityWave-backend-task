import type { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../utils/ApiResponse.js';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // If it's a Multer error or our custom rejection message
  if (err.message && err.message.includes('Reject:')) {
    statusCode = 400;
  }

  console.error(`[Error] ${statusCode} - ${message}`);

  return res.status(statusCode).json(
    ApiResponse.error(message)
  );
};
