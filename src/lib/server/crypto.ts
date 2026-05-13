import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const VERSION = "v1";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function readKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY is not set. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
    );
  }
  let buf: Buffer;
  try {
    buf = Buffer.from(raw, "base64");
  } catch {
    throw new Error("ENCRYPTION_KEY must be base64-encoded.");
  }
  if (buf.length !== KEY_LENGTH) {
    throw new Error(
      `ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes. Got ${buf.length}. Regenerate with openssl rand -base64 32.`,
    );
  }
  return buf;
}

/**
 * Encrypt a secret with AES-256-GCM. Returns a versioned compact token:
 *   "v1:<iv-b64>:<ciphertext-b64>:<tag-b64>"
 */
export function encryptSecret(plaintext: string): string {
  if (typeof plaintext !== "string") {
    throw new Error("encryptSecret: plaintext must be a string.");
  }
  const key = readKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), ciphertext.toString("base64"), tag.toString("base64")].join(":");
}

/**
 * Decrypt a versioned compact token produced by encryptSecret.
 * Throws if the version is unknown, the token is malformed, or the auth tag fails.
 */
export function decryptSecret(token: string): string {
  if (typeof token !== "string") {
    throw new Error("decryptSecret: token must be a string.");
  }
  const parts = token.split(":");
  if (parts.length !== 4) {
    throw new Error("decryptSecret: malformed token.");
  }
  const [version, ivB64, ctB64, tagB64] = parts;
  if (version !== VERSION) {
    throw new Error(`decryptSecret: unsupported version ${version}.`);
  }
  const key = readKey();
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(ctB64, "base64");
  if (iv.length !== IV_LENGTH) {
    throw new Error("decryptSecret: invalid iv length.");
  }
  if (tag.length !== TAG_LENGTH) {
    throw new Error("decryptSecret: invalid auth tag length.");
  }
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}
