function rankRelative(overlapPct, placement) {
  let score = overlapPct;

  if (placement <= 3) score += 10;
  if (placement <= 5) score += 5;

  if (score >= 85) return "Tier S";
  if (score >= 70) return "Tier A";
  if (score >= 55) return "Tier B";
  return "Tier C";
}

module.exports = { rankRelative };
