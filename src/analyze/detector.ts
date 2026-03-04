/**
 * Project Type and Framework Detector
 *
 * Analyzes a ScanResult from the filesystem scanner to detect project type,
 * primary languages, frameworks, build systems, and infrastructure signals.
 * Produces a ProjectProfile that guides downstream AI analysis.
 */

import type { ScanResult, FileEntry, DirectoryEntry } from './scanner';

// ── Types ────────────────────────────────────────────────────────────────────

export type ProjectType = 'monorepo' | 'microservices' | 'single-app' | 'library' | 'unknown';

export interface DetectedLanguage {
  name: string;
  extensions: string[];
  fileCount: number;
  percentage: number; // 0-100
}

export interface DetectedFramework {
  name: string;
  confidence: 'high' | 'medium' | 'low';
  evidence: string; // what file/config led to this detection
}

export interface InfraSignal {
  type: string; // e.g. 'docker', 'kubernetes', 'terraform', 'ci-github', 'ci-gitlab'
  evidence: string;
}

export interface DetectedDataStore {
  type: string; // e.g. 'postgresql', 'mongodb', 'redis', 'mysql', 'sqlite'
  evidence: string;
}

export interface ProjectProfile {
  languages: DetectedLanguage[];
  frameworks: DetectedFramework[];
  projectType: ProjectType;
  buildSystems: string[];
  infraSignals: InfraSignal[];
  dataStores: DetectedDataStore[];
  entryPoints: string[];
}

// ── Language Detection ───────────────────────────────────────────────────────

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.mjs': 'JavaScript',
  '.cjs': 'JavaScript',
  '.py': 'Python',
  '.pyw': 'Python',
  '.go': 'Go',
  '.rs': 'Rust',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.kts': 'Kotlin',
  '.scala': 'Scala',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.cs': 'C#',
  '.fs': 'F#',
  '.swift': 'Swift',
  '.m': 'Objective-C',
  '.c': 'C',
  '.h': 'C',
  '.cpp': 'C++',
  '.cc': 'C++',
  '.cxx': 'C++',
  '.hpp': 'C++',
  '.dart': 'Dart',
  '.ex': 'Elixir',
  '.exs': 'Elixir',
  '.erl': 'Erlang',
  '.hs': 'Haskell',
  '.lua': 'Lua',
  '.r': 'R',
  '.R': 'R',
  '.jl': 'Julia',
  '.clj': 'Clojure',
  '.vue': 'Vue',
  '.svelte': 'Svelte',
};

/** Config files that strongly indicate a language */
const CONFIG_TO_LANGUAGE: Record<string, string> = {
  'package.json': 'JavaScript',
  'tsconfig.json': 'TypeScript',
  'go.mod': 'Go',
  'go.sum': 'Go',
  'Cargo.toml': 'Rust',
  'Cargo.lock': 'Rust',
  'requirements.txt': 'Python',
  'pyproject.toml': 'Python',
  'setup.py': 'Python',
  'Pipfile': 'Python',
  'poetry.lock': 'Python',
  'pom.xml': 'Java',
  'build.gradle': 'Java',
  'build.gradle.kts': 'Kotlin',
  'Gemfile': 'Ruby',
  'composer.json': 'PHP',
  'mix.exs': 'Elixir',
  'Package.swift': 'Swift',
  'pubspec.yaml': 'Dart',
  'stack.yaml': 'Haskell',
  'Makefile': 'C',
  'CMakeLists.txt': 'C++',
};

/**
 * Detect languages from file extension distribution and config files.
 */
