import fs from "node:fs";
import path from "node:path";
const html = fs.readFileSync("index.html", "utf8");
const refs = new Set();
for (const [, attr, value] of html.matchAll(/\b(src|poster|srcset)="([^"]+)"/g)) {
  const list = attr === "srcset" ? value.split(",") : [value];
  for (const entry of list) {
    const local = entry.trim().split(/\s+/)[0].split("?")[0];
    if (/^(photos|assets)\//.test(local)) refs.add(local);
  }
}
let errors = 0;
for (const ref of refs) {
  const file = path.resolve(ref);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile() || !fs.statSync(file).size) {
    console.error("Missing/empty:", ref); errors++; continue;
  }
  const bytes = fs.readFileSync(file);
  const ext = path.extname(ref).toLowerCase();
  const valid = (ext === ".jpg" || ext === ".jpeg")
    ? bytes[0] === 0xff && bytes[1] === 0xd8
    : ext === ".webp"
      ? bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP"
      : ext === ".mp4"
        ? bytes.toString("ascii", 4, 8) === "ftyp"
        : true;
  if (!valid) { console.error("Wrong format:", ref); errors++; }
}
console.log("Checked " + refs.size + " local media assets.");
if (errors) process.exit(1);
