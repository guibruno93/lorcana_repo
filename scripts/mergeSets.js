// backend/scripts/mergeSets.js
const fs = require("fs");
const path = require("path");

const SCRIPTS_DIR = __dirname; // onde ficam setdata.N.json
const BACKEND_DIR = path.resolve(__dirname, "..");
const OUTPUT = path.join(BACKEND_DIR, "db", "cards.json");

// Remove / conserta somente trechos que quebram o JSON do setdata (10/11)
function sanitizeSetdataRaw(raw) {
  let s = raw;

  /**
   * 1) Remover SOMENTE o bloco "externalLinks" quando ele estiver quebrado
   *    (ex.: cardmarketUrl truncado "https:" ou ids vazios "cardTraderId": ,)
   *    -> substitui por "externalLinks": {}
   */
  const externalLinksBroken =
    /"externalLinks"\s*:\s*\{[^}]*?(?:"cardTraderId"\s*:\s*,|"cardmarketId"\s*:\s*,|"tcgPlayerId"\s*:\s*,|"cardmarketUrl"\s*:\s*"https:)[^}]*?\}/g;

  s = s.replace(externalLinksBroken, '"externalLinks": {}');

  /**
   * 2) Consertar URLs quebradas do tipo:
   *    "thumbnail": "https:        "varnishMask": ""
   *    ou seja, a string "https:" engoliu o próximo campo.
   *
   * Importante: isso costuma vir "em cadeia" (foilMask -> thumbnail -> varnishMask),
   * então rodamos várias passagens (até estabilizar) pra corrigir tudo.
   */
  const brokenHttpsNextKey = /:\s*"https:\s*"([A-Za-z0-9_]+)"\s*:/g;

  for (let i = 0; i < 10; i++) {
    const prev = s;
    s = s.replace(brokenHttpsNextKey, ': "", "$1":');
    if (s === prev) break;
  }

  /**
   * 3) Consertar casos em que a URL quebrada termina antes de fechar objeto/lista:
   *    "thumbnail": "https:      }
   */
  const brokenHttpsBeforeClose = /:\s*"https:\s*([}\]])/g;
  s = s.replace(brokenHttpsBeforeClose, ': ""$1');

  /**
   * 4) Caso existam IDs vazios (": ,"), trocar por null pra JSON ficar válido.
   */
  s = s.replace(
    /"(cardTraderId|cardmarketId|tcgPlayerId|tcgplayerId)"\s*:\s*,/gi,
    '"$1": null,'
  );

  /**
   * 5) Remover vírgulas finais antes de } ou ]
   */
  s = s.replace(/,\s*([}\]])/g, "$1");

  return s;
}

function safeParseSetdata(filepath) {
  const raw = fs.readFileSync(filepath, "utf8");
  const cleaned = sanitizeSetdataRaw(raw);

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    // Ajuda a debugar se algum setdata específico continuar quebrado
    const dumpPath = filepath + ".CLEANED_PREVIEW.json";
    try {
      fs.writeFileSync(dumpPath, cleaned.slice(0, 250000), "utf8");
    } catch (_) {}
    throw new Error(
      `Falha ao parsear ${path.basename(filepath)}: ${err.message}\nPreview: ${dumpPath}`
    );
  }
}

function normalizeCard(card, setMeta) {
  const setName = setMeta?.name || null;
  const setCode = setMeta?.code || setMeta?.number || null;
  const setNumber = setMeta?.number ?? null;

  const id =
    card.cardIdentifier ||
    card.fullIdentifier ||
    card.id ||
    card.code ||
    null;

  return {
    // identificadores
    id,
    fullIdentifier: card.fullIdentifier ?? null,
    number: card.number ?? null,

    // nomes
    name: card.fullName || card.name || null,
    simpleName: card.simpleName || null,

    // cor/tipo/custo
    color: card.color || card.ink || null,
    ink: card.ink || card.color || null, // mantém compatibilidade
    type: card.type || card.cardType || null,
    subtypes: Array.isArray(card.subtypes) ? card.subtypes : [],

    cost: Number(card.cost ?? card.inkCost ?? 0),
    strength: card.strength ?? null,
    willpower: card.willpower ?? null,
    lore: card.lore ?? null,
    rarity: card.rarity ?? null,

    // lorcana specifics
    inkable: Boolean(card.inkwell ?? card.inkable ?? false),

    // set info (isso é o que vai permitir identificar set 10 e 11 no cards.json)
    set: setName,
    setCode,
    setNumber
  };
}

function mergeSets() {
  const files = fs
    .readdirSync(SCRIPTS_DIR)
    .filter((f) => /^setdata\.\d+\.json$/i.test(f))
    .sort((a, b) => {
      const na = Number(a.match(/\d+/)?.[0] ?? 0);
      const nb = Number(b.match(/\d+/)?.[0] ?? 0);
      return na - nb;
    });

  if (!files.length) {
    console.error("❌ Nenhum arquivo setdata.N.json encontrado em:", SCRIPTS_DIR);
    process.exit(1);
  }

  const byKey = new Map();
  let totalRead = 0;

  for (const file of files) {
    const fp = path.join(SCRIPTS_DIR, file);
    console.log(`📦 Lendo ${file}...`);

    let set;
    try {
      set = safeParseSetdata(fp);
    } catch (e) {
      console.warn(`⚠️ Pulando ${file}: ${e.message}`);
      continue;
    }

    const cards = Array.isArray(set.cards) ? set.cards : [];
    totalRead += cards.length;

    for (const card of cards) {
      const c = normalizeCard(card, set);
      if (!c.name) continue;

      const key = String(
        c.id ?? c.fullIdentifier ?? `${c.setCode}-${c.number}-${c.name}`
      ).toLowerCase();

      if (byKey.has(key)) continue;
      byKey.set(key, c);
    }
  }

  const merged = Array.from(byKey.values()).sort((a, b) => {
    const sa = Number(a.setNumber ?? 999);
    const sb = Number(b.setNumber ?? 999);
    if (sa !== sb) return sa - sb;

    const na = Number(a.number ?? 9999);
    const nb = Number(b.number ?? 9999);
    if (na !== nb) return na - nb;

    return String(a.name).localeCompare(String(b.name));
  });

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(merged, null, 2), "utf8");

  console.log(`✅ cards.json atualizado: ${merged.length} cards (lidos ${totalRead})`);
  console.log(`📄 Saída: ${OUTPUT}`);
}

mergeSets();
