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

    let finalFilePath = 'skipped_or_failed_upload';

    const safeFileName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.]/g, '_')}`;

    if (file.mimetype.startsWith('image/')) {
      const uploadDir = path.join(process.cwd(), 'uploads', 'compressed');
      
      try {
        await fs.mkdir(uploadDir, { recursive: true });
      } catch (err) {
        console.error('Failed to create upload directory:', err);
      }

      const localFilePath = path.join(uploadDir, safeFileName);

      try {
        console.log('Image detected: Compressing locally with Sharp...');
        const processBuffer = await sharp(file.buffer)
          .resize({ width: 1280, height: 720, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();
          
        await fs.writeFile(localFilePath, processBuffer);
        console.log(`Saved optimized image locally to: ${localFilePath}`);
        finalFilePath = `/uploads/compressed/${safeFileName}`;
      } catch (sharpError) {
        console.error('[Sharp Compression Error]:', sharpError);
        console.log('Falling back to saving raw, uncompressed image...');
        
        try {
          await fs.writeFile(localFilePath, file.buffer);
          console.log(`Saved RAW image locally to: ${localFilePath}`);
          finalFilePath = `/uploads/compressed/${safeFileName}`;
        } catch (writeError) {
          console.error('[FS Write Error on Fallback]:', writeError);
          finalFilePath = 'local_file_write_failed';
        }
      }
    } else if (file.mimetype.startsWith('video/')) {
      console.log('Video detected: Offloading compression to Cloudinary...');

      try {
        const uploadResult = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: 'veritywave_test',
              resource_type: 'video',
              transformation: [
                { quality: 'auto', fetch_format: 'auto' },
                { width: 1280, height: 720, crop: 'limit' }
              ]
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );

          const readableStream = new Readable();
          readableStream.push(file.buffer);
          readableStream.push(null);
          readableStream.pipe(uploadStream);
        });

        finalFilePath = (uploadResult as any).secure_url;
        console.log(`Successfully optimized and uploaded video to Cloudinary: ${finalFilePath}`);
      } catch (cloudinaryError) {
        console.error('[Cloudinary Upload Error]:', cloudinaryError);
        console.log('Video upload failed. Proceeding with analysis only (skipping upload)...');
        finalFilePath = 'cloudinary_upload_failed';
      }
    }

    try {
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
      console.error('[Database Error]:', error);
      throw new ApiError(500, 'Failed to save analysis to database');
    }
  }

  static async getAllHistory() {
    return await prisma.analysis.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }
}
