# Design — Fase 3, domínio Classes, sub-projeto Habilidades e Talentos

Data: 2026-09-18
Status: aprovado para planejamento
Spec anterior: `docs/superpowers/specs/2026-09-18-fase3-classes-core-design.md`
(sub-projeto 1, "Tabela Núcleo" — este sub-projeto escreve sobre os
MESMOS 10 documentos `class` já gerados lá, mesmo `_id` determinístico,
preenchendo os campos que o sub-projeto 1 deixou vazios:
`specialAbilities[]`, `classItems[]`)

## 1. Objetivo

Segundo e último sub-projeto do domínio classes (cap. 4). Cobre:

1. A coluna de texto livre "Abilities" de cada Table N–Xa (o que cada
   classe ganha em cada nível) — que, contra a estimativa inicial de
   ~18 habilidades nomeadas distintas, provou ser **~30 habilidades
   nomeadas** após extração exaustiva das 10 tabelas inteiras (36
   níveis cada), catalogadas na seção 3.
2. `classDefinition.specialAbilities[]` — array de links pra itens
   `specialAbility`, tanto os NOVOS itens criados por este sub-projeto
   (habilidades de combate/classe) quanto os itens `specialAbility` já
   existentes do domínio `skills` (os 10 Talentos: Open Locks, Locate
   Traps, etc.) pras 4 classes que os concedem (Thief, Mountebank,
   Mystic, Ranger).
3. Os sub-caminhos do Fighter (Chevalier/Warden/Warlord, escolha
   opcional a partir do nível 9).
4. Duas habilidades com tabela de progressão própria sem campo no
   schema real (Turn Undead do Cleric, Command Animal do Druid) —
   mesma tratativa de "tabela HTML em description" já usada no
   sub-projeto 1 pro Powder do Grenadier e artes marciais do Mystic.

Critério de conclusão: os 10 documentos `packsrc/items/Character_Classes/*.json`
(já existentes, do sub-projeto 1) têm `specialAbilities[]` preenchido;
novos itens `specialAbility` em `packsrc/items/Class_Abilities/` cobrem
as ~34 habilidades de classe catalogadas (algumas compartilhadas entre
classes quando o texto é idêntico, ver seção 3); `npm run validate`
passa sem erros.

## 2. Ruling de escopo (decisão do usuário)

Avaliado com o usuário se este sub-projeto deveria ser decomposto ainda
mais (dado que ~30 habilidades é comparável em volume a um domínio
inteiro) — **decisão: manter como um sub-projeto só**, seguindo o
mesmo padrão já usado no domínio `weaponMastery` (plano grande, mesma
disciplina de verificação exaustiva antes de finalizar).

## 3. Catálogo completo das habilidades nomeadas (achado por extração exaustiva das 10 tabelas)

Extraído programaticamente: pra cada uma das 10 classes, toda linha de
nível (1–36) da Table Na, descartando as colunas numéricas conhecidas
(XP/HP/Attack Bonus/recurso), o texto restante identifica exatamente
quais habilidades são concedidas em qual nível. **"Skill Increase"**,
**"Weapon Feat"** e **"Spell Casting"** NÃO viram itens — são mecânicas
genéricas de compra de ponto já descritas em "ABILITIES COMMON TO ALL
CLASSES" (fora de escopo, regra geral de criação de personagem, não
dado por classe).

