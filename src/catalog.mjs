/**
 * Rose's catalog: one emoji per Conventional Commits type.
 * The default catalog (rose.json) can be extended or changed by a .rose.json file at the root of
 * the repository, with the same shape: emoji get added over time.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

export const DEFAULT_CATALOG = JSON.parse(readFileSync(new URL('../rose.json', import.meta.url), 'utf8'));

/** Root of the current git repository, or the folder itself outside a repository. */
export function repositoryRoot(folder = process.cwd()) {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: folder, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return folder;
  }
}

/** Merges the default catalog with the repository's .rose.json, when there is one. */
export function loadCatalog(folder = process.cwd()) {
  const customPath = join(repositoryRoot(folder), '.rose.json');
  if (!existsSync(customPath)) return DEFAULT_CATALOG;
  let custom;
  try {
    custom = JSON.parse(readFileSync(customPath, 'utf8'));
  } catch (error) {
    throw new Error(`.rose.json illisible : ${error.message}`);
  }
  return {
    types: { ...DEFAULT_CATALOG.types, ...(custom.types || {}) },
    incompatible: { ...DEFAULT_CATALOG.incompatible, ...(custom.incompatible || {}) },
  };
}

/** Finds the type an emoji belongs to. */
export function typeForEmoji(catalog, emoji) {
  const withoutVariant = (text) => text.replace(/️/g, '');
  return Object.keys(catalog.types).find((type) => withoutVariant(catalog.types[type].emoji) === withoutVariant(emoji)) || null;
}
