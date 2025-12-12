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

// List files in current directory for debugging
try {
  console.log('Files in current directory:', fs.readdirSync(currentDir).join(', '));
  if (fs.existsSync(path.join(currentDir, 'dashboard-api'))) {
    console.log('Files in dashboard-api:', fs.readdirSync(path.join(currentDir, 'dashboard-api')).join(', '));
  }
} catch (e) {
  console.log('Could not list files:', e.message);
}

// Try multiple possible locations for tsconfig.json
// Railway seems to run from /app even with Root Directory set
const possiblePaths = [
  path.join(scriptDir, 'tsconfig.json'),                    // Same dir as build.js
  path.join(currentDir, 'tsconfig.json'),                   // Current working dir
  path.join('/app', 'dashboard-api', 'tsconfig.json'),      // Absolute path from Railway /app
  path.join(currentDir, 'dashboard-api', 'tsconfig.json'),  // dashboard-api subdir from root
  path.join(process.cwd(), 'dashboard-api', 'tsconfig.json'), // dashboard-api from cwd
];

// Also check if we need to look for dashboard-api folder
if (currentDir === '/app' || currentDir.endsWith('/app')) {
  // We're in Railway's /app, look for dashboard-api subfolder
  const dashboardApiPath = '/app/dashboard-api/tsconfig.json';
  if (!possiblePaths.includes(dashboardApiPath)) {
    possiblePaths.unshift(dashboardApiPath); // Check this first
  }
}

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
