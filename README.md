# Rose

Mes gitmoji à moi, roses, rouges et violets, rangés dans le bon ordre pour que tout l'outillage
suive : le **type** d'abord (Conventional Commits, lu par release-please et vérifié par
[Constance](https://github.com/Carolinedanslesnuages/constance)), puis l'**emoji**.

```text
feat: 🌸 ajouter l'export CSV
fix(api): 🐞 corriger le tri par date
feat!: 🧨 changer le format des adresses
```

Le nom rend hommage à Rose Bertin, marchande de modes de Marie-Antoinette : elle ornait ce qui
existait déjà de rubans et de fleurs.

## La liste

| | Type | Sens | Pourquoi |
|---|---|---|---|
| 🌸 | `feat` | nouvelle fonctionnalité | une fonctionnalité qui éclot |
| 🐞 | `fix` | correction | la coccinelle, *ladybug* : un bug |
| 🧾 | `docs` | documentation | un document |
| 💄 | `style` | interface et styles | le gitmoji officiel, rouge |
| 🌺 | `refactor` | refactorisation | même plante, nouvelle fleur |
| 🌶️ | `perf` | performances | ça pique, ça va vite |
| 🧠 | `test` | tests | on vérifie, on réfléchit |
| 🛍️ | `build` | construction, dépendances | on emballe |
| 💜 | `ci` | intégration continue | le cœur de la CI, en violet |
| 🧰 | `chore` | entretien | la boîte à outils |
| 🦩 | `revert` | annulation | le flamant fait demi-tour |
| 🧨 | `!` | changement incompatible | la dynamite : ça casse |

Les couleurs ont été mesurées sur la police Apple Color Emoji : chacun de ces emoji est
majoritairement rose, rouge ou violet. Elles peuvent varier un peu sur un autre système.

### Ajouter les tiens

Un fichier `.rose.json` à la racine du dépôt complète ou remplace la liste :

```json
{ "types": { "a11y": { "emoji": "💗", "sens": "accessibilité" } } }
```

Un type à toi (ici `a11y`) doit aussi être autorisé par Constance (réglage `types` de
`titre-pr`), sinon elle refusera le titre de la PR.

## À quoi ça ressemble

```text
$ rose verifier "feat: ajouter l'export CSV"
✗ il manque l'emoji : « feat: 🌸 ajouter l'export CSV »

$ rose titre feat "ajouter l'export CSV"
feat: 🌸 ajouter l'export CSV
```

## Utilisation

Il faut Node.js 20 ou plus récent.

### Le plus simple : le hook Git

```sh
npx @carolinedanslesnuages/rose hook installer
```

Ensuite, tu commites comme d'habitude, et Rose ajoute l'emoji :

```text
git commit -m "feat: ajouter l'export CSV"   →   feat: 🌸 ajouter l'export CSV
```

- Le hook est **autonome** : il ne dépend pas de Rose installée et ne va jamais sur Internet.
  Il lit ton `.rose.json` à chaque commit.
- Il **ne bloque jamais** un commit : en cas de souci, le message reste tel quel.
- Un titre qui a déjà un emoji, ou qui ne suit pas « type: … », n'est pas touché.
- Il respecte un hook `commit-msg` existant (refus sans `--forcer`) et `core.hooksPath` (husky).
- `rose hook retirer` l'enlève.

### La commande

```sh
npx @carolinedanslesnuages/rose                      # compose un commit pas à pas
npx @carolinedanslesnuages/rose liste
npx @carolinedanslesnuages/rose titre feat ajouter l\'export   # pour un titre de PR
npx @carolinedanslesnuages/rose verifier "feat: 🐞 ajouter X"
# ✗ 🐞 est l'emoji de « fix », pas de « feat » (attendu : 🌸).
```

### Dans une CI GitHub

En fusion squash, le **titre de la PR** devient le commit : c'est lui qu'il faut vérifier.

```yaml
on:
  pull_request:
    types: [opened, edited, synchronize, reopened]
jobs:
  rose:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7.0.1   # pour lire ton .rose.json
      - uses: Carolinedanslesnuages/rose@v1
```

Les PR ouvertes par des robots (release-please, Dependabot) ne sont pas vérifiées.

## Développer

```sh
npm test    # dont de vrais « git commit » avec le hook
```

## Licence

[MIT](LICENSE).
