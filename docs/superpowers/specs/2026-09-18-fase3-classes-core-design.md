# Design — Fase 3, domínio Classes, sub-projeto Tabela Núcleo (subtipo `class`)

Data: 2026-09-18
Status: aprovado para planejamento
Spec anterior: `docs/superpowers/specs/2026-09-16-fade-retro-compendiums-design.md`
(seção 4, "Cap. 4 — 10 classes" → `class` → `Character_Classes/`)

## 1. Objetivo

Primeiro de dois sub-projetos do domínio classes (cap. 4,
`extract/raw/creating-a-character.txt`, 2748 linhas). Cobre a parte
puramente tabular/mecânica do subtipo `class`
(`ClassDefinitionDataModel`, Forelius/fantastic-depths@4a8f2c8):
`levels[]` (progressão por nível), `saves[]` (salvamentos por nível),
`spells[][]` (slots de magia por nível/círculo, só classes
conjuradoras), `primeReqs` (Table 4-1), e a identidade básica da classe
(`key`, `species`, `firstLevel`, `maxLevel`, `firstSpellLevel`,
`maxSpellLevel`, `basicProficiency`, `alignment`, `description`).

**Fora de escopo deste sub-projeto** (fica pro sub-projeto 2,
"Habilidades e Talentos"): a coluna de texto livre "Abilities" de cada
tabela Na (o que cada nível concede em prosa — Skill Increase, Weapon
Feat, Turn Undead, etc.), o array `specialAbilities[]`, `classItems[]`,
os sub-caminhos de Fighter (Chevalier/Warden/Warlord), e as tabelas
"Talents by Level" (4-7c/4-8c/4-9c/4-10c).

Critério de conclusão: `packsrc/items/Character_Classes/*.json` cobre
as 10 classes com `levels`/`saves`/`spells`/`primeReqs` preenchidos, e
`npm run validate` passa sem erros. O sub-projeto 2 preenche os campos
restantes num commit posterior, no mesmo documento (mesmo `_id`
determinístico) — não recria os documentos do zero.

## 2. Catálogo das 10 classes (achado por leitura completa e exaustiva de todas as tabelas "a")

Cada classe tem sua própria "Table N–Xa: <Classe> Abilities by Level"
com um layout de coluna DIFERENTE — não existe uma tabela universal.
Catalogado por leitura direta de todas as 10 tabelas:

| Classe | Colunas além de Level/XP/Hit Points/Attack Bonus/Abilities | Círculos de magia | Prime Ability (Table 4-1) |
|---|---|---|---|
| Battlemage | Spell Slots (9 círculos) | 9 | Intelligence |
| Cleric | Spell Slots (7 círculos) | 7 | Wisdom |
| Druid | Spell Slots (7 círculos) | 7 | Wisdom |
| Fighter | nenhuma | — | Strength |
| Grenadier | "Powder Refinement" (1 coluna, texto tipo "26 grains") | — | Dexterity |
| Mountebank | Spell Slots (8 círculos) | 8 | Charisma |
| Mystic | "Enhanced Martial Arts Abilities": Armour Class, Move, Unarmed Attacks, Unarmed Damage, Unarmed Hit As (5 colunas) | — | Strength |
| Ranger | nenhuma | — | Dexterity |
| Thief | nenhuma (as colunas de talento ficam na Table 4-10c, fora de escopo) | — | Dexterity |
| Wizard | Spell Slots (9 círculos) | 9 | Intelligence |

**Achado que redefine o parsing**: como não existe layout universal, o
parser usa uma **tabela de configuração por classe** (nome → número de
colunas de recurso, tipo de recurso), não uma regex genérica de coluna.
Isso é o mesmo princípio já usado em `weaponMastery` (vocabulário fixo
verificado contra o texto real, não inferido genericamente).

## 3. Achado: `thbonus` ≠ `thac0`, e o livro só imprime `thbonus`

