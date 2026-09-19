# Design — Fase 3, domínio Skills e Talentos (subtipos `skill` e `specialAbility`)

Data: 2026-09-18
Status: aprovado para planejamento
Spec anterior: `docs/superpowers/specs/2026-09-16-fade-retro-compendiums-design.md`
(seção 4, tabela de mapeamento — "Cap. 5 — skills e talentos" → `skill`
→ `General_Skills/`, `Talents/` — **corrigido nesta spec**, ver seção 1)

## 1. Objetivo e correção ao spec geral

Quarto domínio da Fase 3 (ordem: equipamento → armas e masteries →
magias [concluídos] → skills → classes). Cobre o cap. 5
(`extract/raw/skills-and-talents.txt`), que tem DUAS seções de dados
distintas: talentos (seção "SKILLS & TALENTS") e skills (seção
"ALPHABETIC SKILL LISTING").

**Correção**: o spec geral (seção 4) mapeia todo o capítulo 5 para um
único subtipo `skill`. Isso não bate com o schema real do sistema
(Forelius/fantastic-depths @ 4a8f2c8):

- `SkillItemDataModel` (`src/item/dataModel/SkillItemDataModel.ts`, via
  campos próprios — não delega a um field module separado) modela a
  mecânica de "comprar pontos de skill": `ability` (obrigatório),
  `level` (obrigatório, representa pontos investidos), `skillBonus`/
  `skillPenalty` (obrigatórios), `rollFormula`/`targetFormula`/
  `operator` (obrigatórios). É a forma certa pras 31 skills do capítulo
  (Balance, Climbing, etc. — cada ponto dá +1 a um ability check
  específico).
