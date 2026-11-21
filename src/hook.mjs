/**
 * Rose's "commit-msg" Git hook: it adds the missing emoji to the commit title.
 * It is SELF-CONTAINED (no dependency, no network): it embeds the default catalog and reads the
 * repository's .rose.json on every commit.
 */
import { readFileSync, writeFileSync, existsSync, chmodSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { DEFAULT_CATALOG } from './catalog.mjs';

/** Marker that identifies Rose's hook (kept as is: hooks already installed carry it). */
export const MARKER = '// rose : hook commit-msg';

export function hookSource() {
  const titleFunctions = readFileSync(new URL('./title.mjs', import.meta.url), 'utf8')
    .replace(/^import .*$/m, '')
    .replace(/^export /gm, '');
  return `#!/usr/bin/env node
${MARKER} (https://github.com/Carolinedanslesnuages/rose)
// Adds your catalog's emoji to the commit title: "feat: add X" becomes "feat: 🌸 add X".
// To remove it: rose hook retirer
const { readFileSync, writeFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const { execFileSync } = require('node:child_process');
const DEFAULT_CATALOG = ${JSON.stringify(DEFAULT_CATALOG)};
function typeForEmoji(catalog, emoji) {
  const withoutVariant = (text) => text.replace(/\\uFE0F/g, '');
  return Object.keys(catalog.types).find((type) => withoutVariant(catalog.types[type].emoji) === withoutVariant(emoji)) || null;
}
${titleFunctions}
try {
  const messagePath = process.argv[2];
  let catalog = DEFAULT_CATALOG;
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const customPath = join(root, '.rose.json');
  if (existsSync(customPath)) {
    const custom = JSON.parse(readFileSync(customPath, 'utf8'));
    catalog = {
      types: { ...DEFAULT_CATALOG.types, ...(custom.types || {}) },
      incompatible: { ...DEFAULT_CATALOG.incompatible, ...(custom.incompatible || {}) },
    };
  }
  const original = readFileSync(messagePath, 'utf8');
  const decorated = decorate(catalog, original);
  if (decorated !== original) writeFileSync(messagePath, decorated);
} catch (error) {
  // Rose never blocks a commit: when anything goes wrong, the message stays as it is.
  process.stderr.write('rose : emoji non ajouté (' + error.message + ')\\n');
}
`;
}

/** The repository's hooks folder (honours core.hooksPath, used by husky for example). */
export function hooksFolder(folder = process.cwd()) {
  const runGit = (args) => execFileSync('git', args, { cwd: folder, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  let configured;
  try {
    configured = runGit(['config', '--get', 'core.hooksPath']);
  } catch {
    configured = '';
  }
  if (configured) return resolve(runGit(['rev-parse', '--show-toplevel']), configured);
  return resolve(folder, runGit(['rev-parse', '--git-path', 'hooks']));
}

export function install(folder = process.cwd(), { force = false } = {}) {
  const hooks = hooksFolder(folder);
  mkdirSync(hooks, { recursive: true });
  const hookPath = join(hooks, 'commit-msg');
  if (existsSync(hookPath) && !readFileSync(hookPath, 'utf8').includes(MARKER) && !force) {
    throw new Error(`Un hook commit-msg existe déjà (${hookPath}). Rose ne l'écrase pas : ajoutez --forcer si vous voulez le remplacer.`);
  }
  writeFileSync(hookPath, hookSource());
  chmodSync(hookPath, 0o755);
  return hookPath;
}

export function uninstall(folder = process.cwd()) {
  const hookPath = join(hooksFolder(folder), 'commit-msg');
  if (!existsSync(hookPath)) return null;
  if (!readFileSync(hookPath, 'utf8').includes(MARKER)) throw new Error(`Le hook commit-msg (${hookPath}) n'est pas celui de Rose : je n'y touche pas.`);
  unlinkSync(hookPath);
  return hookPath;
}