export function detectLanguages(scanResult: ScanResult): DetectedLanguage[] {
  const langCounts = new Map<string, { extensions: Set<string>; count: number }>();

  // Count from file extension distribution
  for (const [ext, count] of Object.entries(scanResult.languageBreakdown)) {
    const lang = EXTENSION_TO_LANGUAGE[ext];
    if (!lang) continue;

    const existing = langCounts.get(lang) ?? { extensions: new Set(), count: 0 };
    existing.extensions.add(ext);
    existing.count += count;
    langCounts.set(lang, existing);
  }

  // Boost from config file presence
  const allFiles = collectAllFiles(scanResult);
  const allFileNames = new Set(allFiles.map(f => f.name));
  const rootFileNames = new Set(scanResult.fileTree.root.files.map(f => f.name));

  for (const [configFile, lang] of Object.entries(CONFIG_TO_LANGUAGE)) {
    if (rootFileNames.has(configFile) || allFileNames.has(configFile)) {
      const existing = langCounts.get(lang) ?? { extensions: new Set(), count: 0 };
      // Don't add count, just ensure the language is represented
      langCounts.set(lang, existing);
    }
  }

  const totalFiles = scanResult.totalFiles || 1; // avoid division by zero

  const languages: DetectedLanguage[] = [];
  for (const [name, data] of langCounts) {
    languages.push({
      name,
      extensions: Array.from(data.extensions).sort(),
      fileCount: data.count,
      percentage: Math.round((data.count / totalFiles) * 1000) / 10,
    });
  }

  // Sort by file count descending
  languages.sort((a, b) => b.fileCount - a.fileCount);

  return languages;
}

// ── Framework Detection ──────────────────────────────────────────────────────

interface FrameworkRule {
  name: string;
  /** Check against root-level file names */
  configFiles?: string[];
  /** Check for file names anywhere in the tree */
  anywhereFiles?: string[];
  /** Check if any of these strings appear in any matching config file name's relativePath */
  filePathPatterns?: string[];
  confidence: 'high' | 'medium' | 'low';
}

const FRAMEWORK_RULES: FrameworkRule[] = [
  // JavaScript/TypeScript frameworks
  { name: 'Next.js', configFiles: ['next.config.js', 'next.config.mjs', 'next.config.ts'], confidence: 'high' },
  { name: 'Nuxt', configFiles: ['nuxt.config.js', 'nuxt.config.ts'], confidence: 'high' },
  { name: 'SvelteKit', configFiles: ['svelte.config.js', 'svelte.config.ts'], confidence: 'high' },
  { name: 'Remix', configFiles: ['remix.config.js', 'remix.config.ts'], confidence: 'high' },
  { name: 'Astro', configFiles: ['astro.config.mjs', 'astro.config.ts'], confidence: 'high' },
  { name: 'Gatsby', configFiles: ['gatsby-config.js', 'gatsby-config.ts'], confidence: 'high' },
  { name: 'Angular', configFiles: ['angular.json', '.angular-cli.json'], confidence: 'high' },
  { name: 'Vite', configFiles: ['vite.config.ts', 'vite.config.js', 'vite.config.mjs'], confidence: 'medium' },
  { name: 'Webpack', configFiles: ['webpack.config.js', 'webpack.config.ts'], confidence: 'medium' },
  { name: 'Rollup', configFiles: ['rollup.config.js', 'rollup.config.mjs'], confidence: 'medium' },
  { name: 'Electron', configFiles: ['electron-builder.yml', 'electron.config.js'], confidence: 'high' },
  { name: 'Capacitor', configFiles: ['capacitor.config.ts', 'capacitor.config.json'], confidence: 'high' },
  { name: 'Expo', configFiles: ['app.json', 'expo.json'], confidence: 'medium' },
  { name: 'Tailwind CSS', configFiles: ['tailwind.config.js', 'tailwind.config.ts', 'tailwind.config.cjs'], confidence: 'high' },

  // Python frameworks
  { name: 'Django', anywhereFiles: ['manage.py'], confidence: 'high' },
  { name: 'FastAPI', anywhereFiles: ['main.py'], confidence: 'low' },
  { name: 'Flask', anywhereFiles: ['app.py'], confidence: 'low' },

  // Go frameworks
  { name: 'Gin', configFiles: ['go.mod'], confidence: 'low' },

  // Ruby frameworks
  { name: 'Rails', configFiles: ['Rakefile'], anywhereFiles: ['config/routes.rb'], confidence: 'high' },

  // Java/JVM frameworks
  { name: 'Spring Boot', anywhereFiles: ['application.properties', 'application.yml'], confidence: 'medium' },

  // Rust frameworks
  { name: 'Actix Web', configFiles: ['Cargo.toml'], confidence: 'low' },

  // Infrastructure / platforms
  { name: 'Serverless Framework', configFiles: ['serverless.yml', 'serverless.ts'], confidence: 'high' },
  { name: 'AWS CDK', configFiles: ['cdk.json'], confidence: 'high' },
  { name: 'Pulumi', configFiles: ['Pulumi.yaml'], confidence: 'high' },
];

