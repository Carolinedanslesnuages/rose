/**
 * La liste de Rose : un emoji par type Conventional Commits.
 * La liste par défaut (rose.json) peut être complétée ou modifiée par un fichier .rose.json à la
 * racine du dépôt, avec la même forme : on y ajoute ses emoji au fur et à mesure.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

export const PAR_DEFAUT = JSON.parse(readFileSync(new URL('../rose.json', import.meta.url), 'utf8'));

/** Racine du dépôt git courant, ou le dossier courant hors d'un dépôt. */
export function racine(dossier = process.cwd()) {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: dossier, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return dossier;
  }
}

/** Fusionne la liste par défaut et le .rose.json du dépôt (s'il existe). */
export function chargerListe(dossier = process.cwd()) {
  const fichier = join(racine(dossier), '.rose.json');
  if (!existsSync(fichier)) return PAR_DEFAUT;
  let perso;
  try {
    perso = JSON.parse(readFileSync(fichier, 'utf8'));
  } catch (e) {
    throw new Error(`.rose.json illisible : ${e.message}`);
  }
  return {
    types: { ...PAR_DEFAUT.types, ...(perso.types || {}) },
    incompatible: { ...PAR_DEFAUT.incompatible, ...(perso.incompatible || {}) },
  };
}

/** Emoji → type, pour retrouver le type d'un emoji. */
export function typeDeLEmoji(liste, emoji) {
  const sansVariante = (e) => e.replace(/️/g, '');
  return Object.keys(liste.types).find((t) => sansVariante(liste.types[t].emoji) === sansVariante(emoji)) || null;
}
