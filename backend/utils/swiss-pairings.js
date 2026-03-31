'use strict';

/**
 * Pairings estilo Swiss simplificados: ordena por pontos, emparelha de cima para baixo,
 * evita repetir confrontos diretos quando possível.
 */

function hasPlayedBefore(p1, p2, history) {
  const a = String(p1.id);
  const b = String(p2.id);
  const set = history.get(a);
  return set && set.has(b);
}

function recordPlayed(p1, p2, history) {
  const a = String(p1.id);
  const b = String(p2.id);
  if (!history.has(a)) history.set(a, new Set());
  if (!history.has(b)) history.set(b, new Set());
  history.get(a).add(b);
  history.get(b).add(a);
}

/**
 * @param {Array<{id:string, points:number}>} players
 * @param {number} roundNumber
 * @param {Map<string, Set<string>>} matchHistory - ids que já jogaram entre si
 * @returns {Array<{table:number, player1:object, player2:object|null, bye?:boolean}>}
 */
function generateSwissPairings(players, roundNumber, matchHistory) {
  const history = matchHistory || new Map();
  const sorted = [...players].sort((a, b) => (b.points || 0) - (a.points || 0));

  const pairings = [];
  const paired = new Set();
  let table = 1;

  for (let i = 0; i < sorted.length; i++) {
    const p1 = sorted[i];
    if (paired.has(p1.id)) continue;

    let opponent = null;
    for (let j = i + 1; j < sorted.length; j++) {
      const p2 = sorted[j];
      if (paired.has(p2.id)) continue;
      if (!hasPlayedBefore(p1, p2, history)) {
        opponent = p2;
        break;
      }
    }

    if (!opponent) {
      for (let j = i + 1; j < sorted.length; j++) {
        const p2 = sorted[j];
        if (paired.has(p2.id)) continue;
        opponent = p2;
        break;
      }
    }

    if (opponent) {
      pairings.push({
        table,
        player1: p1,
        player2: opponent,
        round: roundNumber,
      });
      paired.add(p1.id);
      paired.add(opponent.id);
      recordPlayed(p1, opponent, history);
      table += 1;
    }
  }

  const unpaired = sorted.filter((p) => !paired.has(p.id));
  if (unpaired.length === 1) {
    pairings.push({
      table: 'Bye',
      player1: unpaired[0],
      player2: null,
      bye: true,
      round: roundNumber,
    });
  }

  return pairings;
}

module.exports = { generateSwissPairings, hasPlayedBefore };
