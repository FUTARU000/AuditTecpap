import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';

/**
 * MinIO (S3-compatible) object storage. Bytes live in MinIO; the database stores
 * metadata + the object key only.
 *
 * Two endpoints:
 *   • MINIO_ENDPOINT        — used for server I/O (put/get/delete) inside the
 *                             Docker network (e.g. http://minio:9000).
 *   • MINIO_PUBLIC_ENDPOINT — used ONLY to mint presigned URLs handed to the
 *                             browser. Must be reachable from the user's machine
 *                             (e.g. http://localhost:9000); never the internal
 *                             Docker hostname, or downloads/preview break.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: MinioClient;
  private readonly presignClient: MinioClient;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    const internal = config.get<string>('MINIO_ENDPOINT') ?? 'http://localhost:9000';
    this.client = this.buildClient(config, internal);
    this.bucket = config.get<string>('MINIO_BUCKET_DOCUMENTS') ?? 'tecpap-documents';
    const publicEndpoint = config.get<string>('MINIO_PUBLIC_ENDPOINT') ?? internal;
    this.presignClient = publicEndpoint === internal ? this.client : this.buildClient(config, publicEndpoint);
  }

  private buildClient(config: ConfigService, endpoint: string): MinioClient {
    const url = new URL(endpoint);
    return new MinioClient({
      endPoint: url.hostname,
      port: url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80,
      useSSL: url.protocol === 'https:',
      accessKey: config.get<string>('MINIO_ACCESS_KEY') ?? '',
      secretKey: config.get<string>('MINIO_SECRET_KEY') ?? '',
      region: config.get<string>('MINIO_REGION') ?? 'us-east-1',
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        this.logger.log(`Created storage bucket "${this.bucket}"`);
      }
    } catch (error) {
      this.logger.error(`Storage initialization failed: ${(error as Error).message}`);
    }
  }

  getBucket(): string {
    return this.bucket;
  }

  /** Upload a buffer under `key`. Returns the stored object key. */
  async putObject(key: string, data: Buffer, mimeType: string): Promise<string> {
    await this.client.putObject(this.bucket, key, data, data.length, { 'Content-Type': mimeType });
    return key;
  }

  /** Read an object back into memory as a Buffer (used by the import pipeline). */
  async getObject(key: string): Promise<Buffer> {
    const stream = await this.client.getObject(this.bucket, key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
    }
    return Buffer.concat(chunks);
  }

  /** Short-lived presigned GET URL for a browser — uses the public endpoint. */
  async presignedDownloadUrl(key: string, expirySeconds = 300): Promise<string> {
    return this.presignClient.presignedGetObject(this.bucket, key, expirySeconds);
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }
}
