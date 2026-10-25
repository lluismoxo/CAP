import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "dist");

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

// Publish the same static pages and assets, without development tools or SQL.
const entries = await readdir(root, { withFileTypes: true });
const pages = entries.filter(
  (entry) => entry.isFile() && /\.(html|png|svg|ico)$/.test(entry.name),
);
for (const name of [...pages.map((entry) => entry.name), "robots.txt", "sitemap.xml", "assets"]) {
  await cp(path.join(root, name), path.join(output, name), { recursive: true });
}

console.log(`Published ${pages.length} pages/images plus assets, robots.txt and sitemap.xml to dist/`);
