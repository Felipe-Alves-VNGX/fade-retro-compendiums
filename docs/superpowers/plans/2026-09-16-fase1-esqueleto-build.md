# fade-retro-compendiums — Fase 1: Esqueleto e Ciclo de Build — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provar o ciclo de build completo do módulo — `packsrc/items/*.json` → `packs/items.db` → LevelDB — com 2-3 documentos de Item escritos à mão, fiéis ao texto de *Dark Dungeons 4e*, validados contra o schema real do sistema `fantastic-depths`.

**Architecture:** Repositório Node/ESM que replica a estrutura do `Forelius/fade-compendiums` (module.json declarando packs Foundry, scripts de build MIT copiados) e acrescenta um validador de schema próprio (`scripts/extract/validate.mjs`) que roda antes de cada compilação. Nenhum parser de PDF nesta fase — os 3 documentos são digitados à mão a partir do livro, exatamente como qualquer domínio futuro terá seus documentos gerados pelo pipeline de extração (fases seguintes).

**Tech Stack:** Node.js (ESM, `"type": "module"`), pacote `level` (LevelDB), `node --test` + `node:assert/strict` (nativos do Node 20+, sem dependência de teste extra), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-16-fade-retro-compendiums-design.md`

## Global Constraints

- Módulo id: `fade-retro-compendiums` (nunca "Dark Dungeons" — nome é Reserved Material sob a ORC License).
- Sistema alvo: `fantastic-depths`, compatibilidade Foundry mínima v13, verificada v14.
- Nenhuma imagem do PDF *Dark Dungeons* entra no repositório. Ícones desta fase usam o SVG genérico embutido no próprio Foundry (`icons/svg/item-bag.svg`); curadoria de ícones temáticos fica para fase futura.
- Todo texto de descrição de item deve vir do livro (*Dark Dungeons, 4th Edition*, Gurbintroll Games, 2025) — citar página/capítulo no commit quando não for óbvio.
- Licença do código: MIT (`LICENSE`). Licença do conteúdo: ORC License, com atribuição obrigatória a "Dark Dungeons, ©2024 Gurbintroll Games" em `CREDITS.md`.
- Nenhum documento de `packsrc` do `fade-compendiums` é copiado. Só os scripts de build (`scripts/build/*.mjs`) são vendorizados, com atribuição de origem em comentário.
- `packs/` (saída compilada, LevelDB) é sempre gitignored — só `packsrc/` é versionado.

---

### Task 1: Esqueleto do repositório, licenciamento e higiene de Git

**Files:**
- Create: `LICENSE`
- Create: `CREDITS.md`
- Create: `README.md`
- Create: `.gitignore`
- Create: `.gitattributes`
- Create: `.vscode/launch.json`

**Interfaces:**
- Consumes: nada (primeira tarefa).
- Produces: convenções de repositório que todas as tarefas seguintes assumem (ex.: `packs/` sempre ignorado, `packsrc/` sempre versionado).

- [ ] **Step 1: Criar `LICENSE` (MIT)**

```
MIT License

Copyright (c) 2026 Felipe Alves

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

This licenses only the **code** in this repository (scripts, config). It does
not license the compendium content — see `CREDITS.md`.

- [ ] **Step 2: Criar `CREDITS.md`**

```markdown
# Credits

## Code

The build pipeline (`scripts/build/`) and repository structure of this
project are adapted from
[Forelius/fade-compendiums](https://github.com/Forelius/fade-compendiums)
(commit `91c6a12`), used under the MIT License. See `LICENSE`.

## Content

Compendium content in this module is derived from:

> **Dark Dungeons, 4th Edition** — © 2024 Gurbintroll Games

This product is licensed under the ORC License, located at the Library of
Congress at TX0009307067 and available online at
https://www.azoralaw.com/orclicense and other locations. All warranties are
disclaimed as set forth therein.

Per the ORC License terms declared in *Dark Dungeons* (p. 473), **all text**
in that work is Expressly Designated Licensed Material. Reserved Material —
excluded from this project — is limited to the name "Dark Dungeons" and all
art contained in that work. This module does not use the name "Dark
Dungeons" and contains no artwork from the source book.

Dark Dungeons itself attributes material to the System Reference Document
5.1 ("SRD5.1") by Wizards of the Coast LLC, licensed under the Creative
Commons Attribution 4.0 International License
(https://creative-commons.org/licenses/by/4.0/legalcode), and to Pathfinder
Player Core, GM Core, and Monster Core, © Paizo Inc.

## This module

"Retro Rules Compendiums for Fantastic Depths" is an independent, unofficial
project and is not affiliated with or endorsed by Gurbintroll Games, Paizo
Inc., or Wizards of the Coast LLC.
```

- [ ] **Step 3: Criar `README.md`**

```markdown
# Retro Rules Compendiums for Fantastic Depths

Compendium module for the [Fantastic Depths](https://github.com/Forelius/fantastic-depths)
Foundry VTT system. Content is derived from *Dark Dungeons, 4th Edition*
(Gurbintroll Games) under the ORC License — see [CREDITS.md](CREDITS.md).

## Status

Phase 1: build pipeline skeleton, proven with a handful of hand-written
Item documents. See `docs/superpowers/specs/` and `docs/superpowers/plans/`
for the full roadmap.

## Development

```bash
npm install
npm run validate     # check packsrc/ documents against the schema rules
npm run comppacks     # packsrc/*.json -> packs/*.db -> packs/<name> (LevelDB)
npm run decomppacks   # packs/<name> (LevelDB) -> packs/*.db -> packsrc/*.json
```

`packsrc/` is the source of truth and is version-controlled. `packs/` is
build output (LevelDB) and is gitignored — regenerate it with
`npm run comppacks` before loading the module in Foundry.
```

- [ ] **Step 4: Criar `.gitignore`**

```
node_modules

# Compiled FoundryVTT LevelDB pack output — rebuilt from packsrc/ via `npm run comppacks`
packs

# Release artifacts
/module.zip
release_notes.txt
```

- [ ] **Step 5: Criar `.gitattributes`**

```
# Auto detect text files and perform LF normalization
* text=auto

# Explicitly declare text files you want to always be normalized and converted
# to native line endings on checkout.
*.js text
*.mjs text
*.json text
*.md text
*.yml text
*.yaml text
*.txt text

# Declare files that are truly binary and should not be modified.
*.png binary
*.jpg binary
*.jpeg binary
*.gif binary
*.ico binary
*.webp binary
*.db binary
*.ldb binary
```

- [ ] **Step 6: Criar `.vscode/launch.json`**

```json
{
    "version": "0.2.0",
    "configurations": []
}
```

- [ ] **Step 7: Verificar os arquivos criados**

Run: `ls -la LICENSE CREDITS.md README.md .gitignore .gitattributes .vscode/launch.json`
Expected: os 6 arquivos existem.

- [ ] **Step 8: Commit**

```bash
git add LICENSE CREDITS.md README.md .gitignore .gitattributes .vscode/launch.json
git commit -m "chore: repository skeleton, licensing, and git hygiene

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `package.json` e dependências

**Files:**
- Create: `package.json`

**Interfaces:**
- Consumes: nada.
- Produces: scripts npm (`packdump`, `packrestore`, `packextract`, `packcompile`,
  `decomppacks`, `comppacks`, `validate`, `test`) que todas as tarefas seguintes
  invocam pelo nome exato.

- [ ] **Step 1: Criar `package.json`**

```json
{
  "name": "fade-retro-compendiums",
  "version": "0.1.0",
  "type": "module",
  "description": "Compendium content for the Fantastic Depths Foundry VTT system, derived from Dark Dungeons 4th Edition under the ORC License.",
  "scripts": {
    "packdump": "node scripts/build/LdbActions.mjs dump",
    "packrestore": "node scripts/build/LdbActions.mjs restore",
    "packextract": "node scripts/build/dbConvert.mjs extract",
    "packcompile": "node scripts/build/dbConvert.mjs compile",
    "decomppacks": "npm run packdump && npm run packextract && echo \"Decompiled packs\"",
    "comppacks": "npm run validate && npm run packcompile && npm run packrestore && echo \"Compiled packs\"",
    "validate": "node scripts/extract/validate.mjs",
    "test": "node --test scripts/extract/*.test.mjs"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/FelipeAlves/fade-retro-compendiums.git"
  },
  "keywords": [
    "foundryvtt",
    "fantastic-depths",
    "dark-dungeons"
  ],
  "author": "Felipe Alves",
  "license": "MIT",
  "dependencies": {
    "level": "^10.0.0"
  }
}
```

Nota: `comppacks` roda `validate` antes de `packcompile` — um documento inválido
nunca chega a ser compilado no `.db`. Isso é uma decisão desta fase, não do
fade original (que não tem validador).

- [ ] **Step 2: Instalar dependências**

Run: `cd ~/projetos/fade-retro-compendiums && npm install`
Expected: `node_modules/` criado, `package-lock.json` gerado, sem erros.

- [ ] **Step 3: Confirmar que o pacote `level` é importável**

Run: `node --input-type=module -e "import('level').then(() => console.log('level OK'))"`
Expected: imprime `level OK`.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add package.json with build/validate scripts

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Copiar os scripts de build do fade-compendiums

**Files:**
- Create: `scripts/build/dbConvert.mjs`
- Create: `scripts/build/LdbActions.mjs`
- Create: `scripts/system/config.mjs`
- Create: `scripts/system/templates.mjs`
- Create: `scripts/fadeRetroCompendiums.mjs`

**Interfaces:**
- Consumes: pacote `level` (Task 2).
- Produces: os comandos CLI `node scripts/build/dbConvert.mjs {extract,compile} --pack <name>`
  e `node scripts/build/LdbActions.mjs {dump,restore,checkpack,list} --pack <name>`,
  que Tasks 7 e 8 invocam via os scripts npm da Task 2.

Estes dois arquivos (`dbConvert.mjs`, `LdbActions.mjs`) são copiados
**verbatim** de `Forelius/fade-compendiums` (commit `91c6a12`, MIT) — nenhuma
lógica muda nesta tarefa. Só um cabeçalho de atribuição é adicionado.

- [ ] **Step 1: Criar `scripts/build/dbConvert.mjs`**

```javascript
// Adapted verbatim from Forelius/fade-compendiums (MIT License),
// https://github.com/Forelius/fade-compendiums, commit 91c6a12.
// scripts/build/dbConvert.mjs
import fs from "fs/promises";
import path from "path";

// Normalize text content to CRLF for consistent Windows checkouts
const toCRLF = (text) => text.replace(/\r?\n/g, "\r\n");

/**
 * Database Converter - ES6 Class for converting FoundryVTT database formats
 */
class dbConvert {
    static AVAILABLE_PACKS = ["actors", "items", "macros", "rollTables", "journals", "scenes"];

    constructor(packName = "actors") {
        this.validatePackName(packName);
        this.packName = packName;
        this.paths = this.getPackPaths(packName);
    }

    /**
     * Validate pack name against available packs
     */
    validatePackName(packName) {
        if (!dbConvert.AVAILABLE_PACKS.includes(packName)) {
            throw new Error(`Invalid pack name: ${packName}. Available packs: ${dbConvert.AVAILABLE_PACKS.join(", ")}`);
        }
    }

