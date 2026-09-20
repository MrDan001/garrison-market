import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.MARKETING_TOKEN_ENCRYPTION_KEY;

  if (!raw) {
    throw new Error("MARKETING_TOKEN_ENCRYPTION_KEY is not configured.");
  }

  const key = Buffer.from(raw, "base64");

  if (key.length !== 32) {
    throw new Error("MARKETING_TOKEN_ENCRYPTION_KEY must decode from base64 to exactly 32 bytes.");
  }

  return key;
}

export function encryptMarketingToken(token: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptMarketingToken(payload: string): string {
  const [ivEncoded, authTagEncoded, ciphertextEncoded] = payload.split(".");

  if (!ivEncoded || !authTagEncoded || !ciphertextEncoded) {
    throw new Error("Invalid encrypted marketing token.");
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(ivEncoded, "base64url"),
  );

  decipher.setAuthTag(Buffer.from(authTagEncoded, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
