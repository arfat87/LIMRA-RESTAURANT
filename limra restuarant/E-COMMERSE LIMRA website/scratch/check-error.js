import fs from 'fs';

const projectConfig = JSON.parse(fs.readFileSync('.insforge/project.json', 'utf8'));
const API_BASE_URL = projectConfig.oss_host;
const API_KEY = projectConfig.api_key;

const deploymentId = 'b17dd3f7-2983-44a6-9658-60681e9a5362';

async function run() {
  const headers = { 'x-api-key': API_KEY };
  const response = await fetch(`${API_BASE_URL}/api/deployments/${encodeURIComponent(deploymentId)}`, { headers });
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

run().catch(console.error);
