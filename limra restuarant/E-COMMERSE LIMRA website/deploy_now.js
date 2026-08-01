import { registerInsforgeTools } from "./package/dist/chunk-VMC7ZO3K.js";
import path from "path";

const tools = {};
const mockServer = {
  tool(name, ...args) {
    const handler = args[args.length - 1];
    tools[name] = handler;
  }
};

async function main() {
  console.log("Registering tools in local mode...");
  const config = {
    apiKey: "ik_799af068e8f4fb05944d04497229fe7d",
    apiBaseUrl: "https://vb9ucr22.us-east.insforge.app",
    mode: "local"
  };
  
  await registerInsforgeTools(mockServer, config);

  console.log("Available tools:", Object.keys(tools));

  const distPath = path.resolve(process.cwd(), "dist");
  console.log("Invoking create-deployment tool for path:", distPath);
  const result = await tools["create-deployment"]({
    sourceDirectory: distPath
  });

  console.log("Deployment Call Finished.");
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