| Classe | Habilidade | Nível(is) concedido(s) |
|---|---|---|
| Fighter | Parry | 7 |
| Fighter | Chivalric Vows | 8 (tabela) — prosa da própria habilidade diz "after reaching 9th level" pra efetivamente tomar os votos; documentado como está, não reconciliado |
| Fighter | Power Attack | 11 |
| Fighter | Multi-attack | 10 (2 ataques), 20 (3), 30 (4) — um item, 3 entradas em `specialAbilities[]` |
| Battlemage | Parry | 7 |
| Battlemage | Power Attack | 11 |
| Battlemage | Multi-attack | 14 (2 ataques), 26 (3) — um item, 2 entradas |
| Cleric | Turn Undead | 1 (+ Table 4-3c como referência em description) |
| Druid | Command Animal | 1 (+ Table 4-4c como referência em description) |
| Grenadier | Powder Crafting | 2 (Grade 1), 4 (2), 6 (3), 8 (4), 10 (5), 13 (6), 17 (7) — um item, 7 entradas |
| Grenadier | Covering Fire | 7 |
| Grenadier | Power Shot | 11 |
| Grenadier | Powder Distillation | 14 |
| Grenadier | Multi-attack | 10, 20, 30 — mesmos níveis do Fighter, texto próprio do Grenadier (item separado, ver seção 4) |
| Mountebank | Weak Magic | 1 |
| Mountebank | Item Use | 1 |
| Mountebank | Breath Evasion | 16 — texto idêntico ao de Mystic/Ranger salvo o nome da classe (ver seção 4, item compartilhado) |
| Mystic | Alertness | 2 |
| Mystic | Self Healing | 4 (nota: tabela imprime "Self-Healing" com hífen, prosa usa "Self Healing" sem hífen — inconsistência real do livro, nome do item usa a grafia da prosa) |
| Mystic | Speak with Animals | 6 |
| Mystic | Parry | 7 |
| Mystic | Spell Resistance | 8 |
| Mystic | Speak with Anyone | 10 |
| Mystic | Power Attack | 11 |
| Mystic | Still Mind | 12 |
| Mystic | Pass Unnoticed | 14 |
| Mystic | Breath Evasion | 16 — item compartilhado (ver seção 4) |
| Mystic | Gentle Touch | 18 (Cureall), 19 (Charm Monster), 20 (Hold Monster), 22 (Quest), 24 (morte instantânea) — um item, 5 entradas |
| Ranger | Nimble | 1 |
| Ranger | Parry | 7 |
| Ranger | Power Attack | 11 |
| Ranger | Power Shot | 11 |
| Ranger | Multi-attack | 14 (2), 26 (3) |
| Ranger | Breath Evasion | 16 — item compartilhado (ver seção 4) |
| Thief | Sneak Attack | 1 |
| Thief | Breath Evasion | 16 — item compartilhado (ver seção 4); **achado real**: o livro concede essa habilidade ao thief na Table 4-10a mas NUNCA escreve uma prosa "Breath Evasion:" própria pro thief (só Mountebank/Mystic/Ranger têm) — omissão do próprio livro, não erro de extração (confirmado por busca exaustiva). Ruling: já que o texto de Mountebank/Mystic/Ranger é idêntico exceto o nome da classe, o thief usa o mesmo item compartilhado. |
| Wizard | (nenhuma) | — |

Total: **34 habilidades-classe distintas** contando Multi-attack/Powder
Crafting/Gentle Touch como um item cada (não um por nível), MENOS 1 por
causa do compartilhamento de Breath Evasion entre 4 classes = **31
itens `specialAbility` novos** a criar.

## 4. Ruling: item por (classe, habilidade), exceto Breath Evasion

Verificado que a maioria das habilidades de mesmo nome entre classes
(Parry, Power Attack) tem prosa **quase idêntica** mas com pequenas
variações reais por classe (ex.: a versão do Mystic pra "Power Attack"
tem uma frase extra dizendo que funciona com artes marciais e ataques
desarmados, que as outras classes não têm). **Ruling**: um item
`specialAbility` por (classe, habilidade), mesmo quando o nome se
repete — mais simples e seguro que tentar deduplicar por comparação de
texto, ao custo de alguma duplicação de conteúdo entre itens.

**Exceção**: "Breath Evasion" (Mountebank/Mystic/Ranger/Thief) tem
texto **literalmente idêntico** exceto pelo nome da classe (confirmado
por leitura das 3 prosas existentes) — vira **um único item
compartilhado**, referenciado pelas 4 classes em `specialAbilities[]`
(inclusive Thief, que não tem prosa própria — ver seção 3). Texto do
item usa fraseado neutro ("o personagem" em vez de nomear uma classe
específica).

## 5. Sub-caminhos do Fighter: Chevalier, Warden, Warlord

A partir do 9º nível (após tomar Chivalric Vows no 8º), um Fighter pode
escolher UM dos três caminhos — é uma escolha do jogador, não uma
progressão automática:

- **Chevalier**: Detect Evil à vontade, cast cleric spells como clérigo
  de 1/3 do nível, turn undead como clérigo de 1/3 do nível.
- **Warden**: mesmos benefícios do Chevalier, mas com spells/comando de
  animais de druida em vez de clérigo.
