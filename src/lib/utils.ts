import type { Response } from "express";
import type { ButtonRecord } from "../db/schema.js";

export function sendSSE(res: Response, data: unknown): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * Extract suggested action buttons from the end of agent output.
 * Looks for trailing lines matching `- [Label]` or `* [Label]`.
 */
export function extractButtons(text: string): ButtonRecord[] {
  const lines = text.trim().split("\n");
  const buttons: ButtonRecord[] = [];

  for (let i = lines.length - 1; i >= 0; i--) {
    const match = lines[i].match(/^[-*]\s*\[(.+?)\]\s*$/);
    if (match) {
      buttons.unshift({ label: match[1], value: match[1] });
    } else if (buttons.length > 0) {
      break;
    }
  }

  return buttons;
}
