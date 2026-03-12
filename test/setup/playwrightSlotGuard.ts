/**
 * Playwright globalSetup adapter for slotGuard.
 *
 * Playwright requires globalSetup to export a single default function,
 * while slotGuard exports named `setup`/`teardown`. This adapter bridges
 * the two: the default export calls setup() and returns a teardown function.
 */

import { setup, teardown } from "./slotGuard";

export default async function globalSetup() {
  await setup();
  return teardown;
}
