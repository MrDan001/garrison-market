// Generates a fresh VAPID keypair for Web Push, using the same
// ECDH(prime256v1) approach the `web-push` package itself uses — no
// network access needed. Run with: npm run generate-vapid-keys
//
// Treat the private key like any other secret: put it in env vars
// (VAPID_PRIVATE_KEY), never commit it, and never reuse the same pair
// across unrelated apps. If you rotate keys, every existing browser
// subscription becomes invalid and users must re-enable notifications.

import crypto from "crypto";

function base64url(buf: Buffer) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const ecdh = crypto.createECDH("prime256v1");
ecdh.generateKeys();

const publicKey = base64url(ecdh.getPublicKey());
const privateKey = base64url(ecdh.getPrivateKey());

console.log("\nVAPID keys generated. Add these to your .env:\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log(`VAPID_SUBJECT=mailto:support@gmstock.co\n`);