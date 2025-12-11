#!/usr/bin/env node
// Build script that works from any directory
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Get the directory where this script is located
const scriptDir = __dirname;
const tsconfigPath = path.join(scriptDir, 'tsconfig.json');

// Check if tsconfig.json exists in script directory
if (fs.existsSync(tsconfigPath)) {
  // We're in the right directory, just run tsc
  console.log('Running tsc from:', scriptDir);
  process.chdir(scriptDir);
  execSync('npx tsc', { stdio: 'inherit' });
} else {
  // Try dashboard-api subdirectory
  const dashboardApiPath = path.join(process.cwd(), 'dashboard-api', 'tsconfig.json');
  if (fs.existsSync(dashboardApiPath)) {
    console.log('Running tsc from:', path.join(process.cwd(), 'dashboard-api'));
    process.chdir(path.join(process.cwd(), 'dashboard-api'));
    execSync('npx tsc', { stdio: 'inherit' });
  } else {
    console.error('Could not find tsconfig.json');
    process.exit(1);
  }
}
