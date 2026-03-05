// backend/scripts/enrichCardsDbFromSetData.js
const fs = require("fs");
const path = require("path");

/**
 * Seus setdata.*.json podem ter:
 * - comentários //...
 * - trailing commas antes de } ou ]
 * Então parseamos de forma tolerante.
 */
function readJsonLenient(filePath) {
  let txt = fs.readFileSync(filePath, "utf-8");
  // remove BOM
  txt = txt.replace(/^\uFEFF/, "");
  // remove linhas //comentário
  txt = txt.replace(/^\s*\/\/.*$/gm, "");
  // remove trailing commas: , }  e , ]
  txt = txt.replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(txt);
}

function asArray(x) {
  return Array.isArray(x) ? x : [];
}

function isFilled(v) {
  if (v === undefined || v === null) return false;
  if (typeof v === "string" && v.trim() === "") return false;
  if (Array.isArray(v) && v.length === 0) return false;
  return true;
}

function parseArgs(argv) {
  const out = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
    else if (a === "--force") out.force = true;
  }
  return out;
}

function findSetDataFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const items = fs.readdirSync(dir);
  return items
    .filter((f) => /^setdata\.\d+\.json$/i.test(f))
    .map((f) => path.join(dir, f))
    .sort((a, b) => {
      const na = Number((a.match(/setdata\.(\d+)\.json/i) || [])[1] || 0);
      const nb = Number((b.match(/setdata\.(\d+)\.json/i) || [])[1] || 0);
      return na - nb;
    });
}

function deriveSetNameFromCardmarketUrl(cardmarketUrl) {
  // .../Products/Singles/<SET-NAME>/<CARD>?language=1
  try {
    const u = new URL(cardmarketUrl);
    const parts = u.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => p === "Singles");
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1]; // ex: "Shimmering-Skies"
  } catch {
    // ignore
  }
  return null;
}

function main() {
  const args = parseArgs(process.argv);

  const cardsDbPath = args.cardsDb
    ? path.resolve(args.cardsDb)
    : path.join(__dirname, "../db/cards.json");

  const setdataDir =
    args.setdataDir
      ? path.resolve(args.setdataDir)
      : null;

  const candidateDirs = [
    setdataDir,
    path.join(__dirname, "../data"),
    path.join(__dirname, "../data/sets"),
    path.join(__dirname, "../scripts") // se você guardou aí
  ].filter(Boolean);

  let setFiles = [];
  let usedDir = null;

  for (const d of candidateDirs) {
    const found = findSetDataFiles(d);
    if (found.length) {
      setFiles = found;
      usedDir = d;
      break;
    }
  }

  if (!setFiles.length) {
    throw new Error(
      [
        "Nenhum setdata.N.json encontrado.",
        "Passe explicitamente: --setdataDir=CAMINHO",
        "Caminhos tentados:",
        ...candidateDirs.map((d) => `- ${d}`)
      ].join("\n")
    );
  }

  if (!fs.existsSync(cardsDbPath)) throw new Error(`cards.json não encontrado em: ${cardsDbPath}`);
  const cardsDb = JSON.parse(fs.readFileSync(cardsDbPath, "utf-8"));
  if (!Array.isArray(cardsDb)) throw new Error("cards.json inválido (esperado array)");

  console.log("=== Enrich cards.json com setCode/setName via setdata ===");
  console.log("cardsDb:", cardsDbPath);
  console.log("setdataDir:", usedDir);
  console.log("setFiles:", setFiles.length);

  // mapa por code (code é 100% no seu DB)
  const codeToSet = new Map();

  for (const fp of setFiles) {
    const sd = readJsonLenient(fp);

    // Alguns setdata têm meta no topo; mas se não tiver, derivamos do conteúdo.
    const setCode = isFilled(sd.code)
      ? String(sd.code)
      : null;

    const setName = isFilled(sd.name)
      ? String(sd.name)
      : null;

    for (const c of asArray(sd.cards)) {
      const code = c?.code != null ? String(c.code) : null;
      if (!code) continue;

      // fallback de setName: usa cardmarketUrl se precisar
      const inferredName = setName || deriveSetNameFromCardmarketUrl(c?.externalLinks?.cardmarketUrl);

      // fallback de setCode: usa final do fullIdentifier "... • <N>"
      let inferredCode = setCode;
      if (!inferredCode && typeof c?.fullIdentifier === "string") {
        const m = c.fullIdentifier.match(/\u2022\s*(\d+)\s*$/); // "• 6"
        if (m) inferredCode = String(m[1]);
      }

      if (!codeToSet.has(code)) {
        codeToSet.set(code, {
          setCode: inferredCode || null,
          setName: inferredName || null
        });
      }
    }
  }

  let updated = 0;
  let missing = 0;
  let mismatched = 0;

  const force = Boolean(args.force);

  const enriched = cardsDb.map((c) => {
    const code = c?.code != null ? String(c.code) : null;
    if (!code) return c;

    const meta = codeToSet.get(code);
    if (!meta) {
      missing++;
      return c;
    }

    const next = { ...c };

    // setCode
    if (!isFilled(next.setCode)) {
      if (isFilled(meta.setCode)) {
        next.setCode = meta.setCode;
        updated++;
      }
    } else if (isFilled(meta.setCode) && String(next.setCode) !== String(meta.setCode)) {
      mismatched++;
      if (force) next.setCode = meta.setCode;
    }

    // setName
    if (!isFilled(next.setName)) {
      if (isFilled(meta.setName)) {
        next.setName = meta.setName;
        updated++;
      }
    } else if (isFilled(meta.setName) && String(next.setName) !== String(meta.setName)) {
      mismatched++;
      if (force) next.setName = meta.setName;
    }

    return next;
  });

  const outPath = args.out
    ? path.resolve(args.out)
    : path.join(path.dirname(cardsDbPath), "cards.withSets.json");

  fs.writeFileSync(outPath, JSON.stringify(enriched, null, 2), "utf-8");

  console.log("\n--- Resultado ---");
  console.log("out:", outPath);
  console.log("updated fields (count):", updated);
  console.log("missing mappings:", missing);
  console.log("mismatched existing:", mismatched);
  console.log("\nPróximo passo: rode auditCardsDb.js e, se estiver ok, substitua cards.json pelo gerado.");
}

main();
