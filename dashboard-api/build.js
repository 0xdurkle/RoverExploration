#!/usr/bin/env node
// Build script that works from any directory
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Get the directory where this script is located
const scriptDir = __dirname;
const currentDir = process.cwd();

console.log('Build script location:', scriptDir);
console.log('Current working directory:', currentDir);

// Try multiple possible locations for tsconfig.json
const possiblePaths = [
  path.join(scriptDir, 'tsconfig.json'),                    // Same dir as build.js
  path.join(currentDir, 'tsconfig.json'),                   // Current working dir
  path.join(currentDir, 'dashboard-api', 'tsconfig.json'),  // dashboard-api subdir from root
  path.join('/app', 'dashboard-api', 'tsconfig.json'),      // Absolute path from Railway /app
  path.join(process.cwd(), 'dashboard-api', 'tsconfig.json'), // dashboard-api from cwd
  path.join(__dirname, 'tsconfig.json'),                     // Same as scriptDir but explicit
];

let foundPath = null;
let workDir = null;

for (const tsconfigPath of possiblePaths) {
  console.log('Checking:', tsconfigPath);
  if (fs.existsSync(tsconfigPath)) {
    foundPath = tsconfigPath;
    workDir = path.dirname(tsconfigPath);
    console.log('✅ Found tsconfig.json at:', foundPath);
    console.log('✅ Working directory:', workDir);
    break;
  }
}

if (!foundPath) {
  console.error('❌ Could not find tsconfig.json in any of these locations:');
  possiblePaths.forEach(p => console.error('  -', p));
  process.exit(1);
}

// Change to the directory with tsconfig.json and run tsc
process.chdir(workDir);
console.log('Running tsc in:', process.cwd());
execSync('npx tsc', { stdio: 'inherit' });