O schema real do sistema (`SkillItemDataModel`... não, aqui:
`ClassDefinitionDataModel.levels[]`) tem dois campos de ataque
distintos: `thac0` (THAC0 clássico descendente) e `thbonus` (bônus
ascendente). Confirmado lendo `src/sys/registry/ToHitSystem.ts`: o
sistema suporta os dois modos de acerto (THAC0 clássico ou AAC
ascendente) como uma **configuração de mundo** (`game.settings`), não
por classe — então um documento de classe precisa ter dado utilizável
nos dois modos, em teoria.

O livro (Dark Dungeons, um retroclone puramente ascendente) só imprime
a coluna "Attack Bonus" (+1, +2, +3...) — nunca um valor de THAC0
clássico em lugar nenhum do capítulo. **Ruling**: `thbonus` = valor
impresso da coluna "Attack Bonus"; `thac0` fica no default do schema
(`CONFIG.FADE.ToHit.baseTHAC0`, uma constante calculada em runtime, não
hardcodável de forma confiável aqui) — o builder simplesmente omite
esse campo do objeto que escreve pra cada nível, deixando o schema
aplicar seu próprio default na importação (mesmo padrão já usado em
outros domínios pra campos sem dado do livro).

## 4. Achado: sem mecânica de bônus de XP por prime requisite

Diferente do B/X clássico (onde uma prime ability alta dá +5%/+10%/+15%
de XP), este livro **não tem essa mecânica** — confirmado por busca
exaustiva no capítulo inteiro (nenhuma menção a bônus percentual de XP
ligado a ability score). A Table 4-1 só define QUAL ability é a prime
de cada classe, usada na criação de personagem pra decidir onde alocar
o maior valor rolado — não alimenta nenhum cálculo de XP.

**Ruling**: `primeReqs` = `[{ ability: "<código 3 letras>", minScore: 0,
percentage: 5, concatLogic: null }]` — um único elemento por classe
(a Table 4-1 só lista uma prime ability cada). `minScore: 0` (livro não
define um piso mínimo de score pra isso valer) e `percentage: 5`
(default do schema, campo sem função mecânica neste livro, mas
obrigatório — `required: true` sem default definido no elemento do
array, então precisa de ALGUM valor explícito; 5 é o valor de
`initial` que o schema usa em outros contextos do mesmo campo).

## 5. Achado: `saves` não tem sub-schema fixo no schema real

`ClassDefinitionDataModel.saves` é `new ArrayField(new ObjectField({}),
...)` — um array de objetos genéricos, sem shape imposto pelo schema
(diferente de `levels`, que tem uma `SchemaField` com campos
nomeados). A Table N–Xb ("Saves by Level") de toda classe tem
exatamente 5 colunas: Doom, Ray, Stasis, Blast, Spell — confirmado por
leitura de Battlemage e Cleric, e a estrutura se repete
consistentemente (mesmos 5 nomes de coluna) nas tabelas b de todas as
10 classes.

**Ruling**: cada entrada de `saves` é `{ level: number, doom: number,
ray: number, stasis: number, blast: number, spell: number }` —
transcrição direta das 5 colunas do livro, já que o schema não impõe
nenhuma outra forma.

## 6. Recursos específicos de classe sem campo no schema real

Grenadier ("Powder Refinement") e Mystic (5 colunas de artes marciais)
têm progressão por nível real e mecanicamente relevante, mas
`ClassDefinitionDataModel` não tem NENHUM campo genérico pra "recurso
específico de classe" fora do array `spells` (que é fixamente "slots de
magia por círculo", não um recurso arbitrário).

**Ruling (confirmado com o usuário)**: preservar esse dado como uma
tabela HTML dentro de `system.description` (mesmo texto que já
carrega a prosa de introdução da classe) — nunca descartar dado real
do livro silenciosamente, mesmo quando o schema não tem um campo
estruturado pra ele. A tabela é só referência textual pro
jogador/Gameguide, não é lida por nenhuma automação do sistema (mesma
natureza que outras tabelas já preservadas em descrição em domínios
anteriores).

## 7. Sem coluna de "título" por nível