    /**
     * Get pack paths for the current pack
     */
    getPackPaths(packName) {
        const dbFile = path.join(process.cwd(), "packs", `${packName}.db`);
        const outputDir = path.join(process.cwd(), "packsrc", packName);
        return { dbFile, outputDir };
    }

    /**
     * Main extract method - extracts documents from .db file to individual JSON files
     * @param {string} dbFilePath - Path to the .db file to process
     */
    async extract(dbFilePath = null) {
        const dbFile = dbFilePath || this.paths.dbFile;

        // Ensure the .db file exists
        try {
            await fs.access(dbFile);
        } catch (error) {
            throw new Error(`Database file not found: ${dbFile}`);
        }

        // Delete destination folder before extracting.
        await this.deletePackSourceFolder(this.packName);

        // Read and parse the .db file
        const dbContent = await fs.readFile(dbFile, "utf8");
        const cleanDbContent = this.removeBOM(dbContent);
        const documents = JSON.parse(cleanDbContent);

        // Ensure output directory structure exists
        await this.ensureDirectoryStructure();

        // Extract folders first and get folder documents for path resolution
        const folderDocuments = await this.extractFolders(documents);

        // Extract individual documents with folder structure
        await this.extractDocuments(documents, folderDocuments);

        console.log(`Extraction completed for: ${dbFile}`);
    }

    /**
     * Extract folder documents to _folders.json file
     * @param {Object} documents - All documents from the .db file
     * @returns {Object} - The folder documents for use in path resolution
     */
    async extractFolders(documents) {
        const folderDocuments = {};

        // Find all documents with keys starting with "!folders"
        for (const [key, document] of Object.entries(documents)) {
            if (key.startsWith("!folders")) {
                folderDocuments[key] = document;
            }
        }

        // Only create _folders.json if there are folder documents
        if (Object.keys(folderDocuments).length > 0) {
            const foldersFilePath = path.join(this.paths.outputDir, "_folders.json");
            await fs.writeFile(foldersFilePath, toCRLF(JSON.stringify(folderDocuments, null, 2)), "utf8");
            console.log(`Extracted ${Object.keys(folderDocuments).length} folder documents to: ${foldersFilePath}`);
        } else {
            console.log("No folder documents found to extract.");
        }

        return folderDocuments;
    }

    /**
     * Remove BOM (Byte Order Mark) from file content
     * @param {string} content - The file content that may contain BOM
     * @returns {string} - Content with BOM removed
     */
    removeBOM(content) {
        // Check for UTF-8 BOM (EF BB BF) which appears as ﻿ in JavaScript strings
        if (content.charCodeAt(0) === 0xFEFF) {
            return content.slice(1);
        }
        return content;
    }

    /**
     * Ensure the packsrc directory structure exists
     */
    async ensureDirectoryStructure() {
        try {
            await fs.mkdir(this.paths.outputDir, { recursive: true });
        } catch (error) {
            throw new Error(`Failed to create output directory: ${this.paths.outputDir} - ${error.message}`);
        }
    }

    /**
     * Delete the pack type folder and all its contents
     * @param {string} packName - Name of the pack folder to delete
     */
    async deletePackSourceFolder(packName) {
        this.validatePackName(packName);

        const packSourceFolder = path.join(process.cwd(), "packsrc", packName);

        try {
            // Check if the folder exists before attempting to delete
            await fs.access(packSourceFolder);

            // Delete the folder and all its contents recursively
            await fs.rm(packSourceFolder, { recursive: true, force: true });
            console.log(`Successfully deleted pack folder: ${packSourceFolder}`);

        } catch (error) {
            if (error.code === "ENOENT") {
                console.log(`Pack folder does not exist: ${packSourceFolder}`);
            } else {
                throw new Error(`Failed to delete pack folder: ${packSourceFolder} - ${error.message}`);
            }
        }
    }

    /**
     * Sanitize filename to be Windows and Linux compliant
     * @param {string} filename - The filename to sanitize
     * @returns {string} - Sanitized filename with special characters replaced by underscores
     */
    sanitizeFilename(filename) {
        if (!filename || typeof filename !== "string") {
            return "unnamed";
        }

        // Replace invalid characters with underscores
        // Windows invalid chars: < > : " | ? * \ /
        // Also replace spaces and other special chars for consistency
        return filename
            .replace(/[<>:"|?*\\/\s&()]+/g, "_")
            .replace(/_{2,}/g, "_")  // Replace multiple underscores with single
            .replace(/^_+|_+$/g, "") // Remove leading/trailing underscores
            .trim() || "unnamed";
    }

    /**
     * Resolve folder path structure from document folder references
     * @param {Object} document - The document to get folder path for
     * @param {Object} folderDocuments - All folder documents for reference lookup
     * @returns {string} - Sanitized folder path relative to pack root
     */
    resolveFolderPath(document, folderDocuments) {
        if (!document.folder) {
            return ""; // Document is at root level
        }

        const folderPath = [];
        let currentFolderId = document.folder;

        // Traverse up the folder hierarchy
        while (currentFolderId) {
            const folderKey = `!folders!${currentFolderId}`;
            const folderDoc = folderDocuments[folderKey];

            if (!folderDoc) {
                console.warn(`Warning: Folder reference not found: ${folderKey}`);
                break;
            }

            // Add sanitized folder name to the beginning of path
            folderPath.unshift(this.sanitizeFilename(folderDoc.name));

            // Move to parent folder
            currentFolderId = folderDoc.folder;
        }

        return folderPath.join(path.sep);
    }

    /**
     * Extract and organize embedded documents into their parent documents
     * @param {Object} allDocuments - All documents from the database
     * @returns {Object} - Object containing topLevelDocuments and embeddedDocuments
     */
    async organizeDocuments(allDocuments) {
        const topLevelDocuments = {};
        const embeddedDocuments = {};

        // Separate top-level and embedded documents
        for (const [key, document] of Object.entries(allDocuments)) {
            // Top-level documents also save their original key
            document._originalKey = key;
            this.removeStats(document);

            // Skip folder documents (handled separately)
            if (key.startsWith("!folders!")) {
                continue;
            }

            // Migrate document data before writing (stubbed for now)
            let migratedDocument = await this.migrateDocument(document);

            // Check if this is an embedded document (contains a dot in the type part)
            // Pattern: !<type>.<subtype>!<parentId>.<childId>
            const keyMatch = key.match(/^!([^!]+)!(.+)$/);
            if (keyMatch) {
                const [, typeSection, idSection] = keyMatch;

                if (typeSection.includes(".")) {
                    // This is an embedded document
                    const [parentType, childType] = typeSection.split(".");
                    const [parentId, childId] = idSection.split(".");

                    if (parentId && childId) {
                        const parentKey = `!${parentType}!${parentId}`;

                        if (!embeddedDocuments[parentKey]) {
                            embeddedDocuments[parentKey] = [];
                        }

                        embeddedDocuments[parentKey].push({
                            key: key,
                            document: migratedDocument,
                            childType: childType,
                            childId: childId
                        });
                    }
                } else {
                    // This is a top-level document
                    topLevelDocuments[key] = { ...migratedDocument };
                }
            }
        }

        // Add embedded documents to their parent documents
        for (const [parentKey, embeddedList] of Object.entries(embeddedDocuments)) {
            if (topLevelDocuments[parentKey]) {
                topLevelDocuments[parentKey].embedded = embeddedList.map(item => ({
                    _originalKey: item.key,
                    ...item.document
                }));
            }
        }

        return { topLevelDocuments, embeddedDocuments };
    }

    /**
     * Extract documents to individual JSON files with folder structure
     * @param {Object} allDocuments - All documents from the database
     * @param {Object} folderDocuments - All folder documents for path resolution
     */
    async extractDocuments(allDocuments, folderDocuments) {
        const { topLevelDocuments } = await this.organizeDocuments(allDocuments);

        let extractedCount = 0;

        for (const [key, document] of Object.entries(topLevelDocuments)) {
            try {
                // Get folder path for this document
                const folderPath = this.resolveFolderPath(document, folderDocuments);

                // Create sanitized filename
                const sanitizedName = this.sanitizeFilename(document.name);
                const filename = `${sanitizedName}.json`;

                // Build full file path
                const fullFolderPath = path.join(this.paths.outputDir, folderPath);
                const fullFilePath = path.join(fullFolderPath, filename);

                // Ensure directory exists
                await fs.mkdir(fullFolderPath, { recursive: true });

                // Write document to file
                await fs.writeFile(fullFilePath, toCRLF(JSON.stringify(document, null, 2)), "utf8");

                extractedCount++;

            } catch (error) {
                console.error(`Error extracting document ${key}:`, error);
            }
        }

        console.log(`Extracted ${extractedCount} documents to individual JSON files.`);
    }

    /**
     * Migrate a document before writing to disk (stub)
     * @param {Object} document - The document to migrate
     * @returns {Object} - Migrated document (unchanged for now)
     */
    async migrateDocument(document) {
        let result = document;
        try {
            // Parse type segment from the original key and compare
            const typeMatch = typeof document?._originalKey === "string"
                ? document._originalKey.match(/^!([^!]+)!/)
                : null;
            const typeSegment = (typeMatch && typeMatch[1] ? typeMatch[1] : "").toLowerCase();

            if (typeSegment.startsWith("tables")) {
                result = await this.migrateRollTable(typeSegment, document);
            }
        } catch (error) {
            console.debug("migrateDocument error:", error);
        }

        return result;
    }

    /**
     * Migrate RollTable document (stub)
     * @param {Object} document - RollTable document
     * @returns {Object} - Migrated RollTable document (unchanged for now)
     */
    async migrateRollTable(typeSegment, document) {
        let result = document;
        if (typeSegment === "tables.results") {
            //console.debug("migrateRollTable:", typeSegment, document);
            // If v13 format then backport
            if (document.type === "text") {
                if (document.description && !document.name) {
                    result.name = document.description;
                    result.description = "";
                    result.text = result.name;
                } else if (document.description && !document.text) {
                    result.text = document.description;
                }
            } else if (document.type === "document") {
                if (document.name && !document.text) {
                    result.text = document.name;
                }
                if (document.text && !document.name) {
                    result.name = document.text
                }
            }
        }
        return result;
    }

    /**
    * Do stuff to the document
    * @param {Object} documents - All documents from the .db file
    */
    async removeStats(document) {
        document._stats = {
            "coreVersion": "12.343",
            "systemId": "fantastic-depths",
        };
    }

    /**
     * Compile individual JSON files back into a .db file
     * @param {string} packName - Name of the pack to compile
     */
    async compile(packName) {
        if (!packName) {
            throw new Error("Pack name is required for compilation");
        }

        this.packName = packName;
        this.paths = this.getPackPaths(packName);
        const packsrcPath = this.paths.outputDir;

        // Check if packsrc directory exists
        if (!(await this.directoryExists(packsrcPath))) {
            throw new Error(`Pack source directory not found: ${packsrcPath}`);
        }

        console.log(`Starting compilation of pack: ${packName}`);
        console.log(`Reading from: ${packsrcPath}`);

        try {
            // Step 1: Collect all JSON files from packsrc folder structure
            console.log("Collecting JSON files...");
            const collectedData = await this.collectJsonFiles(packsrcPath);

            // Step 2: Reconstruct embedded documents from parent documents" embedded arrays
            console.log("Reconstructing embedded documents...");
            const allDocuments = await this.reconstructEmbeddedDocuments(collectedData);

            // Step 3: Write compiled documents to .db file format
            console.log("Writing compiled database...");
            await this.writeCompiledDatabase(allDocuments, packName);

            console.log(`Compilation completed successfully for pack: ${packName}`);

        } catch (error) {
            console.error(`Error during compilation: ${error.message}`);
            throw error;
        }
    }

    /**
     * Collect all JSON files from the packsrc folder structure
     * @param {string} packsrcPath - Path to the packsrc directory
     * @returns {Object} - Object containing folders and documents
     */
    async collectJsonFiles(packsrcPath) {
        const result = {
            folders: {},
            documents: []
        };

        // Read _folders.json if it exists
        const foldersPath = path.join(packsrcPath, "_folders.json");
        try {
            const foldersContent = await fs.readFile(foldersPath, "utf8");
            result.folders = JSON.parse(foldersContent);
            console.log(`Loaded ${Object.keys(result.folders).length} folder documents from _folders.json`);
        } catch (error) {
            console.warn(`No _folders.json found or error reading it: ${error.message}`);
        }

        // Recursively collect all JSON files (except _folders.json)
        await this.collectJsonFilesRecursive(packsrcPath, result.documents, packsrcPath);

        console.log(`Collected ${result.documents.length} document files`);
        return result;
    }

    /**
     * Recursively collect JSON files from a directory
     * @param {string} dirPath - Directory path to search
     * @param {Array} documents - Array to collect documents into
     * @param {string} basePath - Base path for calculating relative paths
     */
    async collectJsonFilesRecursive(dirPath, documents, basePath) {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);

                if (entry.isDirectory()) {
                    // Recursively search subdirectories
                    await this.collectJsonFilesRecursive(fullPath, documents, basePath);
                } else if (entry.isFile() && entry.name.endsWith(".json") && entry.name !== "_folders.json") {
                    // Read and parse JSON file
                    try {
                        const content = await fs.readFile(fullPath, "utf8");
                        const cleanContent = this.removeBOM(content);
                        const document = JSON.parse(cleanContent);
                        documents.push({
                            filePath: fullPath,
                            relativePath: path.relative(basePath, fullPath),
                            document: document
                        });
                    } catch (error) {
                        console.warn(`Error reading JSON file ${fullPath}: ${error.message}`);
                    }
                }
            }
        } catch (error) {
            console.warn(`Error reading directory ${dirPath}: ${error.message}`);
        }
    }

    /**
     * Reconstruct embedded documents from parent documents" embedded arrays
     * @param {Object} collectedData - Object containing folders and documents from collectJsonFiles
     * @returns {Object} - Object with all documents keyed by their database keys
     */
    async reconstructEmbeddedDocuments(collectedData) {
        const allDocuments = {};

        // Add folder documents first
        for (const [key, folderDoc] of Object.entries(collectedData.folders)) {
            allDocuments[key] = folderDoc;
        }

        // Process each document file
        for (const fileData of collectedData.documents) {
            const document = fileData.document;

            // Migrate document data before writing (stubbed for now)
            let migratedDocument = await this.migrateDocument(document);
            this.removeStats(migratedDocument);

            // Create a clean copy of the document without the embedded array
            const cleanDocument = { ...migratedDocument };
            delete cleanDocument.embedded;

            // Add the top-level document
            allDocuments[document._originalKey] = cleanDocument;

            // Process embedded documents if they exist
            if (document.embedded && Array.isArray(document.embedded)) {
                for (const embeddedDoc of document.embedded) {
                    if (embeddedDoc._originalKey) {
                        // Use the stored original key
                        const embeddedKey = embeddedDoc._originalKey;

                        // Migrate document data before writing (stubbed for now)
                        let migratedEmbeddedDocument = await this.migrateDocument(embeddedDoc);
                        this.removeStats(migratedEmbeddedDocument);

                        // Create a clean copy without the _originalKey property
                        const cleanEmbeddedDoc = { ...migratedEmbeddedDocument };
                        delete cleanEmbeddedDoc._originalKey;

                        allDocuments[embeddedKey] = cleanEmbeddedDoc;
                    } else {
                        console.warn(`Embedded document missing _originalKey in ${fileData.relativePath}`);
                    }
                }
            }
        }

        console.log(`Reconstructed ${Object.keys(allDocuments).length} total documents`);
        return allDocuments;
    }

    /**
     * Write compiled documents to .db file format
     * @param {Object} documents - Object with all documents keyed by their database keys
     * @param {string} packName - Name of the pack
     */
    async writeCompiledDatabase(documents, packName) {
        const dbPath = path.join(process.cwd(), "packs", `${packName}.db`);

        try {
            // Ensure pack directory exists
            await fs.mkdir(path.dirname(dbPath), { recursive: true });

            // The documents object is already in the correct format - just write it as JSON
            const dbContent = JSON.stringify(documents, null, 2);

            // Write to the .db file
            await fs.writeFile(dbPath, toCRLF(dbContent), "utf8");

            const documentCount = Object.keys(documents).length;
            console.log(`Successfully compiled ${documentCount} documents to ${dbPath}`);

        } catch (error) {
            console.error(`Error writing compiled database: ${error.message}`);
            throw error;
        }
    }

    /**
     * Check if a directory exists
     * @param {string} dirPath - Directory path to check
     * @returns {boolean} - True if directory exists
     */
    async directoryExists(dirPath) {
        try {
            const stats = await fs.stat(dirPath);
            return stats.isDirectory();
        } catch (error) {
            return false;
        }
    }
}

