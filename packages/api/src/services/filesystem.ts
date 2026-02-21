import fs from "node:fs/promises";
import path from "node:path";
import { HTTPException } from "hono/http-exception";
import mime from "mime-types";
import { config, type VolumeConfig } from "../config.js";
import type { FileEntry } from "../types/api.js";

export function getVolume(volumeId: string): VolumeConfig {
  const volume = config.volumes.find((v) => v.id === volumeId);
  if (!volume) {
    throw new HTTPException(404, { message: `Volume '${volumeId}' not found` });
  }
  return volume;
}

/**
 * Resolve a user-provided path within a volume, preventing path traversal.
 * This is the security-critical function that ALL file operations must use.
 */
export function resolveVolumePath(
  volume: VolumeConfig,
  relativePath: string
): string {
  // Normalize to strip .. sequences, then resolve to absolute
  const normalized = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
  const resolved = path.resolve(volume.path, normalized);

  // Verify the resolved path is within the volume root
  if (!resolved.startsWith(volume.path)) {
    throw new HTTPException(403, {
      message: "Access denied: path escapes volume root",
    });
  }

  return resolved;
}

export async function listDirectory(
  volume: VolumeConfig,
  relativePath: string
): Promise<FileEntry[]> {
  const dirPath = resolveVolumePath(volume, relativePath);

  const stat = await fs.stat(dirPath);
  if (!stat.isDirectory()) {
    throw new HTTPException(400, { message: "Path is not a directory" });
  }

  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const results: FileEntry[] = [];

  for (const entry of entries) {
    // Skip hidden files (dotfiles)
    if (entry.name.startsWith(".")) continue;

    const entryPath = path.join(dirPath, entry.name);
    try {
      const entryStat = await fs.stat(entryPath);
      const relPath = path.relative(volume.path, entryPath);
      results.push({
        name: entry.name,
        path: relPath,
        isDirectory: entry.isDirectory(),
        size: entryStat.size,
        modifiedAt: entryStat.mtime.toISOString(),
        mimeType: entry.isDirectory()
          ? null
          : mime.lookup(entry.name) || null,
      });
    } catch {
      // Skip entries we can't stat (e.g. broken symlinks)
      continue;
    }
  }

  // Directories first, then alphabetical
  results.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  return results;
}

export async function getFileInfo(
  volume: VolumeConfig,
  relativePath: string
): Promise<FileEntry> {
  const filePath = resolveVolumePath(volume, relativePath);
  const stat = await fs.stat(filePath);
  const name = path.basename(filePath);
  const relPath = path.relative(volume.path, filePath);

  return {
    name,
    path: relPath,
    isDirectory: stat.isDirectory(),
    size: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    mimeType: stat.isDirectory() ? null : mime.lookup(name) || null,
  };
}

export async function deleteEntry(
  volume: VolumeConfig,
  relativePath: string
): Promise<void> {
  const targetPath = resolveVolumePath(volume, relativePath);

  // Prevent deleting the volume root
  if (targetPath === volume.path) {
    throw new HTTPException(403, { message: "Cannot delete volume root" });
  }

  await fs.rm(targetPath, { recursive: true });
}

export async function moveEntry(
  volume: VolumeConfig,
  relativePath: string,
  destinationRelative: string
): Promise<void> {
  const sourcePath = resolveVolumePath(volume, relativePath);
  const destPath = resolveVolumePath(volume, destinationRelative);

  if (sourcePath === volume.path) {
    throw new HTTPException(403, { message: "Cannot move volume root" });
  }

  // Check destination parent exists
  const destParent = path.dirname(destPath);
  await fs.access(destParent);

  await fs.rename(sourcePath, destPath);
}

export async function createDirectory(
  volume: VolumeConfig,
  parentRelative: string,
  name: string
): Promise<void> {
  const parentPath = resolveVolumePath(volume, parentRelative);

  // Validate name doesn't contain path separators
  if (name.includes("/") || name.includes("\\") || name.includes("..")) {
    throw new HTTPException(400, { message: "Invalid directory name" });
  }

  const newDirPath = path.join(parentPath, name);

  // Re-verify the new path is within bounds
  if (!newDirPath.startsWith(volume.path)) {
    throw new HTTPException(403, { message: "Access denied" });
  }

  await fs.mkdir(newDirPath, { recursive: false });
}

export async function getVolumeStats(volume: VolumeConfig) {
  const stats = await fs.statfs(volume.path);
  const totalBytes = stats.blocks * stats.bsize;
  const freeBytes = stats.bfree * stats.bsize;

  return {
    id: volume.id,
    label: volume.label,
    totalBytes,
    freeBytes,
    usedBytes: totalBytes - freeBytes,
  };
}
