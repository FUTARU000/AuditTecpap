import type { VerificationResult } from '@tecpap/types';

/** `verifications` must be ordered oldest-first (verifiedAt asc) — the established
 * convention for both CapaVerification and CapaActionVerification history. */
export function latestActionVerificationStatus(
  verifications: { result: VerificationResult }[],
): 'NOT_VERIFIED' | VerificationResult {
  if (verifications.length === 0) return 'NOT_VERIFIED';
  return verifications[verifications.length - 1]!.result;
}
