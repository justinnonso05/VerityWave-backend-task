import { prisma } from '../lib/prisma.js';
import cloudinary from '../utils/cloudinary.js';
import { ApiError } from '../utils/ApiError.js';
import { Readable } from 'stream';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

export class AnalysisService {
  static async processUpload(file: Express.Multer.File) {
    const score = Math.floor(Math.random() * 101);
    const isAIGenerated = score > 60;

    try {
      let finalFilePath = '';

      if (file.mimetype.startsWith('image/')) {
        console.log('Image detected: Compressing locally with Sharp...');
        const processBuffer = await sharp(file.buffer)
          .resize({ width: 1280, height: 720, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();
          
        // Store optimized image in local uploads folder
        const uploadDir = path.join(process.cwd(), 'uploads', 'compressed');
        await fs.mkdir(uploadDir, { recursive: true });
        
        const safeFileName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const localFilePath = path.join(uploadDir, safeFileName);
        await fs.writeFile(localFilePath, processBuffer);
        console.log(`Saved optimized image locally to: ${localFilePath}`);
        
        finalFilePath = `/uploads/compressed/${safeFileName}`;
      } else if (file.mimetype.startsWith('video/')) {
        console.log('Video detected: Offloading compression to Cloudinary...');

        const uploadResult = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: 'veritywave_test',
              resource_type: 'video', // Only handling videos with Cloudinary now
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
          readableStream.push(file.buffer);
          readableStream.push(null);
          readableStream.pipe(uploadStream);
        });

        finalFilePath = (uploadResult as any).secure_url;
        console.log(`Successfully optimized and uploaded video to Cloudinary: ${finalFilePath}`);
      }

      return await prisma.analysis.create({
        data: {
          fileName: file.originalname,
          fileType: file.mimetype,
          score,
          isAIGenerated,
          filePath: finalFilePath
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
