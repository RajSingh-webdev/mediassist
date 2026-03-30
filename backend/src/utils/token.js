import crypto from "node:crypto";

export function generateToken() {
  // 6-char uppercase token: harder to guess than 3-digit numeric code.
  return crypto.randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
}
