import React from 'react';
import './InkIcons.css';

/** Cores oficiais aproximadas das tintas Lorcana (UI). */
export const INK_HEX = {
  amber: '#FDB022',
  amethyst: '#A855F7',
  emerald: '#10B981',
  ruby: '#EF4444',
  sapphire: '#3B82F6',
  steel: '#94A3B8',
};

const ALIASES = {
  amber: 'amber',
  amethyst: 'amethyst',
  ametista: 'amethyst',
  emerald: 'emerald',
  esmeralda: 'emerald',
  ruby: 'ruby',
  rubi: 'ruby',
  sapphire: 'sapphire',
  safira: 'sapphire',
  steel: 'steel',
  aço: 'steel',
  aco: 'steel',
};

function resolveInkKey(raw) {
  if (raw == null) return null;
  const k = String(raw)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  return ALIASES[k] || null;
}

/** Bolinha de tinta (acessível com title). */
export function InkBadge({ ink, size = 'md' }) {
  const key = resolveInkKey(ink);
  const color = key ? INK_HEX[key] : '#64748b';
  const label = ink || 'Unknown';
  return (
    <span
      className={`ink-badge ink-badge--${size}`}
      style={{ backgroundColor: color }}
      title={label}
      aria-label={label}
      role="img"
    />
  );
}

/** Parte o arquétipo em tintas (/, +, |, " · "). */
export function parseArchetypeInks(archetype) {
  if (archetype == null || String(archetype).trim() === '') return [];
  return String(archetype)
    .split(/\s*[/+|]\s*|\s*·\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Ícones de tinta + texto do arquétipo (ex.: Sapphire/Emerald → 2 badges + string).
 */
export function ArchetypeWithIcons({ archetype, showText = true, size = 'md' }) {
  const parts = parseArchetypeInks(archetype);
  const display = archetype || '—';

  return (
    <span className="archetype-with-icons">
      {parts.length > 0 && (
        <span className="ink-icons-group" aria-hidden={!showText}>
          {parts.map((p, i) => (
            <InkBadge key={`${p}-${i}`} ink={p} size={size} />
          ))}
        </span>
      )}
      {showText && (
        <span className="archetype-with-icons__text">{display}</span>
      )}
    </span>
  );
}

const InkIcons = { InkBadge, ArchetypeWithIcons, parseArchetypeInks, INK_HEX };
export default InkIcons;