/**
 * CLI Processor for dbConvert operations
 */
class dbConvertCLI {
    constructor() {
        this.args = process.argv.slice(2);
        this.command = this.args[0];
        this.options = this.parseArgs();
    }

    /**
     * Parse command line arguments
     */
    parseArgs() {
        const options = {};

        for (let i = 1; i < this.args.length; i++) {
            const arg = this.args[i];
            if (arg.startsWith("--")) {
                const key = arg.slice(2);
                const value = this.args[i + 1];
                if (value && !value.startsWith("--")) {
                    options[key] = value;
                    i++; // Skip next arg as it"s the value
                } else {
                    options[key] = true;
                }
            }
        }

        return options;
    }

    /**
     * Show help information
     */
    showHelp() {
        console.log(`
dbConvert - FoundryVTT Database Converter

Usage: node dbConvert.mjs <command> [options]

Commands:
  extract                 Extract documents from .db file to individual JSON files
  compile                 Compile individual JSON files back into a .db file
  help                    Show this help message

Options:
  --pack <name>          Specify pack name (actors, items, macros, rollTables)
  --file <path>          Specify custom .db file path (extract only)
  --help                 Show help

Examples:
  node "scripts/build/dbConvert.mjs" extract --pack actors
  node "scripts/build/dbConvert.mjs" extract --file ./packs/actors.db
  node "scripts/build/dbConvert.mjs" compile --pack actors
  node "scripts/build/dbConvert.mjs" help
        `);
    }

    /**
     * Run the CLI command
     */
    async run() {
        try {
            switch (this.command) {
                case "extract":
                    await this.handleExtract();
                    break;
                case "compile":
                    await this.handleCompile();
                    break;
                case "help":
                case "--help":
                case undefined:
                    this.showHelp();
                    break;
                default:
                    console.error(`Unknown command: ${this.command}`);
                    this.showHelp();
                    process.exit(1);
            }
        } catch (error) {
            console.error("Error:", error.message);
            process.exit(1);
        }
    }

    /**
     * Handle the extract command
     */
    async handleExtract() {
        const customFile = this.options.file;

        // If a custom file is specified, extract just that file
        if (customFile) {
            const converter = new dbConvert("actors"); // Default pack name for custom file
            await converter.extract(customFile);
            return;
        }

        // If no pack is specified, extract all available packs
        if (!this.options.pack) {
            console.log("No pack specified, extracting all available packs...\n");

            for (const packName of dbConvert.AVAILABLE_PACKS) {
                console.log(`Extracting ${packName}...`);
                const converter = new dbConvert(packName);

                try {
                    await converter.extract();
                    console.log(`✓ Successfully extracted ${packName}\n`);
                } catch (error) {
                    console.error(`✗ Failed to extract ${packName}: ${error.message}\n`);
                }
            }
            return;
        }

        // Extract specific pack
        const packName = this.options.pack;
        const converter = new dbConvert(packName);
        await converter.extract();
    }

    /**
     * Handle the compile command
     */
    async handleCompile() {
        // If no pack is specified, compile all available packs
        if (!this.options.pack) {
            console.log("No pack specified, compiling all available packs...\n");

            for (const packName of dbConvert.AVAILABLE_PACKS) {
                console.log(`Compiling ${packName}...`);
                const converter = new dbConvert(packName);

                try {
                    await converter.compile(packName);
                    console.log(`✓ Successfully compiled ${packName}\n`);
                } catch (error) {
                    console.error(`✗ Failed to compile ${packName}: ${error.message}\n`);
                }
            }
            return;
        }

        // Compile specific pack
        const packName = this.options.pack;
        const converter = new dbConvert(packName);
        await converter.compile(packName);
    }
}

// Export classes
export { dbConvert, dbConvertCLI };

// CLI runner - only run if this file is executed directly
if (process.argv && process.argv.length > 2) {
    const cli = new dbConvertCLI();
    cli.run();
}
```

- [ ] **Step 2: Criar `scripts/build/LdbActions.mjs`**

```javascript
// Adapted verbatim from Forelius/fade-compendiums (MIT License),
// https://github.com/Forelius/fade-compendiums, commit 91c6a12.
// scripts/build/LdbActions.mjs
import { Level } from "level";
import fs from "fs/promises";
import path from "path";

// Normalize text content to CRLF for consistent Windows checkouts
const toCRLF = (text) => text.replace(/\r?\n/g, "\r\n");

/**
 * LevelDB Pack Manager - ES6 Class for managing FoundryVTT pack data
 */
class LdbActions {
    static AVAILABLE_PACKS = ["actors", "items", "macros", "rollTables", "journals", "scenes"];
    static BACKUP_SUFFIX = ".bak";

    constructor(packName = "rollTables") {
        this.validatePackName(packName);
        this.packName = packName;
        this.paths = this.getPackPaths(packName);
    }

    /**
     * Validate pack name against available packs
     */
    validatePackName(packName) {
        if (!LdbActions.AVAILABLE_PACKS.includes(packName)) {
            throw new Error(`Invalid pack name: ${packName}. Available packs: ${LdbActions.AVAILABLE_PACKS.join(", ")}`);
        }
    }

    /**
     * Get pack paths for the current pack
     */
    getPackPaths(packName) {
        const packDir = path.join(process.cwd(), "packs", packName);
        const outFile = path.join(process.cwd(), "packs", `${packName}.db`);
        return { packDir, outFile };
    }

    /**
     * Export pack data to JSON file
     */
    async dump() {
        const { packDir, outFile } = this.paths;

        // Clean existing .db file if it exists
        try {
            await fs.unlink(outFile);
            console.log(`Cleaned existing file: ${outFile}`);
        } catch (err) {
            if (err.code !== 'ENOENT') {
                console.warn(`Warning: Could not clean existing file ${outFile}:`, err.message);
            }
        }

        const db = new Level(packDir, { valueEncoding: "json", valueEncoding: "utf8" });
        const out = {};

        for await (const [key, value] of db.iterator()) {
            try {
                out[key] = JSON.parse(value);
            } catch (e) {
                console.error("JSON parse error for key", key, ":", e);
                out[key] = value; // Store as string if JSON parse fails
            }
        }

        await fs.writeFile(outFile, toCRLF(JSON.stringify(out, null, 2)), "utf8");
        console.log("Wrote", Object.keys(out).length, "entries to", outFile);
        await db.close();
    }

