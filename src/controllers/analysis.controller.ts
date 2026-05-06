import type { Request, Response } from 'express';
import { AnalysisService } from '../services/analysis.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

export class AnalysisController {
  static async analyze(req: Request, res: Response) {
    try {
      if (!req.file) {
        throw new ApiError(400, 'Missing input: No image or video file provided.');
      }

      const result = await AnalysisService.processUpload(req.file);
      
      return res.status(200).json(
        ApiResponse.success('File analyzed successfully', [result])
      );
    } catch (error: any) {
      const statusCode = error instanceof ApiError ? error.statusCode : 500;
      return res.status(statusCode).json(
        ApiResponse.error(error.message || 'An error occurred during file processing')
      );
    }
  }

  static async getHistory(req: Request, res: Response) {
    try {
      const history = await AnalysisService.getAllHistory();
      
      const message = history.length > 0 
        ? 'History retrieved successfully' 
        : 'No analysis history found';

      return res.status(200).json(
        ApiResponse.success(message, history)
      );
    } catch (error: any) {
      return res.status(500).json(
        ApiResponse.error('Failed to retrieve analysis history')
      );
    }
  }
}
