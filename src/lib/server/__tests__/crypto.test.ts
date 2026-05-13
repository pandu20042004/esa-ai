import { afterEach, beforeEach, describe, expect, it } from "vitest";

const ORIGINAL_KEY = process.env.ENCRYPTION_KEY;

function setTestKey() {
  // Deterministic 32-byte base64 key for tests.
  process.env.ENCRYPTION_KEY = "3ZZ9c/eFyUW0Uhl2PuFijxpxn6FT+hMuDT+1FC3A2BE=";
}

describe("crypto (AES-256-GCM)", () => {
  beforeEach(() => {
    setTestKey();
  });

  afterEach(() => {
    if (ORIGINAL_KEY === undefined) {
      delete process.env.ENCRYPTION_KEY;
    } else {
      process.env.ENCRYPTION_KEY = ORIGINAL_KEY;
    }
  });

  it("round-trips plaintext through encrypt and decrypt", async () => {
    const { encryptSecret, decryptSecret } = await import("../crypto");
    const plaintext = "sk-test-abc-123";
    const token = encryptSecret(plaintext);
    expect(token.startsWith("v1:")).toBe(true);
    expect(decryptSecret(token)).toBe(plaintext);
  });

  it("produces distinct ciphertext on each call (random iv)", async () => {
    const { encryptSecret } = await import("../crypto");
    const a = encryptSecret("same-secret");
    const b = encryptSecret("same-secret");
    expect(a).not.toBe(b);
  });

  it("detects tampered ciphertext", async () => {
    const { encryptSecret, decryptSecret } = await import("../crypto");
    const token = encryptSecret("hello");
    const parts = token.split(":");
    // flip a byte in the ciphertext segment
    const ct = Buffer.from(parts[2], "base64");
    ct[0] = ct[0] ^ 0xff;
    parts[2] = ct.toString("base64");
    expect(() => decryptSecret(parts.join(":"))).toThrow();
  });

  it("fails to decrypt with a different key", async () => {
    const { encryptSecret } = await import("../crypto");
    const token = encryptSecret("secret");
    process.env.ENCRYPTION_KEY = "7hl9QkfdkilunR9FrhT2gTAKIOdFfPDXcS9EZyoJO7c=";
    const { decryptSecret } = await import("../crypto");
    expect(() => decryptSecret(token)).toThrow();
  });

  it("throws when ENCRYPTION_KEY missing", async () => {
    delete process.env.ENCRYPTION_KEY;
    const { encryptSecret } = await import("../crypto");
    expect(() => encryptSecret("x")).toThrow(/ENCRYPTION_KEY/);
  });

  it("throws on malformed token", async () => {
    const { decryptSecret } = await import("../crypto");
    expect(() => decryptSecret("not-a-token")).toThrow();
    expect(() => decryptSecret("v2:aaa:bbb:ccc")).toThrow(/version/);
  });
});
