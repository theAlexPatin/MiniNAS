import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { resetDb, createTestUser, createTestVolume } from "../helpers.js";
import {
  resolveVolumePath,
  getVolume,
  listDirectory,
  getFileInfo,
  deleteEntry,
  moveEntry,
  createDirectory,
} from "../../src/services/filesystem.js";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const testRoot = join(tmpdir(), "mininas-fs-test");

function setupTestFiles(): void {
  mkdirSync(join(testRoot, "docs"), { recursive: true });
  mkdirSync(join(testRoot, "images"), { recursive: true });
  writeFileSync(join(testRoot, "readme.txt"), "hello");
  writeFileSync(join(testRoot, "docs", "notes.md"), "# Notes");
  writeFileSync(join(testRoot, "images", "photo.jpg"), "fake-jpg");
  writeFileSync(join(testRoot, ".hidden"), "secret");
}

beforeEach(() => {
  resetDb();
  rmSync(testRoot, { recursive: true, force: true });
  setupTestFiles();
  createTestUser("admin1", "admin", "admin");
  createTestVolume("v1", "Test Vol", testRoot);
});

afterAll(() => {
  try {
    rmSync(testRoot, { recursive: true });
  } catch {}
});

describe("resolveVolumePath", () => {
  const vol = { id: "v1", label: "Test", path: testRoot };

  it("resolves simple paths", () => {
    const resolved = resolveVolumePath(vol, "docs/notes.md");
    expect(resolved).toBe(join(testRoot, "docs/notes.md"));
  });

  it("resolves root path", () => {
    expect(resolveVolumePath(vol, "")).toBe(testRoot);
    expect(resolveVolumePath(vol, ".")).toBe(testRoot);
  });

  it("neutralizes .. traversal to stay within volume", () => {
    // The implementation strips leading ../ sequences after normalize,
    // so ../../etc/passwd becomes etc/passwd within the volume
    const result = resolveVolumePath(vol, "../../etc/passwd");
    expect(result.startsWith(testRoot)).toBe(true);
    expect(result).toBe(join(testRoot, "etc/passwd"));
  });

  it("neutralizes pure parent traversal to volume root", () => {
    const result = resolveVolumePath(vol, "../../../");
    expect(result).toBe(testRoot);
  });
});

describe("getVolume", () => {
  it("returns volume for valid id", () => {
    const vol = getVolume("v1");
    expect(vol.id).toBe("v1");
    expect(vol.path).toBe(testRoot);
  });

  it("throws 404 for non-existent volume", () => {
    expect(() => getVolume("nope")).toThrow();
  });

  it("throws 403 when user lacks access", () => {
    createTestUser("u1", "alice");
    createTestVolume("priv", "Private", testRoot + "/sub", "private");
    mkdirSync(testRoot + "/sub", { recursive: true });
    expect(() => getVolume("priv", "u1")).toThrow();
  });
});

describe("listDirectory", () => {
  it("lists root directory", async () => {
    const vol = { id: "v1", label: "Test", path: testRoot };
    const entries = await listDirectory(vol, "");
    const names = entries.map((e) => e.name);
    // Directories first, then files, hidden excluded
    expect(names).toContain("docs");
    expect(names).toContain("images");
    expect(names).toContain("readme.txt");
    expect(names).not.toContain(".hidden");
  });

  it("lists subdirectory", async () => {
    const vol = { id: "v1", label: "Test", path: testRoot };
    const entries = await listDirectory(vol, "docs");
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("notes.md");
  });

  it("includes dotfiles when requested", async () => {
    const vol = { id: "v1", label: "Test", path: testRoot };
    const entries = await listDirectory(vol, "", { includeDotfiles: true });
    const names = entries.map((e) => e.name);
    expect(names).toContain(".hidden");
  });

  it("sorts directories first", async () => {
    const vol = { id: "v1", label: "Test", path: testRoot };
    const entries = await listDirectory(vol, "");
    const firstDirIdx = entries.findIndex((e) => e.isDirectory);
    const lastDirIdx = entries.findLastIndex((e) => e.isDirectory);
    const firstFileIdx = entries.findIndex((e) => !e.isDirectory);

    if (firstDirIdx !== -1 && firstFileIdx !== -1) {
      expect(lastDirIdx).toBeLessThan(firstFileIdx);
    }
  });
});

describe("getFileInfo", () => {
  it("returns file info", async () => {
    const vol = { id: "v1", label: "Test", path: testRoot };
    const info = await getFileInfo(vol, "readme.txt");
    expect(info.name).toBe("readme.txt");
    expect(info.isDirectory).toBe(false);
    expect(info.size).toBeGreaterThan(0);
    expect(info.mimeType).toBe("text/plain");
  });

  it("returns directory info", async () => {
    const vol = { id: "v1", label: "Test", path: testRoot };
    const info = await getFileInfo(vol, "docs");
    expect(info.name).toBe("docs");
    expect(info.isDirectory).toBe(true);
    expect(info.mimeType).toBeNull();
  });
});

describe("createDirectory", () => {
  it("creates a new directory", async () => {
    const vol = { id: "v1", label: "Test", path: testRoot };
    await createDirectory(vol, "", "newdir");
    expect(existsSync(join(testRoot, "newdir"))).toBe(true);
  });

  it("rejects names with path separators", async () => {
    const vol = { id: "v1", label: "Test", path: testRoot };
    await expect(createDirectory(vol, "", "bad/name")).rejects.toThrow();
  });

  it("rejects names with ..", async () => {
    const vol = { id: "v1", label: "Test", path: testRoot };
    await expect(createDirectory(vol, "", "..")).rejects.toThrow();
  });
});

describe("deleteEntry", () => {
  it("deletes a file", async () => {
    const vol = { id: "v1", label: "Test", path: testRoot };
    await deleteEntry(vol, "readme.txt");
    expect(existsSync(join(testRoot, "readme.txt"))).toBe(false);
  });

  it("deletes a directory recursively", async () => {
    const vol = { id: "v1", label: "Test", path: testRoot };
    await deleteEntry(vol, "docs");
    expect(existsSync(join(testRoot, "docs"))).toBe(false);
  });

  it("refuses to delete volume root", async () => {
    const vol = { id: "v1", label: "Test", path: testRoot };
    await expect(deleteEntry(vol, "")).rejects.toThrow();
  });
});

describe("moveEntry", () => {
  it("renames a file", async () => {
    const vol = { id: "v1", label: "Test", path: testRoot };
    await moveEntry(vol, "readme.txt", "renamed.txt");
    expect(existsSync(join(testRoot, "readme.txt"))).toBe(false);
    expect(existsSync(join(testRoot, "renamed.txt"))).toBe(true);
  });

  it("moves a file to subdirectory", async () => {
    const vol = { id: "v1", label: "Test", path: testRoot };
    await moveEntry(vol, "readme.txt", "docs/readme.txt");
    expect(existsSync(join(testRoot, "docs", "readme.txt"))).toBe(true);
  });
});