/**
 * Detect frameworks from config file presence.
 */
export function detectFrameworks(scanResult: ScanResult): DetectedFramework[] {
  const allFiles = collectAllFiles(scanResult);
  const allFileNames = new Set(allFiles.map(f => f.name));
  const allRelativePaths = new Set(allFiles.map(f => f.relativePath));
  const rootFileNames = new Set(scanResult.fileTree.root.files.map(f => f.name));

  const detected: DetectedFramework[] = [];

  for (const rule of FRAMEWORK_RULES) {
    let matched = false;
    let evidence = '';

    // Check config files at root level
    if (rule.configFiles) {
      for (const cf of rule.configFiles) {
        if (rootFileNames.has(cf) || allFileNames.has(cf)) {
          matched = true;
          evidence = cf;
          break;
        }
      }
    }

    // Check files anywhere in tree
    if (!matched && rule.anywhereFiles) {
      for (const af of rule.anywhereFiles) {
        // Check both name and relative path
        if (allFileNames.has(af) || allRelativePaths.has(af)) {
          matched = true;
          evidence = af;
          break;
        }
      }
    }

    if (matched) {
      detected.push({
        name: rule.name,
        confidence: rule.confidence,
        evidence,
      });
    }
  }

  // Special detection: React (check package.json dependency - we check for .tsx/.jsx files as proxy)
  const hasReactFiles = Object.keys(scanResult.languageBreakdown).some(ext =>
    ext === '.tsx' || ext === '.jsx'
  );
  if (hasReactFiles && !detected.some(d => d.name === 'React')) {
    detected.push({
      name: 'React',
      confidence: 'medium',
      evidence: '.tsx/.jsx files present',
    });
  }

  // Vue detection from .vue files
  if (scanResult.languageBreakdown['.vue'] && !detected.some(d => d.name === 'Vue')) {
    detected.push({
      name: 'Vue',
      confidence: 'medium',
      evidence: '.vue files present',
    });
  }

  // Svelte detection from .svelte files
  if (scanResult.languageBreakdown['.svelte'] && !detected.some(d => d.name === 'Svelte')) {
    detected.push({
      name: 'Svelte',
      confidence: 'medium',
      evidence: '.svelte files present',
    });
  }

  return detected;
}

// ── Project Structure Detection ──────────────────────────────────────────────

/**
 * Detect project structure type: monorepo, microservices, single-app, library.
 */
export function detectProjectType(scanResult: ScanResult): ProjectType {
  const rootFiles = scanResult.fileTree.root.files.map(f => f.name);
  const rootDirs = scanResult.fileTree.root.directories.map(d => d.name);
  const allFiles = collectAllFiles(scanResult);
  const allFileNames = allFiles.map(f => f.relativePath);

  // Monorepo signals
  const hasLerna = rootFiles.includes('lerna.json');
  const hasTurbo = rootFiles.includes('turbo.json');
  const hasNxJson = rootFiles.includes('nx.json');
  const hasPnpmWorkspace = rootFiles.includes('pnpm-workspace.yaml');
  const hasPackagesDir = rootDirs.includes('packages');
  const hasAppsDir = rootDirs.includes('apps');

  // Check for workspaces in package.json presence (heuristic: packages/ or apps/ dir + root package.json)
  const hasRootPackageJson = rootFiles.includes('package.json');

  if (hasLerna || hasTurbo || hasNxJson || hasPnpmWorkspace) {
    return 'monorepo';
  }

  if (hasRootPackageJson && (hasPackagesDir || hasAppsDir)) {
    return 'monorepo';
  }

  // Microservices signals: multiple Dockerfiles or docker-compose with multiple services
  const dockerfileCount = allFileNames.filter(f =>
    f.endsWith('Dockerfile') || f.match(/Dockerfile\.\w+$/)
  ).length;
  const hasDockerCompose = allFileNames.some(f =>
    f === 'docker-compose.yml' || f === 'docker-compose.yaml'
  );

  if (dockerfileCount >= 3 || (hasDockerCompose && dockerfileCount >= 2)) {
    return 'microservices';
  }

  // Library signals
  const isLibrary = checkIsLibrary(rootFiles, allFileNames);
  if (isLibrary) {
    return 'library';
  }

  // If we have source files, it's a single app
  if (scanResult.totalFiles > 0) {
    return 'single-app';
  }

  return 'unknown';
}

