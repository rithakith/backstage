const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const errorsDir = path.join(__dirname, 'packages', 'errors');

console.log('Compiling @backstage/errors...');
try {
  // Use tsc to compile to CommonJS
  execSync('npx tsc src/index.ts --outDir dist --module commonjs --target es2019 --esModuleInterop --skipLibCheck', { 
    cwd: errorsDir, 
    stdio: 'inherit' 
  });
  
  // Rename index.js to index.cjs.js to match package.json "main"
  const distIndex = path.join(errorsDir, 'dist', 'index.js');
  const targetIndex = path.join(errorsDir, 'dist', 'index.cjs.js');
  
  if (fs.existsSync(distIndex)) {
    fs.renameSync(distIndex, targetIndex);
    console.log('Successfully compiled and mapped @backstage/errors to CommonJS!');
  } else {
    console.error('tsc finished but dist/index.js was not found.');
  }
} catch (e) {
  console.error('Failed to compile @backstage/errors:', e.message);
}
