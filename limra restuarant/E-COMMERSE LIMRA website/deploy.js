import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';

console.log('====================================================');
console.log('🚀 LIMRA RESTAURANT — INSFORGE PRODUCTION DEPLOYMENT');
console.log('====================================================');

// 1. Build fresh frontend production bundle
console.log('\n📦 Step 1: Building production bundle (vite build)...');
try {
  execSync('npm run build', { stdio: 'inherit' });
} catch (err) {
  console.error('❌ Build failed:', err.message);
  process.exit(1);
}

// 2. Read configuration
let projectConfig;
try {
  projectConfig = JSON.parse(fs.readFileSync('.insforge/project.json', 'utf8'));
} catch (err) {
  console.error('❌ Failed to read .insforge/project.json:', err.message);
  process.exit(1);
}

const API_BASE_URL = projectConfig.oss_host || 'https://vb9ucr22.us-east.insforge.app';
const API_KEY = projectConfig.api_key;
const SOURCE_DIR = path.resolve('dist');

console.log(`\n📡 Step 2: Preparing deployment artifacts`);
console.log(`Source Directory: ${SOURCE_DIR}`);
console.log(`API Base URL: ${API_BASE_URL}`);

function getRelativePath(absolutePath) {
  return path.relative(SOURCE_DIR, absolutePath).split(path.sep).join('/').replace(/\\/g, '/');
}

function shouldExclude(normalizedPath) {
  const segments = normalizedPath.split('/');
  if (segments.some(seg => seg === '.env' || seg.startsWith('.env.'))) return true;
  const excludedSegments = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.insforge']);
  if (segments.some(seg => excludedSegments.has(seg))) return true;
  return normalizedPath === '.DS_Store' || normalizedPath.endsWith('/.DS_Store') || normalizedPath.endsWith('.log');
}

async function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    let size = 0;
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => {
      size += chunk.length;
      hash.update(chunk);
    });
    stream.on('end', () => {
      resolve({ sha: hash.digest('hex'), size });
    });
    stream.on('error', err => reject(err));
  });
}

async function collectFiles(dir) {
  const files = [];
  async function walk(currentDir) {
    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = getRelativePath(fullPath);
      if (shouldExclude(relPath)) continue;
      
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const { sha, size } = await hashFile(fullPath);
        files.push({
          absolutePath: fullPath,
          path: relPath,
          sha,
          size
        });
      }
    }
  }
  await walk(dir);
  return files;
}

async function api(pathname, init = {}) {
  const headers = {
    'x-api-key': API_KEY,
    ...(init.headers || {}),
  };
  const response = await fetch(API_BASE_URL + pathname, { ...init, headers });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!response.ok) {
    throw new Error(data && typeof data === 'object' ? data.message || data.error || 'Request failed' : 'Request failed: ' + response.status);
  }
  return data;
}

async function run() {
  console.log('\n📂 Step 3: Scanning files...');
  const files = await collectFiles(SOURCE_DIR);
  console.log(`Found ${files.length} production files.`);

  const manifestFiles = files.map(({ path: p, sha, size }) => ({ path: p, sha, size }));
  
  console.log('\n🚀 Step 4: Creating deployment session...');
  const session = await api('/api/deployments/direct', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: manifestFiles })
  });

  const deploymentId = session.id;
  console.log(`Deployment Session Created. ID: ${deploymentId}`);
  console.log(`Files needing upload: ${session.files.length}`);

  const localFileByPath = new Map(files.map(f => [f.path, f]));

  // Upload files with concurrency
  const concurrency = 8;
  let nextIndex = 0;

  async function uploadWorker() {
    while (nextIndex < session.files.length) {
      const fileToUpload = session.files[nextIndex++];
      const localFile = localFileByPath.get(fileToUpload.path);
      if (!localFile) {
        throw new Error(`Session requested file not found locally: ${fileToUpload.path}`);
      }
      console.log(`Uploading [${nextIndex}/${session.files.length}] ${fileToUpload.path} (${localFile.size} bytes)...`);
      
      const response = await fetch(
        `${API_BASE_URL}/api/deployments/${encodeURIComponent(deploymentId)}/files/${encodeURIComponent(fileToUpload.fileId)}/content`,
        {
          method: 'PUT',
          headers: {
            'x-api-key': API_KEY,
            'Content-Type': 'application/octet-stream',
            'Content-Length': String(localFile.size)
          },
          body: fs.createReadStream(localFile.absolutePath),
          duplex: 'half'
        }
      );
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to upload ${fileToUpload.path}: ${response.statusText} - ${text}`);
      }
    }
  }

  if (session.files.length > 0) {
    console.log('\n⬆️ Step 5: Uploading files to InsForge Edge Storage...');
    const workers = Array.from({ length: Math.min(concurrency, session.files.length) }, () => uploadWorker());
    await Promise.all(workers);
    console.log('All files uploaded successfully.');
  } else {
    console.log('⚡ All files cached/identical — skipping file upload.');
  }

  console.log('\n🏁 Step 6: Triggering deployment activation...');
  const startResult = await api(`/api/deployments/${encodeURIComponent(deploymentId)}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });

  console.log('Deployment activation initiated.');

  // Poll deployment status
  console.log('\n⏳ Step 7: Verifying live health check...');
  let deploymentStatus = null;
  let attempts = 0;
  while (attempts < 20) {
    attempts++;
    const statusData = await api(`/api/deployments/${encodeURIComponent(deploymentId)}`);
    deploymentStatus = statusData;
    console.log(`Live Status (attempt ${attempts}): ${statusData.status}`);
    if (statusData.status === 'success' || statusData.status === 'ready' || statusData.status === 'active') {
      console.log('✅ Deployment is LIVE and Healthy!');
      break;
    }
    if (statusData.status === 'failed' || statusData.status === 'error') {
      throw new Error(`Deployment failed: ${JSON.stringify(statusData, null, 2)}`);
    }
    await new Promise(resolve => setTimeout(resolve, 2500));
  }

  const liveUrl = `https://${projectConfig.appkey}.insforge.site`;

  console.log('\n====================================================');
  console.log('🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!');
  console.log(`Deployment ID: ${deploymentId}`);
  console.log(`Live Production URL: ${liveUrl}`);
  console.log(`Admin Dashboard:     ${liveUrl}/admin.html`);
  console.log('====================================================\n');
}

run().catch(error => {
  console.error('\n❌ Deployment Error:', error);
  process.exit(1);
});
