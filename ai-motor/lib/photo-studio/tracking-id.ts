import { randomBytes } from "crypto";

export function newPhotoTrackingId(): string {
  const ts = Date.now().toString(36);
  const rand = randomBytes(6).toString("hex");
  return `ps_${ts}_${rand}`;
}