    /**
     * Import pack data from JSON file
     */
    async restore(options = {}) {
        const { backupExisting = false } = options;
        const { packDir, outFile } = this.paths;

        // Read JSON file
        const raw = await fs.readFile(outFile, "utf8");
        const cleanRaw = this.removeBOM(raw);
        const data = JSON.parse(cleanRaw);

        // Handle both old array format and new object format
        let entries;
        if (Array.isArray(data)) {
            // Old format - convert to key-value pairs
            entries = {};
            for (const obj of data) {
                const key = obj._id ?? obj.id;
                if (key) {
                    entries[key] = obj;
                }
            }
        } else if (typeof data === 'object') {
            // New format - already key-value pairs
            entries = data;
        } else {
            throw new Error("Expected an array or object in the .db JSON file");
        }

        // Optional backup of existing pack directory
        if (backupExisting) {
            await this.createBackup(packDir);
        }

        // Delete the folder and all its contents recursively
        await fs.rm(packDir, { recursive: true, force: true });
        console.log(`Successfully deleted pack folder: ${packDir}`);
        // Ensure pack directory exists
        await fs.mkdir(path.dirname(packDir), { recursive: true });

        // Open Level store and write entries
        const db = new Level(packDir, { valueEncoding: "json", valueEncoding: "utf8" });
        let written = 0;

        try {
            for (const [key, value] of Object.entries(entries)) {
                const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
                await db.put(key, valueStr);
                written++;
            }
            console.log(`Wrote ${written} entries to Level store at ${packDir}`);
        } finally {
            await db.close();
        }
    }

    /**
     * Create backup of existing pack directory
     */
    async createBackup(packDir) {
        try {
            const stat = await fs.stat(packDir);
            if (stat.isDirectory()) {
                const backupDir = `${packDir}${LdbActions.BACKUP_SUFFIX}-${Date.now()}`;
                await fs.rename(packDir, backupDir);
                console.log("Backed up existing pack directory to", backupDir);
            }
        } catch (err) {
            if (err.code !== "ENOENT") throw err; // ignore if no existing pack
        }
    }

    /**
     * Show sample keys from pack
     */
    async checkpack() {
        const { packDir } = this.paths;
        const db = new Level(packDir, { valueEncoding: "json", valueEncoding: 'utf8' });
        let n = 0;

        for await (const [key] of db.iterator()) {
            console.log(key);
            n++;
            if (n >= 20) break;
        }

        console.log('sampled keys:', n);
        await db.close();
    }

    /**
     * Remove BOM (Byte Order Mark) from file content
     * @param {string} content - The file content that may contain BOM
     * @returns {string} - Content with BOM removed
     */
    removeBOM(content) {
        if (content.charCodeAt(0) === 0xFEFF) {
            return content.slice(1);
        }
        return content;
    }

    /**
     * List all available packs and their status
     */
    static async listPacks() {
        console.log("Available packs:");
        for (const packName of LdbActions.AVAILABLE_PACKS) {
            const packDir = path.join(process.cwd(), "packs", packName);
            try {
                const stat = await fs.stat(packDir);
                if (stat.isDirectory()) {
                    console.log(`  ✓ ${packName} (exists)`);
                }
            } catch (err) {
                console.log(`  ✗ ${packName} (not found)`);
            }
        }
    }

    /**
     * Dump all available packs
     */
    static async dumpAll() {
        console.log("Dumping all available packs...");
        let successCount = 0;
        let errorCount = 0;

        for (const packName of LdbActions.AVAILABLE_PACKS) {
            try {
                console.log(`\n--- Dumping ${packName} ---`);
                const ldbActions = new LdbActions(packName);
                await ldbActions.dump();
                successCount++;
            } catch (err) {
                console.error(`Error dumping ${packName}:`, err.message);
                errorCount++;
            }
        }

        console.log(`\n--- Summary ---`);
        console.log(`Successfully dumped: ${successCount} packs`);
        if (errorCount > 0) {
            console.log(`Failed to dump: ${errorCount} packs`);
        }
    }

    /**
     * Restore all available packs from their JSON files
     */
    static async restoreAll(options = {}) {
        console.log("Restoring all available packs...");

        let successCount = 0;
        let errorCount = 0;

        for (const packName of LdbActions.AVAILABLE_PACKS) {
            try {
                console.log(`\n--- Restoring ${packName} ---`);
                const ldbActions = new LdbActions(packName);
                await ldbActions.restore(options);
                successCount++;
            } catch (err) {
                console.error(`Error restoring ${packName}:`, err.message);
                errorCount++;
            }
        }

        console.log(`\n--- Summary ---`);
        console.log(`Successfully restored: ${successCount} packs`);
        if (errorCount > 0) {
            console.log(`Failed to restore: ${errorCount} packs`);
        }
    }
}

/**
 * Command Line Interface Runner
 */
class LdbDumpCLI {
    constructor() {
        this.args = process.argv.slice(2);
    }

    /**
     * Parse command line arguments
     */
    parseArgs() {
        const command = this.args[0];
        let packName = "rollTables"; // default
        let backup = false; // default to no backup since git is used
        let packSpecified = false; // track if pack was explicitly specified

        // Look for --pack argument
        const packIndex = this.args.indexOf("--pack");
        if (packIndex !== -1 && packIndex + 1 < this.args.length) {
            packName = this.args[packIndex + 1];
            packSpecified = true;
        }

        // Look for --backup flag
        if (this.args.includes("--backup")) {
            backup = true;
        }

        return { command, packName, backup, packSpecified };
    }

    /**
     * Show help message
     */
    showHelp() {
        console.log(`
Usage: node scripts/build/LdbActions.mjs <command> [--pack <packName>] [--backup]

Commands:
  dump      - Export pack data to JSON file
              If no --pack is specified, dumps all available packs
  restore   - Import pack data from JSON file
              If no --pack is specified, restores all available packs
  checkpack - Show sample keys from pack
  list      - List all available packs
  help      - Show this help message

Options:
  --pack <name>  - Specify pack name (default for checkpack: rollTables)
                   Available: ${LdbActions.AVAILABLE_PACKS.join(", ")}
                   For dump/restore commands: omit to process all packs
  --backup       - Create backup directory before restore (default: false)
                   Use this if you're not using git or want extra safety

Examples:
  node scripts/build/LdbActions.mjs dump                          # Dump all packs
  node scripts/build/LdbActions.mjs dump --pack actors            # Dump specific pack
  node scripts/build/LdbActions.mjs restore                       # Restore all packs
  node scripts/build/LdbActions.mjs restore --pack items          # Restore specific pack
  node scripts/build/LdbActions.mjs restore --pack items --backup
  node scripts/build/LdbActions.mjs checkpack --pack macros
  node scripts/build/LdbActions.mjs list
`);
    }

    /**
     * Execute the CLI command
     */
    async run() {
        try {
            const { command, packName, backup, packSpecified } = this.parseArgs();

            if (command === "dump") {
                if (!packSpecified) {
                    await LdbActions.dumpAll();
                } else {
                    const ldbActions = new LdbActions(packName);
                    await ldbActions.dump();
                }
            } else if (command === "restore") {
                if (!packSpecified) {
                    await LdbActions.restoreAll({ backupExisting: backup });
                } else {
                    const ldbActions = new LdbActions(packName);
                    await ldbActions.restore({ backupExisting: backup });
                }
            } else if (command === "checkpack") {
                const ldbActions = new LdbActions(packName);
                await ldbActions.checkpack();
            } else if (command === "list") {
                await LdbActions.listPacks();
            } else if (command === "help" || command === "--help" || command === "-h") {
                this.showHelp();
            } else {
                console.error(`Unknown command: ${command}`);
                this.showHelp();
                process.exit(1);
            }
        } catch (err) {
            console.error("Error:", err.message);
            this.showHelp();
            process.exit(1);
        }
    }
}

// Export the classes for potential module usage
export { LdbActions, LdbDumpCLI };

// CLI runner - only execute if this file is run directly
if (process.argv && process.argv.length > 2) {
    const cli = new LdbDumpCLI();
    cli.run();
}
```

- [ ] **Step 3: Criar `scripts/system/config.mjs`**

```javascript
export const FADERETRO = {};
```

- [ ] **Step 4: Criar `scripts/system/templates.mjs`**

```javascript
/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
export const preloadHandlebarsTemplates = async function () {
   const fn = foundry?.applications?.handlebars?.loadTemplates ? foundry.applications.handlebars.loadTemplates : loadTemplates;
   await fn({});
};
```

- [ ] **Step 5: Criar `scripts/fadeRetroCompendiums.mjs`**

```javascript
import { preloadHandlebarsTemplates } from './system/templates.mjs';
import { FADERETRO } from './system/config.mjs';

Hooks.once('init', async function () {
   //console.debug('FADERETRO: init hook called.');
});

Hooks.once('beforeFadeInit', async function (fadeRegistry) {
   //console.debug('FADERETRO: beforeFadeInit hook called.');
});

Hooks.once('afterFadeInit', async function (fadeRegistry) {
   //console.debug('FADERETRO: afterFadeInit hook called.');
   await preloadHandlebarsTemplates();
});

Hooks.once('beforeFadeReady', async function (fadeRegistry) {
   //console.debug('FADERETRO: beforeFadeReady hook called.');
});

Hooks.once('afterFadeReady', async function (fadeRegistry) {
   //console.debug('FADERETRO: afterFadeReady hook called.');
});
```

- [ ] **Step 6: Checar sintaxe de todos os arquivos copiados**

Run:
```bash
node --check scripts/build/dbConvert.mjs
node --check scripts/build/LdbActions.mjs
node --check scripts/system/config.mjs
node --check scripts/system/templates.mjs
node --check scripts/fadeRetroCompendiums.mjs
```
Expected: nenhum output (sintaxe válida) para os 5 comandos.

- [ ] **Step 7: Testar o CLI de ajuda de cada script de build**

Run: `node scripts/build/dbConvert.mjs help`
Expected: imprime o texto de uso ("dbConvert - FoundryVTT Database Converter").

Run: `node scripts/build/LdbActions.mjs help`
Expected: imprime o texto de uso ("Usage: node scripts/build/LdbActions.mjs...").

- [ ] **Step 8: Commit**

```bash
git add scripts/build scripts/system scripts/fadeRetroCompendiums.mjs
git commit -m "chore: vendor fade-compendiums build scripts (MIT, commit 91c6a12)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Documento de referência do schema do `fantastic-depths`

**Files:**
- Create: `docs/fantastic-depths-item-schema.md`

**Interfaces:**
- Consumes: nada diretamente em código; é a fonte de verdade que a Task 6
  (validador) e a Task 7 (documentos escritos à mão) seguem.
- Produces: a lista de campos obrigatórios por subtipo de Item, usada
  literalmente como `GEAR_REQUIRED_FIELDS` / `SUBTYPE_REQUIRED_FIELDS` na
  Task 6.

