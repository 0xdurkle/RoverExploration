import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

let cachedBiomesData: any = null;
let lastLoadTime = 0;
const CACHE_TTL = 5000; // Reload every 5 seconds max (for hot-reloading)

function getBiomesPath(): string {
  const possiblePaths = [
    join(__dirname, 'biomes.json'),
    join(process.cwd(), 'src/data/biomes.json'),
    join(process.cwd(), 'data/biomes.json'),
  ];
  const path = possiblePaths.find(p => existsSync(p));
  if (!path) {
    throw new Error(`biomes.json not found. Tried: ${possiblePaths.join(', ')}`);
  }
  return path;
}

export function loadBiomesData(): any {
  const now = Date.now();
  // Reload if cache is stale or doesn't exist
  if (!cachedBiomesData || (now - lastLoadTime) > CACHE_TTL) {
    const biomesPath = getBiomesPath();
    cachedBiomesData = JSON.parse(readFileSync(biomesPath, 'utf-8'));
    lastLoadTime = now;
  }
  return cachedBiomesData;
}

export function reloadBiomesData(): void {
  cachedBiomesData = null;
  loadBiomesData();
  console.log('✅ Biomes data reloaded');
}

export function getBiomesPathForSync(): string {
  return getBiomesPath();
}

