export class ApiError extends Error {
  statusCode: number;
  data: any[];
  success: boolean;

  constructor(statusCode: number, message: string, data: any = []) {
    super(message);
    this.statusCode = statusCode;
    this.message = message;
    this.data = Array.isArray(data) ? data : [data];
    this.success = false;

    Error.captureStackTrace(this, this.constructor);
  }
}