function checkIsLibrary(rootFiles: string[], allRelativePaths: string[]): boolean {
  // Libraries typically have: no src/pages or src/app, index file as entry,
  // and files like tsconfig.build.json, rollup config, or "main"/"module" in package.json
  const hasTsconfigBuild = rootFiles.includes('tsconfig.build.json');
  const hasRollupConfig = rootFiles.some(f => f.startsWith('rollup.config'));
  const hasTsupConfig = rootFiles.some(f => f.startsWith('tsup.config'));

  // Absence of app-like structures
  const hasPages = allRelativePaths.some(f => f.includes('/pages/') || f.includes('/app/'));
  const hasPublicIndex = allRelativePaths.some(f => f === 'public/index.html' || f === 'index.html');

  if ((hasTsconfigBuild || hasRollupConfig || hasTsupConfig) && !hasPages && !hasPublicIndex) {
    return true;
  }

  return false;
}

// ── Build System Detection ───────────────────────────────────────────────────

const BUILD_SYSTEM_FILES: Record<string, string> = {
  'package.json': 'npm',
  'yarn.lock': 'yarn',
  'pnpm-lock.yaml': 'pnpm',
  'pnpm-workspace.yaml': 'pnpm',
  'bun.lockb': 'bun',
  'Makefile': 'make',
  'CMakeLists.txt': 'cmake',
  'Cargo.toml': 'cargo',
  'go.mod': 'go modules',
  'build.gradle': 'gradle',
  'build.gradle.kts': 'gradle',
  'pom.xml': 'maven',
  'build.sbt': 'sbt',
  'Rakefile': 'rake',
  'Gemfile': 'bundler',
  'composer.json': 'composer',
  'mix.exs': 'mix',
  'pubspec.yaml': 'pub',
  'setup.py': 'setuptools',
  'pyproject.toml': 'pyproject',
  'Pipfile': 'pipenv',
  'poetry.lock': 'poetry',
  'Bazel': 'bazel',
  'BUILD': 'bazel',
  'WORKSPACE': 'bazel',
  'meson.build': 'meson',
};

/**
 * Detect build systems from config file presence.
 */
export function detectBuildSystems(scanResult: ScanResult): string[] {
  const rootFileNames = new Set(scanResult.fileTree.root.files.map(f => f.name));
  const systems = new Set<string>();

  for (const [fileName, system] of Object.entries(BUILD_SYSTEM_FILES)) {
    if (rootFileNames.has(fileName)) {
      systems.add(system);
    }
  }

  return Array.from(systems).sort();
}

// ── Infrastructure Signal Detection ──────────────────────────────────────────

/**
 * Detect infrastructure signals from config files and directory structures.
 */
