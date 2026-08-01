import { registerInsforgeTools } from "./package/dist/chunk-VMC7ZO3K.js";

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

  console.log("Invoking create-deployment tool...");
  const result = await tools["create-deployment"]({
    sourceDirectory: "c:\\MY_ALL_ITEM\\ALL_PROJECT\\biuld with Ai\\E-COMMERSE LIMRA\\dist"
  });

  console.log("Deployment Call Finished.");
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