Esta é a tarefa de pesquisa mencionada na Fase 1 do spec: os campos vêm de
leitura direta das classes `DataModel` do sistema `fantastic-depths`
(`Forelius/fantastic-depths`, commit `4a8f2c8`), não de suposição.

- [ ] **Step 1: Criar `docs/fantastic-depths-item-schema.md`**

```markdown
# Schema de Item do sistema `fantastic-depths`

Fonte: [`Forelius/fantastic-depths`](https://github.com/Forelius/fantastic-depths),
commit `4a8f2c8`, `src/item/dataModel/*.ts`. Lido diretamente do código-fonte
das classes `DataModel`, não dos nomes de subtipo do `system.json`.

Subtipos declarados em `system.json` → `documentTypes.Item`: `item`, `weapon`,
`armor`, `spell`, `skill`, `actorClass`, `mastery`, `specialAbility`, `class`,
`weaponMastery`, `light`, `condition`, `treasure`, `species`, `ammo`.

Esta fase (1) só usa `item`, `weapon` e `light`. Os demais ficam para as fases
que tratam de classes, magias, skills e masteries.

## `IdentifiableData` (mixin usado por `GearItemDataModel`)

| Campo | Tipo | Obrigatório | Default |
|---|---|---|---|
| `unidentifiedName` | string | não | `""` |
| `unidentifiedDesc` | string | não | `""` |
| `isIdentified` | boolean | não | `true` |
| `isCursed` | boolean | não | `false` |

## `GearItemDataModel` (base de `item`, `weapon`, `armor`, `light`, `ammo`)

| Campo | Tipo | Obrigatório | Default |
|---|---|---|---|
| `shortName` | string | não | `""` |
| `tags` | string[] | não | `[]` |
| `description` | string | não | `""` |
| `gm.notes` | string | não | `""` |
| `quantity` | number | **sim** | `1` |
| `quantityMax` | number, nullable | não | `0` |
| `charges` | number | **sim** | `0` |
| `chargesMax` | number, nullable | não | `0` |
| `weight` | number | não | `1` |
| `weightEquipped` | number, nullable | não | `null` |
| `cost` | number | não | `0` |
| `totalWeight` | number | não | `0` |
| `totalCost` | number | não | `0` |
| `containerId` | string | não | `""` |
| `equipped` | boolean | não | `false` |
| `container` | boolean | não | `false` |
| `isOpen` | boolean | não | `false` |
| `equippable` | boolean | não | `false` |
| `fuelType` | string | não | `""` |
| `isDropped` | boolean | **sim** | `false` |
| `isTreasure` | boolean | **sim** | `false` |
| `specialAbilities` | array | não | `[]` |
| `spells` | array | não | `[]` |
| `conditions` | array | não | `[]` |

**Unidade de peso**: comparando o `Dagger.json` real do `fade-compendiums`
(`weight: 10`, DD4e diz "1lb") com o `Backpack.json` real (`weight: 20`,
DD4e diz "2lb"), o campo `weight` está em uma escala de 10 unidades por libra
(padrão retro-clone de encumbrance em moedas). Ao converter valores do livro:
`weight_no_pack = libras_no_livro × 10`.

**Unidade de custo**: `cost` está em peças de ouro (gp). Peças de prata (sp)
do livro viram fração decimal: `2sp = 0.2`.

Campos obrigatórios usados pelo validador (Task 6) para o subtipo `item`:
`tags, description, quantity, weight, cost, equipped, container, equippable,
isDropped, isTreasure`.

## `WeaponItemDataModel extends GearItemDataModel`

Campos adicionais:

| Campo | Tipo | Obrigatório | Default |
|---|---|---|---|
| `damageRoll` | string | **sim** | `"1d6"` |
| `damageLabel` | string | não | `"1d6"` |
| `damageType` | string | **sim** | `"physical"` |
| `breath` | string, nullable | não | `null` |
| `canMelee` | boolean | **sim** | `true` |
| `canRanged` | boolean | **sim** | `false` |
| `canSet` | boolean | não | `false` |
| `isSlow` | boolean | não | `false` |
| `savingThrow` | string, nullable | não | `null` |
| `saveDmgFormula` | string, nullable | não | `null` |
| `mastery` | string | **sim** | `""` |
| `weaponType` | string | **sim** | `""` |
| `ammoType` | string | não | `""` |
| `range.{short,medium,long,min}` | number, nullable (min: não-nullable) | **sim** (o objeto `range`) | `null`/`null`/`null`/`0` |
| `size` | string, nullable | não | `null` |
| `grip` | string, nullable | não | `null` |
| `natural` | boolean | não | `false` |
| `mod.{dmg,toHit,dmgRanged,toHitRanged,rangeMultiplier,vsGroup}` | number/object | não | `0`/`0`/`0`/`0`/`1`/`{}` |
| `attacks.{used,max,group}` | number | não | `0`/`null`/`0` |
| `siege.*` | vários, nullable | não | todos `null`/`false` |

Campos obrigatórios usados pelo validador para o subtipo `weapon`: os de
`item` + `damageRoll, damageType, canMelee, canRanged, mastery, weaponType,
range`.

## `LightItemDataModel extends GearItemDataModel`

Campos adicionais:

| Campo | Tipo | Obrigatório | Default |
|---|---|---|---|
| `isLight` | boolean | não | `true` |
| `light.enabled` | boolean | não | `false` |
| `light.type` | string (`torch`, `lantern`, `bullseye`, `candle`, `magic`, `custom`, `none`) | não | `""` |
| `light.duration` | number, nullable — **em turnos de 10 minutos** | não | `6` |
| `light.radius` | number | não | `30` |
| `light.fuelType` | string | não | `""` |
| `light.secondsRemain` | number | não | `0` |
| `light.bright` | number | não | `6` |
| `light.color` | string (hex) | não | `"#d0a750"` |
| `light.attenuation` | number | não | `0.7` |
| `light.luminosity` | number | não | `0.5` |
| `light.angle` | number | não | `360` |
| `light.animation.{type,speed,intensity}` | string/number | não | `"torch"`/`2`/`3` |

Campos obrigatórios usados pelo validador para o subtipo `light`: os de
`item` + `light`.

## Campos vistos em documentos reais mas não localizados nas DataModels lidas

O `Dagger.json` real do `fade-compendiums` inclui `isAmmo`, `isCarried`,
`dmgFormula`, `healFormula`, `isUsable` — provavelmente de um outro mixin
(`Usable`/`Ammo`) ainda não localizado no código-fonte. **Não** são exigidos
pelo validador desta fase; ficam como item aberto para quando um domínio
futuro (munição, itens usáveis) precisar deles — ver spec, seção 8.
```

- [ ] **Step 2: Commit**

```bash
git add docs/fantastic-depths-item-schema.md
git commit -m "docs: fantastic-depths Item DataModel schema reference

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: `module.json`

**Files:**
- Create: `module.json`

**Interfaces:**
- Consumes: nada.
- Produces: a lista de packs (`item-compendium`, `actor-compendium`,
  `roll-table-compendium`, `macro-compendium`) e seus caminhos
  (`packs/items`, `packs/actors`, `packs/rollTables`, `packs/macros`) que a
  Task 7 usa como destino de `packsrc/<pack>`.

- [ ] **Step 1: Criar `module.json`**

```json
{
  "id": "fade-retro-compendiums",
  "title": "Retro Rules Compendiums for Fantastic Depths",
  "description": "Compendium content for the Fantastic Depths Foundry VTT system, derived from Dark Dungeons (4th Edition) by Gurbintroll Games under the ORC License. See CREDITS.md for full attribution.",
  "version": "#{VERSION}#",
  "compatibility": {
    "minimum": 13,
    "verified": 14,
    "maximum": 14
  },
  "relationships": {
    "systems": [
      {
        "id": "fantastic-depths",
        "type": "system",
        "compatibility": {}
      }
    ]
  },
  "authors": [
    {
      "name": "Felipe Alves",
      "flags": {}
    }
  ],
  "esmodules": [
    "scripts/fadeRetroCompendiums.mjs"
  ],
  "languages": [
    {
      "lang": "en",
      "name": "English",
      "path": "lang/en.json"
    }
  ],
  "packs": [
    {
      "name": "item-compendium",
      "label": "Item Compendium",
      "path": "packs/items",
      "type": "Item",
      "system": "fantastic-depths",
      "ownership": {
        "PLAYER": "OBSERVER",
        "ASSISTANT": "OWNER"
      }
    },
    {
      "name": "actor-compendium",
      "label": "Actor Compendium",
      "path": "packs/actors",
      "type": "Actor",
      "system": "fantastic-depths",
      "ownership": {
        "PLAYER": "OBSERVER",
        "ASSISTANT": "OWNER"
      }
    },
    {
      "name": "roll-table-compendium",
      "label": "Roll Table Compendium",
      "path": "packs/rollTables",
      "type": "RollTable",
      "system": "fantastic-depths",
      "ownership": {
        "PLAYER": "OBSERVER",
        "ASSISTANT": "OWNER"
      }
    },
    {
      "name": "macro-compendium",
      "label": "Macro Compendium",
      "path": "packs/macros",
      "type": "Macro",
      "system": "fantastic-depths",
      "ownership": {
        "PLAYER": "OBSERVER",
        "ASSISTANT": "OWNER"
      }
    }
  ],
  "url": "#{URL}#",
  "manifest": "#{MANIFEST}#",
  "download": "#{DOWNLOAD}#",
  "changelog": "#{CHANGELOG}#"
}
```

- [ ] **Step 2: Validar sintaxe JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('module.json', 'utf8')); console.log('module.json OK')"`
Expected: imprime `module.json OK`.

- [ ] **Step 3: Verificar os 4 packs e o relacionamento de sistema**

Run:
```bash
node -e "
const m = JSON.parse(require('fs').readFileSync('module.json', 'utf8'));
console.assert(m.id === 'fade-retro-compendiums', 'id incorreto');
console.assert(m.packs.length === 4, 'esperava 4 packs, achou ' + m.packs.length);
console.assert(m.relationships.systems[0].id === 'fantastic-depths', 'sistema incorreto');
console.log('module.json: estrutura OK');
"
```
Expected: imprime `module.json: estrutura OK`, sem mensagens de `Assertion failed`.

- [ ] **Step 4: Commit**

```bash
git add module.json
git commit -m "feat: add module.json declaring the 4 fantastic-depths packs

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Validador de schema (`scripts/extract/validate.mjs`)

**Files:**
- Create: `scripts/extract/validate.mjs`
- Test: `scripts/extract/validate.test.mjs`

**Interfaces:**
- Consumes: os campos obrigatórios documentados na Task 4
  (`docs/fantastic-depths-item-schema.md`).
- Produces:
  - `validateDocument(doc, { packName, knownFolderIds }) -> string[]`
    (lista de erros; vazia = válido)
  - `validatePack(packName, packsrcDir) -> Promise<{ fileCount: number, errors: string[] }>`
  - CLI: `node scripts/extract/validate.mjs [--pack <name>]`, chamado por
    `npm run validate` (Task 2) e usado pela Task 7 para aceitar os
    documentos escritos à mão, e pelo `comppacks` (Task 2) antes de compilar.

- [ ] **Step 1: Escrever os testes (falhando)**

Criar `scripts/extract/validate.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateDocument, validatePack } from "./validate.mjs";

const validWeapon = {
   name: "Dagger",
   type: "weapon",
   _id: "OFQFxbNVm1qvEG9t",
   folder: "2AKCulCJIGNyAMaN",
   _originalKey: "!items!OFQFxbNVm1qvEG9t",
   system: {
      tags: ["thrown"],
      description: "<p>A short blade.</p>",
      quantity: 1,
      weight: 10,
      cost: 3,
      equipped: false,
      container: false,
      equippable: true,
      isDropped: false,
      isTreasure: false,
      damageRoll: "1d4",
      damageType: "physical",
      canMelee: true,
      canRanged: true,
      mastery: "Dagger",
      weaponType: "handheld",
      range: { short: 10, medium: 20, long: 30, min: 0 },
   },
};

test("validateDocument accepts a fully-formed weapon", () => {
   const errors = validateDocument(validWeapon, {
      packName: "items",
      knownFolderIds: new Set(["2AKCulCJIGNyAMaN"]),
   });
   assert.deepEqual(errors, []);
});

test("validateDocument flags a missing required weapon field", () => {
   const broken = structuredClone(validWeapon);
   delete broken.system.damageRoll;
   const errors = validateDocument(broken, {
      packName: "items",
      knownFolderIds: new Set(["2AKCulCJIGNyAMaN"]),
   });
   assert.ok(
      errors.some((e) => e.includes("system.damageRoll")),
      `expected an error mentioning system.damageRoll, got: ${errors.join(", ")}`
   );
});

test("validateDocument rejects a malformed _id", () => {
   const broken = structuredClone(validWeapon);
   broken._id = "too-short";
   const errors = validateDocument(broken, {
      packName: "items",
      knownFolderIds: new Set(["2AKCulCJIGNyAMaN"]),
   });
   assert.ok(errors.some((e) => e.includes("_id")));
});

test("validateDocument rejects a folder id absent from _folders.json", () => {
   const broken = structuredClone(validWeapon);
   broken.folder = "doesNotExist0000";
   const errors = validateDocument(broken, {
      packName: "items",
      knownFolderIds: new Set(["2AKCulCJIGNyAMaN"]),
   });
   assert.ok(errors.some((e) => e.includes("folder")));
});

test("validateDocument rejects an unknown subtype", () => {
   const broken = structuredClone(validWeapon);
   broken.type = "not-a-real-subtype";
   const errors = validateDocument(broken, {
      packName: "items",
      knownFolderIds: new Set(["2AKCulCJIGNyAMaN"]),
   });
   assert.ok(errors.some((e) => e.includes("unknown subtype")));
});

test("validatePack reports zero errors for a well-formed packsrc directory", async () => {
   const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fade-retro-validate-"));
   try {
      await fs.writeFile(
         path.join(dir, "_folders.json"),
         JSON.stringify({
            "!folders!2AKCulCJIGNyAMaN": { _id: "2AKCulCJIGNyAMaN", name: "Weapons", folder: null },
         })
      );
      await fs.writeFile(path.join(dir, "Dagger.json"), JSON.stringify(validWeapon));

      const { fileCount, errors } = await validatePack("items", dir);
      assert.equal(fileCount, 1);
      assert.deepEqual(errors, []);
   } finally {
      await fs.rm(dir, { recursive: true, force: true });
   }
});

test("validatePack flags duplicate _id across two files", async () => {
   const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fade-retro-validate-"));
   try {
      await fs.writeFile(
         path.join(dir, "_folders.json"),
         JSON.stringify({
            "!folders!2AKCulCJIGNyAMaN": { _id: "2AKCulCJIGNyAMaN", name: "Weapons", folder: null },
         })
      );
      await fs.writeFile(path.join(dir, "Dagger.json"), JSON.stringify(validWeapon));
      const duplicate = structuredClone(validWeapon);
      duplicate.name = "Dagger Copy";
      await fs.writeFile(path.join(dir, "Dagger_Copy.json"), JSON.stringify(duplicate));

      const { fileCount, errors } = await validatePack("items", dir);
      assert.equal(fileCount, 2);
      assert.ok(errors.some((e) => e.includes("duplicate _id")));
   } finally {
      await fs.rm(dir, { recursive: true, force: true });
   }
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `node --test scripts/extract/validate.test.mjs`
Expected: FAIL — `Cannot find module './validate.mjs'` (o arquivo ainda não
existe).

- [ ] **Step 3: Implementar `scripts/extract/validate.mjs`**

```javascript
import fs from "node:fs/promises";
import path from "node:path";

const ORIGINAL_KEY_PREFIX = {
   actors: "!actors!",
   items: "!items!",
   macros: "!macros!",
   rollTables: "!tables!",
};

const ID_PATTERN = /^[a-zA-Z0-9]{16}$/;

const GEAR_REQUIRED_FIELDS = [
   "tags", "description", "quantity", "weight", "cost",
   "equipped", "container", "equippable", "isDropped", "isTreasure",
];

const SUBTYPE_REQUIRED_FIELDS = {
   item: GEAR_REQUIRED_FIELDS,
   weapon: [...GEAR_REQUIRED_FIELDS, "damageRoll", "damageType", "canMelee", "canRanged", "mastery", "weaponType", "range"],
   light: [...GEAR_REQUIRED_FIELDS, "light"],
};

/**
 * Validate a single document object against envelope and subtype rules.
 * @param {object} doc - parsed document JSON
 * @param {object} context
 * @param {string} context.packName - pack this document belongs to (e.g. "items")
 * @param {Set<string>} context.knownFolderIds - folder ids declared in _folders.json
 * @returns {string[]} list of error messages, empty when the document is valid
 */
