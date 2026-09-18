# Design — Fase 3, sub-projeto Weapon Mastery (subtipo `weaponMastery`)

Data: 2026-09-18
Status: aprovado para planejamento
Spec anterior: `docs/superpowers/specs/2026-09-16-fade-retro-compendiums-design.md`
(seção 7, item 3 — "armas e masteries")
Também referencia: `docs/superpowers/specs/2026-09-18-fase3-weapons-design.md`
(sub-projeto anterior, subtipo `weapon` — este spec depende do
resultado dele: os 41 documentos de arma já gerados são o que os
documentos deste sub-projeto vão linkar por nome)

## 1. Objetivo

Segundo e último sub-projeto do domínio "armas e weapon masteries" —
cobre as tabelas de progressão de proficiência do cap. 6
(`extract/raw/weapons.txt`, Tables 6-2 em diante), subtipo `weaponMastery`.

Critério de conclusão: `packsrc/items/Weapon_Masteries/*.json` cobre uma
entrada por arma (41 documentos, mesma contagem do sub-projeto
`weapon` — 39 armas distintas + as 2 variantes de Sword, Bastard), e
`npm run validate` passa sem erros.

## 2. Achado que redefine a escala do sub-projeto

O livro tem 83 tabelas nomeadas "Table 6-N*" nessa faixa (confirmado por
contagem direta), não ~80 documentos de compêndio. Cada arma tem um
**par** de tabelas — "a" (vs Armed Opponents) e "b" (vs Unarmed
Opponents) — e o schema real do `weaponMastery`
(`MasteryDefinitionDataModel`, ver seção 3) já modela isso como um único
documento com campos primário/secundário por nível
(`pToHit`/`sToHit`, `pDmgFormula`/`sDmgFormula`). **Um documento por
arma, combinando o par a+b**, não um documento por tabela.

Confirmado com Sword, Bastard: tem 4 tabelas (6-33a/b para a variante
One-Handed, 6-33c/d para a Two-Handed) com progressões numéricas
diferentes entre si — vira 2 documentos `weaponMastery`, um por variante,
com os mesmos nomes usados nos 2 documentos `weapon` correspondentes
(`"Sword, Bastard"` e `"Sword, Bastard (Two-Handed)"`).

**Achado que também descarta um risco registrado no sub-projeto
anterior**: o título de cada tabela é o **nome da arma**
("Axe, Battle vs Armed Opponents"), não o grupo de proficiência
("Short Axes"). O link entre um documento `weapon` e seu
`weaponMastery` correspondente é **por nome de arma**, não pelo campo
`system.mastery` (grupo). Isso torna irrelevante, para fins de linking,
a inconsistência de grafia "Med. Blades"/"Medium Blades" que a revisão
final do sub-projeto `weapon` havia sinalizado como risco — não existe
mais uma canonização de chave a decidir, porque a chave nunca foi o
grupo.

**Confirmado por leitura de amostra (Club vs Mace, mesmo grupo
"Hammers")**: os dois têm progressões numéricas diferentes — a tabela é
genuinamente por arma, o "Proficiency Group" da Table 6-1 não implica
progressão compartilhada.

## 3. Schema de `MasteryDefinitionDataModel`

Fonte: `Forelius/fantastic-depths` @ `4a8f2c8`,
`src/item/dataModel/MasteryDefinitionDataModel.ts` (lido diretamente do
código-fonte durante esta sessão de brainstorming, não é uma tarefa de
pesquisa em aberto). Registrado em `src/fantastic-depths.ts:119` como
`weaponMastery: MasteryDefinitionDataModel` — distinto do subtipo
`mastery` (`ActorMasteryItemDM`, linha 116), que é tracking por
personagem em tempo de jogo (embarcado em Actor), não conteúdo de
compêndio, e fica fora de escopo aqui.

