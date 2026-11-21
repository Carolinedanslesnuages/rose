#!/usr/bin/env node
/** Rose : tes gitmoji, roses, rouges et violets, dans le bon ordre pour Conventional Commits. */
import { createInterface } from 'node:readline/promises';
import { execFileSync } from 'node:child_process';
import { chargerListe } from '../src/liste.mjs';
import { composer, verifier, decorer } from '../src/titre.mjs';
import { installer, retirer } from '../src/hook.mjs';
import { readFileSync, writeFileSync } from 'node:fs';

const AIDE = `Rose · tes gitmoji, dans le bon ordre : « feat: 🌸 ajouter l'export »

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

const liste = () => chargerListe();

function options(args) {
  const o = { mots: [] };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--portee') o.portee = args[++i];
    else if (args[i] === '--incompatible') o.incompatible = true;
    else if (args[i] === '--forcer') o.forcer = true;
    else o.mots.push(args[i]);
  }
  return o;
}

function afficherListe(l) {
  const larg = Math.max(...Object.keys(l.types).map((t) => t.length));
  for (const [t, v] of Object.entries(l.types)) console.log(`  ${v.emoji}  ${t.padEnd(larg)}  ${v.sens}${v.pourquoi ? ` · ${v.pourquoi}` : ''}`);
  if (l.incompatible) console.log(`  ${l.incompatible.emoji}  ${'!'.padEnd(larg)}  ${l.incompatible.sens}`);
}

async function pasAPas() {
  const l = liste();
  const types = Object.keys(l.types);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    types.forEach((t, i) => console.log(`  ${String(i + 1).padStart(2)}. ${l.types[t].emoji}  ${t} · ${l.types[t].sens}`));
    const n = Number(await rl.question('Type (numéro) : '));
    const type = types[n - 1];
    if (!type) throw new Error('Numéro inconnu.');
    const portee = (await rl.question('Portée (facultative, Entrée pour passer) : ')).trim();
    const incompatible = /^o/i.test((await rl.question('Changement incompatible ? (o/N) ')).trim());
    const description = await rl.question('Description : ');
    const titre = composer(l, { type, portee, incompatible, description });
    console.log(`\n  ${titre}\n`);
    if (!/^o/i.test((await rl.question('Commiter ? (o/N) ')).trim())) return console.log('Rien commité.');
    execFileSync('git', ['commit', '-m', titre], { stdio: 'inherit' });
  } finally {
    rl.close();
  }
}

async function principal() {
  const [commande, ...reste] = process.argv.slice(2);
  const o = options(reste);
  switch (commande) {
    case undefined:
      return pasAPas();
    case 'aide': case '--aide': case '-h': case '--help':
      return console.log(AIDE);
    case 'liste':
      return afficherListe(liste());
    case 'titre':
    case 'commit': {
      const [type, ...mots] = o.mots;
      const titre = composer(liste(), { type, portee: o.portee, incompatible: o.incompatible, description: mots.join(' ') });
      if (commande === 'titre') return console.log(titre);
      return execFileSync('git', ['commit', '-m', titre], { stdio: 'inherit' });
    }
    case 'verifier': {
      const r = verifier(liste(), o.mots.join(' '));
      console.log(`${r.ok ? '✓' : '✗'} ${r.message}`);
      if (process.env.GITHUB_ACTIONS && !r.ok) console.log(`::error title=Rose::${r.message}`);
      if (!r.ok) process.exitCode = 1;
      return;
    }
    case 'decorer': {
      const f = o.mots[0];
      const avant = readFileSync(f, 'utf8');
      const apres = decorer(liste(), avant);
      if (apres !== avant) writeFileSync(f, apres);
      return;
    }
    case 'hook': {
      if (o.mots[0] === 'installer') return console.log(`Hook installé : ${installer(process.cwd(), o)}\nÀ chaque « git commit -m "feat: …" », Rose ajoutera l'emoji.`);
      if (o.mots[0] === 'retirer') { const f = retirer(); return console.log(f ? `Hook retiré : ${f}` : 'Aucun hook à retirer.'); }
      throw new Error('« rose hook installer » ou « rose hook retirer ».');
    }
    default:
      throw new Error(`Commande inconnue : ${commande}. Tapez « rose aide ».`);
  }
}

principal().catch((e) => {
  console.error(`rose : ${e.message}`);
  process.exit(1);
});
