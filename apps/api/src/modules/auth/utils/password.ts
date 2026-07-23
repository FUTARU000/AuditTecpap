import { hash, verify } from '@node-rs/argon2';

/**
 * Password hashing with argon2id (OWASP-recommended) via @node-rs/argon2 —
 * prebuilt binaries, no native build step in containers. The default algorithm
 * is argon2id, so we only tune the cost parameters.
 */
export async function hashPassword(plaintext: string): Promise<string> {
  return hash(plaintext, {
    memoryCost: 19456, // 19 MiB
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(plaintext: string, digest: string): Promise<boolean> {
  try {
    return await verify(digest, plaintext);
  } catch {
    // Malformed/unsupported hash → treat as a failed verification, never throw.
    return false;
  }
}