```typescript
name: string (required)
weaponType: string (não obrigatório, default "handheld")
primaryType: string (required, default "all")
levels: array de 6 elementos (um por rank), cada um:
  name: string (required)
  range: { short, medium, long } — todos number, required, default 0 (NÃO nullable)
  pDmgFormula: string, nullable, default null
  sDmgFormula: string, nullable, default null
  acBonusType: string, nullable, default null
  acBonus: number, nullable, default null
  acBonusAT: number, nullable, default null
  pToHit: number, required, default 0
  sToHit: number, required, default 0
  special: string, nullable, não obrigatório
```

`p`/`s` = primário/secundário. Os nomes dos campos não dizem
explicitamente "armed"/"unarmed", mas a estrutura (duas colunas
paralelas de to-hit e dano por nível) bate exatamente com o par de
tabelas "a"/"b" do livro — decisão de mapeamento: `p* = tabela "a" (vs
Armed)`, `s* = tabela "b" (vs Unarmed)`.

## 4. Vocabulário de linhas da tabela (achado por leitura completa de amostra)

Cada linha de dado tem um rótulo e 6 valores (colunas None → Grand
Master), cada valor um token sem espaço interno:

| Rótulo no livro | Aparece em | Mapeamento |
|---|---|---|
| `Attack Bonus` | sempre, "a" e "b" | `pToHit` (de "a") / `sToHit` (de "b") |
| `Damage` | sempre, "a" e "b" | `pDmgFormula` (de "a") / `sDmgFormula` (de "b") — nunca `"–"`, sempre populado |
| `AC Bonus` | só na tabela "b", nem toda arma | ver seção 5 (formato de 4 valores) |
| `Hurl Range` / `Throw Range` / `Missile Range` | armas com alcance | `range.{short,medium,long}` |
| `Deflect`, `Disarm`, `Hook`, `Knockout`, `Delay`, `Stun`, `Strangle` | variável por arma, 0-2+ por tabela | combinadas em `special` (seção 5) |

## 5. Regras de mapeamento por nível

- **`pToHit`/`sToHit`**: valor numérico da linha `Attack Bonus`;
  `"–"` → `0`.
- **`pDmgFormula`/`sDmgFormula`**: string literal da linha `Damage`
  (ex. `"1d8+4"`), sem parsing — mesmo padrão do `damageRoll` dos
  weapon items.
- **`acBonus`/`acBonusType`/`acBonusAT`**: a linha `AC Bonus` vem como 4
  valores separados por `/` (ex. `"–2/–2/–/–"`), sem documentação clara
  de que cada posição significa. Decisão: `acBonus` recebe o **primeiro**
  segmento convertido pra número (`"–"` → `null`); `acBonusType` e
  `acBonusAT` ficam `null` (sem base pra preencher com significado
  real); a string completa do livro fica preservada em
  `system.gm.notes` daquele documento (não por nível — uma nota geral no
  documento, já que o schema não tem `gm.notes` por nível). Quando
  nenhuma linha `AC Bonus` existe pra essa arma, os três campos ficam no
  default do schema (`null`).
- **`special`**: concatena toda linha de habilidade extra presente
  (`Deflect`, `Disarm`, `Hook`, `Knockout`, `Delay`, `Stun`, `Strangle`)
  nesse nível, no formato `"Nome valor, Nome valor"` — ex.
  `"Deflect 2, Disarm -1"` pro Sword Normal no rank Expert. Uma
  habilidade com valor `"Yes"` vira só o nome (`"Delay"`, sem o "Yes"
  literal); uma habilidade com `"–"` nesse nível específico é omitida
  (ainda não desbloqueada). Se nenhuma habilidade extra existe nesse
  nível pra essa arma, `special` fica `null` (default do schema).
- **`range.{short,medium,long}`**: da linha `Hurl Range`/`Throw
  Range`/`Missile Range` (qualquer uma que exista — nome da linha
  varia por arma, valor tem o mesmo formato `X/Y/Z` nas três variantes),
  3 valores separados por `/`; `"–"` → `0` (default do schema, que não
  aceita `null` aqui). Sem essa linha pra uma arma, os três campos ficam
  `0` (default).
