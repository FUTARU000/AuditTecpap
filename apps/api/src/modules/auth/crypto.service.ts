import { Injectable } from '@nestjs/common';
import { hashPassword, verifyPassword } from './utils/password';

/**
 * Shared password hashing service. Exported from AuthModule so other modules
 * (e.g. Users) hash/verify passwords through a single, consistent path.
 */
@Injectable()
export class CryptoService {
  hash(plaintext: string): Promise<string> {
    return hashPassword(plaintext);
  }

  verify(plaintext: string, digest: string): Promise<boolean> {
    return verifyPassword(plaintext, digest);
  }
}
