import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PAR_DEFAUT, chargerListe } from '../src/liste.mjs';
import { analyser, composer, decorer, verifier } from '../src/titre.mjs';
import { installer, retirer } from '../src/hook.mjs';

const BIN = fileURLToPath(new URL('../bin/rose.mjs', import.meta.url));
const L = PAR_DEFAUT;
const git = (d, ...a) => execFileSync('git', a, { cwd: d, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
function depot() {
  const d = mkdtempSync(join(tmpdir(), 'rose-'));
  git(d, 'init', '-q');
  git(d, 'config', 'user.email', 'essai@exemple.fr');
  git(d, 'config', 'user.name', 'essai');
  return d;
}
const commit = (d, message) => { writeFileSync(join(d, `f${Math.random()}`), 'x'); git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', message); return git(d, 'log', '-1', '--format=%B'); };

test('la liste : un emoji par type, tous différents', () => {
  const emojis = Object.values(L.types).map((t) => t.emoji);
  assert.equal(new Set(emojis).size, emojis.length);
  assert.ok(!emojis.includes(L.incompatible.emoji));
});

test('analyser un titre', () => {
  assert.deepEqual(analyser('feat(api)!: 🌸 ajouter X'), { type: 'feat', portee: '(api)', incompatible: true, emoji: '🌸', description: 'ajouter X' });
  assert.equal(analyser('fix: corriger').emoji, null);
  assert.equal(analyser('🌸 feat: x'), null);
  assert.equal(analyser('Merge branch main'), null);
});

test('composer : le type d’abord, puis l’emoji', () => {
  assert.equal(composer(L, { type: 'feat', description: 'ajouter X' }), 'feat: 🌸 ajouter X');
  assert.equal(composer(L, { type: 'fix', portee: 'api', description: 'tri' }), 'fix(api): 🐞 tri');
  assert.equal(composer(L, { type: 'feat', incompatible: true, description: 'format' }), 'feat!: 🧨 format');
  assert.throws(() => composer(L, { type: 'nimporte', description: 'x' }), /Type inconnu/);
  assert.throws(() => composer(L, { type: 'feat', description: ' ' }), /vide/);
});

test('les titres de Rose passent le contrôle de Constance', () => {
  const motif = /^(feat|fix|perf|refactor|docs|test|build|ci|chore|style|revert)(\([^()\s][^()]*\))?!?: \S/u;
  for (const type of Object.keys(L.types)) assert.match(composer(L, { type, description: 'x' }), motif, type);
});

test('decorer : ajoute l’emoji manquant, ne touche à rien d’autre', () => {
  assert.equal(decorer(L, 'feat: ajouter X'), 'feat: 🌸 ajouter X');
  assert.equal(decorer(L, 'docs(readme): typo\n\ncorps du message'), 'docs(readme): 🧾 typo\n\ncorps du message');
  for (const inchange of ['feat: 🌸 déjà là', 'Merge branch "x"', 'inconnu: x', 'feat: ', 'texte libre']) assert.equal(decorer(L, inchange), inchange);
});

test('verifier : bon emoji, mauvais emoji, absent, variante, incompatible', () => {
  assert.equal(verifier(L, 'feat: 🌸 x').ok, true);
  assert.match(verifier(L, 'feat: 🐞 x').message, /l'emoji de « fix »/);
  assert.match(verifier(L, 'feat: x').message, /il manque l'emoji : « feat: 🌸 x »/);
  assert.equal(verifier(L, 'perf: 🌶 x').ok, true, 'sans le sélecteur de variante');
  assert.equal(verifier(L, 'feat!: 🧨 x').ok, true);
  assert.equal(verifier(L, 'feat!: 🌸 x').ok, true);
  assert.equal(verifier(L, 'wip: x').ok, true, 'type hors liste : non vérifié');
  assert.equal(verifier(L, 'pas un titre').ok, false);
});

test('.rose.json complète la liste', () => {
  const d = depot();
  writeFileSync(join(d, '.rose.json'), JSON.stringify({ types: { a11y: { emoji: '💗', sens: 'accessibilité' }, fix: { emoji: '🩷', sens: 'correction' } } }));
  const l = chargerListe(d);
  assert.equal(l.types.a11y.emoji, '💗');
  assert.equal(l.types.fix.emoji, '🩷');
  assert.equal(l.types.feat.emoji, '🌸');
  writeFileSync(join(d, '.rose.json'), '{ cassé');
  assert.throws(() => chargerListe(d), /illisible/);
});

test('hook : un « git commit » ordinaire reçoit son emoji', () => {
  const d = depot();
  installer(d);
  assert.equal(commit(d, 'feat: ajouter l’export'), 'feat: 🌸 ajouter l’export');
  assert.equal(commit(d, 'fix(api): 🐞 déjà décoré'), 'fix(api): 🐞 déjà décoré');
  assert.equal(commit(d, 'message libre'), 'message libre');
  writeFileSync(join(d, '.rose.json'), JSON.stringify({ types: { a11y: { emoji: '💗', sens: 'accessibilité' } } }));
  assert.equal(commit(d, 'a11y: contraste du bouton'), 'a11y: 💗 contraste du bouton');
});

test('hook : ne bloque jamais un commit, même avec un .rose.json cassé', () => {
  const d = depot();
  installer(d);
  writeFileSync(join(d, '.rose.json'), '{ cassé');
  assert.equal(commit(d, 'feat: malgré tout'), 'feat: malgré tout');
});

test('hook : respecte un hook existant, core.hooksPath, et se retire proprement', () => {
  const d = depot();
  const autre = join(d, '.git', 'hooks', 'commit-msg');
  writeFileSync(autre, '#!/bin/sh\nexit 0\n');
  assert.throws(() => installer(d), /existe déjà/);
  assert.match(readFileSync(autre, 'utf8'), /exit 0/);
  assert.throws(() => retirer(d), /pas celui de Rose/);
  installer(d, { forcer: true });
  assert.ok(retirer(d));
  assert.ok(!existsSync(autre));
  const h = depot();
  git(h, 'config', 'core.hooksPath', '.husky');
  assert.match(installer(h), /\.husky[\\/]commit-msg$/);
  assert.equal(commit(h, 'docs: lire'), 'docs: 🧾 lire');
});

test('commande : titre, verifier, liste, erreurs', () => {
  const r = (...a) => spawnSync(process.execPath, [BIN, ...a], { encoding: 'utf8', env: { ...process.env, GITHUB_ACTIONS: '' } });
  assert.equal(r('titre', 'refactor', 'découper', 'le', 'module').stdout.trim(), 'refactor: 🌺 découper le module');
  assert.equal(r('verifier', 'ci: 💜 réparer').status, 0);
  assert.equal(r('verifier', 'ci: 💚 réparer').status, 1);
  assert.match(r('liste').stdout, /🦩\s+revert/);
  assert.match(r('nimporte').stderr, /Commande inconnue/);
});
