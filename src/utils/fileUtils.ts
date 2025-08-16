import { promises as fs } from 'fs';
import path from 'path';
import { PocketSmithEvent, CacheMetadata } from '../types';

/**
 * Get cache file path for a specific month
 * @param year Year
 * @param month Month (1-12)
 * @returns Path to cache file
 */
export function getCacheFilePath(year: number, month: number): string {
  return path.join(process.cwd(), 'cache', `events-${year}-${month.toString().padStart(2, '0')}.json`);
}

/**
 * Get metadata file path for a specific month
 * @param year Year
 * @param month Month (1-12)
 * @returns Path to metadata file
 */
export function getMetadataFilePath(year: number, month: number): string {
  return path.join(process.cwd(), 'cache', `metadata-${year}-${month.toString().padStart(2, '0')}.json`);
}

/**
 * Check if cache exists for a specific month
 * @param year Year
 * @param month Month (1-12)
 * @returns True if cache exists
 */
export async function cacheExists(year: number, month: number): Promise<boolean> {
  try {
    const cachePath = getCacheFilePath(year, month);
    const metadataPath = getMetadataFilePath(year, month);
    
    await fs.access(cachePath);
    await fs.access(metadataPath);
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Load cached events for a specific month
 * @param year Year
 * @param month Month (1-12)
 * @returns Cached events or null if not found
 */
export async function loadCachedEvents(year: number, month: number): Promise<PocketSmithEvent[] | null> {
  try {
    if (!(await cacheExists(year, month))) {
      return null;
    }
    
    const cachePath = getCacheFilePath(year, month);
    const data = await fs.readFile(cachePath, 'utf-8');
    
    return JSON.parse(data) as PocketSmithEvent[];
  } catch (error) {
    console.warn(`Failed to load cached events for ${year}-${month}:`, error);
    return null;
  }
}

/**
 * Save events to cache
 * @param year Year
 * @param month Month (1-12)
 * @param events Events to cache
 */
export async function saveCachedEvents(year: number, month: number, events: PocketSmithEvent[]): Promise<void> {
  try {
    // Ensure cache directory exists
    const cacheDir = path.join(process.cwd(), 'cache');
    await fs.mkdir(cacheDir, { recursive: true });
    
    const cachePath = getCacheFilePath(year, month);
    const metadataPath = getMetadataFilePath(year, month);
    
    // Save events
    await fs.writeFile(cachePath, JSON.stringify(events, null, 2));
    
    // Save metadata
    const metadata: CacheMetadata = {
      year,
      month,
      cachedAt: new Date().toISOString(),
      eventCount: events.length
    };
    
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    
    console.log(`Cached ${events.length} events for ${year}-${month.toString().padStart(2, '0')}`);
  } catch (error) {
    console.error(`Failed to save cached events for ${year}-${month}:`, error);
    throw error;
  }
}

/**
 * Get cache metadata for a specific month
 * @param year Year
 * @param month Month (1-12)
 * @returns Cache metadata or null if not found
 */
export async function getCacheMetadata(year: number, month: number): Promise<CacheMetadata | null> {
  try {
    if (!(await cacheExists(year, month))) {
      return null;
    }
    
    const metadataPath = getMetadataFilePath(year, month);
    const data = await fs.readFile(metadataPath, 'utf-8');
    
    return JSON.parse(data) as CacheMetadata;
  } catch (error) {
    console.warn(`Failed to load cache metadata for ${year}-${month}:`, error);
    return null;
  }
}
