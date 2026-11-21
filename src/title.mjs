/**
 * Commit and pull request titles: "type(scope)!: emoji description".
 * The type comes first (Conventional Commits, read by release-please and checked by Constance),
 * then the emoji.
 */
import { typeForEmoji } from './catalog.mjs';

const HEADER = /^([a-z][a-z0-9-]*)(\([^()\s][^()]*\))?(!)?: ?(.*)$/s;
const graphemes = new Intl.Segmenter('fr', { granularity: 'grapheme' });
const isEmoji = (grapheme) => /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(grapheme);
const stripVariant = (emoji) => (emoji || '').replace(/️/g, '');

/** Splits a title. Returns null when it does not follow "type: …". */
export function parse(title) {
  const match = HEADER.exec(String(title).split('\n')[0]);
  if (!match) return null;
  const [, type, scope = '', bang, rest] = match;
  const first = graphemes.segment(rest)[Symbol.iterator]().next().value;
  const emoji = first && isEmoji(first.segment) ? first.segment : null;
  const description = (emoji ? rest.slice(first.segment.length) : rest).trim();
  return { type, scope, breaking: !!bang, emoji, description };
}

/** Builds a title with the catalog's emoji. */
export function compose(catalog, { type, scope = '', breaking = false, description }) {
  const entry = catalog.types[type];
  if (!entry) throw new Error(`Type inconnu : « ${type} ». Types : ${Object.keys(catalog.types).join(', ')}.`);
  if (!description || !description.trim()) throw new Error('La description est vide.');
  const emoji = breaking && catalog.incompatible ? catalog.incompatible.emoji : entry.emoji;
  return `${type}${scope ? `(${scope})` : ''}${breaking ? '!' : ''}: ${emoji} ${description.trim()}`;
}

/** Adds the missing emoji to a "type: description" title. Returns the title unchanged otherwise. */
export function decorate(catalog, title) {
  const parsed = parse(title);
  if (!parsed || parsed.emoji || !catalog.types[parsed.type] || !parsed.description) return title;
  const lines = String(title).split('\n');
  lines[0] = compose(catalog, { type: parsed.type, scope: parsed.scope.slice(1, -1), breaking: parsed.breaking, description: parsed.description });
  return lines.join('\n');
}

/** Checks that a title carries the right emoji. Returns { valid, message }. */
export function check(catalog, title) {
  const parsed = parse(title);
  if (!parsed) return { valid: false, message: `« ${title} » ne suit pas « type: emoji description ».` };
  if (!catalog.types[parsed.type]) return { valid: true, message: `type « ${parsed.type} » absent de ta liste : emoji non vérifié.` };
  const typeEmoji = catalog.types[parsed.type].emoji;
  const expected = parsed.breaking && catalog.incompatible ? catalog.incompatible.emoji : typeEmoji;
  if (!parsed.emoji) {
    const suggestion = compose(catalog, { type: parsed.type, scope: parsed.scope.slice(1, -1), breaking: parsed.breaking, description: parsed.description || '…' });
    return { valid: false, message: `il manque l'emoji : « ${suggestion} »` };
  }
  // Breaking change: 🧨, or the type's own emoji.
  const matches = stripVariant(parsed.emoji) === stripVariant(expected) || (parsed.breaking && stripVariant(parsed.emoji) === stripVariant(typeEmoji));
  if (matches) return { valid: true, message: `${parsed.type} ${parsed.emoji} : ok` };
  const otherType = typeForEmoji(catalog, parsed.emoji);
  return {
    valid: false,
    message: otherType
      ? `${parsed.emoji} est l'emoji de « ${otherType} », pas de « ${parsed.type} » (attendu : ${expected}).`
      : `${parsed.emoji} n'est pas dans ta liste pour « ${parsed.type} » (attendu : ${expected}). Ajoute-le dans .rose.json si tu veux le garder.`,
  };
}
