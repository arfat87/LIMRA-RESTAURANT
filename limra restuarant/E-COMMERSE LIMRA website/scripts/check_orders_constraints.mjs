import { registerInsforgeTools } from "../package/dist/chunk-VMC7ZO3K.js";

const tools = {};
const mockServer = {
  tool(name, ...args) {
    const handler = args[args.length - 1];
    tools[name] = handler;
  }
};

async function main() {
  const config = {
    apiKey: "ik_799af068e8f4fb05944d04497229fe7d",
    apiBaseUrl: "https://vb9ucr22.us-east.insforge.app",
    mode: "local"
  };
  
  await registerInsforgeTools(mockServer, config);

  const res = await tools["run-raw-sql"]({
    query: `
      SELECT conname, pg_get_constraintdef(oid) 
      FROM pg_constraint 
      WHERE conrelid = 'public.orders'::regclass;
    `
  });
  console.log("Constraints on orders table:", JSON.stringify(res, null, 2));
}

main().catch(console.error);
