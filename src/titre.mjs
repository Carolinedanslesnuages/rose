/**
 * Titres de commit et de PR : « type(portée)!: emoji description ».
 * Le type vient d'abord (Conventional Commits, lu par release-please et vérifié par Constance),
 * l'emoji ensuite.
 */
import { typeDeLEmoji } from './liste.mjs';

const ENTETE = /^([a-z][a-z0-9-]*)(\([^()\s][^()]*\))?(!)?: ?(.*)$/s;
const segmenteur = new Intl.Segmenter('fr', { granularity: 'grapheme' });
const estEmoji = (g) => /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(g);

/** Découpe un titre. Renvoie null s'il ne suit pas « type: … ». */
export function analyser(titre) {
  const m = ENTETE.exec(String(titre).split('\n')[0]);
  if (!m) return null;
  const [, type, portee = '', bang, reste] = m;
  const premier = segmenteur.segment(reste)[Symbol.iterator]().next().value;
  const emoji = premier && estEmoji(premier.segment) ? premier.segment : null;
  const description = (emoji ? reste.slice(premier.segment.length) : reste).trim();
  return { type, portee, incompatible: !!bang, emoji, description };
}

/** Compose un titre avec l'emoji de la liste. */
export function composer(liste, { type, portee = '', incompatible = false, description }) {
  const t = liste.types[type];
  if (!t) throw new Error(`Type inconnu : « ${type} ». Types : ${Object.keys(liste.types).join(', ')}.`);
  if (!description || !description.trim()) throw new Error('La description est vide.');
  const emoji = incompatible && liste.incompatible ? liste.incompatible.emoji : t.emoji;
  return `${type}${portee ? `(${portee})` : ''}${incompatible ? '!' : ''}: ${emoji} ${description.trim()}`;
}

/** Ajoute l'emoji manquant à un titre « type: description ». Renvoie le titre inchangé sinon. */
export function decorer(liste, titre) {
  const a = analyser(titre);
  if (!a || a.emoji || !liste.types[a.type] || !a.description) return titre;
  const lignes = String(titre).split('\n');
  lignes[0] = composer(liste, { type: a.type, portee: a.portee.slice(1, -1), incompatible: a.incompatible, description: a.description });
  return lignes.join('\n');
}

/**
 * Vérifie qu'un titre porte le bon emoji. Renvoie { ok, message, niveau }.
 * niveau : « erreur » (bloque) ou « remarque ».
 */
export function verifier(liste, titre) {
  const a = analyser(titre);
  if (!a) return { ok: false, niveau: 'erreur', message: `« ${titre} » ne suit pas « type: emoji description ».` };
  if (!liste.types[a.type]) return { ok: true, niveau: 'remarque', message: `type « ${a.type} » absent de ta liste : emoji non vérifié.` };
  const attendu = a.incompatible && liste.incompatible ? liste.incompatible.emoji : liste.types[a.type].emoji;
  const propre = (e) => (e || '').replace(/️/g, '');
  if (!a.emoji) return { ok: false, niveau: 'erreur', message: `il manque l'emoji : « ${composer(liste, { type: a.type, portee: a.portee.slice(1, -1), incompatible: a.incompatible, description: a.description || '…' })} »` };
  // Changement incompatible : 🧨, ou l'emoji du type.
  if (propre(a.emoji) === propre(attendu) || (a.incompatible && propre(a.emoji) === propre(liste.types[a.type].emoji))) return { ok: true, niveau: 'ok', message: `${a.type} ${a.emoji} : ok` };
  const autre = typeDeLEmoji(liste, a.emoji);
  return {
    ok: false,
    niveau: 'erreur',
    message: autre ? `${a.emoji} est l'emoji de « ${autre} », pas de « ${a.type} » (attendu : ${attendu}).` : `${a.emoji} n'est pas dans ta liste pour « ${a.type} » (attendu : ${attendu}). Ajoute-le dans .rose.json si tu veux le garder.`,
  };
}
