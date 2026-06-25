import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export class CredentialBox {
  key: Buffer;

  constructor(secret: string) {
    this.key = createHash("sha256").update(secret).digest();
  }

  encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString("base64url");
  }

  decrypt(value: string) {
    const payload = Buffer.from(value, "base64url");
    const iv = payload.subarray(0, 12);
    const authTag = payload.subarray(12, 28);
    const encrypted = payload.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  }
}
