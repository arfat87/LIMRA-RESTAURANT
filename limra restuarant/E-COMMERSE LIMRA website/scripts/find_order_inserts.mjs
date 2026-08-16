import fs from "fs";

function findInFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  console.log(`=== ${filePath} ===`);
  lines.forEach((line, idx) => {
    if (line.includes("orders") && line.includes("insert")) {
      console.log(`Line ${idx + 1}:`);
      console.log(lines.slice(Math.max(0, idx - 10), idx + 20).join("\n"));
      console.log("-------------------");
    }
  });
}

findInFile("src/main.js");
findInFile("src/admin.js");
findInFile("src/table/table.js");
findInFile("src/table/table-client.js");
