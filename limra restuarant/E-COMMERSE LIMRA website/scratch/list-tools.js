import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerInsforgeTools } from "../deploy_temp/package/dist/chunk-VMC7ZO3K.js";

async function run() {
  const server = new McpServer({ name: "test", version: "1.0.0" });
  await registerInsforgeTools(server, { apiKey: "test", apiBaseUrl: "https://test.insforge.app" });
  
  // McpServer lists its tools by calling the handler for listTools, or they are in server.listTools() / server.listTools
  // Let's inspect the server object to see where the tools are stored
  console.log(Object.keys(server));
  // In @modelcontextprotocol/sdk, server has a private/public list of tools or we can call listTools handler
  // Let's just print server to see its structure or look at the registered tools.
  if (server.listTools) {
    console.log("listTools exists");
  }
}
run().catch(console.error);
