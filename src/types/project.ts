/**
 * Project manifest types for multi-file architecture projects.
 *
 * A project manifest (.archproject.json) describes a folder-based architecture
 * project where multiple .archc files reference each other. It lists all .archc
 * files in a folder, their relationships, and a root entry point.
 */

/**
 * Display metadata for a linked architecture file in the project.
 */
export interface ProjectFileEntry {
  /** Relative path to the .archc file from the project root. */
  path: string;
  /** Human-readable display name for the file. */
  displayName: string;
  /** Optional description of what this architecture file represents. */
  description?: string;
}

/**
 * A relationship between two architecture files in the project.
 * Represents how one architecture references or depends on another.
 */
export interface ProjectFileLink {
  /** Relative path of the source .archc file. */
  from: string;
  /** Relative path of the target .archc file. */
  to: string;
  /** Optional label describing the relationship (e.g., "imports", "depends on"). */
  label?: string;
}

/**
 * Project manifest schema (.archproject.json).
 *
 * The single source of truth for a folder-based architecture project.
 * Lists all .archc files, their display metadata, relationships, and
 * designates a root entry point for the project graph.
 */
export interface ProjectManifest {
  /** Schema version for forward compatibility. */
  version: 1;
  /** Human-readable project name. */
  name: string;
  /** Optional project description. */
  description?: string;
  /** Relative path to the root/entry-point .archc file. */
  rootFile: string;
  /** All .archc files in the project. */
  files: ProjectFileEntry[];
  /** Relationships between architecture files. */
  links: ProjectFileLink[];
}

/** The manifest filename used in project folders. */
export const PROJECT_MANIFEST_FILENAME = '.archproject.json';

/**
 * The subdirectory name used for ArchCanvas projects.
 * When present inside a user-selected folder, indicates that the folder
 * contains an ArchCanvas project. All .archc files live inside this directory.
 */
export const ARCHCANVAS_DIR_NAME = '.archcanvas';

/** The default root .archc file name inside the .archcanvas/ directory. */
export const ARCHCANVAS_MAIN_FILE = 'main.archc';
