import fs from 'fs/promises';
import { readFileSync } from 'fs';
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
  const data = readFileSync(filePath);
  const hash = createHash("sha1");
  hash.update(data);
  return { sha: hash.digest("hex"), size: data.length, buffer: data };
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
      const { sha, size, buffer } = await hashFile(absolutePath);
      files.push({
        absolutePath,
        path: normalizedPath,
        sha,
        size,
        buffer
      });
    }
  }
  await walk(sourceDirectory);
  return files;
}

// Helper for concurrency
async function runWithConcurrency(tasks, concurrency, processor) {
  const results = [];
  const queue = [...tasks];
  const activeWorkers = [];

  const worker = async () => {
    while (queue.length > 0) {
      const task = queue.shift();
      try {
        const result = await processor(task);
        results.push(result);
      } catch (err) {
        console.error(`Error processing task:`, err);
        throw err;
      }
    }
  };

  for (let i = 0; i < Math.min(concurrency, tasks.length); i++) {
    activeWorkers.push(worker());
  }

  await Promise.all(activeWorkers);
  return results;
}

async function main() {
  console.log('Collecting and hashing frontend files...');
  const files = await collectDeploymentFiles(sourceDirectory);
  console.log(`Found ${files.length} files to deploy.`);
  
  const manifestFiles = files.map(({ path: p, sha, size }) => ({ path: p, sha, size }));
  
  console.log(`Creating direct deployment session...`);
  const createRes = await fetch(`${API_BASE_URL}/api/deployments/direct`, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ files: manifestFiles })
  });
  
  if (!createRes.ok) {
    throw new Error(`Failed to create deployment session: ${createRes.status} ${await createRes.text()}`);
  }
  
  const createResult = await createRes.json();
  const deploymentId = createResult.id;
  console.log(`Deployment Session Created: ${deploymentId}`);
  
  // Find which files need to be uploaded
  const filesToUpload = createResult.files.filter(f => !f.uploadedAt);
  console.log(`Need to upload ${filesToUpload.length} files (concurrency 3, robust retries enabled)...`);
  
  const localFileMap = new Map(files.map(f => [f.path, f]));
  
  let uploadedCount = 0;
  await runWithConcurrency(filesToUpload, 3, async (manifestFile) => {
    const localFile = localFileMap.get(manifestFile.path);
    if (!localFile) {
      throw new Error(`Backend requested file not present locally: ${manifestFile.path}`);
    }
    
    const uploadUrl = `${API_BASE_URL}/api/deployments/${encodeURIComponent(deploymentId)}/files/${encodeURIComponent(manifestFile.fileId)}/content`;
    
    let attempts = 0;
    let uploadSuccess = false;
    let lastError = null;
    
    while (!uploadSuccess && attempts < 3) {
      attempts++;
      try {
        const putRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'x-api-key': API_KEY,
            'Content-Type': 'application/octet-stream',
            'Content-Length': String(localFile.size)
          },
          body: localFile.buffer
        });
        
        if (!putRes.ok) {
          throw new Error(`HTTP ${putRes.status}: ${await putRes.text()}`);
        }
        
        uploadSuccess = true;
      } catch (err) {
        lastError = err;
        console.warn(`[Upload Retry] Attempt ${attempts} failed for ${manifestFile.path}. Error: ${err.message || err}`);
        if (attempts < 3) {
          await new Promise(r => setTimeout(r, 1500)); // Wait 1.5s before retry
        }
      }
    }
    
    if (!uploadSuccess) {
      throw new Error(`Failed to upload ${manifestFile.path} after 3 attempts. Last error: ${lastError?.message || lastError}`);
    }
    
    uploadedCount++;
    if (uploadedCount % 20 === 0 || uploadedCount === filesToUpload.length) {
      console.log(`Uploaded ${uploadedCount}/${filesToUpload.length} files...`);
    }
  });
  
  console.log(`All files uploaded! Triggering deployment build with STATIC settings...`);
  const startRes = await fetch(`${API_BASE_URL}/api/deployments/${encodeURIComponent(deploymentId)}/start`, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      projectSettings: {
        buildCommand: "echo 'skipping build'",
        installCommand: "echo 'skipping install'",
        outputDirectory: "."
      }
    })
  });
  
  if (!startRes.ok) {
    throw new Error(`Failed to start deployment: ${startRes.status} ${await startRes.text()}`);
  }
  
  const startResult = await startRes.json();
  console.log(`Deployment build started successfully!`);
  console.log('Start Result:', JSON.stringify(startResult, null, 2));
  
  // Monitor the deployment status
  console.log('\nMonitoring deployment status...');
  let buildCompleted = false;
  let attempts = 0;
  
  while (!buildCompleted && attempts < 30) {
    attempts++;
    await new Promise(r => setTimeout(r, 4000));
    
    const statusRes = await fetch(`${API_BASE_URL}/api/deployments/${encodeURIComponent(deploymentId)}`, {
      method: 'GET',
      headers: {
        'x-api-key': API_KEY
      }
    });
    
    if (statusRes.ok) {
      const deployInfo = await statusRes.json();
      console.log(`Attempt ${attempts}: Status is ${deployInfo.status || 'UNKNOWN'}`);
      
      const status = (deployInfo.status || '').toUpperCase();
      if (status === 'READY' || status === 'COMPLETED' || status === 'SUCCESS') {
        console.log(`\n🎉 Deployment Succeeded!`);
        console.log(`Global Live URL: ${deployInfo.liveUrl || deployInfo.url || 'https://vb9ucr22.insforge.site'}`);
        console.log('Full Info:', JSON.stringify(deployInfo, null, 2));
        buildCompleted = true;
        break;
      } else if (status === 'FAILED' || status === 'ERROR') {
        console.error(`\n❌ Deployment Failed!`);
        console.error(JSON.stringify(deployInfo, null, 2));
        process.exit(1);
      }
    } else {
      console.log(`Attempt ${attempts}: Failed to get status (HTTP ${statusRes.status})`);
    }
  }
  
  if (!buildCompleted) {
    console.log('\nMonitoring timed out. Check the Vercel dashboard or deployments dashboard for final status.');
  }
}

main().catch(err => {
  console.error('\nFatal Deployment Error:', err);
  process.exit(1);
});
