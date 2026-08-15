// FILE: apps/frontend/lib/password-validation.ts
//
// SECURITY (Stage 5 — session/access audit): one shared password policy,
// used everywhere a password gets set. Before this, the rule existed in
// two different places with two different values — resetPasswordAction
// and /api/auth/change-password both required 6 characters — while
// registerOwnerAction and registerStaffAction had no server-side check at
// all. Whatever the client form enforced was the entire policy for new
// accounts; a direct POST to either action bypassed it completely.
//
// 8 characters, no forced complexity rules (uppercase/number/symbol).
// This follows current NIST guidance (SP 800-63B): length matters far
// more than composition rules, which tend to push people toward
// predictable, easily-guessed patterns (Password1!) without meaningfully
// raising resistance to real attacks. Given the primary users here are
// shop owners and staff on mobile, often via voice-to-text, a plain
// length requirement is also the realistic bar that actually gets
// followed rather than worked around.

const MIN_LENGTH = 8;
// bcrypt silently ignores any bytes past 72 anyway (a well-known bcrypt
// quirk, not a bug introduced here) — this upper bound just stops
// someone posting a multi-megabyte string as a "password" and burning
// CPU on the hashing call itself.
const MAX_LENGTH = 128;

export function validatePassword(
  password: string | null | undefined
): { valid: true } | { valid: false; error: string } {
  if (!password) {
    return { valid: false, error: "Password is required." };
  }
  if (password.length < MIN_LENGTH) {
    return { valid: false, error: `Password must be at least ${MIN_LENGTH} characters long.` };
  }
  if (password.length > MAX_LENGTH) {
    return { valid: false, error: "Password is too long." };
  }
  return { valid: true };
}