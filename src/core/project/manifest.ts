/**
 * Project manifest utilities — parse, validate, and create .archproject.json manifests.
 *
 * The manifest is a lightweight JSON file that lists all .archc files in a
 * folder-based architecture project, their relationships, and a root entry point.
 */

import type {
  ProjectManifest,
  ProjectFileEntry,
  ProjectFileLink,
} from '@/types/project';
import { PROJECT_MANIFEST_FILENAME } from '@/types/project';

/**
 * Validate and parse a raw JSON object into a ProjectManifest.
 * Throws descriptive errors for any invalid structure.
 *
 * @param data - Raw parsed JSON object
 * @returns A validated ProjectManifest
 * @throws Error if the manifest is invalid
 */
export function parseManifest(data: unknown): ProjectManifest {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid manifest: expected a JSON object');
  }

  const obj = data as Record<string, unknown>;

  // Version check
  if (obj.version !== 1) {
    throw new Error(
      `Invalid manifest version: expected 1, got ${JSON.stringify(obj.version)}`,
    );
  }

  // Name (required)
  if (typeof obj.name !== 'string' || obj.name.trim().length === 0) {
    throw new Error('Invalid manifest: "name" must be a non-empty string');
  }

  // Description (optional)
  if (obj.description !== undefined && typeof obj.description !== 'string') {
    throw new Error('Invalid manifest: "description" must be a string');
  }

  // Root file (required)
  if (typeof obj.rootFile !== 'string' || obj.rootFile.trim().length === 0) {
    throw new Error('Invalid manifest: "rootFile" must be a non-empty string');
  }

  // Files array (required)
  if (!Array.isArray(obj.files)) {
    throw new Error('Invalid manifest: "files" must be an array');
  }

  const files: ProjectFileEntry[] = obj.files.map((entry: unknown, i: number) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`Invalid manifest: files[${i}] must be an object`);
    }
    const e = entry as Record<string, unknown>;
    if (typeof e.path !== 'string' || e.path.trim().length === 0) {
      throw new Error(`Invalid manifest: files[${i}].path must be a non-empty string`);
    }
    if (typeof e.displayName !== 'string' || e.displayName.trim().length === 0) {
      throw new Error(
        `Invalid manifest: files[${i}].displayName must be a non-empty string`,
      );
    }
    return {
      path: e.path,
      displayName: e.displayName,
      ...(typeof e.description === 'string' ? { description: e.description } : {}),
    };
  });

  // Validate rootFile is in the files list
  if (!files.some((f) => f.path === obj.rootFile)) {
    throw new Error(
      `Invalid manifest: rootFile "${obj.rootFile}" is not listed in files[]`,
    );
  }

  // Links array (optional, defaults to [])
  const rawLinks = Array.isArray(obj.links) ? obj.links : [];
  const links: ProjectFileLink[] = rawLinks.map((link: unknown, i: number) => {
    if (!link || typeof link !== 'object' || Array.isArray(link)) {
      throw new Error(`Invalid manifest: links[${i}] must be an object`);
    }
    const l = link as Record<string, unknown>;
    if (typeof l.from !== 'string' || l.from.trim().length === 0) {
      throw new Error(`Invalid manifest: links[${i}].from must be a non-empty string`);
    }
    if (typeof l.to !== 'string' || l.to.trim().length === 0) {
      throw new Error(`Invalid manifest: links[${i}].to must be a non-empty string`);
    }
    // Validate that from/to reference known files
    const filePaths = files.map((f) => f.path);
    if (!filePaths.includes(l.from)) {
      throw new Error(
        `Invalid manifest: links[${i}].from "${l.from}" is not listed in files[]`,
      );
    }
    if (!filePaths.includes(l.to)) {
      throw new Error(
        `Invalid manifest: links[${i}].to "${l.to}" is not listed in files[]`,
      );
    }
    return {
      from: l.from,
      to: l.to,
      ...(typeof l.label === 'string' ? { label: l.label } : {}),
    };
  });

  return {
    version: 1,
    name: obj.name as string,
    ...(typeof obj.description === 'string' ? { description: obj.description } : {}),
    rootFile: obj.rootFile as string,
    files,
    links,
  };
}

/**
 * Serialize a ProjectManifest to a formatted JSON string.
 *
 * @param manifest - The manifest to serialize
 * @returns Pretty-printed JSON string
 */
export function serializeManifest(manifest: ProjectManifest): string {
  return JSON.stringify(manifest, null, 2) + '\n';
}

/**
 * Create a new ProjectManifest from a list of discovered .archc file paths.
 * Uses the first file as the root entry point. Display names are derived
 * from filenames by removing the .archc extension.
 *
 * @param projectName - Human-readable project name
 * @param archcPaths - Relative paths to .archc files
 * @param rootFile - Optional explicit root file path (defaults to first file)
 * @returns A new ProjectManifest
 */
export function createManifest(
  projectName: string,
  archcPaths: string[],
  rootFile?: string,
): ProjectManifest {
  if (archcPaths.length === 0) {
    throw new Error('Cannot create manifest: no .archc files provided');
  }

  const files: ProjectFileEntry[] = archcPaths.map((path) => ({
    path,
    displayName: path.replace(/\.archc$/, '').replace(/^.*[\\/]/, ''),
  }));

  const root = rootFile ?? archcPaths[0]!;
  if (!archcPaths.includes(root)) {
    throw new Error(
      `Cannot create manifest: rootFile "${root}" is not in the file list`,
    );
  }

  return {
    version: 1,
    name: projectName,
    rootFile: root,
    files,
    links: [],
  };
}

/** Re-export the manifest filename constant for convenience. */
export { PROJECT_MANIFEST_FILENAME };
