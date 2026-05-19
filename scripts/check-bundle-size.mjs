import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const BUNDLE_BUDGET_BYTES = 5 * 1024 * 1024;
const DIST_ASSETS_DIR = path.resolve('dist', 'assets');

async function getAssetFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await getAssetFiles(absolutePath)));
      continue;
    }
    if (entry.name.endsWith('.js') || entry.name.endsWith('.css')) {
      files.push(absolutePath);
    }
  }

  return files;
}

function formatBytes(bytes) {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

async function main() {
  const files = await getAssetFiles(DIST_ASSETS_DIR);
  let totalSize = 0;

  for (const file of files) {
    const { size } = await stat(file);
    totalSize += size;
  }

  console.log(`Web bundle JS/CSS size: ${formatBytes(totalSize)} (${totalSize} bytes)`);
  console.log(`Bundle budget: ${formatBytes(BUNDLE_BUDGET_BYTES)} (${BUNDLE_BUDGET_BYTES} bytes)`);

  if (totalSize > BUNDLE_BUDGET_BYTES) {
    console.error('Bundle budget exceeded (NF-06).');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Failed to evaluate bundle size.');
  console.error(error);
  process.exit(1);
});
