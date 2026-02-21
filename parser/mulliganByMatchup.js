function mulliganByMatchup(handEval, matchup) {
  if (matchup === "aggro") {
    return {
      keep: handEval.lowCost >= 2,
      reason: "Early game é decisivo"
    };
  }

  if (matchup === "control") {
    return {
      keep: handEval.inkables >= 2,
      reason: "Recursos e consistência > velocidade"
    };
  }

  return {
    keep: handEval.lowCost >= 1 && handEval.inkables >= 2,
    reason: "Mão balanceada"
  };
}
