import fs from "fs";

const content = fs.readFileSync("admin.html", "utf8");
const lines = content.split("\n");
lines.forEach((l, idx) => {
  if (l.includes("printer") || l.includes("Printer")) {
    console.log(`${idx + 1}: ${l.trim()}`);
  }
});
