// decklet bins run as `node bin/whatever.mjs`, some through a symlinked checkout (e.g. ~/Documents/decklet ->
// ~/Documents/decklet.nosync). `import.meta.url === pathToFileURL(process.argv[1]).href` compares the two paths
// literally, so a symlink in either path makes them differ, the bin's entry-point guard is skipped, and the script
// exits 0 having written nothing. Resolving both sides through fs.realpathSync before comparing survives the symlink.
import fs from 'node:fs';
import {fileURLToPath, pathToFileURL} from 'node:url';

export function isMain(importMetaUrl) {
  const invoked = process.argv[1];
  if (!invoked) return false;
  let modulePath, invokedPath;
  try {
    modulePath = fs.realpathSync(fileURLToPath(importMetaUrl));
    invokedPath = fs.realpathSync(invoked);
  } catch {
    return false;
  }
  return pathToFileURL(modulePath).href === pathToFileURL(invokedPath).href;
}
