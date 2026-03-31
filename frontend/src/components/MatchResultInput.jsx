import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './MatchResultInput.css';

export default function MatchResultInput({
  match,
  player1Name,
  player2Name,
  matchFormat,
  onReportBo1,
  onReportBo3,
  disabled,
}) {
  const { t } = useTranslation();
  const [score, setScore] = useState({ p1: 0, p2: 0 });

  if (matchFormat === 'bo3') {
    const winnerId =
      score.p1 > score.p2 ? match.player1Id : score.p2 > score.p1 ? match.player2Id : null;
    const valid =
      (score.p1 === 2 || score.p2 === 2) &&
      score.p1 <= 2 &&
      score.p2 <= 2 &&
      winnerId;

    const submit = () => {
      if (!valid || !winnerId) return;
      onReportBo3({
        winnerId,
        gamesP1: score.p1,
        gamesP2: score.p2,
      });
    };

    return (
      <div className="match-result-bo3">
        <div className="score-input">
          <div className="player-score">
            <span className="player-name">{player1Name}</span>
            <div className="score-buttons">
              <button type="button" onClick={() => setScore((s) => ({ ...s, p1: Math.max(0, s.p1 - 1) }))}>
                −
              </button>
              <span className="score-value">{score.p1}</span>
              <button type="button" onClick={() => setScore((s) => ({ ...s, p1: Math.min(2, s.p1 + 1) }))}>
                +
              </button>
            </div>
          </div>
          <span className="vs">vs</span>
          <div className="player-score">
            <span className="player-name">{player2Name}</span>
            <div className="score-buttons">
              <button type="button" onClick={() => setScore((s) => ({ ...s, p2: Math.max(0, s.p2 - 1) }))}>
                −
              </button>
              <span className="score-value">{score.p2}</span>
              <button type="button" onClick={() => setScore((s) => ({ ...s, p2: Math.min(2, s.p2 + 1) }))}>
                +
              </button>
            </div>
          </div>
        </div>
        <div className="score-presets">
          <button type="button" onClick={() => setScore({ p1: 2, p2: 0 })}>
            2-0
          </button>
          <button type="button" onClick={() => setScore({ p1: 2, p2: 1 })}>
            2-1
          </button>
          <button type="button" onClick={() => setScore({ p1: 1, p2: 2 })}>
            1-2
          </button>
          <button type="button" onClick={() => setScore({ p1: 0, p2: 2 })}>
            0-2
          </button>
        </div>
        <button
          type="button"
          className="btn-submit-score"
          onClick={submit}
          disabled={disabled || !valid}
        >
          {t('tournamentsOrg.submitResult')}
        </button>
      </div>
    );
  }

  return (
    <div className="match-result-bo1">
      <button
        type="button"
        className="btn-player"
        disabled={disabled}
        onClick={() => onReportBo1({ winnerId: match.player1Id })}
      >
        {t('tournamentsOrg.winFor', { name: player1Name })}
      </button>
      <button type="button" className="btn-player btn-player--draw" disabled={disabled} onClick={() => onReportBo1({ result: 'draw' })}>
        {t('tournamentsOrg.draw')}
      </button>
      <button
        type="button"
        className="btn-player"
        disabled={disabled}
        onClick={() => onReportBo1({ winnerId: match.player2Id })}
      >
        {t('tournamentsOrg.winFor', { name: player2Name })}
      </button>
    </div>
  );
}
