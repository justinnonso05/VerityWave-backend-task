export class ApiResponse {
  static success(message: string, data: any = []) {
    return {
      success: true,
      message,
      data: Array.isArray(data) ? data : [data]
    };
  }

  static error(message: string, data: any = []) {
    return {
      success: false,
      message,
      data: Array.isArray(data) ? data : [data]
    };
  }
}
