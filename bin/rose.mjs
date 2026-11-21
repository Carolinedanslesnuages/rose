#!/usr/bin/env node
/** Rose: your gitmoji, pink, red and purple, in the right order for Conventional Commits. */
import { createInterface } from 'node:readline/promises';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { loadCatalog } from '../src/catalog.mjs';
import { compose, check, decorate } from '../src/title.mjs';
import { install, uninstall } from '../src/hook.mjs';

const HELP = `Rose · tes gitmoji, dans le bon ordre : « feat: 🌸 ajouter l'export »

  rose                               compose un commit pas à pas
  rose liste                         ta liste d'emoji
  rose titre <type> <description>    affiche le titre (pour une PR)
  rose commit <type> <description>   commite avec ce titre
       options : --portee <x>  --incompatible
  rose verifier "<titre>"            vérifie l'emoji d'un titre (code 1 si faux)
  rose hook installer [--forcer]     ajoute l'emoji tout seul à chaque « git commit »
  rose hook retirer

Ta liste se complète avec un fichier .rose.json à la racine du dépôt :
  { "types": { "a11y": { "emoji": "💗", "sens": "accessibilité" } } }`;

function parseOptions(args) {
  const options = { words: [] };
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--portee') options.scope = args[++index];
    else if (args[index] === '--incompatible') options.breaking = true;
    else if (args[index] === '--forcer') options.force = true;
    else options.words.push(args[index]);
  }
  return options;
}

function printCatalog(catalog) {
  const width = Math.max(...Object.keys(catalog.types).map((type) => type.length));
  for (const [type, entry] of Object.entries(catalog.types)) {
    console.log(`  ${entry.emoji}  ${type.padEnd(width)}  ${entry.sens}${entry.pourquoi ? ` · ${entry.pourquoi}` : ''}`);
  }
  if (catalog.incompatible) console.log(`  ${catalog.incompatible.emoji}  ${'!'.padEnd(width)}  ${catalog.incompatible.sens}`);
}

async function stepByStep() {
  const catalog = loadCatalog();
  const types = Object.keys(catalog.types);
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    types.forEach((type, index) => console.log(`  ${String(index + 1).padStart(2)}. ${catalog.types[type].emoji}  ${type} · ${catalog.types[type].sens}`));
    const type = types[Number(await prompt.question('Type (numéro) : ')) - 1];
    if (!type) throw new Error('Numéro inconnu.');
    const scope = (await prompt.question('Portée (facultative, Entrée pour passer) : ')).trim();
    const breaking = /^o/i.test((await prompt.question('Changement incompatible ? (o/N) ')).trim());
    const description = await prompt.question('Description : ');
    const title = compose(catalog, { type, scope, breaking, description });
    console.log(`\n  ${title}\n`);
    if (!/^o/i.test((await prompt.question('Commiter ? (o/N) ')).trim())) return console.log('Rien commité.');
    execFileSync('git', ['commit', '-m', title], { stdio: 'inherit' });
  } finally {
    prompt.close();
  }
}

function runHook(options) {
  const [action] = options.words;
  if (action === 'installer') {
    return console.log(`Hook installé : ${install(process.cwd(), options)}\nÀ chaque « git commit -m "feat: …" », Rose ajoutera l'emoji.`);
  }
  if (action === 'retirer') {
    const removed = uninstall();
    return console.log(removed ? `Hook retiré : ${removed}` : 'Aucun hook à retirer.');
  }
  throw new Error('« rose hook installer » ou « rose hook retirer ».');
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const options = parseOptions(rest);
  switch (command) {
    case undefined:
      return stepByStep();
    case 'aide': case '--aide': case '-h': case '--help':
      return console.log(HELP);
    case 'liste':
      return printCatalog(loadCatalog());
    case 'titre':
    case 'commit': {
      const [type, ...words] = options.words;
      const title = compose(loadCatalog(), { type, scope: options.scope, breaking: options.breaking, description: words.join(' ') });
      if (command === 'titre') return console.log(title);
      return execFileSync('git', ['commit', '-m', title], { stdio: 'inherit' });
    }
    case 'verifier': {
      const result = check(loadCatalog(), options.words.join(' '));
      console.log(`${result.valid ? '✓' : '✗'} ${result.message}`);
      if (process.env.GITHUB_ACTIONS && !result.valid) console.log(`::error title=Rose::${result.message}`);
      if (!result.valid) process.exitCode = 1;
      return;
    }
    case 'decorer': {
      const [messagePath] = options.words;
      const original = readFileSync(messagePath, 'utf8');
      const decorated = decorate(loadCatalog(), original);
      if (decorated !== original) writeFileSync(messagePath, decorated);
      return;
    }
    case 'hook':
      return runHook(options);
    default:
      throw new Error(`Commande inconnue : ${command}. Tapez « rose aide ».`);
  }
}

main().catch((error) => {
  console.error(`rose : ${error.message}`);
  process.exit(1);
});
