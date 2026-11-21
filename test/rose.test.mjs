import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DEFAULT_CATALOG, loadCatalog } from '../src/catalog.mjs';
import { parse, compose, decorate, check } from '../src/title.mjs';
import { install, uninstall } from '../src/hook.mjs';

const BINARY = fileURLToPath(new URL('../bin/rose.mjs', import.meta.url));
const CATALOG = DEFAULT_CATALOG;
const runGit = (folder, ...args) => execFileSync('git', args, { cwd: folder, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function newRepository() {
  const folder = mkdtempSync(join(tmpdir(), 'rose-'));
  runGit(folder, 'init', '-q');
  runGit(folder, 'config', 'user.email', 'essai@exemple.fr');
  runGit(folder, 'config', 'user.name', 'essai');
  return folder;
}

const commit = (folder, message) => {
  writeFileSync(join(folder, `file${Math.random()}`), 'content');
  runGit(folder, 'add', '-A');
  runGit(folder, 'commit', '-q', '-m', message);
  return runGit(folder, 'log', '-1', '--format=%B');
};

test('la liste : un emoji par type, tous différents', () => {
  const emojis = Object.values(CATALOG.types).map((entry) => entry.emoji);
  assert.equal(new Set(emojis).size, emojis.length);
  assert.ok(!emojis.includes(CATALOG.incompatible.emoji));
});

test('analyser un titre', () => {
  assert.deepEqual(parse('feat(api)!: 🌸 ajouter X'), { type: 'feat', scope: '(api)', breaking: true, emoji: '🌸', description: 'ajouter X' });
  assert.equal(parse('fix: corriger').emoji, null);
  assert.equal(parse('🌸 feat: x'), null);
  assert.equal(parse('Merge branch main'), null);
});

test('composer : le type d’abord, puis l’emoji', () => {
  assert.equal(compose(CATALOG, { type: 'feat', description: 'ajouter X' }), 'feat: 🌸 ajouter X');
  assert.equal(compose(CATALOG, { type: 'fix', scope: 'api', description: 'tri' }), 'fix(api): 🐞 tri');
  assert.equal(compose(CATALOG, { type: 'feat', breaking: true, description: 'format' }), 'feat!: 🧨 format');
  assert.throws(() => compose(CATALOG, { type: 'nimporte', description: 'x' }), /Type inconnu/);
  assert.throws(() => compose(CATALOG, { type: 'feat', description: ' ' }), /vide/);
});

test('les titres de Rose passent le contrôle de Constance', () => {
  const constancePattern = /^(feat|fix|perf|refactor|docs|test|build|ci|chore|style|revert)(\([^()\s][^()]*\))?!?: \S/u;
  for (const type of Object.keys(CATALOG.types)) assert.match(compose(CATALOG, { type, description: 'x' }), constancePattern, type);
});

test('decorer : ajoute l’emoji manquant, ne touche à rien d’autre', () => {
  assert.equal(decorate(CATALOG, 'feat: ajouter X'), 'feat: 🌸 ajouter X');
  assert.equal(decorate(CATALOG, 'docs(readme): typo\n\ncorps du message'), 'docs(readme): 🧾 typo\n\ncorps du message');
  for (const unchanged of ['feat: 🌸 déjà là', 'Merge branch "x"', 'inconnu: x', 'feat: ', 'texte libre']) {
    assert.equal(decorate(CATALOG, unchanged), unchanged);
  }
});

test('verifier : bon emoji, mauvais emoji, absent, variante, incompatible', () => {
  assert.equal(check(CATALOG, 'feat: 🌸 x').valid, true);
  assert.match(check(CATALOG, 'feat: 🐞 x').message, /l'emoji de « fix »/);
  assert.match(check(CATALOG, 'feat: x').message, /il manque l'emoji : « feat: 🌸 x »/);
  assert.equal(check(CATALOG, 'perf: 🌶 x').valid, true, 'sans le sélecteur de variante');
  assert.equal(check(CATALOG, 'feat!: 🧨 x').valid, true);
  assert.equal(check(CATALOG, 'feat!: 🌸 x').valid, true);
  assert.equal(check(CATALOG, 'wip: x').valid, true, 'type hors liste : non vérifié');
  assert.equal(check(CATALOG, 'pas un titre').valid, false);
});

test('.rose.json complète la liste', () => {
  const folder = newRepository();
  writeFileSync(join(folder, '.rose.json'), JSON.stringify({ types: { a11y: { emoji: '💗', sens: 'accessibilité' }, fix: { emoji: '🩷', sens: 'correction' } } }));
  const catalog = loadCatalog(folder);
  assert.equal(catalog.types.a11y.emoji, '💗');
  assert.equal(catalog.types.fix.emoji, '🩷');
  assert.equal(catalog.types.feat.emoji, '🌸');
  writeFileSync(join(folder, '.rose.json'), '{ cassé');
  assert.throws(() => loadCatalog(folder), /illisible/);
});

test('hook : un « git commit » ordinaire reçoit son emoji', () => {
  const folder = newRepository();
  install(folder);
  assert.equal(commit(folder, 'feat: ajouter l’export'), 'feat: 🌸 ajouter l’export');
  assert.equal(commit(folder, 'fix(api): 🐞 déjà décoré'), 'fix(api): 🐞 déjà décoré');
  assert.equal(commit(folder, 'message libre'), 'message libre');
  writeFileSync(join(folder, '.rose.json'), JSON.stringify({ types: { a11y: { emoji: '💗', sens: 'accessibilité' } } }));
  assert.equal(commit(folder, 'a11y: contraste du bouton'), 'a11y: 💗 contraste du bouton');
});

test('hook : ne bloque jamais un commit, même avec un .rose.json cassé', () => {
  const folder = newRepository();
  install(folder);
  writeFileSync(join(folder, '.rose.json'), '{ cassé');
  assert.equal(commit(folder, 'feat: malgré tout'), 'feat: malgré tout');
});

test('hook : respecte un hook existant, core.hooksPath, et se retire proprement', () => {
  const folder = newRepository();
  const otherHook = join(folder, '.git', 'hooks', 'commit-msg');
  writeFileSync(otherHook, '#!/bin/sh\nexit 0\n');
  assert.throws(() => install(folder), /existe déjà/);
  assert.match(readFileSync(otherHook, 'utf8'), /exit 0/);
  assert.throws(() => uninstall(folder), /pas celui de Rose/);
  install(folder, { force: true });
  assert.ok(uninstall(folder));
  assert.ok(!existsSync(otherHook));
  const huskyFolder = newRepository();
  runGit(huskyFolder, 'config', 'core.hooksPath', '.husky');
  assert.match(install(huskyFolder), /\.husky[\\/]commit-msg$/);
  assert.equal(commit(huskyFolder, 'docs: lire'), 'docs: 🧾 lire');
});

test('hook : un hook installé par une version précédente est toujours reconnu', () => {
  const folder = newRepository();
  writeFileSync(join(folder, '.git', 'hooks', 'commit-msg'), '#!/usr/bin/env node\n// rose : hook commit-msg (ancienne version)\n');
  assert.ok(uninstall(folder));
});

test('commande : titre, verifier, liste, erreurs', () => {
  const runCli = (...args) => spawnSync(process.execPath, [BINARY, ...args], { encoding: 'utf8', env: { ...process.env, GITHUB_ACTIONS: '' } });
  assert.equal(runCli('titre', 'refactor', 'découper', 'le', 'module').stdout.trim(), 'refactor: 🌺 découper le module');
  assert.equal(runCli('verifier', 'ci: 💜 réparer').status, 0);
  assert.equal(runCli('verifier', 'ci: 💚 réparer').status, 1);
  assert.match(runCli('liste').stdout, /🦩\s+revert/);
  assert.match(runCli('nimporte').stderr, /Commande inconnue/);
});
