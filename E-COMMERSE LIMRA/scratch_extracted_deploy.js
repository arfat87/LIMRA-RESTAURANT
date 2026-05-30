        'Content-Type': 'application/octet-stream',
        'Content-Length': String(localFile.size),
      },
      body: createReadStream(localFile.absolutePath),
      duplex: 'half',
    }
  );

  await readJsonResponse(response);
}

const rootDirectory = process.cwd();
const localFiles = await collectFiles(rootDirectory);
if (localFiles.length === 0) throw new Error('No deployable files found after applying exclusions.');

const createResult = await api('/api/deployments/direct', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    files: localFiles.map(({ path, sha, size }) => ({ path, sha, size })),
  }),
});

if (!createResult || !Array.isArray(createResult.files)) {
  throw new Error('Direct deployment endpoint returned an unexpected response.');
}

const deploymentId = createResult.id;
const localFileByPath = new Map(localFiles.map((file) => [file.path, file]));
const uploadConcurrency = getUploadConcurrency();
console.log('Created deployment. Deployment ID: ' + deploymentId);

await runWithConcurrency(createResult.files, uploadConcurrency, async (manifestFile) => {
  const localFile = localFileByPath.get(manifestFile.path);
  if (!localFile) throw new Error('Backend returned an unknown file path: ' + manifestFile.path);
  if (localFile.sha !== manifestFile.sha || localFile.size !== manifestFile.size) {
    throw new Error('Backend file metadata mismatch for: ' + manifestFile.path);
  }
  await uploadFile(deploymentId, manifestFile, localFile);
});