- **`name`** (do nível): o rótulo do rank como impresso no livro —
  `"None"`, `"Basic"`, `"Skilled"`, `"Expert"`, `"Master"`, `"Grand
  Master"`.

## 6. Parser (`scripts/parse/weaponMastery.mjs`)

Lê `extract/raw/weapons.txt`, localiza cada par de tabelas "a"/"b" (ou,
pra Sword Bastard, os dois pares "a"/"b" e "c"/"d") pelo título (`Table
6–Na: <Nome> vs Armed Opponents`), extrai as linhas de dado de cada uma
usando a whitelist de rótulos da seção 4, e produz
`extract/parsed/weaponMastery.json` com um registro por arma — mesma
forma de nome que o sub-projeto `weapon` já usa (incluindo o sufixo
`"(Two-Handed)"` pra Sword Bastard 2H), pra o link por nome funcionar
sem ambiguidade.

## 7. Builder (`scripts/build/weaponMastery.mjs`)

Mesmo padrão dos dois sub-projetos anteriores: `_id` determinístico
(`sha1("weaponMastery:" + name)`), builder idempotente, pasta destino
`packsrc/items/Weapon_Masteries/` (nova — precisa de entrada em
`packsrc/items/_folders.json`, mesmo padrão da pasta `Armour` criada no
domínio equipment).

## 8. Validador e documentação de schema

`docs/fantastic-depths-item-schema.md` ganha uma seção
`MasteryDefinitionDataModel` (conteúdo da seção 3 deste spec, já
verificado — não é uma tarefa de pesquisa em aberto no plano de
implementação). `scripts/extract/validate.mjs` ganha
`SUBTYPE_REQUIRED_FIELDS.weaponMastery` — campos obrigatórios: `name`,
`primaryType`, `levels` (o array inteiro, com sua própria validação
aninhada avaliada como fora de escopo do validador atual, que só checa
presença de campos top-level de `system`, mesmo padrão usado pros
subtipos existentes).

## 9. Testes e validação

- **Parser**: fixture real reduzida com um par a/b completo (recomendo
  Club, que tem `AC Bonus` + `Deflect` + `Hurl Range`, cobrindo os três
  casos especiais numa arma só), mais o caso dos 4 tabelas do Sword
  Bastard virando 2 registros distintos.
- **Builder**: mapeamento de cada campo por nível (incluindo os casos
  de ausência: sem `AC Bonus`, sem habilidade extra, sem linha de
  alcance), combinação de múltiplas habilidades extras em `special`,
  `acBonus` só-primeiro-valor com nota preservando a string completa,
  `_id` determinístico.
- `npm run validate` como gate final.
- Revisão manual: amostragem de 3-4 armas geradas comparadas com as
  tabelas do livro, incluindo pelo menos uma com `AC Bonus` e uma com
  duas habilidades extras simultâneas.

## 10. Riscos e decisões pendentes

- **`acBonus` de 4 valores mapeado só pro primeiro é uma simplificação
  deliberada**, não um bug — decisão já tomada nesta sessão de
  brainstorming (seção 5), registrada aqui pra não ser reaberta como
  falha de mapeamento numa revisão futura. Se o significado exato dos 4
  valores for descoberto depois (ex. lendo o texto de regras do cap. 6
  sobre AC Bonus com mais cuidado), um sub-projeto futuro pode
  reprocessar `acBonusType`/`acBonusAT` a partir da string já
  preservada em `gm.notes`, sem precisar re-extrair do livro.
- **`primaryType` fica sempre `"all"` (default do schema)** — não há
  coluna na Table 6-2+ que sugira um valor diferente por arma; se o
  fantastic-depths usa esse campo pra alguma lógica de filtro por classe
  de personagem, isso fica sem dado de origem nesta fase.
- **`weaponType` fixo `"handheld"`**, mesma decisão já tomada no
  sub-projeto `weapon` — sem confirmação de outro valor válido usado em
  armas de cerco/fogo.
