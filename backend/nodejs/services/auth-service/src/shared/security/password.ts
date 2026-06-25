import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const HASH_VERSION = "scrypt";
export const MIN_PASSWORD_LENGTH = 8;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${HASH_VERSION}:${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, passwordHash: string) {
  const [version, salt, digest] = passwordHash.split(":");
  if (version !== HASH_VERSION || !salt || !digest) {
    return false;
  }

  const actual = Buffer.from(scryptSync(password, salt, 64).toString("hex"), "utf8");
  const expected = Buffer.from(digest, "utf8");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
