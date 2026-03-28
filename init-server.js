/**
 * Initialize script for Electron application
 * Copies necessary dependencies from frontend node_modules
 */

const fs = require('fs');
const path = require('path');

console.log('Initializing server dependencies...');

const appDir = __dirname;
const frontendNodeModules = path.join(appDir, 'frontend', 'node_modules');
const rootNodeModules = path.join(appDir, 'node_modules');

// Ensure node_modules directory exists
if (!fs.existsSync(rootNodeModules)) {
  fs.mkdirSync(rootNodeModules, { recursive: true });
  console.log('Created node_modules directory');
}

// List of dependencies to copy
const dependenciesToCopy = [
  'tesseract.js',
  '@imgur',
  'tesseract.js-core',
];

for (const dep of dependenciesToCopy) {
  const sourcePath = path.join(frontendNodeModules, dep);
  const targetPath = path.join(rootNodeModules, dep);

  if (fs.existsSync(sourcePath)) {
    console.log(`Copying ${dep}...`);

    // Remove target if it exists
    if (fs.existsSync(targetPath)) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    }

    // Copy recursively
    copyRecursiveSync(sourcePath, targetPath);

    console.log(`✓ Copied ${dep}`);
  } else {
    console.log(`⚠ Skipped ${dep} (not found in frontend node_modules)`);
  }
}

console.log('\n✓ Initialization complete!');
console.log('Server dependencies are ready.');

/**
 * Recursive copy function
 */
function copyRecursiveSync(source, target) {
  const stat = fs.statSync(source);

  if (stat.isDirectory()) {
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }

    const files = fs.readdirSync(source);
    files.forEach(file => {
      const srcPath = path.join(source, file);
      const destPath = path.join(target, file);
      copyRecursiveSync(srcPath, destPath);
    });
  } else {
    fs.copyFileSync(source, target);
  }
}
