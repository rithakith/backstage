/**
 * bootstrap-all.js
 *
 * Finds every workspace package whose "main" points to src/index.ts
 * (meaning the CLI will try to transpile it on-the-fly), and compiles
 * them with tsc directly so Node 24 can load them as plain CommonJS.
 *
 * Usage: node bootstrap-all.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = __dirname;

// ── 1. Collect all workspace package dirs ──────────────────────────────────
function getWorkspaceDirs() {
  const rootPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const patterns = rootPkg.workspaces?.packages || ['packages/*', 'plugins/*'];
  const dirs = [];
  for (const pattern of patterns) {
    // We only handle simple globs like "packages/*"
    const base = pattern.replace(/\/\*$/, '');
    const baseDir = path.join(ROOT, base);
    if (!fs.existsSync(baseDir)) continue;
    for (const entry of fs.readdirSync(baseDir)) {
      const full = path.join(baseDir, entry);
      if (fs.statSync(full).isDirectory()) dirs.push(full);
    }
  }
  return dirs;
}

// ── 2. Detect packages that load from src at runtime ──────────────────────
function needsBootstrap(pkgDir) {
  const pkgJsonPath = path.join(pkgDir, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) return false;
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  return (
    typeof pkg.main === 'string' && pkg.main.startsWith('src/')
  );
}

// ── 3. Check if a package already has a compiled dist ─────────────────────
function hasCompiledDist(pkgDir) {
  const distDir = path.join(pkgDir, 'dist');
  if (!fs.existsSync(distDir)) return false;
  const files = fs.readdirSync(distDir);
  // Look for any .js file in dist
  return files.some(f => f.endsWith('.js'));
}

// ── 4. Compile a single package with tsc ──────────────────────────────────
function compilePkg(pkgDir, pkgName) {
  const srcIndex = path.join(pkgDir, 'src', 'index.ts');
  if (!fs.existsSync(srcIndex)) {
    console.log(`  [SKIP] ${pkgName} — no src/index.ts found`);
    return false;
  }

  const distDir = path.join(pkgDir, 'dist');
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

  try {
    execSync(
      [
        'npx tsc',
        `"${srcIndex}"`,
        '--outDir', `"${distDir}"`,
        '--module', 'commonjs',
        '--target', 'es2019',
        '--moduleResolution', 'node',
        '--esModuleInterop',
        '--allowSyntheticDefaultImports',
        '--declaration',
        '--skipLibCheck',
        '--noEmit', 'false',
      ].join(' '),
      { cwd: pkgDir, stdio: 'pipe' }
    );

    // tsc puts the file at dist/src/index.js — flatten it to dist/index.cjs.js
    const tscOut = path.join(distDir, 'src', 'index.js');
    const tscOutFlat = path.join(distDir, 'index.js');
    const finalOut = path.join(distDir, 'index.cjs.js');

    if (fs.existsSync(tscOut)) {
      fs.renameSync(tscOut, finalOut);
      // Clean up the empty dist/src directory
      try { fs.rmdirSync(path.join(distDir, 'src'), { recursive: true }); } catch {}
    } else if (fs.existsSync(tscOutFlat)) {
      fs.renameSync(tscOutFlat, finalOut);
    } else {
      // tsc compiled everything into dist — just find the first .js file
      const js = fs.readdirSync(distDir).find(f => f.endsWith('.js'));
      if (js && js !== 'index.cjs.js') {
        fs.copyFileSync(path.join(distDir, js), finalOut);
      }
    }

    return true;
  } catch (err) {
    // tsc might print type errors but still emit — check if we got output
    const tscOut = path.join(distDir, 'src', 'index.js');
    const finalOut = path.join(distDir, 'index.cjs.js');

    if (fs.existsSync(tscOut)) {
      fs.renameSync(tscOut, finalOut);
      try { fs.rmdirSync(path.join(distDir, 'src'), { recursive: true }); } catch {}
      return true;
    }
    if (fs.existsSync(finalOut)) return true;

    console.log(`  [WARN] ${pkgName} — tsc failed, skipping`);
    return false;
  }
}

// ── 5. Update package.json "main" to point at dist ────────────────────────
function patchPackageJson(pkgDir, pkgName) {
  const pkgJsonPath = path.join(pkgDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

  const distCjs = path.join(pkgDir, 'dist', 'index.cjs.js');
  if (!fs.existsSync(distCjs)) {
    console.log(`  [SKIP patch] ${pkgName} — no dist/index.cjs.js`);
    return;
  }

  if (pkg.main !== 'dist/index.cjs.js') {
    pkg.main = 'dist/index.cjs.js';
    fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    console.log(`  [PATCHED] ${pkgName} — main → dist/index.cjs.js`);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────
console.log('=== Backstage Node 24 Bootstrap ===\n');
console.log('Scanning workspace packages...\n');

const allDirs = getWorkspaceDirs();
const toBootstrap = allDirs.filter(needsBootstrap);

console.log(`Found ${toBootstrap.length} packages with main="src/..." that need bootstrapping.\n`);

let compiled = 0;
let skipped = 0;
let already = 0;

for (const dir of toBootstrap) {
  const pkgName = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).name;

  if (hasCompiledDist(dir)) {
    patchPackageJson(dir, pkgName);
    already++;
    continue;
  }

  process.stdout.write(`Compiling ${pkgName}...`);
  const ok = compilePkg(dir, pkgName);
  if (ok) {
    process.stdout.write(' ✓\n');
    patchPackageJson(dir, pkgName);
    compiled++;
  } else {
    process.stdout.write(' ✗ (skipped)\n');
    skipped++;
  }
}

console.log(`\n=== Done ===`);
console.log(`  Already compiled: ${already}`);
console.log(`  Newly compiled:   ${compiled}`);
console.log(`  Skipped/failed:   ${skipped}`);
console.log('\nYou can now run:');
console.log('  yarn workspace @rk-apim/backstage-plugin-wso2-api-manager build');
console.log('  yarn workspace @rk-apim/backstage-plugin-wso2-api-manager-backend build');
console.log('  yarn workspace @rk-apim/backstage-plugin-catalog-backend-module-wso2-apim build');
