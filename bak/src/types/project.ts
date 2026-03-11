/**
 * Project types for .archcanvas/ folder-based architecture projects.
 *
 * The old .archproject.json manifest system has been removed. Projects now
 * use the .archcanvas/ folder convention exclusively. A ProjectDescriptor
 * is an in-memory representation of the project state (not persisted as a
 * separate file — the folder structure IS the manifest).
 */

/**
 * Describes a file discovered in the .archcanvas/ directory.
 */
export interface ProjectFile {
  /** Filename within .archcanvas/ (e.g., "main.archc", "01JABCDEF.archc"). */
  path: string;
  /** Human-readable display name for the file. */
  displayName: string;
}

/**
 * In-memory project descriptor derived from scanning the .archcanvas/ folder.
 * NOT persisted to disk — the folder structure is the source of truth.
 */
export interface ProjectDescriptor {
  /** Human-readable project name (derived from the root folder name). */
  name: string;
  /** The root .archc file (typically "main.archc"). */
  rootFile: string;
  /** All .archc files discovered in .archcanvas/. */
  files: ProjectFile[];
}

/**
 * The subdirectory name used for ArchCanvas projects.
 * When present inside a user-selected folder, indicates that the folder
 * contains an ArchCanvas project. All .archc files live inside this directory.
 */
export const ARCHCANVAS_DIR_NAME = '.archcanvas';

/** The default root .archc file name inside the .archcanvas/ directory. */
export const ARCHCANVAS_MAIN_FILE = 'main.archc';