O schema tem `title`/`femaleTitle`/`attackRank` por nível (convenção
clássica de "Veteran", "Warrior", etc. do B/X). **Nenhuma das 10
tabelas do livro tem uma coluna de título** — confirmado nos cabeçalhos
de todas as tabelas lidas (Level/Experience/Hit Points/Attack Bonus/
[recurso opcional]/Abilities, nunca um "Title"). **Ruling**: os três
campos ficam `null` (default do schema) em todo nível de toda classe —
este livro não usa a convenção de títulos por nível.

## 8. `hdcon`: sempre `true`

O texto geral ("ABILITIES COMMON TO ALL CLASSES", já lido) explica que
"after 9th level characters no longer gain additional hit points for
their constitution modifier" — mas essa informação já está BAKED IN na
própria string de HD impressa por nível (ex.: Battlemage nível 9 = 
`"38+9c"`, nível 10 = `"39+9c"` — o coeficiente do `c` já para de
crescer em 9, sem precisar de um booleano pra sinalizar isso).
**Ruling**: `hdcon: true` em todo nível de toda classe — o campo HD
(string) é a fonte de verdade, o booleano não precisa mudar.

## 9. Schema real usado (campos relevantes a este sub-projeto)

`ClassDefinitionDataModel` (`src/item/dataModel/ClassDefinitionDataModel.ts`,
Forelius/fantastic-depths@4a8f2c8):

- `key` (string, obrigatório) — slug da classe, ex. `"battlemage"`.
- `species` (string, obrigatório, default `"Human"`) — nenhuma das 10
  classes tem restrição de espécie mencionada no capítulo; fica no
  default.
- `firstLevel` (number, obrigatório, default `1`).
- `maxLevel` (number, obrigatório) — última linha de cada tabela Na
  (36 pra todas as 10 classes, confirmado por leitura de todos os
  cabeçalhos/últimas linhas).
- `firstSpellLevel`/`maxSpellLevel` (number, obrigatórios) — só
  relevantes pras 5 classes conjuradoras; nas outras 5, ficam nos
  defaults do schema (`1`/`0`).
- `basicProficiency` (boolean, obrigatório, default `false`) — `true`
  quando o texto de "Equipment Restrictions" da classe diz algo como
  "may use any weapons" (ex.: Battlemage, Fighter) — ver seção 10 pra
  regra exata.
- `unskilledToHitMod` (number, obrigatório, default `-2`) — sem dado de
  livro que sobrescreva; fica no default.
- `alignment` (string, nullable, default `"Any"`) — nenhuma das 10
  classes tem restrição de alinhamento mencionada no capítulo lido até
  agora; fica no default, a menos que a Task de implementação encontre
  uma menção explícita ao ler a prosa completa de cada classe (a
  verificar).
- `description` (string) — prosa de introdução da classe + (quando
  aplicável) a tabela HTML de recurso específico (seção 6).
- `castAsKey` (string nullable) — não usado neste sub-projeto (relação
  entre classes tipo Chevalier/cleric fica pro sub-projeto 2).
- `primeReqs` — ver seção 4.
- `levels[]` — ver campos abaixo.
- `saves[]` — ver seção 5.
- `spells[][]` — array de arrays, `spells[levelIndex][circleIndex]`,
  só pras 5 classes conjuradoras; outras 5 ficam com array vazio.
- `specialAbilities`/`classItems` — deixados `[]` neste sub-projeto
  (populados no sub-projeto 2).

Campos de `levels[]` (schema `ClassLevelData`):
`level`, `xp` (coluna Experience), `thac0` (omitido, seção 3),
`thbonus` (coluna Attack Bonus, seção 3), `hd` (coluna Hit Points,
string verbatim tipo `"6+c"`), `hdcon` (sempre `true`, seção 8),
`title`/`femaleTitle`/`attackRank` (sempre `null`, seção 7).

## 10. `basicProficiency` e restrições de equipamento

