import { prisma } from '../lib/prisma.js';
import cloudinary from '../utils/cloudinary.js';
import { ApiError } from '../utils/ApiError.js';
import { Readable } from 'stream';
import sharp from 'sharp';

export class AnalysisService {
  static async processUpload(file: Express.Multer.File) {
    const score = Math.floor(Math.random() * 101);
    const isAIGenerated = score > 60;

    try {
      let processBuffer = file.buffer;

      if (file.mimetype.startsWith('image/')) {
        console.log('Image detected: Compressing locally with Sharp...');
        processBuffer = await sharp(file.buffer)
          .resize({ width: 1280, height: 720, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();
      } else if (file.mimetype.startsWith('video/')) {
        console.log('Video detected: Offloading compression to Cloudinary...');
      }

      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'veritywave_test',
            resource_type: 'auto', // Detects image vs video automatically
            transformation: [
              { quality: 'auto', fetch_format: 'auto' }, // Cloudinary's best compression logic
              { width: 1280, height: 720, crop: 'limit' }
            ]
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );

        // Convert buffer to stream and pipe to cloudinary
        const readableStream = new Readable();
        readableStream.push(processBuffer);
        readableStream.push(null);
        readableStream.pipe(uploadStream);
      });

      const { secure_url } = uploadResult as any;

      return await prisma.analysis.create({
        data: {
          fileName: file.originalname,
          fileType: file.mimetype,
          score,
          isAIGenerated,
          filePath: secure_url // Store the secure URL from Cloudinary
        }
      });
    } catch (error: any) {
      console.error('[Cloudinary Upload Error]:', error);
      throw new ApiError(500, 'Media upload and optimization failed');
    }
  }

  static async getAllHistory() {
    return await prisma.analysis.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }
}
