/**
 * `.archcanvas/settings.yaml` codec — non-secret AI provider preferences.
 *
 * Mirrors `yamlCodec.ts`'s Zod-validated `parseDocument`/`stringify` pattern
 * for a *different* file: `.archcanvas/settings.yaml` (new, sibling to
 * `main.yaml`), not the canvas YAML. That file is normally committed to the
 * user's git repo (see `keyStorage.ts`'s doc comment and spec Decision 5),
 * so `SettingsSchema` deliberately has no key/secret fields anywhere — API
 * keys live only in `localStorage` via `keyStorage.ts`.
 *
 * Unlike `yamlCodec.ts`'s `parseCanvas`/`serializeCanvas` (which throw on
 * invalid input — a corrupt canvas file is a hard error the user must see),
 * `parseSettings` never throws: a malformed or partially-invalid
 * `settings.yaml` falls back to schema defaults. Settings are a soft
 * preference layer — losing them silently (falling back to "no provider
 * selected") is far less disruptive than blocking the whole project from
 * loading over a corrupt preferences file. See spec §6 Negative/security.
 */

import { parseDocument, stringify } from 'yaml';
import { z } from 'zod/v4';
import type { FileSystem } from '../platform/fileSystem';

const SETTINGS_PATH = '.archcanvas/settings.yaml';
const SETTINGS_DIR = '.archcanvas';

export const SettingsSchema = z.object({
  ai: z
    .object({
      selectedProviderId: z.string().optional(),
      providers: z
        .record(
          z.string(),
          z.object({
            model: z.string().optional(),
            baseUrl: z.string().optional(),
          }),
        )
        .default({}),
    })
    .default({ providers: {} }),
});

export type Settings = z.infer<typeof SettingsSchema>;

/** Schema defaults — returned whenever the file is missing, unreadable, or fails validation. */
export function defaultSettings(): Settings {
  return { ai: { providers: {} } };
}

/**
 * Parse + Zod-validate `.archcanvas/settings.yaml` content.
 *
 * Never throws: malformed YAML or a schema-validation failure both fall
 * back to `defaultSettings()`, matching this module's soft-preference
 * contract (see file-level doc comment).
 */
export function parseSettings(yamlContent: string): Settings {
  try {
    const doc = parseDocument(yamlContent);
    if (doc.errors.length > 0) {
      return defaultSettings();
    }

    const raw = doc.toJSON();
    const result = SettingsSchema.safeParse(raw ?? {});
    if (!result.success) {
      return defaultSettings();
    }

    return result.data;
  } catch {
    return defaultSettings();
  }
}

/**
 * Serialize settings to YAML. Structurally incapable of emitting a key/
 * secret field: `SettingsSchema` has none, so `safeParse` strips any
 * unknown/extra field (e.g. a stray `apiKey`) before stringifying — even if
 * such a field were hypothetically present on the input object.
 */
export function serializeSettings(settings: Settings): string {
  const result = SettingsSchema.safeParse(settings);
  const data = result.success ? result.data : defaultSettings();

  return stringify(data, {
    indent: 2,
    lineWidth: 0,
    defaultKeyType: 'PLAIN',
    defaultStringType: 'PLAIN',
  });
}

/** Read `.archcanvas/settings.yaml` via the FileSystem abstraction. Missing file → defaults, not an error. */
export async function loadSettings(fs: FileSystem): Promise<Settings> {
  try {
    const fileExists = await fs.exists(SETTINGS_PATH);
    if (!fileExists) {
      return defaultSettings();
    }
    const content = await fs.readFile(SETTINGS_PATH);
    return parseSettings(content);
  } catch {
    return defaultSettings();
  }
}

/** Write settings back to `.archcanvas/settings.yaml`. */
export async function saveSettings(fs: FileSystem, settings: Settings): Promise<void> {
  // .archcanvas/ already exists whenever a project is open (main.yaml lives
  // there), but mkdir is idempotent/recursive across all FileSystem
  // implementations — cheap insurance against ordering surprises.
  await fs.mkdir(SETTINGS_DIR);
  await fs.writeFile(SETTINGS_PATH, serializeSettings(settings));
}