console.log('Deployment files uploaded. Deployment ID: ' + deploymentId);
console.log('Uploaded ' + createResult.files.length + ' files through direct deployment proxy with concurrency ' + uploadConcurrency + '.');
NODE
\`\`\`

After the script succeeds, call the \`start-deployment\` tool with the printed deployment ID.

If the upload is interrupted after the deployment ID is printed, query \`deployments.files\` with the raw SQL tool for that \`deployment_id\` to inspect \`uploaded_at\`. You can rerun \`create-deployment\` to create a fresh deployment, or upload missing file IDs to \`PUT /api/deployments/:id/files/:fileId/content\` using the queried manifest rows.`;
}
function registerDeploymentTools(ctx) {
  const {
    API_BASE_URL,
    backendVersion,
    isRemote,
    registerTool,
    withUsageTracking,
    getApiKey,
    addBackgroundContext
  } = ctx;
  const supportsDirectDeployment = supportsDirectDeploymentVersion(backendVersion);
  registerTool(
    "get-container-logs",
    "Get latest logs from a specific container/service. Use this to help debug problems with your app.",
    {
      apiKey: z29.string().optional().describe("API key for authentication (optional if provided via --api_key)"),
      source: z29.enum(["insforge.logs", "postgREST.logs", "postgres.logs", "function.logs"]).describe("Log source to retrieve"),
      limit: z29.number().optional().default(20).describe("Number of logs to return (default: 20)")
    },
    withUsageTracking("get-container-logs", async ({ apiKey, source, limit }) => {
      try {
        const actualApiKey = getApiKey(apiKey);
        const queryParams = new URLSearchParams();
        if (limit) queryParams.append("limit", limit.toString());
        let response = await fetch6(`${API_BASE_URL}/api/logs/${source}?${queryParams}`, {
          method: "GET",
          headers: { "x-api-key": actualApiKey }
        });
        if (response.status === 404) {
          response = await fetch6(`${API_BASE_URL}/api/logs/analytics/${source}?${queryParams}`, {
            method: "GET",
            headers: { "x-api-key": actualApiKey }
          });
        }
        const result = await handleApiResponse(response);
        return await addBackgroundContext({
          content: [
            { type: "text", text: formatSuccessMessage(`Latest logs from ${source}`, result) }
          ]
        });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [{ type: "text", text: `Error retrieving container logs: ${errMsg}` }],
          isError: true
        };
      }
    })
  );
  if (isRemote) {
    registerTool(
      "create-deployment",
      "Prepare a deployment upload. Direct-capable backends return direct file upload commands. Older backends use the legacy zip upload flow. After uploading, call the start-deployment tool to trigger the build.",
      {
        sourceDirectory: z29.string().describe(
          'Absolute path to the source directory containing files to deploy (e.g., /Users/name/project). Do not use relative paths like "."'
        )
      },
      withUsageTracking("create-deployment", async ({ sourceDirectory }) => {
        try {
          if (!isAbsoluteSourcePath(sourceDirectory)) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error: sourceDirectory must be an absolute path, not a relative path like "${sourceDirectory}". Please provide the full path to the source directory (e.g., /Users/name/project on macOS/Linux or C:\\Users\\name\\project on Windows).`
                }
              ],
              isError: true
            };
          }
          if (supportsDirectDeployment) {
            return {
              content: [
                {
                  type: "text",
                  text: buildRemoteDirectUploadInstructions(API_BASE_URL, sourceDirectory)
                }
              ]
            };
          }
          const createResponse = await fetch6(`${API_BASE_URL}/api/deployments`, {
            method: "POST",
            headers: {
              "x-api-key": getApiKey(),
              "Content-Type": "application/json"
            }
          });
          const createResult = parseCreateDeploymentResponse(
            await handleApiResponse(createResponse)
          );
          const { id: deploymentId, uploadUrl, uploadFields } = createResult;
          const esc = shellEsc;
          const curlFields = Object.entries(uploadFields).map(([key, value]) => `-F ${esc(`${key}=${value}`)}`).join(" \\\n  ");
          const escapedDir = esc(sourceDirectory);
          const tmpZip = `/tmp/insforge-deploy-${deploymentId}.zip`;
          const instructions = `Deployment prepared successfully. Deployment ID: ${deploymentId}

Please execute the following commands locally, then call the \`start-deployment\` tool:

## Step 1: Zip the source directory
\`\`\`bash
cd ${escapedDir} && zip -r ${tmpZip} .   -x "node_modules/*" ".git/*" ".next/*" ".env*" "dist/*" "build/*" ".insforge/*" ".DS_Store" "*.log"
\`\`\`

## Step 2: Upload the zip file
\`\`\`bash
curl -X POST ${esc(uploadUrl)}   ${curlFields}   -F 'file=@${tmpZip};type=application/zip'
\`\`\`

## Step 3: Clean up
\`\`\`bash
rm /tmp/insforge-deploy-${deploymentId}.zip
\`\`\`

## Step 4: Trigger the build
Call the \`start-deployment\` tool with deploymentId: "${deploymentId}"

Run each step in order. If any step fails, do not proceed to the next step.`;
          return {
            content: [{ type: "text", text: instructions }]
          };
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : "Unknown error occurred";
          return {
            content: [{ type: "text", text: `Error preparing deployment: ${errMsg}` }],
            isError: true
          };
        }
      })
    );
    registerTool(
      "start-deployment",
      "Trigger a deployment build after uploading source code. Use this after executing the upload commands from create-deployment.",
      {
        deploymentId: z29.string().describe("The deployment ID returned by create-deployment"),
        ...startDeploymentRequestSchema.shape
      },
      withUsageTracking(
        "start-deployment",
        async ({ deploymentId, projectSettings, envVars, meta }) => {
          try {
            const startBody = {};
            if (projectSettings) startBody.projectSettings = projectSettings;
            if (envVars) startBody.envVars = envVars;
            if (meta) startBody.meta = meta;
            const startResponse = await fetch6(
              `${API_BASE_URL}/api/deployments/${encodeURIComponent(deploymentId)}/start`,
              {
                method: "POST",
                headers: {
                  "x-api-key": getApiKey(),
                  "Content-Type": "application/json"
                },
                body: JSON.stringify(startBody)
              }
            );
            const startResult = await handleApiResponse(startResponse);
            return await addBackgroundContext({
              content: [
                {
                  type: "text",
                  text: formatSuccessMessage("Deployment started", startResult) + `

${supportsDirectDeployment ? isInsforgeCloudApiBaseUrl(API_BASE_URL) ? "Note: You can check deployment status by querying the deployments.runs table." : "Note: For self-hosted direct deployments, check the result in your Vercel dashboard instead of InsForge deployment logs." : "Note: You can check deployment status by querying the deployments.runs table."}`
                }
              ]
            });
          } catch (error) {
            const errMsg = error instanceof Error ? error.message : "Unknown error occurred";
            return {
              content: [{ type: "text", text: `Error starting deployment: ${errMsg}` }],
              isError: true
            };
          }
        }
      )
    );
  } else {
    registerTool(
      "create-deployment",
      "Deploy source code from a directory. Uses parallel direct file uploads for direct-capable backends, with legacy zip upload fallback for older projects.",
      {
        sourceDirectory: z29.string().describe(
          'Absolute path to the source directory containing files to deploy (e.g., /Users/name/project or C:\\Users\\name\\project). Do not use relative paths like "."'
        ),
        ...startDeploymentRequestSchema.shape
      },
      withUsageTracking(
        "create-deployment",
        async ({ sourceDirectory, projectSettings, envVars, meta }) => {
          try {
            if (!isAbsoluteSourcePath(sourceDirectory)) {
              return {
                content: [
                  {
                    type: "text",
                    text: `Error: sourceDirectory must be an absolute path, not a relative path like "${sourceDirectory}". Please provide the full path to the source directory (e.g., /Users/name/project on macOS/Linux or C:\\Users\\name\\project on Windows).`
                  }
                ],
                isError: true
              };
            }
            try {
              const stats = await fs3.stat(sourceDirectory);
              if (!stats.isDirectory()) {
                return {
                  content: [
                    {
                      type: "text",
                      text: `Error: "${sourceDirectory}" is not a directory. Please provide a path to a directory containing the source code.`
                    }
                  ],
                  isError: true
                };
              }
            } catch {
              return {
                content: [
                  {
                    type: "text",
                    text: `Error: Directory "${sourceDirectory}" does not exist or is not accessible. Please verify the path is correct.`
                  }
                ],
                isError: true
              };
            }
            const resolvedSourceDir = sourceDirectory;
            const startBody = buildStartBody({ projectSettings, envVars, meta });
            if (supportsDirectDeployment) {
              try {
                const { fileCount, uploadConcurrency, startResult: startResult2 } = await deployDirect(
                  API_BASE_URL,
                  getApiKey(),
                  resolvedSourceDir,
                  startBody
                );
                const uploadSummary = `Uploaded ${fileCount} files through direct deployment proxy with concurrency ${uploadConcurrency}.`;
                return await addBackgroundContext({
                  content: [
                    {
                      type: "text",
                      text: formatSuccessMessage("Deployment started", startResult2) + `

${uploadSummary}

${isInsforgeCloudApiBaseUrl(API_BASE_URL) ? "Note: You can check deployment status by querying the deployments.runs table. If file uploads are interrupted, inspect deployments.files with the raw SQL tool to see which files are already uploaded before retrying missing files." : "Note: For self-hosted direct deployments, check the result in your Vercel dashboard instead of InsForge deployment logs. If file uploads are interrupted, inspect deployments.files with the raw SQL tool to see which files are already uploaded before retrying missing files."}`
                    }
                  ]
                });
              } catch (error) {
                if (!(error instanceof DirectDeploymentUnsupportedError)) {
                  throw error;
                }
              }
            }
            const createResponse = await fetch6(`${API_BASE_URL}/api/deployments`, {
              method: "POST",
              headers: {
                "x-api-key": getApiKey(),
                "Content-Type": "application/json"
              }
            });
            const createResult = parseCreateDeploymentResponse(
              await handleApiResponse(createResponse)
            );
            const { id: deploymentId, uploadUrl, uploadFields } = createResult;
            const tmpZipPath = join2(tmpdir2(), `insforge-deploy-${deploymentId}.zip`);
            try {
              await new Promise((resolve, reject) => {
                const archive = archiver("zip", { zlib: { level: 9 } });
                const output = createWriteStream(tmpZipPath);
                output.on("close", resolve);
                output.on("error", reject);
                archive.on("error", reject);
                archive.directory(resolvedSourceDir, false, (entry) => {
                  const normalizedName = entry.name.replace(/\\/g, "/");
                  if (shouldExcludeDeploymentPath(normalizedName)) return false;
                  return entry;
                });
                archive.pipe(output);
                archive.finalize();
              });
              const { size: zipSize } = await fs3.stat(tmpZipPath);
              const uploadFormData = new FormData2();
              for (const [key, value] of Object.entries(uploadFields)) {
                uploadFormData.append(key, value);
              }
              uploadFormData.append("file", createReadStream(tmpZipPath), {
                filename: "deployment.zip",
                contentType: "application/zip",
                knownLength: zipSize
              });
              const uploadResponse = await fetch6(uploadUrl, {
                method: "POST",
                body: uploadFormData,
                headers: uploadFormData.getHeaders()
              });
              if (!uploadResponse.ok) {
                const uploadError = await uploadResponse.text();
                throw new Error(`Failed to upload zip file: ${uploadError}`);
              }
            } finally {
              await fs3.rm(tmpZipPath, { force: true }).catch(() => void 0);
            }
            const startResult = await startDeployment(
              API_BASE_URL,
              getApiKey(),
              deploymentId,
              startBody
            );
            return await addBackgroundContext({
              content: [
                {
                  type: "text",
                  text: formatSuccessMessage("Deployment started", startResult) + "\n\nNote: You can check deployment status by querying the deployments.runs table."
                }
              ]
            });
          } catch (error) {
            const errMsg = error instanceof Error ? error.message : "Unknown error occurred";
            return {
              content: [{ type: "text", text: `Error creating deployment: ${errMsg}` }],
              isError: true
            };
          }
        }
      )
    );
  }
}

