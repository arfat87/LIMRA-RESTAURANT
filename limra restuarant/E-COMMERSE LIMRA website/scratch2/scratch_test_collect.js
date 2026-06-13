import fs from 'fs/promises';
import { createReadStream } from 'fs';
import { createHash } from 'crypto';
import path from 'path';

const sourceDirectory = 'c:\\MY_ALL_ITEM\\ALL_PROJECT\\biuld with Ai\\E-COMMERSE LIMRA\\dist';
const EXCLUDED_DEPLOYMENT_SEGMENTS = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.insforge']);

function shouldExcludeDeploymentPath(normalizedName) {
  const segments = normalizedName.split("/");
  if (segments.some((segment) => segment === ".env" || segment.startsWith(".env."))) {
    return true;
  }
  if (segments.some((segment) => EXCLUDED_DEPLOYMENT_SEGMENTS.has(segment))) {
    return true;
  }
  return normalizedName === ".DS_Store" || normalizedName.endsWith("/.DS_Store") || normalizedName.endsWith(".log");
}

function normalizeRelativePath(rootDirectory, absolutePath) {
  return path.relative(rootDirectory, absolutePath).split(path.sep).join("/").replace(/\\/g, "/");
}

async function hashFile(filePath) {
  const hash = createHash("sha1");
  let size = 0;
  for await (const chunk of createReadStream(filePath)) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    hash.update(buffer);
  }
  return { sha: hash.digest("hex"), size };
}

async function collectDeploymentFiles(sourceDirectory) {
  const files = [];
  async function walk(currentDirectory) {
    const entries = await fs.readdir(currentDirectory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const absolutePath = path.join(currentDirectory, entry.name);
      const normalizedPath = normalizeRelativePath(sourceDirectory, absolutePath);
      if (!normalizedPath || shouldExcludeDeploymentPath(normalizedPath)) {
        continue;
      }
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      console.log(`Hashing: ${normalizedPath}...`);
      const { sha, size } = await hashFile(absolutePath);
      files.push({
        absolutePath,
        path: normalizedPath,
        sha,
        size
      });
    }
  }
  await walk(sourceDirectory);
  return files;
}

async function main() {
  console.log('Starting collectDeploymentFiles test...');
  const start = Date.now();
  const files = await collectDeploymentFiles(sourceDirectory);
  console.log(`Finished collecting ${files.length} files in ${Date.now() - start}ms.`);
}

main().catch(console.error);