export function validateDocument(doc, { packName, knownFolderIds }) {
   const errors = [];

   if (typeof doc.name !== "string" || doc.name.length === 0) {
      errors.push("missing or empty 'name'");
   }
   if (typeof doc.type !== "string" || doc.type.length === 0) {
      errors.push("missing or empty 'type'");
   }
   if (!ID_PATTERN.test(doc._id ?? "")) {
      errors.push(`invalid '_id': ${JSON.stringify(doc._id)} (expected 16 alphanumeric characters)`);
   }

   const expectedKeyPrefix = ORIGINAL_KEY_PREFIX[packName];
   if (expectedKeyPrefix) {
      const expectedKey = `${expectedKeyPrefix}${doc._id}`;
      if (doc._originalKey !== expectedKey) {
         errors.push(`_originalKey '${doc._originalKey}' does not match expected '${expectedKey}'`);
      }
   }

   if (doc.folder != null && doc.folder !== "") {
      if (!knownFolderIds.has(doc.folder)) {
         errors.push(`folder '${doc.folder}' is not declared in _folders.json`);
      }
   }

   if (doc.system == null || typeof doc.system !== "object") {
      errors.push("missing 'system' object");
   } else {
      const requiredFields = SUBTYPE_REQUIRED_FIELDS[doc.type];
      if (!requiredFields) {
         errors.push(`unknown subtype '${doc.type}' — add it to SUBTYPE_REQUIRED_FIELDS in scripts/extract/validate.mjs`);
      } else {
         for (const field of requiredFields) {
            if (!(field in doc.system)) {
               errors.push(`system.${field} is required for subtype '${doc.type}'`);
            }
         }
      }
   }

   return errors;
}

async function collectJsonFiles(dir) {
   const results = [];
   let entries;
   try {
      entries = await fs.readdir(dir, { withFileTypes: true });
   } catch (error) {
      if (error.code === "ENOENT") return results;
      throw error;
   }
   for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
         results.push(...(await collectJsonFiles(fullPath)));
      } else if (entry.isFile() && entry.name.endsWith(".json") && entry.name !== "_folders.json") {
         results.push(fullPath);
      }
   }
   return results;
}

/**
 * Validate every document file in a packsrc/<packName> directory.
 * @param {string} packName
 * @param {string} packsrcDir - path to packsrc/<packName>
 * @returns {Promise<{fileCount: number, errors: string[]}>}
 */
export async function validatePack(packName, packsrcDir) {
   const errors = [];
   let knownFolderIds = new Set();
   let folders = {};

   const foldersPath = path.join(packsrcDir, "_folders.json");
   try {
      const raw = await fs.readFile(foldersPath, "utf8");
      folders = JSON.parse(raw);
      knownFolderIds = new Set(Object.values(folders).map((f) => f._id));
   } catch (error) {
      if (error.code !== "ENOENT") {
         errors.push(`could not read _folders.json: ${error.message}`);
      }
   }

   // A folder's own parent reference must also resolve.
   for (const folder of Object.values(folders)) {
      if (folder.folder != null && folder.folder !== "" && !knownFolderIds.has(folder.folder)) {
         errors.push(`_folders.json: folder '${folder._id}' references unknown parent '${folder.folder}'`);
      }
   }

   const files = await collectJsonFiles(packsrcDir);
   const seenIds = new Map();

   for (const filePath of files) {
      const raw = await fs.readFile(filePath, "utf8");
      let doc;
      try {
         doc = JSON.parse(raw);
      } catch (error) {
         errors.push(`${filePath}: invalid JSON — ${error.message}`);
         continue;
      }

      const docErrors = validateDocument(doc, { packName, knownFolderIds });
      for (const message of docErrors) {
         errors.push(`${filePath}: ${message}`);
      }

      if (ID_PATTERN.test(doc._id ?? "")) {
         if (seenIds.has(doc._id)) {
            errors.push(`${filePath}: duplicate _id '${doc._id}' also used by ${seenIds.get(doc._id)}`);
         } else {
            seenIds.set(doc._id, filePath);
         }
      }
   }

   return { fileCount: files.length, errors };
}

const AVAILABLE_PACKS = ["actors", "items", "macros", "rollTables"];

async function main() {
   const args = process.argv.slice(2);
   const packIndex = args.indexOf("--pack");
   const packsToRun = packIndex !== -1 && args[packIndex + 1]
      ? [args[packIndex + 1]]
      : AVAILABLE_PACKS;

   let totalErrors = 0;
   for (const packName of packsToRun) {
      const packsrcDir = path.join(process.cwd(), "packsrc", packName);
      const { fileCount, errors } = await validatePack(packName, packsrcDir);
      if (errors.length === 0) {
         console.log(`✓ ${packName}: ${fileCount} document(s), no errors`);
      } else {
         console.error(`✗ ${packName}: ${fileCount} document(s), ${errors.length} error(s)`);
         for (const message of errors) {
            console.error(`  - ${message}`);
         }
      }
      totalErrors += errors.length;
   }

   if (totalErrors > 0) {
      console.error(`\nvalidate: ${totalErrors} error(s) found`);
      process.exit(1);
   }
   console.log("\nvalidate: all packs OK");
}

