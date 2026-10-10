import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const ignoredDirectories = new Set([
  ".git",
  "node_modules",
  ".next",
  ".open-next",
  ".wrangler",
  ".firebase",
  "coverage",
  "test-results",
  "playwright-report",
]);

function envFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return ignoredDirectories.has(entry.name) ? [] : envFiles(path);
    }
    return /^\.env/i.test(entry.name) && statSync(path).isFile() ? [path] : [];
  });
}

// OpenNext serializes .env files into its server bundle. Check each assignment
// independently so a later blank assignment cannot conceal an earlier key.
function containsPrivateKey(contents) {
  const assignments = [
    ...contents.matchAll(
      /^\s*(?:export\s+)?IMAGEKIT_PRIVATE_KEY\s*(?:=|:\s+)/gm,
    ),
  ];
  return assignments.some((assignment, index) => {
    const end = assignments[index + 1]?.index ?? contents.length;
    const value = parseEnv(
      `IMAGEKIT_PRIVATE_KEY=${contents.slice(assignment.index + assignment[0].length, end)}`,
    ).IMAGEKIT_PRIVATE_KEY;
    return Boolean(value?.trim());
  });
}

export function checkCloudflareEnv(
  directory = process.cwd(),
  env = process.env,
) {
  if (env.IMAGEKIT_PRIVATE_KEY?.trim()) {
    throw new Error(
      "Cloudflare build refused: IMAGEKIT_PRIVATE_KEY is present in the build environment. Unset it and use a Wrangler runtime secret or local .dev.vars.",
    );
  }
  for (const path of envFiles(directory)) {
    if (containsPrivateKey(readFileSync(path, "utf8"))) {
      throw new Error(
        `Cloudflare build refused: ${path} contains an IMAGEKIT_PRIVATE_KEY assignment. Move the key to a Wrangler runtime secret or local .dev.vars.`,
      );
    }
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    checkCloudflareEnv();
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Cloudflare environment check failed.",
    );
    process.exitCode = 1;
  }
}