export function detectInfraSignals(scanResult: ScanResult): InfraSignal[] {
  const allFiles = collectAllFiles(scanResult);
  const allNames = allFiles.map(f => f.name);
  const allPaths = allFiles.map(f => f.relativePath);
  const signals: InfraSignal[] = [];

  // Docker
  if (allNames.includes('Dockerfile')) {
    signals.push({ type: 'docker', evidence: 'Dockerfile' });
  }
  if (allNames.includes('docker-compose.yml') || allNames.includes('docker-compose.yaml')) {
    signals.push({ type: 'docker-compose', evidence: 'docker-compose.yml' });
  }
  if (allNames.includes('.dockerignore')) {
    if (!signals.some(s => s.type === 'docker')) {
      signals.push({ type: 'docker', evidence: '.dockerignore' });
    }
  }

  // Kubernetes
  const k8sPatterns = ['k8s/', 'kubernetes/', 'deploy/'];
  for (const pattern of k8sPatterns) {
    if (allPaths.some(p => p.startsWith(pattern))) {
      signals.push({ type: 'kubernetes', evidence: `${pattern} directory` });
      break;
    }
  }
  // Check for k8s-style YAML files
  if (allNames.some(n => n.endsWith('.yaml') || n.endsWith('.yml'))) {
    // Look for common k8s file names
    const k8sFiles = ['deployment.yaml', 'service.yaml', 'ingress.yaml', 'configmap.yaml', 'statefulset.yaml'];
    for (const kf of k8sFiles) {
      if (allNames.includes(kf)) {
        if (!signals.some(s => s.type === 'kubernetes')) {
          signals.push({ type: 'kubernetes', evidence: kf });
        }
        break;
      }
    }
  }

  // Terraform
  if (allPaths.some(p => p.endsWith('.tf'))) {
    signals.push({ type: 'terraform', evidence: '*.tf files' });
  }

  // CI/CD - GitHub Actions
  if (allPaths.some(p => p.startsWith('.github/workflows/'))) {
    signals.push({ type: 'ci-github', evidence: '.github/workflows/' });
  }

  // CI/CD - GitLab CI
  if (allNames.includes('.gitlab-ci.yml')) {
    signals.push({ type: 'ci-gitlab', evidence: '.gitlab-ci.yml' });
  }

  // CI/CD - Jenkins
  if (allNames.includes('Jenkinsfile')) {
    signals.push({ type: 'ci-jenkins', evidence: 'Jenkinsfile' });
  }

  // CI/CD - CircleCI
  if (allPaths.some(p => p === '.circleci/config.yml')) {
    signals.push({ type: 'ci-circleci', evidence: '.circleci/config.yml' });
  }

  // CI/CD - Travis CI
  if (allNames.includes('.travis.yml')) {
    signals.push({ type: 'ci-travis', evidence: '.travis.yml' });
  }

  // AWS
  if (allNames.includes('cdk.json') || allNames.includes('samconfig.toml')) {
    signals.push({ type: 'aws', evidence: allNames.includes('cdk.json') ? 'cdk.json' : 'samconfig.toml' });
  }

  // Vercel
  if (allNames.includes('vercel.json')) {
    signals.push({ type: 'vercel', evidence: 'vercel.json' });
  }

  // Netlify
  if (allNames.includes('netlify.toml')) {
    signals.push({ type: 'netlify', evidence: 'netlify.toml' });
  }

  return signals;
}

// ── Data Store Detection ─────────────────────────────────────────────────────

/**
 * Detect data stores from config files and common patterns.
 */
