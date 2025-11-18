import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Backblaze B2 Service
 * Uses S3-compatible API to store and retrieve data files
 */
export class BackblazeService {
  private client: S3Client | null = null;
  private bucketName: string;
  private enabled: boolean;

  constructor() {
    const keyId = process.env.BACKBLAZE_KEY_ID;
    const applicationKey = process.env.BACKBLAZE_APPLICATION_KEY;
    const bucketName = process.env.BACKBLAZE_BUCKET_NAME;
    const endpoint = process.env.BACKBLAZE_ENDPOINT || 'https://s3.us-west-004.backblazeb2.com';

    this.enabled = !!(keyId && applicationKey && bucketName);
    this.bucketName = bucketName || '';

    if (this.enabled) {
      // Extract region from endpoint (e.g., "us-west-004" from "https://s3.us-west-004.backblazeb2.com")
      const regionMatch = endpoint.match(/s3\.([^.]+)\.backblazeb2\.com/);
      const region = regionMatch ? regionMatch[1] : 'us-west-004';
      
      this.client = new S3Client({
        endpoint,
        region,
        credentials: {
          accessKeyId: keyId!,
          secretAccessKey: applicationKey!,
        },
      });
      logger.info('Backblaze B2 service initialized', { bucketName, endpoint, region });
    } else {
      logger.warn('Backblaze B2 not configured - will fall back to ESPN API');
    }
  }

  /**
   * Upload a file to Backblaze B2
   * @param localPath - Local file path
   * @param remotePath - Remote path in bucket (e.g., 'teams/teams.json' or 'rosters/basketball/nba/123.json')
   */
  async uploadFile(localPath: string, remotePath: string): Promise<boolean> {
    if (!this.enabled || !this.client) {
      logger.warn('Backblaze not enabled, skipping upload', { localPath, remotePath });
      return false;
    }

    try {
      if (!fs.existsSync(localPath)) {
        logger.error('Local file does not exist', { localPath });
        return false;
      }

      const fileContent = fs.readFileSync(localPath);
      const contentType = this.getContentType(localPath);

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: remotePath,
        Body: fileContent,
        ContentType: contentType,
      });

      await this.client.send(command);
      logger.info('File uploaded to Backblaze', { localPath, remotePath });
      return true;
    } catch (error: any) {
      logger.error('Error uploading file to Backblaze', { 
        error: error.message, 
        localPath, 
        remotePath 
      });
      return false;
    }
  }

  /**
   * Download a file from Backblaze B2
   * @param remotePath - Remote path in bucket
   * @param localPath - Optional local path to save to. If not provided, returns the content as buffer
   */
  async downloadFile(remotePath: string, localPath?: string): Promise<Buffer | null> {
    if (!this.enabled || !this.client) {
      logger.warn('Backblaze not enabled, cannot download', { remotePath });
      return null;
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: remotePath,
      });

      const response = await this.client.send(command);
      
      if (!response.Body) {
        logger.warn('No content in Backblaze response', { remotePath });
        return null;
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      // Save to local path if provided
      if (localPath) {
        const dir = path.dirname(localPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(localPath, buffer);
        logger.info('File downloaded from Backblaze', { remotePath, localPath });
      }

      return buffer;
    } catch (error: any) {
      if (error.name === 'NoSuchKey') {
        logger.info('File not found in Backblaze', { remotePath });
      } else {
        logger.error('Error downloading file from Backblaze', { 
          error: error.message, 
          remotePath 
        });
      }
      return null;
    }
  }

  /**
   * Get file content as JSON from Backblaze
   */
  async getFileAsJson<T = any>(remotePath: string): Promise<T | null> {
    const buffer = await this.downloadFile(remotePath);
    if (!buffer) {
      return null;
    }

    try {
      return JSON.parse(buffer.toString('utf-8'));
    } catch (error: any) {
      logger.error('Error parsing JSON from Backblaze', { 
        error: error.message, 
        remotePath 
      });
      return null;
    }
  }

  /**
   * Check if a file exists in Backblaze
   */
  async fileExists(remotePath: string): Promise<boolean> {
    const buffer = await this.downloadFile(remotePath);
    return buffer !== null;
  }

  /**
   * Get content type based on file extension
   */
  private getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
    };
    return contentTypes[ext] || 'application/octet-stream';
  }
}

// Singleton instance
export const backblazeService = new BackblazeService();