- **Warlord**: Encouragement (cura 1d6+1 em aliado), Tactics
  (transferir weapon feats), Strategy (bônus em batalha em massa).

Viram 3 itens `specialAbility` próprios (não um por nível, já que são
escolhidos uma vez e mantidos), linkados em `classDefinition.specialAbilities[]`
do Fighter no nível 9, com uma nota em `gm.notes` de cada um dizendo
"escolha opcional entre Chevalier/Warden/Warlord — mutuamente
exclusivas" (o schema não tem um jeito estruturado de expressar
"escolha um dentre" nesse array, então a nota é o único jeito de não
deixar essa informação real do livro se perder).

## 6. Turn Undead (Cleric) e Command Animal (Druid): tabela sem campo no schema

Mesma situação já resolvida no sub-projeto 1 (Powder do Grenadier,
artes marciais do Mystic): `SpecialAbilityDataModel` não tem um campo
genérico pra "tabela de progressão por nível vs. tipo de alvo" — Table
4-3c (Turning Undead, 14 colunas: Skeleton/Zombie/.../Lich/Special) e
Table 4-4c (Commanding Animals, 14 colunas por HD de animal) ficam
preservadas como tabela HTML dentro de `description`, mesma regra já
aprovada (nunca descartar dado real do livro, mesmo sem campo
estruturado).

**Legenda confirmada por leitura completa do texto que segue cada
tabela** (não inventada): ambas as tabelas usam o mesmo padrão de 4
letras + `+N` + `–`:

*Turning Undead (Table 4-3c)*: `–` = não é forte o suficiente;
`+N` = precisa de um check com bônus N, sucesso afugenta 2d6 DV;
`t` = sucesso automático, afugenta 2d6 DV; `d` = sucesso automático,
**destrói** 2d6 DV; `D` = sucesso automático, destrói 3d6 DV;
`X` = sucesso automático, destrói 4d6 DV.

*Commanding Animals (Table 4-4c)*: `–` = não é forte o suficiente;
`+N` = precisa de um check com bônus N, sucesso comanda 2d6 DV;
`c` = sucesso automático, comanda 2d6 DV; `m` = sucesso automático,
pode **mestrar** (não só comandar) 2d6 DV; `M` = sucesso automático,
mestra 3d6 DV; `X` = sucesso automático, mestra 4d6 DV (nível de
detalhe extrapolado do padrão idêntico da tabela de Turn Undead — a
Task de implementação deve confirmar contra o texto completo de 'X'
antes de transcrever, caso haja alguma variação não vista nesta
pesquisa).

A tabela HTML de referência em `description` deve incluir essa legenda
por extenso (não só as siglas soltas), já que sem ela os valores `t`/
`d`/`D`/`X`/`c`/`m`/`M` não têm significado nenhum fora do livro.

## 7. Links de talento (specialAbilities → itens já existentes do domínio skills)

Verificado por leitura completa das 4 tabelas "Talents by Level" (só
os NOMES de coluna e se a célula tem valor real desde o nível 1, não a
progressão numérica corrompida por merge de página — essa progressão
não tem campo no schema, já que `specialAbilities[]` só guarda o nível
em que a habilidade É CONCEDIDA, não uma tabela de bônus por nível):

| Classe | Talentos concedidos | Nível |
|---|---|---|
| Thief | Open Locks, Locate Traps, Remove Traps, Climb Walls, Move Silently, Hide in Shadows, Pick Pockets, Hear Noise | 1 |
| Thief | Read Languages | 4 (confirmado na prosa: "At 4th level or higher") |
| Thief | Wizard Scroll Use | 10 (confirmado na prosa: "Beginning at 10th level") |
| Mountebank | Climb Walls, Move Silently, Hide in Shadows, Pick Pockets | 1 |
| Mystic | Locate Traps, Remove Traps, Climb Walls, Move Silently, Hide in Shadows | 1 |
| Ranger | Climb Walls, Move Silently, Hide in Shadows | 1 |