if (process.argv[1] && process.argv[1].endsWith("validate.mjs")) {
   main();
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `node --test scripts/extract/validate.test.mjs`
Expected: PASS — 7 testes, 0 falhas.

- [ ] **Step 5: Rodar via `npm test`**

Run: `npm test`
Expected: mesmo resultado do Step 4, via o script npm.

- [ ] **Step 6: Commit**

```bash
git add scripts/extract/validate.mjs scripts/extract/validate.test.mjs
git commit -m "feat: pack schema validator with unit tests

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Documentos de Item escritos à mão (Dagger, Backpack, Torch)

**Files:**
- Create: `packsrc/items/_folders.json`
- Create: `packsrc/items/Equipment/Weapons/Dagger.json`
- Create: `packsrc/items/Equipment/Adventuring_Gear/Backpack.json`
- Create: `packsrc/items/Equipment/Adventuring_Gear/Torch.json`
- Create: `packsrc/actors/.gitkeep`
- Create: `packsrc/macros/.gitkeep`
- Create: `packsrc/rollTables/.gitkeep`

**Interfaces:**
- Consumes: `validatePack`/CLI da Task 6; caminhos de pack do `module.json`
  (Task 5).
- Produces: os 3 documentos de `packsrc/items` que a Task 8 compila e
  verifica dentro de um LevelDB real.

Conteúdo fonte: *Dark Dungeons, 4th Edition*, Cap. 6 (Tabela 6-13a, proficiência
básica da adaga) e Cap. 9 (Tabela 9-1, itens mundanos: Backpack, Torch).
Conversões de unidade documentadas na Task 4.

- [ ] **Step 1: Criar `packsrc/items/_folders.json`**

```json
{
  "!folders!luTBWNJHVwpLxh6c": {
    "name": "Equipment",
    "sorting": "a",
    "folder": null,
    "type": "Item",
    "_id": "luTBWNJHVwpLxh6c",
    "description": "",
    "sort": 100000,
    "color": "#3c2f27",
    "flags": {},
    "_stats": {
      "coreVersion": "13.347",
      "systemId": "fantastic-depths"
    }
  },
  "!folders!2AKCulCJIGNyAMaN": {
    "name": "Weapons",
    "sorting": "a",
    "folder": "luTBWNJHVwpLxh6c",
    "type": "Item",
    "_id": "2AKCulCJIGNyAMaN",
    "description": "",
    "sort": 100000,
    "color": "#5b3132",
    "flags": {},
    "_stats": {
      "coreVersion": "13.347",
      "systemId": "fantastic-depths"
    }
  },
  "!folders!vItxVSiPb4vq0Mmc": {
    "name": "Adventuring Gear",
    "sorting": "a",
    "folder": "luTBWNJHVwpLxh6c",
    "type": "Item",
    "_id": "vItxVSiPb4vq0Mmc",
    "description": "",
    "sort": 200000,
    "color": "#42362f",
    "flags": {},
    "_stats": {
      "coreVersion": "13.347",
      "systemId": "fantastic-depths"
    }
  }
}
```

- [ ] **Step 2: Criar `packsrc/items/Equipment/Weapons/Dagger.json`**

```json
{
  "folder": "2AKCulCJIGNyAMaN",
  "name": "Dagger",
  "type": "weapon",
  "_id": "OFQFxbNVm1qvEG9t",
  "img": "icons/svg/item-bag.svg",
  "system": {
    "tags": ["thrown"],
    "description": "<p>A short light blade 18” long or less. Daggers are popular because their small size makes them easy to conceal, and they can be either thrown or used in melee.</p>",
    "gm": { "notes": "" },
    "quantity": 1,
    "quantityMax": 0,
    "charges": 0,
    "chargesMax": 0,
    "weight": 10,
    "weightEquipped": 10,
    "cost": 3,
    "totalWeight": 0,
    "totalCost": 0,
    "containerId": "",
    "equipped": false,
    "container": false,
    "isOpen": false,
    "equippable": true,
    "fuelType": "",
    "isDropped": false,
    "isTreasure": false,
    "specialAbilities": [],
    "spells": [],
    "conditions": [],
    "unidentifiedName": "",
    "unidentifiedDesc": "",
    "isIdentified": true,
    "isCursed": false,
    "damageRoll": "1d4",
    "damageLabel": "1d4",
    "damageType": "physical",
    "breath": null,
    "canMelee": true,
    "canRanged": true,
    "canSet": false,
    "isSlow": false,
    "savingThrow": null,
    "saveDmgFormula": null,
    "mastery": "Dagger",
    "weaponType": "handheld",
    "ammoType": "",
    "range": { "short": 10, "medium": 20, "long": 30, "min": 0 },
    "size": "S",
    "grip": "1H",
    "natural": false,
    "mod": { "dmg": 0, "toHit": 0, "dmgRanged": 0, "toHitRanged": 0, "rangeMultiplier": 1, "vsGroup": {} }
  },
  "effects": [],
  "ownership": { "default": 0 },
  "flags": {},
  "_stats": { "coreVersion": "13.347", "systemId": "fantastic-depths" },
  "sort": 100000,
  "_originalKey": "!items!OFQFxbNVm1qvEG9t"
}
```

- [ ] **Step 3: Criar `packsrc/items/Equipment/Adventuring_Gear/Backpack.json`**

```json
{
  "folder": "vItxVSiPb4vq0Mmc",
  "name": "Backpack",
  "type": "item",
  "_id": "76wpz7XNkzVnoDNA",
  "img": "icons/svg/item-bag.svg",
  "system": {
    "tags": ["container", "equippable"],
    "description": "<p>A leather or canvas backpack with shoulder straps for carrying things while leaving the hands free. Holds up to 40 lb.</p>",
    "gm": { "notes": "" },
    "quantity": 1,
    "quantityMax": 0,
    "charges": 0,
    "chargesMax": 0,
    "weight": 20,
    "weightEquipped": 20,
    "cost": 5,
    "totalWeight": 0,
    "totalCost": 0,
    "containerId": "",
    "equipped": false,
    "container": true,
    "isOpen": false,
    "equippable": true,
    "fuelType": "",
    "isDropped": false,
    "isTreasure": false,
    "specialAbilities": [],
    "spells": [],
    "conditions": [],
    "unidentifiedName": "",
    "unidentifiedDesc": "",
    "isIdentified": true,
    "isCursed": false
  },
  "effects": [],
  "ownership": { "default": 0 },
  "flags": {},
  "_stats": { "coreVersion": "13.347", "systemId": "fantastic-depths" },
  "sort": 100000,
  "_originalKey": "!items!76wpz7XNkzVnoDNA"
}
```

- [ ] **Step 4: Criar `packsrc/items/Equipment/Adventuring_Gear/Torch.json`**

```json
{
  "folder": "vItxVSiPb4vq0Mmc",
  "name": "Torch",
  "type": "light",
  "_id": "SXOmd7QGXpp5LgsB",
  "img": "icons/svg/item-bag.svg",
  "system": {
    "tags": ["light-source"],
    "description": "<p>A 1’ to 2’ length of wood dipped in pitch or tallow. Gives off light in a 30’ radius and burns for one hour.</p>",
    "gm": { "notes": "" },
    "quantity": 1,
    "quantityMax": 0,
    "charges": 0,
    "chargesMax": 0,
    "weight": 5,
    "weightEquipped": 5,
    "cost": 0.2,
    "totalWeight": 0,
    "totalCost": 0,
    "containerId": "",
    "equipped": false,
    "container": false,
    "isOpen": false,
    "equippable": true,
    "fuelType": "wood",
    "isDropped": false,
    "isTreasure": false,
    "specialAbilities": [],
    "spells": [],
    "conditions": [],
    "unidentifiedName": "",
    "unidentifiedDesc": "",
    "isIdentified": true,
    "isCursed": false,
    "isLight": true,
    "light": {
      "enabled": false,
      "type": "torch",
      "duration": 6,
      "radius": 30,
      "fuelType": "wood",
      "secondsRemain": 0,
      "bright": 6,
      "color": "#d0a750",
      "attenuation": 0.7,
      "luminosity": 0.5,
      "angle": 360,
      "animation": { "type": "torch", "speed": 2, "intensity": 3 }
    }
  },
  "effects": [],
  "ownership": { "default": 0 },
  "flags": {},
  "_stats": { "coreVersion": "13.347", "systemId": "fantastic-depths" },
  "sort": 200000,
  "_originalKey": "!items!SXOmd7QGXpp5LgsB"
}
```

- [ ] **Step 5: Criar os diretórios vazios dos packs ainda sem conteúdo**

Run:
```bash
mkdir -p packsrc/actors packsrc/macros packsrc/rollTables
touch packsrc/actors/.gitkeep packsrc/macros/.gitkeep packsrc/rollTables/.gitkeep
```

Estes packs são declarados no `module.json` (Task 5) mas ficam vazios até
as fases que tratam de bestiário, tabelas e macros. `npm run comppacks`
(Task 8) precisa que os diretórios existam para compilar um pack vazio
válido em vez de falhar.

- [ ] **Step 6: Rodar o validador e confirmar zero erros**

Run: `npm run validate`
Expected:
```
✓ actors: 0 document(s), no errors
✓ items: 3 document(s), no errors
✓ macros: 0 document(s), no errors
✓ rollTables: 0 document(s), no errors

validate: all packs OK
```

- [ ] **Step 7: Commit**

```bash
git add packsrc
git commit -m "feat: hand-written Dagger, Backpack, and Torch items from Dark Dungeons ch.6/9

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Verificação de ponta a ponta do ciclo de build

**Files:**
- Nenhum arquivo novo — esta tarefa só executa comandos e verifica o
  resultado.

**Interfaces:**
- Consumes: `npm run comppacks` (Task 2), `packsrc/items` (Task 7).
- Produces: `packs/items` (LevelDB, gitignored) — a prova de que o pipeline
  funciona de ponta a ponta.

- [ ] **Step 1: Rodar o ciclo completo de compilação**

Run: `npm run comppacks`
Expected: a saída inclui, nesta ordem, `validate: all packs OK`, depois
`✓ Successfully compiled items` (e `actors`, `macros`, `rollTables`), depois
`Wrote 3 entries to Level store at .../packs/items` (e `Wrote 0 entries...`
para os outros três). É esperado e não é falha ver
`✗ Failed to compile journals: ...` e `✗ Failed to compile scenes: ...` —
esses dois packs nunca foram declarados no `module.json` e não têm
`packsrc/journals` nem `packsrc/scenes`; `dbConvert`/`LdbActions` tratam
pacotes ausentes como aviso por pacote, não como falha do comando.

- [ ] **Step 2: Confirmar que o LevelDB de items tem exatamente 3 documentos com os nomes certos**

Run:
```bash
node --input-type=module -e "
import { Level } from 'level';
const db = new Level('packs/items', { valueEncoding: 'utf8' });
const names = [];
for await (const [key, value] of db.iterator()) {
   names.push(JSON.parse(value).name);
}
await db.close();
const expected = ['Dagger', 'Backpack', 'Torch'].sort();
const actual = names.sort();
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
   console.error('MISMATCH. expected', expected, 'got', actual);
   process.exit(1);
}
console.log('packs/items LevelDB OK:', actual.join(', '));
"
```
Expected: imprime `packs/items LevelDB OK: Backpack, Dagger, Torch` (ordem
alfabética), sem `MISMATCH`.

- [ ] **Step 3: Confirmar que os packs vazios geram LevelDB válido (sem erro ao abrir)**

Run:
```bash
node --input-type=module -e "
import { Level } from 'level';
for (const pack of ['actors', 'macros', 'rollTables']) {
   const db = new Level('packs/' + pack, { valueEncoding: 'utf8' });
   let count = 0;
   for await (const [key] of db.iterator()) { count++; }
   await db.close();
   console.log(pack + ':', count, 'entries');
}
"
```
Expected: imprime `actors: 0 entries`, `macros: 0 entries`, `rollTables: 0 entries`,
sem exceções.

- [ ] **Step 4: Rodar o ciclo inverso (decompilação) e confirmar que os arquivos batem**

Run: `npm run decomppacks`
Expected: recria `packsrc/items/**/*.json` a partir do LevelDB. Depois:

Run: `npm run validate`
Expected: mesmo resultado do Task 7 Step 6 — `items: 3 document(s), no errors`.
Isto prova que o ciclo `packsrc → packs → packsrc` é estável (idempotente o
suficiente para não corromper os dados).

Run: `git status --short packsrc`
Expected: sem diferenças de conteúdo relevante (o `dbConvert.mjs` original
reordena chaves e recalcula `_stats`, então uma diferença puramente de
formatação/ordem é aceitável; uma diferença de **valores** não é — inspecione
com `git diff packsrc` se houver qualquer saída).

- [ ] **Step 5: Se o Step 4 alterou algo além de formatação, reverter e registrar**

Run: `git diff --stat packsrc`
Se houver mudanças de valor inesperadas, rode `git checkout -- packsrc` para
restaurar os arquivos escritos à mão na Task 7, e anote a causa raiz como um
risco na seção 8 do spec antes de prosseguir (não silenciar o problema).
Se a única diferença for ordenação/formatação, não é necessário reverter —
mas rode `git checkout -- packsrc` de qualquer forma para manter os arquivos
exatamente como a Task 7 os deixou (fonte de verdade é o que foi digitado a
mão, não o que o round-trip gerou).

- [ ] **Step 6: Confirmar que nada de build ficou rastreado por engano**

Run: `git status --short`
Expected: `packs/` não aparece (está no `.gitignore` da Task 1); apenas
mudanças esperadas (nenhuma, se o Step 5 já rodou `git checkout`).

Este é o critério de conclusão da Fase 1: o ciclo de build completo roda,
produz um LevelDB correto para os 3 itens, e os packs declarados mas vazios
não quebram o processo. A abertura real dentro do Foundry (arrastar o
módulo para `Data/modules/` e habilitá-lo em um mundo com o sistema
`fantastic-depths` instalado) é uma verificação manual fora do alcance deste
ambiente — deixe-a registrada como próximo passo para o usuário antes de
iniciar a Fase 2.

---

### Task 9: Workflows de release do GitHub Actions

**Files:**
- Create: `.github/workflows/pre-release.yml`
- Create: `.github/workflows/stable-release.yml`

**Interfaces:**
- Consumes: `npm run comppacks` (Task 2), `module.json` com os tokens
  `#{VERSION}#`, `#{URL}#`, `#{MANIFEST}#`, `#{DOWNLOAD}#`, `#{CHANGELOG}#`
  (Task 5).
- Produces: o `.zip` de release publicado no GitHub Releases quando uma
  release é publicada nas branches `main` (pre-release) ou `stable`
  (release estável).

- [ ] **Step 1: Criar `.github/workflows/pre-release.yml`**

```yaml
name: Build and Release fade-retro-compendiums (Pre-Release)

on:
  release:
    types: [published]

permissions:
  contents: write

jobs:
  build:
    if: ${{ github.event.release.target_commitish == 'main' }}
    runs-on: ubuntu-latest
    env:
      VERSION: ${{ github.event.release.tag_name }}

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Substitute Manifest and Download Links For Versioned Ones
        id: sub_manifest_link_version
        uses: cschleiden/replace-tokens@v1
        with:
          files: 'module.json'
        env:
          VERSION: ${{ env.VERSION }}
          URL: https://github.com/${{ github.repository }}
          MANIFEST: https://github.com/${{ github.repository }}/releases/download/${{ env.VERSION }}/module.json
          DOWNLOAD: https://github.com/${{ github.repository }}/releases/download/${{ env.VERSION }}/module.zip
          CHANGELOG: https://github.com/${{ github.repository }}/releases/tag/${{ env.VERSION }}

      - name: Fetch all branches and tags
        run: git fetch --all --tags

      - name: Check if the tag commit is in the main branch
        id: check_main
        run: |
          TAG_COMMIT=$(git rev-parse ${{ env.VERSION }})
          if git merge-base --is-ancestor $TAG_COMMIT origin/main; then
            echo "The tag is in the main branch history."
            echo "is_valid=true" >> $GITHUB_ENV
          else
            echo "The tag (${{ env.VERSION }}) is NOT in the main branch history. Skipping release."
            echo "is_valid=false" >> $GITHUB_ENV
          fi

      - name: Setup Node.js
        if: env.is_valid == 'true'
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        if: env.is_valid == 'true'
        run: npm ci

      - name: Validate and compile packs
        if: env.is_valid == 'true'
        run: npm run comppacks

      - name: Prepare release zip
        if: env.is_valid == 'true'
        run: |
          zip -r module.zip ./* -x '.git*' -x '.github/*' -x 'packsrc/*' -x 'node_modules/*' -x 'scripts/build/*' -x 'scripts/extract/*' -x 'docs/*' -x 'package.json' -x 'package-lock.json' -x '.vscode/*'

      - name: Prepare release notes
        if: env.is_valid == 'true'
        id: prepare_notes
        env:
          RELEASE_BODY: ${{ github.event.release.body }}
        run: |
          {
            echo "## Retro Rules Compendiums for Fantastic Depths — Pre-Release"
            echo
            printf "%s\n" "$RELEASE_BODY"
            echo
            echo "This is a pre-release version."
            echo "To install manually, use this URL:"
            echo "https://github.com/${{ github.repository }}/releases/download/${{ env.VERSION }}/module.json"
          } > release_notes.txt

      - name: Create GitHub pre-release
        if: env.is_valid == 'true'
        uses: ncipollo/release-action@v1
        with:
          allowUpdates: true
          replacesArtifacts: true
          updateOnlyUnreleased: false
          prerelease: true
          tag: ${{ env.VERSION }}
          name: "Pre-Release ${{ env.VERSION }}"
          artifacts: './module.json, ./module.zip'
          bodyfile: release_notes.txt
          token: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 2: Criar `.github/workflows/stable-release.yml`**

```yaml
name: Build and Release fade-retro-compendiums (Stable)

on:
  release:
    types: [published]

permissions:
  contents: write

jobs:
  build:
    if: ${{ github.event.release.target_commitish == 'stable' }}
    runs-on: ubuntu-latest
    env:
      VERSION: ${{ github.event.release.tag_name }}

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Substitute Manifest and Download Links For Versioned Ones
        id: sub_manifest_link_version
        uses: cschleiden/replace-tokens@v1
        with:
          files: 'module.json'
        env:
          VERSION: ${{ env.VERSION }}
          URL: https://github.com/${{ github.repository }}
          MANIFEST: https://github.com/${{ github.repository }}/releases/download/${{ env.VERSION }}/module.json
          DOWNLOAD: https://github.com/${{ github.repository }}/releases/download/${{ env.VERSION }}/module.zip
          CHANGELOG: https://github.com/${{ github.repository }}/releases/tag/${{ env.VERSION }}

      - name: Fetch all branches and tags
        run: git fetch --all --tags

      - name: Check if the tag commit is in the stable branch
        id: check_stable
        run: |
          TAG_COMMIT=$(git rev-parse ${{ env.VERSION }})
          if git merge-base --is-ancestor $TAG_COMMIT origin/stable; then
            echo "The tag is in the stable branch history."
            echo "is_valid=true" >> $GITHUB_ENV
          else
            echo "The tag (${{ env.VERSION }}) is NOT in the stable branch history. Skipping release."
            echo "is_valid=false" >> $GITHUB_ENV
          fi

      - name: Setup Node.js
        if: env.is_valid == 'true'
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        if: env.is_valid == 'true'
        run: npm ci

      - name: Validate and compile packs
        if: env.is_valid == 'true'
        run: npm run comppacks

      - name: Prepare release zip
        if: env.is_valid == 'true'
        run: |
          zip -r module.zip ./* -x '.git*' -x '.github/*' -x 'packsrc/*' -x 'node_modules/*' -x 'scripts/build/*' -x 'scripts/extract/*' -x 'docs/*' -x 'package.json' -x 'package-lock.json' -x '.vscode/*'

      - name: Prepare release notes
        if: env.is_valid == 'true'
        id: prepare_notes
        env:
          RELEASE_BODY: ${{ github.event.release.body }}
        run: |
          {
            echo "## Retro Rules Compendiums for Fantastic Depths — STABLE"
            echo
            printf "%s\n" "$RELEASE_BODY"
            echo
            echo "This is a STABLE version."
            echo "To install manually, use this URL:"
            echo "https://github.com/${{ github.repository }}/releases/download/${{ env.VERSION }}/module.json"
          } > release_notes.txt

      - name: Create GitHub release
        if: env.is_valid == 'true'
        uses: ncipollo/release-action@v1
        with:
          tag: ${{ env.VERSION }}
          name: "Release ${{ env.VERSION }} (STABLE)"
          prerelease: false
          artifacts: './module.json, ./module.zip'
          bodyfile: release_notes.txt
          token: ${{ secrets.GITHUB_TOKEN }}
          allowUpdates: true
          replacesArtifacts: true
          updateOnlyUnreleased: false
          makeLatest: true

      - name: Publish Module to FoundryVTT Website
        if: env.is_valid == 'true' && !github.event.release.unpublished && !github.event.release.prerelease
        uses: cs96and/FoundryVTT-release-package@v1
        with:
          package-token: ${{ secrets.FOUNDRY_PACKAGE_TOKEN }}
          manifest-url: https://github.com/${{ github.repository }}/releases/download/${{ env.VERSION }}/module.json
```

- [ ] **Step 3: Validar a sintaxe YAML dos dois workflows**

Run:
```bash
python3 -c "
import yaml
for f in ['.github/workflows/pre-release.yml', '.github/workflows/stable-release.yml']:
   with open(f) as fh:
      doc = yaml.safe_load(fh)
   assert 'jobs' in doc, f + ': missing jobs'
   assert 'build' in doc['jobs'], f + ': missing jobs.build'
   steps = doc['jobs']['build']['steps']
   assert any(s.get('run') == 'npm run comppacks' for s in steps), f + ': missing comppacks step'
   print(f, 'OK —', len(steps), 'steps')
"
```
Expected: imprime `.github/workflows/pre-release.yml OK — N steps` e o
mesmo para `stable-release.yml`, sem `AssertionError`.

Nota: a chave YAML `on:` é lida pelo PyYAML 1.1 como o booleano `True`, não
como a string `"on"` — por isso o script acima verifica apenas `jobs`, que
não sofre essa ambiguidade.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows
git commit -m "ci: add pre-release and stable-release workflows

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Fim da Fase 1

Ao final da Task 9, o repositório tem: licenciamento correto (MIT para
código, atribuição ORC para conteúdo), scripts de build funcionando,
`module.json` declarando os 4 packs do sistema `fantastic-depths`, um
validador de schema com testes, 3 documentos de Item fiéis ao livro, e
workflows de release prontos (ainda não exercitados contra um repositório
remoto real — isso depende do usuário criar o repositório no GitHub e as
branches `main`/`stable`, fora do escopo desta fase).

Próximo passo: um novo spec/plano para a Fase 2 (extração do PDF —
`scripts/extract/pdf2txt.mjs` com recorte por coluna), conforme a seção 7
do documento de design.