export function detectDataStores(scanResult: ScanResult): DetectedDataStore[] {
  const allFiles = collectAllFiles(scanResult);
  const allNames = new Set(allFiles.map(f => f.name));
  const allPaths = allFiles.map(f => f.relativePath);
  const stores: DetectedDataStore[] = [];

  // Prisma (implies SQL database)
  if (allPaths.some(p => p.endsWith('schema.prisma') || p === 'prisma/schema.prisma')) {
    stores.push({ type: 'prisma', evidence: 'schema.prisma' });
  }

  // Drizzle ORM
  if (allNames.has('drizzle.config.ts') || allNames.has('drizzle.config.js')) {
    stores.push({ type: 'drizzle', evidence: 'drizzle.config.ts' });
  }

  // SQLite
  if (allPaths.some(p => p.endsWith('.sqlite') || p.endsWith('.sqlite3') || p.endsWith('.db'))) {
    stores.push({ type: 'sqlite', evidence: '*.sqlite file' });
  }

  // TypeORM
  if (allNames.has('ormconfig.json') || allNames.has('ormconfig.ts') || allNames.has('ormconfig.js')) {
    stores.push({ type: 'typeorm', evidence: 'ormconfig' });
  }

  // Sequelize
  if (allNames.has('.sequelizerc')) {
    stores.push({ type: 'sequelize', evidence: '.sequelizerc' });
  }

  // MongoDB (Mongoose)
  if (allPaths.some(p => p.includes('models/') && (p.endsWith('.model.ts') || p.endsWith('.model.js')))) {
    // Weak signal, but combined with other hints...
  }

  // Redis config
  if (allNames.has('redis.conf')) {
    stores.push({ type: 'redis', evidence: 'redis.conf' });
  }

  // Protocol Buffers (like this project)
  if (allPaths.some(p => p.endsWith('.proto'))) {
    stores.push({ type: 'protobuf', evidence: '*.proto files' });
  }

  // Knex migrations
  if (allNames.has('knexfile.js') || allNames.has('knexfile.ts')) {
    stores.push({ type: 'knex', evidence: 'knexfile' });
  }

  // Alembic (Python SQL migrations)
  if (allNames.has('alembic.ini')) {
    stores.push({ type: 'alembic', evidence: 'alembic.ini' });
  }

  // Firebase
  if (allNames.has('firebase.json') || allNames.has('.firebaserc')) {
    stores.push({ type: 'firebase', evidence: 'firebase.json' });
  }

  return stores;
}

// ── Entry Point Detection ────────────────────────────────────────────────────

const ENTRY_POINT_PATTERNS = [
  'src/index.ts',
  'src/index.tsx',
  'src/index.js',
  'src/index.jsx',
  'src/main.ts',
  'src/main.tsx',
  'src/main.js',
  'src/app.ts',
  'src/app.tsx',
  'src/App.tsx',
  'src/App.jsx',
  'index.ts',
  'index.js',
  'main.ts',
  'main.js',
  'main.py',
  'app.py',
  'manage.py',
  'main.go',
  'cmd/main.go',
  'src/main.rs',
  'src/lib.rs',
  'lib/index.ts',
  'lib/index.js',
  'server.ts',
  'server.js',
  'src/server.ts',
  'src/server.js',
];

/**
 * Detect likely entry points for the project.
 */
export function detectEntryPoints(scanResult: ScanResult): string[] {
  const allFiles = collectAllFiles(scanResult);
  const allPathSet = new Set(allFiles.map(f => f.relativePath));

  const entryPoints: string[] = [];

  for (const pattern of ENTRY_POINT_PATTERNS) {
    if (allPathSet.has(pattern)) {
      entryPoints.push(pattern);
    }
  }

  return entryPoints;
}

// ── Main API ─────────────────────────────────────────────────────────────────

/**
 * Analyze a ScanResult to produce a ProjectProfile with detected languages,
 * frameworks, project type, build systems, infrastructure signals, data stores,
 * and entry points.
 */
export function detectProject(scanResult: ScanResult): ProjectProfile {
  return {
    languages: detectLanguages(scanResult),
    frameworks: detectFrameworks(scanResult),
    projectType: detectProjectType(scanResult),
    buildSystems: detectBuildSystems(scanResult),
    infraSignals: detectInfraSignals(scanResult),
    dataStores: detectDataStores(scanResult),
    entryPoints: detectEntryPoints(scanResult),
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Recursively collect all FileEntry objects from a ScanResult.
 */
function collectAllFiles(scanResult: ScanResult): FileEntry[] {
  const files: FileEntry[] = [];

  function walkDir(dir: DirectoryEntry) {
    for (const f of dir.files) {
      files.push(f);
    }
    for (const d of dir.directories) {
      walkDir(d);
    }
  }

  walkDir(scanResult.fileTree.root);
  return files;
}