**Achado que simplifica a implementação**: cada classe também tem sua
própria seção "<CLASSE> TALENTS (TABLE N–Xc)" reafirmando a descrição
de cada talento em prosa própria (ex.: "Locate Traps: A mystic is able
to detect..." vs "...a thief is able to detect...") — é a MESMA
descrição já capturada no domínio `skills` (seção "SKILLS & TALENTS"),
só trocando o pronome/nome da classe. **Ruling**: não recriar nem
duplicar essas descrições — o link em `specialAbilities[]` referencia
o `uuid`/`name` do item `specialAbility` já existente (Open Locks,
etc.), sem copiar a prosa de novo.

**IDs dos itens de Talento já existentes**: os 10 itens estão em
`packsrc/items/Talents/*.json` (domínio skills, já mergeado em
`phase-2-pdf-extraction`), com `_id` = `deterministicId("talents:" +
nome)`. A Task de implementação deve ler esses 10 arquivos reais pra
pegar os `_id`/`name` exatos a usar no link, não recalcular o hash à
mão.

## 8. Schema real usado

Reaproveita os subtipos já documentados: `ClassDefinitionDataModel.specialAbilities[]`
(`{name, uuid, level, target, classKey, changes}`, todos os campos
`required: true` exceto `target` que é nullable) e `SpecialAbilityDataModel`
(já documentado no domínio skills — `tags`, `description`, `rollFormula`,
`operator`, `target`, `category`, etc.).

**Achado real que resolve a incerteza da seção 12 original** (lido
direto de `src/sys/registry/ClassSystem.ts` e `src/utils/finder.ts`,
Forelius/fantastic-depths@4a8f2c8, não deduzido): o mecanismo real de
concessão de habilidade ao subir de nível (`_promptAddAbilityItems` →
`getClassAbilities(className, currentLevel)`) filtra
`classItem.system.specialAbilities` por `level`, e o outro caminho de
sincronização (`ClassSystem.ts:112-113`) casa
`actor.items` contra esse array **só por `name`**
(`abilityNames.includes(item.name)`) — o campo `uuid` **não é lido por
nenhum desses dois caminhos**. Confirma a ruling abaixo, não é mais uma
suposição.

**Achado real que corrige um valor de `category` que a spec original
tinha errado por analogia** (mesmo erro de categoria já visto no
domínio spells com `SUBTYPE_REQUIRED_FIELDS`): `finder.ts:367`
(`_getSpecialAbility`) usa literalmente `options?.category === 'class'`
como o valor de categoria pra habilidades de classe — não
`"classAbility"` como esta spec propunha antes desta correção. O
domínio skills já estabeleceu `category: "talent"` pros Talentos; este
sub-projeto usa `category: "class"` pras novas habilidades, pra bater
com o valor real que o próprio sistema consulta.

**Mapeamento de `specialAbilities[]`**:
- `name`: nome do item `specialAbility` linkado (deve bater
  EXATAMENTE, inclusive capitalização — a comparação usa
  `.toLowerCase()` num dos dois caminhos reais, mas não no outro
  (`includes()` simples), então usar o nome exato do item, não confiar
  só na comparação case-insensitive).
- `uuid`: `""` (string vazia, o próprio default do schema — confirmado
  seguro porque nenhum caminho real de consumo lê esse campo pra
  conceder habilidades de classe; ver achado acima).
- `level`: nível em que a habilidade é concedida (catálogo da seção 3/7).
- `target`: `null` (schema nullable, sem dado de origem no livro pra
  esse campo pras habilidades de classe).
- `classKey`: a `key` da classe que concede (ex.: `"fighter"`) pras
  habilidades NOVAS deste sub-projeto. Pros links de Talento (seção 7),
  os itens de Talento já existentes do domínio skills foram criados com
  `classKey: null` (não é um campo setado lá) — este sub-projeto NÃO
  deve alterar os itens de Talento já existentes pra adicionar um
  `classKey`, já que são compartilhados por 4 classes; o link em si (no
  array `specialAbilities[]` da CLASSE) já carrega a associação
  correta via `name`+`level`, sem precisar mexer no item compartilhado.
- `changes`: string livre — usada pras habilidades progressivas
  (Multi-attack/Powder Crafting/Gentle Touch) pra descrever o que muda
  nessa entrada específica (ex.: `"2 ataques por rodada"` na entrada de
  nível 10 do Multi-attack do Fighter, `"3 ataques"` na de nível 20).
  Pras habilidades de concessão única, `changes: ""`.

**Categoria do novo subtipo `specialAbility`**: `category: "class"`
(valor real confirmado acima, substitui a ideia anterior de
`"classAbility"`).

## 9. IDs determinísticos e pasta

- `deterministicId("classAbilities:" + classKey + ":" + abilityName)`
  — inclui a classe no seed porque a maioria das habilidades tem um
  item por classe (seção 4), exceto Breath Evasion, cujo seed é
  `deterministicId("classAbilities:shared:Breath Evasion")` (sem
  classe, já que é um item único compartilhado).
- Pasta: `Class_Abilities/`, top-level, hand-picked em `_folders.json`
  (31 documentos, volume pequeno o suficiente pra não precisar de
  resolução dinâmica).

## 10. Parser e builder

`scripts/parse/classAbilities.mjs` extrai, pra cada uma das 10 classes:
1. O mapeamento (habilidade, níveis) da Table Na — já resolvido
   estruturalmente na seção 3 (não precisa reparsear a tabela, os
   níveis são um catálogo fixo verificado, igual a
   `TALENT_NAMES`/`KNOWN_LABELS` de domínios anteriores).
2. A prosa de descrição de cada habilidade nomeada, via busca de
   `"Nome: "` no texto do capítulo (mesmo padrão de `parseTalents` do
   domínio skills), usando a lista fixa de ~30 nomes da seção 3 como
   delimitador — não detecção genérica (mesma razão do domínio skills:
   evitar falsos positivos de blocos "Example:"/"Note:" que aparecem
   dentro de descrições).
3. Table 4-3c (Turn Undead) e Table 4-4c (Command Animal) como tabela
   HTML de referência (seção 6).
4. Os 22 links de talento (catálogo fixo da seção 7, sem parsing de
   tabela — os nomes/níveis já são dado verificado nesta spec).
5. Chevalier/Warden/Warlord como 3 blocos de prosa própria (delimitados
   pelos cabeçalhos ALL-CAPS "WARDENS"/"WARLORDS", e o texto de
   Chevalier que vem antes deles dentro do bloco "CHIVALRIC VOWS").

`scripts/build/classAbilities.mjs`:
1. Gera os 31 itens `specialAbility` novos em `packsrc/items/Class_Abilities/`.
2. Lê os 10 itens `specialAbility` de Talento já existentes em
   `packsrc/items/Talents/*.json` pra pegar `_id`/`name` reais.
3. Lê os 10 documentos `class` já existentes em
   `packsrc/items/Character_Classes/*.json` (do sub-projeto 1),
   preenche `specialAbilities[]` de cada um (catálogo da seção 3 + 7),
   e reescreve o MESMO arquivo (mesmo `_id`, só atualizando o campo) —
   não recria os documentos do zero.

## 11. Testes e validação

- Parser: verificar que as ~30 habilidades nomeadas + Chevalier/Warden/
  Warlord são extraídas com descrição não-vazia, contra o texto real
  do livro (não fixture sintético, mesma decisão do sub-projeto 1 dado
  o tamanho do vocabulário).
- Builder: `specialAbilities[]` de cada uma das 10 classes bate
  exatamente com o catálogo das seções 3 e 7 (contagem e níveis).
  Teste de integração real `validateDocument(buildDocument(...))` pros
  dois subtipos tocados (`class` atualizado, `specialAbility` novo).
- Verificação exaustiva antes do plano: rodar o parser contra o
  capítulo inteiro, confirmar as 31 habilidades com descrição não-vazia
  e sem vazamento de página/corrupção de coluna (mesma checagem já
  usada em todos os domínios anteriores).

## 12. Riscos e decisões pendentes

- Segue a recomendação já registrada de consolidar `deterministicId`/
  envelope de documento Foundry em `scripts/lib/` — agora com 6 cópias
  independentes.
- A checagem de `X` na legenda de Commanding Animals (seção 6) foi
  extrapolada do padrão da tabela irmã (Turning Undead), não lida
  literalmente até o fim — a Task de implementação deve confirmar o
  texto exato antes de transcrever a legenda completa.
- Chivalric Vows: a tabela diz nível 8, a prosa da própria habilidade
  diz "after reaching 9th level" pra efetivamente tomar os votos —
  discrepância real do livro, documentada na seção 3, não reconciliada
  (usar o valor da tabela pro campo estruturado `level`, mencionar a
  nuance da prosa em `gm.notes` se a Task de implementação achar valioso).
