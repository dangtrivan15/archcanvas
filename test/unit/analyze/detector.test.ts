import { describe, it, expect } from 'vitest';
import {
  detectProject,
  detectLanguages,
  detectFrameworks,
  detectProjectType,
  detectBuildSystems,
  detectInfraSignals,
  detectDataStores,
  detectEntryPoints,
  type ProjectProfile,
} from '../../../src/analyze/detector';
import type { ScanResult, FileEntry, DirectoryEntry } from '../../../src/analyze/scanner';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeFile(relativePath: string, size = 100): FileEntry {
  const parts = relativePath.split('/');
  const name = parts[parts.length - 1];
  const ext = name.includes('.') ? '.' + name.split('.').pop()! : '';
  return {
    name,
    relativePath,
    size,
    extension: ext.toLowerCase(),
    lastModified: Date.now(),
  };
}

function makeDir(name: string, relativePath: string, files: FileEntry[] = [], directories: DirectoryEntry[] = []): DirectoryEntry {
  return { name, relativePath, files, directories };
}

function makeScanResult(opts: {
  rootFiles?: string[];
  nestedFiles?: string[];
  rootDirs?: DirectoryEntry[];
}): ScanResult {
  const rootFileEntries = (opts.rootFiles ?? []).map(f => makeFile(f));
  const nestedFileEntries = (opts.nestedFiles ?? []).map(f => makeFile(f));

  // Build language breakdown
  const languageBreakdown: Record<string, number> = {};
  const allFileEntries = [...rootFileEntries, ...nestedFileEntries];
  for (const f of allFileEntries) {
    const key = f.extension || '(no extension)';
    languageBreakdown[key] = (languageBreakdown[key] ?? 0) + 1;
  }

  // Build nested directory structure from nestedFiles
  const dirMap = new Map<string, DirectoryEntry>();
  for (const f of nestedFileEntries) {
    const parts = f.relativePath.split('/');
    if (parts.length < 2) continue;

    let currentPath = '';
    for (let i = 0; i < parts.length - 1; i++) {
      const parentPath = currentPath;
      currentPath = currentPath ? currentPath + '/' + parts[i] : parts[i];
      if (!dirMap.has(currentPath)) {
        dirMap.set(currentPath, makeDir(parts[i], currentPath));
      }
      // Link to parent
      if (parentPath && dirMap.has(parentPath)) {
        const parent = dirMap.get(parentPath)!;
        if (!parent.directories.some(d => d.relativePath === currentPath)) {
          parent.directories.push(dirMap.get(currentPath)!);
        }
      }
    }
    // Add file to its directory
    const dirPath = parts.slice(0, -1).join('/');
    if (dirMap.has(dirPath)) {
      dirMap.get(dirPath)!.files.push(f);
    }
  }

  // Get top-level nested directories
  const topDirs: DirectoryEntry[] = [];
  for (const [dirPath, dir] of dirMap) {
    if (!dirPath.includes('/')) {
      topDirs.push(dir);
    }
  }

  const rootDirs = opts.rootDirs ?? topDirs;

  const root: DirectoryEntry = {
    name: 'root',
    relativePath: '.',
    files: rootFileEntries,
    directories: rootDirs,
  };

  return {
    fileTree: { root },
    totalFiles: allFileEntries.length,
    totalDirs: dirMap.size,
    languageBreakdown,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('detectLanguages', () => {
  it('should detect TypeScript from .ts/.tsx files', () => {
    const scan = makeScanResult({
      nestedFiles: ['src/index.ts', 'src/App.tsx', 'src/util.ts'],
    });
    const langs = detectLanguages(scan);
    const ts = langs.find(l => l.name === 'TypeScript');
    expect(ts).toBeDefined();
    expect(ts!.fileCount).toBe(3);
    expect(ts!.extensions).toContain('.ts');
    expect(ts!.extensions).toContain('.tsx');
  });

  it('should detect JavaScript from .js/.jsx/.mjs files', () => {
    const scan = makeScanResult({
      nestedFiles: ['src/index.js', 'src/App.jsx', 'lib/util.mjs'],
    });
    const langs = detectLanguages(scan);
    const js = langs.find(l => l.name === 'JavaScript');
    expect(js).toBeDefined();
    expect(js!.fileCount).toBe(3);
  });

  it('should detect Python from .py files and config', () => {
    const scan = makeScanResult({
      rootFiles: ['requirements.txt'],
      nestedFiles: ['src/main.py', 'src/util.py'],
    });
    const langs = detectLanguages(scan);
    const py = langs.find(l => l.name === 'Python');
    expect(py).toBeDefined();
    expect(py!.fileCount).toBe(2);
  });

  it('should detect Go from config files', () => {
    const scan = makeScanResult({
      rootFiles: ['go.mod', 'go.sum'],
      nestedFiles: ['main.go', 'pkg/handler.go'],
    });
    const langs = detectLanguages(scan);
    const go = langs.find(l => l.name === 'Go');
    expect(go).toBeDefined();
    expect(go!.fileCount).toBe(2);
  });

  it('should detect Rust from Cargo.toml', () => {
    const scan = makeScanResult({
      rootFiles: ['Cargo.toml'],
      nestedFiles: ['src/main.rs', 'src/lib.rs'],
    });
    const langs = detectLanguages(scan);
    const rust = langs.find(l => l.name === 'Rust');
    expect(rust).toBeDefined();
    expect(rust!.fileCount).toBe(2);
  });

  it('should detect Java from pom.xml', () => {
    const scan = makeScanResult({
      rootFiles: ['pom.xml'],
      nestedFiles: ['src/main/java/App.java', 'src/main/java/Service.java'],
    });
    const langs = detectLanguages(scan);
    const java = langs.find(l => l.name === 'Java');
    expect(java).toBeDefined();
    expect(java!.fileCount).toBe(2);
  });

  it('should sort languages by file count descending', () => {
    const scan = makeScanResult({
      nestedFiles: [
        'a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts', // 5 TS
        'x.py', 'y.py', // 2 Python
        'z.go', // 1 Go
      ],
    });
    const langs = detectLanguages(scan);
    expect(langs[0].name).toBe('TypeScript');
    expect(langs[1].name).toBe('Python');
    expect(langs[2].name).toBe('Go');
  });

  it('should calculate percentage correctly', () => {
    const scan = makeScanResult({
      nestedFiles: ['a.ts', 'b.ts', 'c.py', 'd.py', 'e.py', 'f.py'],
    });
    const langs = detectLanguages(scan);
    const ts = langs.find(l => l.name === 'TypeScript')!;
    const py = langs.find(l => l.name === 'Python')!;
    expect(ts.percentage).toBeCloseTo(33.3, 0);
    expect(py.percentage).toBeCloseTo(66.7, 0);
  });

  it('should return empty array for empty scan', () => {
    const scan = makeScanResult({});
    const langs = detectLanguages(scan);
    expect(langs).toEqual([]);
  });

  it('should detect language from config file even without code files', () => {
    const scan = makeScanResult({
      rootFiles: ['go.mod'],
    });
    const langs = detectLanguages(scan);
    const go = langs.find(l => l.name === 'Go');
    expect(go).toBeDefined();
  });
});

describe('detectFrameworks', () => {
  it('should detect Next.js from next.config.js', () => {
    const scan = makeScanResult({
      rootFiles: ['package.json', 'next.config.js'],
      nestedFiles: ['src/app/page.tsx'],
    });
    const frameworks = detectFrameworks(scan);
    expect(frameworks.some(f => f.name === 'Next.js')).toBe(true);
    const nextjs = frameworks.find(f => f.name === 'Next.js')!;
    expect(nextjs.confidence).toBe('high');
    expect(nextjs.evidence).toBe('next.config.js');
  });

  it('should detect Vite from vite.config.ts', () => {
    const scan = makeScanResult({
      rootFiles: ['package.json', 'vite.config.ts'],
    });
    const frameworks = detectFrameworks(scan);
    expect(frameworks.some(f => f.name === 'Vite')).toBe(true);
  });

  it('should detect React from .tsx files', () => {
    const scan = makeScanResult({
      rootFiles: ['package.json'],
      nestedFiles: ['src/App.tsx', 'src/index.tsx'],
    });
    const frameworks = detectFrameworks(scan);
    expect(frameworks.some(f => f.name === 'React')).toBe(true);
    const react = frameworks.find(f => f.name === 'React')!;
    expect(react.confidence).toBe('medium');
  });

  it('should detect Django from manage.py', () => {
    const scan = makeScanResult({
      rootFiles: ['requirements.txt', 'manage.py'],
      nestedFiles: ['myapp/settings.py'],
    });
    const frameworks = detectFrameworks(scan);
    expect(frameworks.some(f => f.name === 'Django')).toBe(true);
  });

  it('should detect Angular from angular.json', () => {
    const scan = makeScanResult({
      rootFiles: ['angular.json', 'package.json'],
    });
    const frameworks = detectFrameworks(scan);
    expect(frameworks.some(f => f.name === 'Angular')).toBe(true);
    expect(frameworks.find(f => f.name === 'Angular')!.confidence).toBe('high');
  });

  it('should detect Vue from .vue files', () => {
    const scan = makeScanResult({
      nestedFiles: ['src/App.vue', 'src/components/Header.vue'],
    });
    const frameworks = detectFrameworks(scan);
    expect(frameworks.some(f => f.name === 'Vue')).toBe(true);
  });

  it('should detect Svelte from .svelte files', () => {
    const scan = makeScanResult({
      nestedFiles: ['src/App.svelte'],
    });
    const frameworks = detectFrameworks(scan);
    expect(frameworks.some(f => f.name === 'Svelte')).toBe(true);
  });

  it('should detect Tailwind CSS from config', () => {
    const scan = makeScanResult({
      rootFiles: ['tailwind.config.js'],
    });
    const frameworks = detectFrameworks(scan);
    expect(frameworks.some(f => f.name === 'Tailwind CSS')).toBe(true);
  });

  it('should detect multiple frameworks', () => {
    const scan = makeScanResult({
      rootFiles: ['package.json', 'vite.config.ts', 'tailwind.config.js'],
      nestedFiles: ['src/App.tsx'],
    });
    const frameworks = detectFrameworks(scan);
    expect(frameworks.some(f => f.name === 'Vite')).toBe(true);
    expect(frameworks.some(f => f.name === 'Tailwind CSS')).toBe(true);
    expect(frameworks.some(f => f.name === 'React')).toBe(true);
  });

  it('should detect Spring Boot from application.properties', () => {
    const scan = makeScanResult({
      rootFiles: ['pom.xml'],
      nestedFiles: ['src/main/resources/application.properties'],
    });
    const frameworks = detectFrameworks(scan);
    expect(frameworks.some(f => f.name === 'Spring Boot')).toBe(true);
  });

  it('should return empty for unknown project', () => {
    const scan = makeScanResult({
      rootFiles: ['README.md'],
    });
    const frameworks = detectFrameworks(scan);
    expect(frameworks).toEqual([]);
  });
});

describe('detectProjectType', () => {
  it('should detect monorepo from lerna.json', () => {
    const scan = makeScanResult({
      rootFiles: ['package.json', 'lerna.json'],
    });
    expect(detectProjectType(scan)).toBe('monorepo');
  });

  it('should detect monorepo from turbo.json', () => {
    const scan = makeScanResult({
      rootFiles: ['package.json', 'turbo.json'],
    });
    expect(detectProjectType(scan)).toBe('monorepo');
  });

  it('should detect monorepo from nx.json', () => {
    const scan = makeScanResult({
      rootFiles: ['package.json', 'nx.json'],
    });
    expect(detectProjectType(scan)).toBe('monorepo');
  });

  it('should detect monorepo from pnpm-workspace.yaml', () => {
    const scan = makeScanResult({
      rootFiles: ['package.json', 'pnpm-workspace.yaml'],
    });
    expect(detectProjectType(scan)).toBe('monorepo');
  });

  it('should detect monorepo from packages/ directory', () => {
    const packagesDir = makeDir('packages', 'packages', [makeFile('packages/core/index.ts')]);
    const scan = makeScanResult({
      rootFiles: ['package.json'],
      rootDirs: [packagesDir],
    });
    expect(detectProjectType(scan)).toBe('monorepo');
  });

  it('should detect monorepo from apps/ directory', () => {
    const appsDir = makeDir('apps', 'apps', [makeFile('apps/web/index.ts')]);
    const scan = makeScanResult({
      rootFiles: ['package.json'],
      rootDirs: [appsDir],
    });
    expect(detectProjectType(scan)).toBe('monorepo');
  });

  it('should detect microservices from multiple Dockerfiles', () => {
    const scan = makeScanResult({
      nestedFiles: [
        'api/Dockerfile',
        'worker/Dockerfile',
        'frontend/Dockerfile',
        'api/main.go',
        'worker/main.go',
      ],
    });
    expect(detectProjectType(scan)).toBe('microservices');
  });

  it('should detect microservices from docker-compose + 2 Dockerfiles', () => {
    const scan = makeScanResult({
      rootFiles: ['docker-compose.yml'],
      nestedFiles: [
        'api/Dockerfile',
        'worker/Dockerfile',
      ],
    });
    expect(detectProjectType(scan)).toBe('microservices');
  });

  it('should detect single-app for typical web project', () => {
    const scan = makeScanResult({
      rootFiles: ['package.json', 'vite.config.ts'],
      nestedFiles: ['src/index.tsx', 'src/App.tsx', 'public/index.html'],
    });
    expect(detectProjectType(scan)).toBe('single-app');
  });

  it('should detect library when build configs present but no app structure', () => {
    const scan = makeScanResult({
      rootFiles: ['package.json', 'tsconfig.build.json'],
      nestedFiles: ['src/index.ts', 'src/utils.ts'],
    });
    expect(detectProjectType(scan)).toBe('library');
  });

  it('should return unknown for empty project', () => {
    const scan = makeScanResult({});
    expect(detectProjectType(scan)).toBe('unknown');
  });
});

describe('detectBuildSystems', () => {
  it('should detect npm from package.json', () => {
    const scan = makeScanResult({ rootFiles: ['package.json'] });
    expect(detectBuildSystems(scan)).toContain('npm');
  });

  it('should detect yarn from yarn.lock', () => {
    const scan = makeScanResult({ rootFiles: ['package.json', 'yarn.lock'] });
    const systems = detectBuildSystems(scan);
    expect(systems).toContain('npm');
    expect(systems).toContain('yarn');
  });

  it('should detect cargo from Cargo.toml', () => {
    const scan = makeScanResult({ rootFiles: ['Cargo.toml'] });
    expect(detectBuildSystems(scan)).toContain('cargo');
  });

  it('should detect go modules from go.mod', () => {
    const scan = makeScanResult({ rootFiles: ['go.mod'] });
    expect(detectBuildSystems(scan)).toContain('go modules');
  });

  it('should detect maven from pom.xml', () => {
    const scan = makeScanResult({ rootFiles: ['pom.xml'] });
    expect(detectBuildSystems(scan)).toContain('maven');
  });

  it('should detect gradle from build.gradle', () => {
    const scan = makeScanResult({ rootFiles: ['build.gradle'] });
    expect(detectBuildSystems(scan)).toContain('gradle');
  });

  it('should detect multiple build systems', () => {
    const scan = makeScanResult({ rootFiles: ['package.json', 'Makefile'] });
    const systems = detectBuildSystems(scan);
    expect(systems).toContain('npm');
    expect(systems).toContain('make');
  });

  it('should return sorted results', () => {
    const scan = makeScanResult({ rootFiles: ['Makefile', 'package.json', 'Cargo.toml'] });
    const systems = detectBuildSystems(scan);
    expect(systems).toEqual([...systems].sort());
  });

  it('should return empty for no build system files', () => {
    const scan = makeScanResult({ rootFiles: ['README.md'] });
    expect(detectBuildSystems(scan)).toEqual([]);
  });
});

describe('detectInfraSignals', () => {
  it('should detect Docker from Dockerfile', () => {
    const scan = makeScanResult({ rootFiles: ['Dockerfile'] });
    const signals = detectInfraSignals(scan);
    expect(signals.some(s => s.type === 'docker')).toBe(true);
  });

  it('should detect docker-compose', () => {
    const scan = makeScanResult({ rootFiles: ['docker-compose.yml'] });
    const signals = detectInfraSignals(scan);
    expect(signals.some(s => s.type === 'docker-compose')).toBe(true);
  });

  it('should detect GitHub Actions', () => {
    const scan = makeScanResult({
      nestedFiles: ['.github/workflows/ci.yml'],
    });
    const signals = detectInfraSignals(scan);
    expect(signals.some(s => s.type === 'ci-github')).toBe(true);
  });

  it('should detect GitLab CI', () => {
    const scan = makeScanResult({ rootFiles: ['.gitlab-ci.yml'] });
    const signals = detectInfraSignals(scan);
    expect(signals.some(s => s.type === 'ci-gitlab')).toBe(true);
  });

  it('should detect Terraform', () => {
    const scan = makeScanResult({
      nestedFiles: ['infra/main.tf', 'infra/variables.tf'],
    });
    const signals = detectInfraSignals(scan);
    expect(signals.some(s => s.type === 'terraform')).toBe(true);
  });

  it('should detect Kubernetes from directory', () => {
    const scan = makeScanResult({
      nestedFiles: ['k8s/deployment.yaml', 'k8s/service.yaml'],
    });
    const signals = detectInfraSignals(scan);
    expect(signals.some(s => s.type === 'kubernetes')).toBe(true);
  });

  it('should detect Jenkins', () => {
    const scan = makeScanResult({ rootFiles: ['Jenkinsfile'] });
    const signals = detectInfraSignals(scan);
    expect(signals.some(s => s.type === 'ci-jenkins')).toBe(true);
  });

  it('should detect Vercel', () => {
    const scan = makeScanResult({ rootFiles: ['vercel.json'] });
    const signals = detectInfraSignals(scan);
    expect(signals.some(s => s.type === 'vercel')).toBe(true);
  });

  it('should detect Netlify', () => {
    const scan = makeScanResult({ rootFiles: ['netlify.toml'] });
    const signals = detectInfraSignals(scan);
    expect(signals.some(s => s.type === 'netlify')).toBe(true);
  });

  it('should detect multiple signals', () => {
    const scan = makeScanResult({
      rootFiles: ['docker-compose.yml', '.gitlab-ci.yml'],
      nestedFiles: ['Dockerfile', 'infra/main.tf'],
    });
    const signals = detectInfraSignals(scan);
    expect(signals.length).toBeGreaterThanOrEqual(3);
  });

  it('should return empty for bare project', () => {
    const scan = makeScanResult({ rootFiles: ['package.json'] });
    expect(detectInfraSignals(scan)).toEqual([]);
  });
});

describe('detectDataStores', () => {
  it('should detect Prisma from schema.prisma', () => {
    const scan = makeScanResult({
      nestedFiles: ['prisma/schema.prisma'],
    });
    const stores = detectDataStores(scan);
    expect(stores.some(s => s.type === 'prisma')).toBe(true);
  });

  it('should detect Drizzle from drizzle.config.ts', () => {
    const scan = makeScanResult({
      rootFiles: ['drizzle.config.ts'],
    });
    const stores = detectDataStores(scan);
    expect(stores.some(s => s.type === 'drizzle')).toBe(true);
  });

  it('should detect SQLite from .sqlite files', () => {
    const scan = makeScanResult({
      nestedFiles: ['data/app.sqlite'],
    });
    const stores = detectDataStores(scan);
    expect(stores.some(s => s.type === 'sqlite')).toBe(true);
  });

  it('should detect TypeORM from ormconfig', () => {
    const scan = makeScanResult({
      rootFiles: ['ormconfig.json'],
    });
    const stores = detectDataStores(scan);
    expect(stores.some(s => s.type === 'typeorm')).toBe(true);
  });

  it('should detect Protocol Buffers from .proto files', () => {
    const scan = makeScanResult({
      nestedFiles: ['proto/schema.proto'],
    });
    const stores = detectDataStores(scan);
    expect(stores.some(s => s.type === 'protobuf')).toBe(true);
  });

  it('should detect Firebase from firebase.json', () => {
    const scan = makeScanResult({
      rootFiles: ['firebase.json'],
    });
    const stores = detectDataStores(scan);
    expect(stores.some(s => s.type === 'firebase')).toBe(true);
  });

  it('should detect Knex from knexfile', () => {
    const scan = makeScanResult({
      rootFiles: ['knexfile.ts'],
    });
    const stores = detectDataStores(scan);
    expect(stores.some(s => s.type === 'knex')).toBe(true);
  });

  it('should return empty for project without data stores', () => {
    const scan = makeScanResult({ rootFiles: ['package.json'] });
    expect(detectDataStores(scan)).toEqual([]);
  });
});

describe('detectEntryPoints', () => {
  it('should detect src/index.ts', () => {
    const scan = makeScanResult({
      nestedFiles: ['src/index.ts', 'src/App.tsx'],
    });
    const entries = detectEntryPoints(scan);
    expect(entries).toContain('src/index.ts');
  });

  it('should detect main.go', () => {
    const scan = makeScanResult({
      rootFiles: ['main.go'],
      nestedFiles: ['pkg/handler.go'],
    });
    const entries = detectEntryPoints(scan);
    expect(entries).toContain('main.go');
  });

  it('should detect src/main.rs', () => {
    const scan = makeScanResult({
      nestedFiles: ['src/main.rs', 'src/lib.rs'],
    });
    const entries = detectEntryPoints(scan);
    expect(entries).toContain('src/main.rs');
    expect(entries).toContain('src/lib.rs');
  });

  it('should detect manage.py for Django', () => {
    const scan = makeScanResult({
      rootFiles: ['manage.py'],
      nestedFiles: ['myapp/settings.py'],
    });
    const entries = detectEntryPoints(scan);
    expect(entries).toContain('manage.py');
  });

  it('should detect multiple entry points', () => {
    const scan = makeScanResult({
      nestedFiles: ['src/index.ts', 'src/App.tsx', 'server.ts'],
    });
    const entries = detectEntryPoints(scan);
    expect(entries.length).toBeGreaterThanOrEqual(2);
  });

  it('should return empty when no entry points found', () => {
    const scan = makeScanResult({
      nestedFiles: ['docs/readme.md'],
    });
    expect(detectEntryPoints(scan)).toEqual([]);
  });
});

describe('detectProject (integration)', () => {
  it('should produce full ProjectProfile for a React + Vite project', () => {
    const scan = makeScanResult({
      rootFiles: ['package.json', 'vite.config.ts', 'tailwind.config.js', 'tsconfig.json'],
      nestedFiles: [
        'src/index.tsx',
        'src/App.tsx',
        'src/components/Header.tsx',
        'src/utils/format.ts',
        'src/styles/globals.css',
        'public/index.html',
        '.github/workflows/ci.yml',
      ],
    });

    const profile = detectProject(scan);

    expect(profile.languages.length).toBeGreaterThan(0);
    expect(profile.languages[0].name).toBe('TypeScript');
    expect(profile.frameworks.some(f => f.name === 'React')).toBe(true);
    expect(profile.frameworks.some(f => f.name === 'Vite')).toBe(true);
    expect(profile.frameworks.some(f => f.name === 'Tailwind CSS')).toBe(true);
    expect(profile.projectType).toBe('single-app');
    expect(profile.buildSystems).toContain('npm');
    expect(profile.infraSignals.some(s => s.type === 'ci-github')).toBe(true);
    expect(profile.entryPoints).toContain('src/index.tsx');
  });

  it('should produce full ProjectProfile for a Go microservices project', () => {
    const scan = makeScanResult({
      rootFiles: ['go.mod', 'docker-compose.yml', 'Makefile'],
      nestedFiles: [
        'cmd/api/main.go',
        'cmd/worker/main.go',
        'pkg/handler/handler.go',
        'api/Dockerfile',
        'worker/Dockerfile',
        'infra/main.tf',
      ],
    });

    const profile = detectProject(scan);

    expect(profile.languages.some(l => l.name === 'Go')).toBe(true);
    expect(profile.projectType).toBe('microservices');
    expect(profile.buildSystems).toContain('go modules');
    expect(profile.buildSystems).toContain('make');
    expect(profile.infraSignals.some(s => s.type === 'docker')).toBe(true);
    expect(profile.infraSignals.some(s => s.type === 'docker-compose')).toBe(true);
    expect(profile.infraSignals.some(s => s.type === 'terraform')).toBe(true);
  });

  it('should produce full ProjectProfile for a Python Django project', () => {
    const scan = makeScanResult({
      rootFiles: ['requirements.txt', 'Dockerfile', '.gitlab-ci.yml', 'manage.py'],
      nestedFiles: [
        'myapp/settings.py',
        'myapp/urls.py',
        'myapp/views.py',
        'myapp/models.py',
      ],
    });

    const profile = detectProject(scan);

    expect(profile.languages.some(l => l.name === 'Python')).toBe(true);
    expect(profile.frameworks.some(f => f.name === 'Django')).toBe(true);
    expect(profile.projectType).toBe('single-app');
    expect(profile.infraSignals.some(s => s.type === 'docker')).toBe(true);
    expect(profile.infraSignals.some(s => s.type === 'ci-gitlab')).toBe(true);
    expect(profile.entryPoints).toContain('manage.py');
  });

  it('should produce full ProjectProfile for a monorepo', () => {
    const packagesDir = makeDir('packages', 'packages');
    const scan = makeScanResult({
      rootFiles: ['package.json', 'turbo.json', 'pnpm-workspace.yaml'],
      rootDirs: [packagesDir],
      nestedFiles: [
        'packages/ui/src/index.ts',
        'packages/api/src/index.ts',
        '.github/workflows/ci.yml',
      ],
    });

    const profile = detectProject(scan);

    expect(profile.projectType).toBe('monorepo');
    expect(profile.buildSystems).toContain('npm');
    expect(profile.buildSystems).toContain('pnpm');
  });

  it('should handle empty ScanResult gracefully', () => {
    const scan: ScanResult = {
      fileTree: {
        root: { name: 'root', relativePath: '.', files: [], directories: [] },
      },
      totalFiles: 0,
      totalDirs: 0,
      languageBreakdown: {},
    };

    const profile = detectProject(scan);

    expect(profile.languages).toEqual([]);
    expect(profile.frameworks).toEqual([]);
    expect(profile.projectType).toBe('unknown');
    expect(profile.buildSystems).toEqual([]);
    expect(profile.infraSignals).toEqual([]);
    expect(profile.dataStores).toEqual([]);
    expect(profile.entryPoints).toEqual([]);
  });

  it('should produce full ProjectProfile for a Rust project', () => {
    const scan = makeScanResult({
      rootFiles: ['Cargo.toml', 'Cargo.lock'],
      nestedFiles: ['src/main.rs', 'src/lib.rs', 'src/utils.rs'],
    });

    const profile = detectProject(scan);

    expect(profile.languages.some(l => l.name === 'Rust')).toBe(true);
    expect(profile.buildSystems).toContain('cargo');
    expect(profile.entryPoints).toContain('src/main.rs');
    expect(profile.entryPoints).toContain('src/lib.rs');
  });
});
