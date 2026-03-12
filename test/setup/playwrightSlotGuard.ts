/**
 * Thin wrapper around slotGuard for Playwright.
 *
 * Playwright globalSetup requires a default-export function that optionally
 * returns a teardown callback. Vitest uses named `setup`/`teardown` exports.
 * This file bridges the two formats.
 */

import { setup, teardown } from "./slotGuard";

export default async function globalSetup() {
  await setup();
  return teardown;
}
