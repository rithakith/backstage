/**
 * Compiles the core Backstage packages that the CLI needs to boot,
 * using esbuild which handles all TS/directory imports automatically.
 */
const path = require('path');
const fs = require('fs');

// Try to load esbuild from various locations
let esbuild;
const candidates = [
  './node_modules/esbuild',
  './packages/cli/node_modules/esbuild',
];
for (const c of candidates) {
  try { esbuild = require(c); break; } catch {}
}
if (!esbuild) {
  console.error('esbuild not found. Run: yarn add -W esbuild');
  process.exit(1);
}

const ROOT = __dirname;

// Packages that need to be compiled for the CLI to boot.
// Order matters: compile leaves first.
const PACKAGES = [
  { dir: 'packages/types',       externals: [] },
  { dir: 'packages/errors',      externals: ['@backstage/types', 'serialize-error'] },
  { dir: 'packages/config',      externals: ['@backstage/types', '@backstage/errors', 'ms'] },
  { dir: 'packages/cli-common',  externals: ['@backstage/*'] },
  { dir: 'packages/cli-node',    externals: ['@backstage/*', 'fs-extra', 'semver', 'chalk', 'ora', 'minimatch', 'tar'] },
  { dir: 'packages/release-manifests', externals: ['@backstage/*'] },
  { dir: 'packages/integration', externals: ['@backstage/*', 'node-fetch', 'minimatch', 'parse-url', 'js-yaml', '@octokit/*'] },
  { dir: 'packages/config-loader', externals: ['@backstage/*', 'js-yaml', 'json-schema', 'minimatch', 'fs-extra'] },
  { dir: 'packages/catalog-model', externals: ['@backstage/*', 'ajv', 'js-yaml', 'lodash', 'json-schema-traverse'] },
];

async function buildPkg({ dir, externals }) {
  const pkgDir = path.join(ROOT, dir);
  const pkgJsonPath = path.join(pkgDir, 'package.json');
  const srcIndex = path.join(pkgDir, 'src', 'index.ts');

  if (!fs.existsSync(srcIndex)) {
    console.log(`[SKIP] ${dir} — no src/index.ts`);
    return;
  }

  const distDir = path.join(pkgDir, 'dist');
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

  const outfile = path.join(distDir, 'index.cjs.js');

  // Build all external patterns
  const allExternals = [
    ...externals,
    'node:*',
  ];

  try {
    await esbuild.build({
      entryPoints: [srcIndex],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      outfile,
      external: allExternals,
      logLevel: 'silent',
      // Allow .ts files in paths
      resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    });

    // Patch package.json
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    const changed = pkg.main !== 'dist/index.cjs.js';
    pkg.main = 'dist/index.cjs.js';
    if (changed) {
      fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n');
    }

    console.log(`[OK] ${dir}`);
  } catch (err) {
    console.error(`[FAIL] ${dir}: ${err.message.split('\n')[0]}`);
  }
}

(async () => {
  console.log('Building core packages with esbuild...\n');
  for (const pkg of PACKAGES) {
    await buildPkg(pkg);
  }
  console.log('\nDone! Now run:');
  console.log('  yarn workspace @rk-apim/backstage-plugin-wso2-api-manager build');
})();
