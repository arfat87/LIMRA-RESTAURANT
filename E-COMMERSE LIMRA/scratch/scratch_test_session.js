import fs from 'fs/promises';
import { createReadStream } from 'fs';
import { createHash } from 'crypto';
import path from 'path';

const API_BASE_URL = 'https://vb9ucr22.us-east.insforge.app';
const API_KEY = 'ik_799af068e8f4fb05944d04497229fe7d';
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
  console.log('Collecting files...');
  const files = await collectDeploymentFiles(sourceDirectory);
  const manifestFiles = files.map(({ path: p, sha, size }) => ({ path: p, sha, size }));
  
  console.log(`Sending direct deployment creation request to ${API_BASE_URL}...`);
  const start = Date.now();
  const res = await fetch(`${API_BASE_URL}/api/deployments/direct`, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ files: manifestFiles })
  });
  
  console.log(`Status: ${res.status} (${Date.now() - start}ms)`);
  const body = await res.text();
  console.log('Response body:', body.slice(0, 1000));
}

main().catch(console.error);
