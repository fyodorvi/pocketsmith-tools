import { promises as fs } from 'fs';
import path from 'path';

export async function ensureDirectoryExists(directory: string): Promise<void> {
  try {
    await fs.mkdir(directory, { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const data = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(data) as T;
}

export async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}