- Talentos não têm essa mecânica — são acesso binário a uma habilidade
  de classe (ex.: só quem tem o talento Climb Walls pode escalar certas
  superfícies; não existe "nível" de Climb Walls). O schema já tem um
  subtipo pronto pra isso, já em uso por outros domínios do projeto
  (citado na tabela de subtipos do spec geral): `SpecialAbilityDataModel`
  (`tags`, `description`, `rollFormula`/`operator`/`target` todos
  opcionais e vazios por padrão, `category`, sem noção de "pontos
  investidos").

**Ruling**: talentos → subtipo `specialAbility` (pasta `Talents/`),
skills → subtipo `skill` (pasta `General_Skills/`). Dois subtipos, não
um. Critério de conclusão: `packsrc/items/General_Skills/*.json` cobre
as 31 skills, `packsrc/items/Talents/*.json` cobre os 10 talentos,
`npm run validate` passa sem erros.

## 2. Fonte e formato de cada seção

Arquivo `extract/raw/skills-and-talents.txt` (1195 linhas, cap. 5
inteiro — bem menor que `spells.txt`, sem necessidade de decomposição
em sub-projetos).

**Talentos** (seção "SKILLS & TALENTS", linha 394 até logo antes de
"ALPHABETIC SKILL LISTING" na linha 553): exatamente **10 talentos**,
cada um no formato `Nome: descrição em prosa` (parágrafo corrido, sem
cabeçalho separado, sem estrutura tabular). Nomes confirmados por
leitura direta do texto real: `Open Locks`, `Locate Traps`,
`Remove Traps`, `Climb Walls`, `Move Silently`, `Hide in Shadows`,
`Pick Pockets`, `Hear Noise`, `Read Languages`, `Wizard Scroll Use`.

**Achado de risco real**: essa mesma seção também contém um bloco de
exemplo iniciado por `Example:` (linha ~433, dentro da descrição de
"Locate Traps") — que bate no mesmo padrão sintático `Palavra: texto`
usado pelos nomes de talento. Um detector genérico baseado em regex de
":" geraria um 11º "talento" falso ("Example"). **Decisão**: usar uma
lista fixa dos 10 nomes reais (confirmados acima) como delimitadores de
verbete — mesmo padrão `KNOWN_LABELS` já usado no domínio
`weaponMastery` — em vez de detecção genérica. É seguro porque a lista é
pequena, fixa, e já foi conferida contra o texto inteiro.

**Skills** ("ALPHABETIC SKILL LISTING", linha 553 ao fim do arquivo):
**31 skills**, cada uma com cabeçalho em CAIXA ALTA na própria linha
(ex.: `ARCANE LORE`, `BALANCE`) seguido de parágrafos de descrição até
o próximo cabeçalho. Confirmado por extração real e exaustiva contra o
arquivo inteiro (todos os 31, nenhum a mais nem a menos — ver seção 3
para a lista completa e o porquê da contagem inicial ingênua ter dado
25, não 31).

## 3. Cabeçalho de skill: achado real sobre o formato

Um regex ingênuo pra cabeçalho (`^[A-Z][A-Z ]+$`, só letras maiúsculas e
espaço) encontra 25 das 31 skills — perde 6 que têm sufixo entre
parênteses indicando que a skill não é única, mas um grupo de
especializações escolhidas pelo jogador: `CRAFT (CHOOSE MEDIUM)`,
`ETIQUETTE (CHOOSE CULTURE)`, `LANGUAGE (CHOOSE LANGUAGE)`,
`LAWS (CHOOSE CULTURE)`, `PERFORMANCE (CHOSE MEDIUM)` (nota: o livro
tem um erro de grafia aqui, "CHOSE" em vez de "CHOOSE" — transcrito
verbatim, não corrigido), `RIDING (CHOOSE ANIMAL)`.

O livro afirma explicitamente, pra pelo menos Craft e Performance, que
"uma lista exaustiva não é possível" — então essas 6 skills viram **UM
item genérico cada** (não fan-out por especialização), com os exemplos
do livro (ex.: Carpentry, Smithing, Fletching... pra Craft) preservados
na descrição pra referência de quem for jogar.

**Regex de cabeçalho corrigido**: `/^[A-Z][A-Z0-9 /()\-]+$/` (aceita
dígitos, `/`, parênteses e hífen) — verificado contra o arquivo inteiro,
encontra exatamente as 31 skills esperadas (confere com a lista
cruzada da Table 5-1 "Skills by Ability Score", p.62, que também lista
30 nomes de skill — a diferença de 1 é "Language", que a Table 5-1 não
lista por não estar amarrada a nenhum ability score específico, ver
seção 4).

## 4. Extração do `ability` de cada skill

A primeira frase de cada descrição de skill segue o padrão "Each point
spent ... gives a +1 bonus **to** `<ability>` **checks**" — mas a
extração exaustiva contra as 31 skills reais achou variações que uma
regex simples perderia:

- `"bonus to X checks"` (a maioria) e `"bonus on X rolls"` (Etiquette,
  First Aid, Navigating) — o parser aceita `to|on` e `checks|rolls`.
- `"bonus to both X checks and Y checks"` — duas skills são
  **duplo-ability**: `Intimidation` (charisma + strength) e
  `Performance` (dexterity + charisma). O schema só tem um campo
  `ability` (string única). **Ruling**: primeira ability listada vira
  `system.ability`, a segunda vira nota em `gm.notes` — mesmo padrão
  "primeiro valor no campo, extra em notes" já usado em `weapons`
  (mastery groups extras) e `spells` (não aplicável lá, mas o princípio
  geral do projeto é o mesmo: nunca descartar dado real).
- `Language` **não tem nenhuma frase desse padrão** — confirmado no
  texto: é uma "special skill" (seção "SPECIAL SKILLS", p.64) que não
  dá bônus de ability check, só representa "conhece o idioma"/"fala
  como nativo" por nível investido. **Ruling**: `system.ability` fica no
  default do schema (`"str"`, nunca de fato consultado pra este item,
  já que Language não participa de rolls de ability normais) e
  `gm.notes` documenta explicitamente "Special skill — não concede
  bônus de ability check, ver descrição" para não deixar a escolha
  arbitrária do default parecer uma afirmação de dado real.

Mapeamento de nome de ability (inglês, minúsculo, por extenso, como
aparece no livro) pro código de 3 letras que o schema espera:
`strength→str`, `intelligence→int`, `wisdom→wis`, `dexterity→dex`,
`charisma→cha` (constitution não aparece em nenhuma skill do capítulo,
confirmado pela Table 5-1).

Verificação exaustiva final (script rodado contra o arquivo real):
**30 das 31 skills têm `ability` extraída com sucesso** (as 2
duplo-ability inclusas, usando a primeira); só `Language` fica sem
match, tratada pela ruling acima — nenhum outro caso residual.

## 5. Schema real dos dois subtipos

**`SkillItemDataModel`** (campos, com o que este domínio escreve):
`description` (string, prosa do livro), `gm.notes` (string, usada pras
rulings das seções 3–4), `ability` (string, obrigatório — seção 4),
`targetFormula` (string, obrigatório, fica no default do schema
`"@rollTarget"` — não há dado do livro pra sobrescrever, é uma
referência calculada pelo sistema em runtime), `operator` (string,
obrigatório, default `"lte"` — mesma razão, é lógica do sistema, não
dado do livro), `rollFormula` (string, obrigatório, default `"1d20"` —
bate com "roll a standard check" do livro, então é o valor correto, não
só o default por acaso), `level` (number, obrigatório, default `1` —
este item é uma definição genérica de skill pro compêndio, não uma
instância já comprada por um personagem específico, então fica no
nível-base do schema), `rollMode` (string, default `""`),
`healFormula` (nullable, default `null`), `showResult` (boolean,
default `true`), `skillBonus`/`skillPenalty` (number, obrigatórios,
default `0` — sem dado de livro que justifique outro valor pra um item
de compêndio genérico), `autoSuccess`/`autoFail` (nullable, default
`null`).

**`SpecialAbilityDataModel`** (campos, com o que este domínio escreve):
`tags` (array, `[]` — sem dado de origem), `description` (string, prosa
do talento), `gm.notes` (string, `""` — nenhum talento precisa de nota
extra), `rollFormula`/`operator`/`target` (strings, default `""` — o
livro descreve os talentos em termos de "faça um roll de Spot/Sneak/
Climbing com bônus", que já são as skills normais, não uma fórmula
própria do talento), `rollMode` (default `"publicroll"`),
`autoSuccess`/`autoFail` (nullable, `null`), `abilityMod` (default
`""`), `savingThrow`/`dmgFormula`/`healFormula` (nullable, `null`),
`damageType` (default `""`), `category` (`"talent"` — valor fixo, único
jeito de distinguir estes itens de outros usos futuros de
`specialAbility` no projeto, ex. habilidades de monstro), `shortName`
(default `""`), `combatManeuver`/`customSaveCode`/`classKey` (nullable,
`null`), `showResult` (default `true`), `quantity` (default `1`),
`quantityMax` (nullable, `null`), `conditions` (array, `[]`).

## 6. IDs determinísticos e pastas

- `deterministicId("skills:" + name)` / `deterministicId("talents:" +
  name)` — mesma função/algoritmo dos domínios anteriores, reimplementada
  de forma independente em cada builder (sem import cruzado).
- Pastas: `General_Skills/` (top-level, `folder: null`) e `Talents/`
  (top-level, `folder: null`) — hand-picked em `_folders.json`, mesmo
  padrão dos domínios equipment/weaponMastery (volume pequeno o
  suficiente pra não precisar de resolução dinâmica como em `spells`).

## 7. Parser (`scripts/parse/skillsAndTalents.mjs`)

Um único arquivo de parser cobre as duas seções (compartilham a mesma
fonte e boa parte da lógica de extração de parágrafos), produzindo
`extract/parsed/skillsAndTalents.json` com o formato:

```json
{
  "talents": [{ "name": "Open Locks", "description": "<p>...</p>" }, ...],
  "skills": [{ "name": "Arcane Lore", "ability": "int", "extraAbility": null, "description": "<p>...</p>" }, ...]
}
```

- Talentos: delimitados pela lista fixa de 10 nomes (seção 2). Nome
  original do livro (Title Case) vira `name`; a descrição junta tudo
  entre `"Nome: "` e o início do próximo nome da lista (ou fim da
  seção), removendo blocos `Example:` internos da MESMA forma que o
  texto de descrição os apresenta (ficam DENTRO da descrição do talento
  a que pertencem — "Example:" não é removido, só não é tratado como um
  novo verbete).
- Skills: cabeçalho detectado por `/^[A-Z][A-Z0-9 /()\-]+$/` (seção 3),
  excluindo a própria linha "ALPHABETIC SKILL LISTING". Nome normalizado
  pra Title Case (ex.: `"CRAFT (CHOOSE MEDIUM)"` → `"Craft"` — o sufixo
  `(CHOOSE ...)` não faz parte do nome do item, vira uma nota em
  `gm.notes` do builder indicando que é uma skill de escolha de
  especialização, com os exemplos do livro). `ability`/`extraAbility`
  extraídos via regex da seção 4.

## 8. Builder (`scripts/build/skillsAndTalents.mjs`)

Lê `extract/parsed/skillsAndTalents.json`, produz um documento por
talento (subtipo `specialAbility`, pasta `Talents/`) e um por skill
(subtipo `skill`, pasta `General_Skills/`), escrevendo em
`packsrc/items/Talents/*.json` e `packsrc/items/General_Skills/*.json`
respectivamente.

## 9. Validador e documentação de schema

- `docs/fantastic-depths-item-schema.md` ganha duas seções novas:
  `SkillItemDataModel` e `SpecialAbilityDataModel`, com os campos reais
  listados na seção 5 (fonte: `SkillItemDataModel.ts`,
  `SpecialAbilityField.ts`, Forelius/fantastic-depths@4a8f2c8).
- `scripts/extract/validate.mjs`: **lição herdada do domínio spells**
  (onde um round de fix anterior adicionou `"name"` a
  `SUBTYPE_REQUIRED_FIELDS.spell` sem essa exigência existir no schema
  real, e só foi corrigido na revisão final) — a lista de campos
  obrigatórios de cada subtipo deve ser literalmente os campos com
  `required: true` no schema real, não uma lista inventada por analogia
  com outro domínio:
  - `SUBTYPE_REQUIRED_FIELDS.skill = ["ability", "targetFormula", "operator", "rollFormula", "level", "skillBonus", "skillPenalty"]`
    (os 7 campos `required: true` reais do `SkillItemDataModel`).
  - `SUBTYPE_REQUIRED_FIELDS.specialAbility = []` (nenhum campo do
    `SpecialAbilityData.defineSchema()` real tem `required: true` — a
    entrada existe só pra satisfazer o "unknown subtype" do validador,
    não pra impor uma exigência inventada).

## 10. Testes e validação

**Parser** (`scripts/parse/skillsAndTalents.test.mjs`):
- os 10 talentos detectados corretamente, incluindo o caso do bloco
  `Example:` embutido em "Locate Traps" não virando um 11º talento
  falso.
- skill com ability simples (ex.: Arcane Lore → int).
- skill com "bonus on X rolls" (Etiquette/First Aid/Navigating).
- skill duplo-ability (Intimidation → charisma + strength; Performance
  → dexterity + charisma).
- skill "special" sem ability (Language → nenhum match, tratado pela
  ruling).
- skill "(CHOOSE X)" tem o nome normalizado sem o sufixo (Craft, não
  "Craft (Choose Medium)").

**Builder** (`scripts/build/skillsAndTalents.test.mjs`):
- mapeamento completo de skill (ability, level=1, rollFormula="1d20",
  etc.).
- mapeamento completo de talento (category="talent", rollFormula="",
  etc.).
- `gm.notes` populada corretamente pros 3 casos especiais (duplo-ability,
  Language, skills "(CHOOSE X)").
- teste de integração real (lição do domínio spells): `buildDocument()`
  seguido de `validateDocument()` deve retornar `[]` de erros, pros dois
  subtipos.

**Verificação exaustiva antes do plano** (já feita nesta spec, seção 3–4,
mas a repetir no plano de implementação com o código final): rodar o
parser real contra o arquivo inteiro, confirmar 10 talentos + 31 skills,
0 residual (nenhuma linha de cabeçalho de skill não reconhecida, nenhum
talento faltando ou duplicado).

## 11. Riscos e decisões pendentes

- As 6 skills "(CHOOSE X)" (seção 3) viram item genérico — se o projeto
  algum dia quiser oferecer opções pré-populadas (ex. "Craft: Smithing"
  como item separado), isso é uma extensão futura fora do escopo desta
  v1, não uma correção.
- Segue a recomendação já registrada nos domínios anteriores de
  consolidar `deterministicId`/envelope de documento Foundry em
  `scripts/lib/` — agora com 5 cópias independentes
  (equipment/weapons/weaponMastery/spells + este domínio). Registrado
  como risco crescente, não bloqueio.