// src/shared/tools/index.ts
var TOOL_VERSION_REQUIREMENTS = {
  // Schedule tools - require backend v1.1.1+
  // 'upsert-schedule': { minVersion: '1.1.1' },
  // 'delete-schedule': { minVersion: '1.1.1' },
  // 'get-schedules': { minVersion: '1.1.1' },
  // 'get-schedule-logs': { minVersion: '1.1.1' },
  "create-deployment": { minVersion: "1.4.7" },
  "fetch-sdk-docs": { minVersion: "1.5.1" }
  // Example of a deprecated tool (uncomment when needed):
  // 'legacy-tool': { minVersion: '1.0.0', maxVersion: '1.5.0' },
};
var LOCAL_ONLY_TOOLS = /* @__PURE__ */ new Set([
  "bulk-upsert"
  // Requires reading local data file (filePath is required)
]);
function compareVersions(v1, v2) {
  const clean1 = v1.replace(/^v/, "").split("-")[0];
  const clean2 = v2.replace(/^v/, "").split("-")[0];
  const parts1 = clean1.split(".").map(Number);
  const parts2 = clean2.split(".").map(Number);
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;
    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }
  return 0;
}
function shouldRegisterTool(toolName, backendVersion) {
  const requirement = TOOL_VERSION_REQUIREMENTS[toolName];
  if (!requirement) return true;
  const { minVersion, maxVersion } = requirement;
  if (minVersion && compareVersions(backendVersion, minVersion) < 0) return false;
  if (maxVersion && compareVersions(backendVersion, maxVersion) > 0) return false;
  return true;
}
async function fetchBackendVersion(apiBaseUrl) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1e4);
  try {
    const response = await fetch7(`${apiBaseUrl}/api/health`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`Health check failed with status ${response.status}`);
    }
    const health = await response.json();
    if (!health.version || typeof health.version !== "string") {
      throw new Error("Health check returned invalid version field");
    }
    return health.version;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Health check timed out after 10s \u2014 is the backend running at ${apiBaseUrl}?`,
        { cause: error }
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
async function registerInsforgeTools(server, config = {}) {
  const GLOBAL_API_KEY = config.apiKey || process.env.API_KEY || "";
  const API_BASE_URL = config.apiBaseUrl || process.env.API_BASE_URL || "http://localhost:7130";
  const isRemote = config.mode === "remote";
  const usageTracker = new UsageTracker(API_BASE_URL, GLOBAL_API_KEY, {
    projectId: config.projectId,
    accessToken: config.accessToken,
    isRemote
  });
  let backendVersion;
  try {
    backendVersion = await fetchBackendVersion(API_BASE_URL);
    console.error(`Backend version: ${backendVersion}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`Failed to fetch backend version: ${msg}`);
    throw new Error(`Cannot initialize tools: backend at ${API_BASE_URL} is unreachable. ${msg}`, {
      cause: error
    });
  }
  let toolCount = 0;
  const registerTool = (toolName, ...args) => {
    if (isRemote && LOCAL_ONLY_TOOLS.has(toolName)) {
      console.error(`Skipping tool '${toolName}': requires local filesystem (remote mode)`);
      return false;
    }
    if (shouldRegisterTool(toolName, backendVersion)) {
      server.tool(toolName, ...args);
      toolCount++;
      return true;
    } else {
      const req = TOOL_VERSION_REQUIREMENTS[toolName];
      const reason = req?.minVersion && compareVersions(backendVersion, req.minVersion) < 0 ? `requires backend >= ${req.minVersion}` : `deprecated after backend ${req?.maxVersion}`;
      console.error(`Skipping tool '${toolName}': ${reason} (current: ${backendVersion})`);
      return false;
    }
  };
  async function trackToolUsage(toolName, success = true) {
    if (GLOBAL_API_KEY) {
      await usageTracker.trackUsage(toolName, success).catch((err) => {
        console.error(`Failed to track usage for '${toolName}':`, err);
      });
    }
  }
  function withUsageTracking(toolName, handler) {
    return async (...args) => {
      try {
        const result = await handler(...args);
        const isStructuredError = result !== null && typeof result === "object" && "isError" in result && result["isError"] === true;
        void trackToolUsage(toolName, !isStructuredError);
        return result;
      } catch (error) {
        void trackToolUsage(toolName, false);
        throw error;
      }
    };
  }
  const getApiKey = (toolApiKey) => {
    const apiKey = toolApiKey?.trim() || GLOBAL_API_KEY;
    if (!apiKey) {
      throw new Error("API key is required. Pass --api_key when starting the MCP server.");
    }
    return apiKey;
  };
  const addBackgroundContext = async (response) => {
    const isLegacyVersion = compareVersions(backendVersion, "1.1.7") < 0;
    if (isLegacyVersion) {
      try {
        const docResponse = await fetch7(`${API_BASE_URL}/api/docs/instructions`, {
          method: "GET",
          headers: { "Content-Type": "application/json" }
        });
        if (docResponse.ok) {
          const result = await handleApiResponse(docResponse);
          if (result && typeof result === "object" && "content" in result) {
            response.content.push({
              type: "text",
              text: `

---
\u{1F527} INSFORGE DEVELOPMENT RULES (Auto-loaded):
${result.content}`
            });
          }
        }
      } catch (error) {
        console.error("Failed to fetch insforge-instructions.md:", error);
      }
    }
    return response;
  };
  const ctx = {
    API_BASE_URL,
    backendVersion,
    isRemote,
    registerTool,
    withUsageTracking,
    getApiKey,
    addBackgroundContext
  };
  registerDocsTools(ctx);
  registerDatabaseTools(ctx);
  registerStorageTools(ctx);
  registerFunctionTools(ctx);
  registerDeploymentTools(ctx);
  return {
    apiKey: GLOBAL_API_KEY,
    apiBaseUrl: API_BASE_URL,
    backendVersion,
    toolCount
  };
}

export {
  registerInsforgeTools
};
