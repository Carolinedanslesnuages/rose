/**
 * Le hook Git « commit-msg » de Rose : il ajoute l'emoji manquant au titre du commit.
 * Il est AUTONOME (aucune dépendance, pas de réseau) : il embarque la liste par défaut et lit le
 * .rose.json du dépôt à chaque commit.
 */
import { readFileSync, writeFileSync, existsSync, chmodSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { PAR_DEFAUT } from './liste.mjs';

export const MARQUE = '// rose : hook commit-msg';

export function texteHook() {
  const decorer = readFileSync(new URL('./titre.mjs', import.meta.url), 'utf8')
    .replace(/^import .*$/m, '')
    .replace(/^export /gm, '');
  return `#!/usr/bin/env node
${MARQUE} (https://github.com/Carolinedanslesnuages/rose)
// Ajoute l'emoji de ta liste au titre du commit : « feat: ajouter X » devient « feat: 🌸 ajouter X ».
// Pour le retirer : rose hook retirer
const { readFileSync, writeFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const { execFileSync } = require('node:child_process');
const PAR_DEFAUT = ${JSON.stringify(PAR_DEFAUT)};
function typeDeLEmoji(liste, emoji) {
  const s = (e) => e.replace(/\\uFE0F/g, '');
  return Object.keys(liste.types).find((t) => s(liste.types[t].emoji) === s(emoji)) || null;
}
${decorer}
try {
  const fichier = process.argv[2];
  let liste = PAR_DEFAUT;
  const racine = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const perso = join(racine, '.rose.json');
  if (existsSync(perso)) {
    const p = JSON.parse(readFileSync(perso, 'utf8'));
    liste = { types: { ...PAR_DEFAUT.types, ...(p.types || {}) }, incompatible: { ...PAR_DEFAUT.incompatible, ...(p.incompatible || {}) } };
  }
  const avant = readFileSync(fichier, 'utf8');
  const apres = decorer(liste, avant);
  if (apres !== avant) writeFileSync(fichier, apres);
} catch (e) {
  // Rose ne bloque jamais un commit : en cas de souci, le message reste tel quel.
  process.stderr.write('rose : emoji non ajouté (' + e.message + ')\\n');
}
`;
}

/** Dossier des hooks du dépôt (respecte core.hooksPath, utilisé par husky par exemple). */
export function dossierHooks(dossier = process.cwd()) {
  const git = (args) => execFileSync('git', args, { cwd: dossier, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  let chemin;
  try {
    chemin = git(['config', '--get', 'core.hooksPath']);
  } catch {
    chemin = '';
  }
  if (chemin) return resolve(git(['rev-parse', '--show-toplevel']), chemin);
  return resolve(dossier, git(['rev-parse', '--git-path', 'hooks']));
}

export function installer(dossier = process.cwd(), { forcer = false } = {}) {
  const d = dossierHooks(dossier);
  mkdirSync(d, { recursive: true });
  const f = join(d, 'commit-msg');
  if (existsSync(f) && !readFileSync(f, 'utf8').includes(MARQUE) && !forcer) {
    throw new Error(`Un hook commit-msg existe déjà (${f}). Rose ne l'écrase pas : ajoutez --forcer si vous voulez le remplacer.`);
  }
  writeFileSync(f, texteHook());
  chmodSync(f, 0o755);
  return f;
}

export function retirer(dossier = process.cwd()) {
  const f = join(dossierHooks(dossier), 'commit-msg');
  if (!existsSync(f)) return null;
  if (!readFileSync(f, 'utf8').includes(MARQUE)) throw new Error(`Le hook commit-msg (${f}) n'est pas celui de Rose : je n'y touche pas.`);
  unlinkSync(f);
  return f;
}
