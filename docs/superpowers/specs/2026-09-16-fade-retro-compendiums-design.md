# Design — fade-retro-compendiums

Data: 2026-09-16
Status: aprovado para planejamento

## 1. Objetivo

Um módulo de compêndios para o Foundry VTT, sistema `fantastic-depths`, cujo
conteúdo vem integralmente de *Dark Dungeons (4th Edition)* (Gurbintroll Games,
2025, 473 páginas). O módulo replica a estrutura do repositório
[`Forelius/fade-compendiums`](https://github.com/Forelius/fade-compendiums)
— mesmo pipeline de build, mesmo layout de pastas, mesmos workflows — e
substitui todo o conteúdo.

Não é um fork: nenhum documento de `packsrc` do fade é herdado. O que se copia
são os scripts de build (`dbConvert.mjs`, `LdbActions.mjs`), licenciados MIT.

## 2. Licenciamento

*Dark Dungeons 4e* é publicado sob a **ORC License** (p. 473). Todo o texto da
obra é **Expressly Designated Licensed Material**. São **Reserved Material**
apenas o nome "Dark Dungeons" e a arte.

Consequências vinculantes para este projeto:

- O conteúdo textual e as estatísticas podem ser republicados.
- O módulo **não pode** se chamar "Dark Dungeons". Id: `fade-retro-compendiums`;
  título: "Retro Rules Compendiums for Fantastic Depths".
- **Nenhuma** imagem do PDF entra no repositório.
- `CREDITS.md` reproduz o ORC Notice e a atribuição exigida:
  `Dark Dungeons, ©2024 Gurbintroll Games`.
- O código próprio é MIT; o conteúdo dos packs é ORC. `LICENSE` e `CREDITS.md`
  deixam a separação explícita.

## 3. Arquitetura

### 3.1 Pipeline herdado do fade

```
packsrc/<pack>/**/*.json    fonte versionada, um documento por arquivo
   │ npm run packcompile    (dbConvert.mjs compile)
   ▼
packs/<pack>.db             JSON único, chaves "!items!<id>"
   │ npm run packrestore    (LdbActions.mjs restore)
   ▼
packs/<pack>/               LevelDB lido pelo Foundry
```

O caminho inverso (`npm run decomppacks` = `packdump` + `packextract`) é
mantido: permite editar dentro do Foundry e devolver o resultado ao Git.

### 3.2 Estágio novo: extração do PDF

O fade não tem equivalente — lá o conteúdo nasceu digitado dentro do Foundry.
Aqui ele nasce do livro:

```
Dark_Dungeons_(4th_Edition).pdf     (fora do repositório)
   │ scripts/extract/pdf2txt.mjs    recorte por coluna, por faixa de páginas
   ▼
extract/raw/<capitulo>.txt          texto bruto, versionado
   │ scripts/extract/parsers/<dominio>.mjs
   ▼
extract/parsed/<dominio>.json       dados neutros, revisáveis em diff
   │ scripts/extract/builders/<dominio>.mjs
   ▼
packsrc/items/**/*.json             schema fantastic-depths
```

Três estágios em vez de um script único porque cada um falha de forma
diferente — extração erra layout, parse erra campo, build erra schema. Com
`extract/parsed/` versionado, corrigir o schema não exige reprocessar o PDF, e
um erro de regra aparece como diff legível em vez de bytes de LevelDB.

**Recorte por coluna é obrigatório.** O livro é de duas colunas e
`pdftotext -layout` intercala as colunas na mesma linha de saída (ex.: p. 98,
onde *Analyse* e *Animate Objects* saem lado a lado). O extrator recorta cada
metade da página com `-x/-y/-W/-H` e concatena na ordem correta. Tabelas de
página cheia (Tabela 6‑1, sumário de armas) são tratadas como exceção
declarada por faixa de páginas.

### 3.3 Estrutura do repositório

```
module.json               packs declarados para o sistema fantastic-depths
package.json              scripts do fade + extract/parse/build/validate
LICENSE                   MIT (código)
CREDITS.md                ORC Notice + atribuição Gurbintroll
README.md
scripts/
  fadeRetro.mjs           esmodule de entrada do módulo (mínimo)
  system/                 config.mjs, templates.mjs
  build/                  dbConvert.mjs, LdbActions.mjs (MIT, copiados)
  extract/
    pdf2txt.mjs
    parsers/<dominio>.mjs
    builders/<dominio>.mjs
    validate.mjs
extract/raw/              texto bruto por capítulo
extract/parsed/           dados neutros por domínio
packsrc/items/            destino da v1
assets/img/               ícones próprios ou CC; nunca arte do PDF
lang/en.json              (pt-BR.json na fase 2)
.github/workflows/        pre-release.yml, stable-release.yml
docs/superpowers/specs/   este documento
```

### 3.4 module.json

Packs declarados na v1: `item-compendium` (`packs/items`, type `Item`).
Os packs `actor-compendium`, `roll-table-compendium` e `macro-compendium`
são declarados vazios desde já, para que versões futuras não exijam que o
usuário reinstale o módulo.

Compatibilidade: Foundry v13 mínimo, v14 verificado — acompanha o que o
sistema `fantastic-depths` declara. Relacionamento de sistema obrigatório
com `fantastic-depths`.

Os workflows substituem `#{VERSION}#`, `#{URL}#`, `#{MANIFEST}#`,
`#{DOWNLOAD}#` e `#{CHANGELOG}#` no release, como no fade.

## 4. Mapeamento de conteúdo (v1)

O sistema `fantastic-depths` expõe os subtipos de Item: `item`, `weapon`,
`armor`, `spell`, `skill`, `actorClass`, `mastery`, `specialAbility`, `class`,
`weaponMastery`, `light`, `condition`, `treasure`, `species`, `ammo`.

| Fonte no livro | Subtipo | Pasta em `packsrc/items` |
|---|---|---|
| Cap. 4 — 10 classes (Battlemage, Cleric, Druid, Fighter, Grenadier, Mountebank, Mystic, Ranger, Thief, Wizard) | `class` | `Character_Classes/` |
| Cap. 5 — skills e talentos | `skill` | `General_Skills/`, `Talents/` |
| Cap. 6 — armas e tabelas de proficiência | `weapon`, `weaponMastery` | `Equipment/Weapons/`, `Weapon_Masteries/` |
| Cap. 7 — lista alfabética de magias | `spell` | `Spells/<Classe>/Circle_N/` |
| Cap. 8 — Red Powder e dispositivos de grenadier | `item` | `Equipment/Red_Powder/` |
| Cap. 9 — equipamento, armaduras, luz, munição, transporte | `item`, `armor`, `light`, `ammo` | `Equipment/*` |

As tabelas de proficiência do cap. 6 (colunas None → Grand Master, com Attack
Bonus, Damage, Delay, Stun, Hurl Range, em variantes *vs Armed* e *vs Unarmed*)
correspondem diretamente ao subtipo `weaponMastery`. É o conteúdo de maior
valor e o mais custoso de digitar à mão.

### Fora da v1

Cada item abaixo recebe seu próprio spec e plano:

- Cap. 19 — Bestiário → `packsrc/actors` (subtipo `monster`)
- Cap. 20‑21 — tesouro, itens mágicos, artefatos → `treasure`, `Magic_Items`
- Tabelas de encontro, tesouro e masmorra aleatória → `packsrc/rollTables`
- Cap. 17‑18 — Immortals
- Macros

## 5. Idioma

A v1 é em inglês, fiel ao PDF. Os builders emitem chaves de i18n junto com o
texto, e `lang/en.json` é gerado no mesmo passo. A camada PT‑BR é uma fase 2
que preenche `lang/pt-BR.json` (ou um mapa Babele) sem tocar em `packsrc`.

## 6. Validação

Não há lógica de negócio para TDD. O que existe é validação de dados, e ela é
escrita antes do código que produz os dados.

- `scripts/extract/validate.mjs` — para cada JSON de `packsrc`: subtipo
  declarado é conhecido; campos obrigatórios do subtipo presentes; nenhum campo
  desconhecido; `_id` com 16 caracteres e único no pack; `folder` existente em
  `_folders.json`; `_originalKey` coerente com `_id` e tipo.
- Um builder só é aceito quando o validador passa em 100% dos documentos do
  seu domínio.
- Parsers têm testes de fixture: um trecho recortado de `extract/raw/` com a
  saída esperada em `extract/parsed/`, para que uma mudança de regex não quebre
  centenas de documentos em silêncio.
- `npm run validate` roda no CI a cada push, antes de `packcompile`.

## 7. Fases de implementação (v1)

1. **Esqueleto e ciclo de build.** Repositório, `module.json`, `package.json`,
   scripts de build copiados, workflows, `LICENSE`, `CREDITS.md`, e um
   `packsrc/items` mínimo com 2‑3 documentos escritos à mão. Critério de
   conclusão: `npm run comppacks` gera um LevelDB que o Foundry abre e mostra
   os itens. Nada mais é construído antes disso fechar.
   Inclui a primeira tarefa de pesquisa: ler as classes `DataModel` do
   `fantastic-depths` para obter o schema real de cada subtipo, não apenas os
   nomes.
2. **Extração.** `pdf2txt.mjs` com recorte por coluna; `extract/raw/`
   versionado; normalização de texto (hifenização, ligaduras, aspas
   tipográficas, o travessão `–` usado como "sem valor" nas tabelas).
3. **Domínios, um de cada vez**, na ordem: equipamento → armas e
   masteries → magias → skills → classes. Cada domínio percorre
   parser → `extract/parsed` → builder → `packsrc` → validate → revisão, e só
   então o próximo começa. Equipamento vem primeiro por ter a tabela mais
   regular: valida o formato do pipeline com o menor risco.
4. **i18n.** `lang/en.json` gerado pelos builders e o gancho para a fase 2.

## 8. Riscos e decisões pendentes

- **Schema real dos subtipos.** Os nomes dos subtipos são conhecidos; os
  campos de cada `DataModel` do `fantastic-depths` precisam ser lidos do
  código-fonte do sistema. É a primeira tarefa da fase 1, e pode alterar o
  mapeamento da seção 4.
- **Construções do DD4e sem equivalente no FADE.** Weapon Feats (cap. 12),
  Red Powder e dispositivos de grenadier (cap. 8), e magias organizadas em
  *Circles* em vez de níveis. Cada uma exige uma decisão explícita de
  mapeamento — campo nativo aproximado, `flags` do módulo, ou descrição em
  prosa — registrada aqui quando tomada.
- **Qualidade do texto extraído.** O PDF tem camada de texto (não é OCR), mas
  usa hifenização, ligaduras e duas colunas. A normalização da fase 2 é
  pré-requisito de todos os parsers.
- **Versão do sistema.** `fantastic-depths` está em desenvolvimento ativo; uma
  mudança de schema quebra os packs. O `module.json` fixa a compatibilidade
  declarada, e o validador é a rede de proteção.
- **`removeStats()` sobrescreve `_stats.coreVersion` com valor hardcoded
  (achado na Task 8).** `scripts/build/dbConvert.mjs`, método `removeStats()`
  (por volta da linha 367), grava incondicionalmente
  `{"coreVersion": "12.343", "systemId": "fantastic-depths"}` em todo
  documento durante `packcompile` — independentemente do `_stats.coreVersion`
  presente no JSON de origem em `packsrc/`. O código foi "adaptado
  literalmente" do `Forelius/fade-compendiums` (ver comentário no topo do
  arquivo) e herdou o valor de versão do Foundry usado por aquele projeto
  upstream. Como resultado, o ciclo `packsrc → packs → packsrc` (Steps 4-5 da
  Task 8) não é totalmente idempotente: os 3 itens de `packsrc/items`, escritos
  à mão na Task 7 com `_stats.coreVersion: "13.347"`, voltam do
  `decomppacks` com `"12.343"` — uma diferença de **valor**, não apenas de
  formatação/ordem. Não corrompe os dados nem quebra a validação (o
  `validate.mjs` não confere `_stats.coreVersion`), mas se não for corrigido
  antes da Fase 2, todo item recompilado a partir de então herdará essa versão
  incorreta. `git checkout -- packsrc` foi usado para restaurar os arquivos
  da Task 7 sem essa mudança; a correção do hardcode (ler a versão real do
  ambiente/`module.json`, ou preservar o `_stats.coreVersion` já existente no
  documento em vez de sobrescrevê-lo) fica como item de backlog para antes de
  depender de `packcompile` em produção.