Cada classe tem uma prosa "<CLASSE> ABILITIES (SEE TABLE N–Xa)" com uma
linha "Equipment Restrictions: ...". `basicProficiency` (schema: "If
true the character or class has basic proficiency with all weapons")
é sobre ARMAS, não armadura — a restrição de armadura de cada classe
(se houver) fica só documentada em `description`, sem campo próprio no
schema.

**Confirmado por leitura das 10 prosas completas** (busca exaustiva,
não amostra):

| Classe | Cláusula de arma (verbatim) | `basicProficiency` |
|---|---|---|
| Battlemage | "may use any weapons" | `true` |
| Cleric | "may only use weapons with the Blunt trait" | `false` |
| Druid | "may only use weapons and shields with the Organic trait" | `false` |
| Fighter | "can use any weapon or shield" | `true` |
| Grenadier | "can use any weapon or shield" | `true` |
| Mountebank | "may use any weapon or shield except for those with the Bulky trait" | `false` (tem exceção, não é irrestrito) |
| Mystic | "may use any weapon with the Simple trait" | `false` |
| Ranger | "may use any weapon" | `true` |
| Thief | "may use any weapon or shield except for those with the Bulky trait" | `false` (mesma exceção do Mountebank) |
| Wizard | "able to use any simple weapon" | `false` |

## 10a. `alignment`: sempre "Any", sem exceção

Busca exaustiva por `alignment` no capítulo inteiro: **zero
ocorrências**. Nenhuma das 10 classes tem restrição de alinhamento
mencionada. **Ruling**: `alignment: "Any"` (default do schema) pra
todas as 10 classes, sem exceção — confirmado, não é mais uma pendência
em aberto.

## 11. IDs determinísticos e pasta

- `deterministicId("classes:" + key)` — mesmo algoritmo dos domínios
  anteriores.
- Pasta: `Character_Classes/`, top-level, hand-picked em
  `_folders.json` (10 documentos, volume pequeno).

## 12. Parser e builder

Dado o catálogo de 10 layouts diferentes (seção 2), o parser usa uma
tabela de configuração hardcoded por classe (nome da classe → número
de colunas de recurso extra, tipo do recurso: `"spells"` com N
círculos, `"resource"` com M colunas nomeadas, ou `nenhum`),
verificada por leitura exaustiva de TODAS as 10 tabelas antes de
escrever o plano de implementação (não confiar só nesta spec — a spec
já fez essa leitura uma vez, mas o plano precisa reverificar com código
real rodando contra o arquivo real antes de ser finalizado, seguindo o
processo já estabelecido nos domínios anteriores).

`scripts/parse/classesCore.mjs` produz
`extract/parsed/classesCore.json`, um array de 10 objetos:

```json
{
  "key": "battlemage",
  "name": "Battlemage",
  "primeAbility": "int",
  "circleCount": 9,
  "levels": [{ "level": 1, "xp": 0, "thbonus": 1, "hd": "6+c" }, ...],
  "spells": [[1,0,0,0,0,0,0,0,0], ...],
  "saves": [{ "level": 1, "doom": 7, "ray": 6, "stasis": 7, "blast": 4, "spell": 5 }, ...],
  "equipmentRestrictions": "may use any weapons and armour",
  "introProse": "<p>...</p>",
  "resourceTable": null
}
```

`scripts/build/classesCore.mjs` mapeia esse JSON pro documento
`ClassDefinitionDataModel`, aplicando as rulings das seções 3–10.

## 13. Testes e validação

**Parser**: um teste por classe confirmando a contagem certa de níveis
(36), a contagem certa de círculos de magia (0 pras 5 não-conjuradoras,
7/8/9 conforme a tabela da seção 2), e a extração correta de pelo menos
um valor de cada coluna (XP, HD, Attack Bonus, saves) contra uma
amostra real de cada uma das 10 tabelas (não um fixture sintético
genérico — cada classe tem sua própria idiossincrasia de layout,
então cada teste usa um recorte real do livro).

**Verificação exaustiva antes do plano**: rodar o parser real contra o
capítulo inteiro, confirmar 10 classes × 36 níveis cada (360 entradas
de `levels`, 360 de `saves`), e os círculos de magia batendo com a
tabela da seção 2.

## 14. Riscos e decisões pendentes

- Sub-projeto 2 (habilidades/talentos) depende do resultado deste
  sub-projeto só na medida em que os dois escrevem no MESMO documento
  de classe (mesmo `_id` determinístico) — precisa rodar depois deste,
  não em paralelo, pra não haver conflito de escrita no mesmo arquivo.
