import React, { useState, useEffect } from 'react';
import './HandAnalyzer.css';

const HandAnalyzer = ({ decklist }) => {
  const [hand, setHand] = useState(Array(7).fill(''));
  const [analysis, setAnalysis] = useState(null);
  const [mulligan, setMulligan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shuffling, setShuffling] = useState(false);
  const [strategy, setStrategy] = useState(null);

  // Auto-load strategy when decklist changes
  useEffect(() => {
    if (decklist && decklist.trim()) {
      loadStrategy();
    }
  }, [decklist]);

  // Load strategy
  const loadStrategy = async () => {
    if (!decklist || !decklist.trim()) {
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/ai/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decklist }),
      });

      if (!response.ok) {
        throw new Error('Failed to load strategy');
      }

      const data = await response.json();
      setStrategy(data);
    } catch (err) {
      console.error('Strategy load error:', err);
    }
  };

  // Shuffle hand from deck
  const handleShuffle = async () => {
    if (!decklist || !decklist.trim()) {
      setError('Please enter a decklist first');
      return;
    }

    setShuffling(true);
    setError('');
    setAnalysis(null);
    setMulligan(null);

    try {
      const response = await fetch('http://localhost:5000/api/ai/shuffle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decklist }),
      });

      if (!response.ok) {
        throw new Error('Shuffle failed');
      }

      const data = await response.json();
      setHand(data.hand);
    } catch (err) {
      setError(`Shuffle error: ${err.message}`);
    } finally {
      setShuffling(false);
    }
  };

  // Analyze hand
  const handleAnalyze = async () => {
    if (!decklist || !decklist.trim()) {
      setError('Please enter a decklist first');
      return;
    }

    const filledHand = hand.filter(c => c && c.trim());
    if (filledHand.length !== 7) {
      setError('Please fill all 7 card slots or use Shuffle');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Analyze hand
      const handResponse = await fetch('http://localhost:5000/api/ai/analyze-hand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hand: filledHand, decklist }),
      });

      if (!handResponse.ok) {
        throw new Error('Hand analysis failed');
      }

      const handData = await handResponse.json();
      setAnalysis(handData);

      // Get mulligan advice
      const mulliganResponse = await fetch('http://localhost:5000/api/ai/mulligan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hand: filledHand, decklist }),
      });

      if (mulliganResponse.ok) {
        const mulliganData = await mulliganResponse.json();
        setMulligan(mulliganData);
      }
    } catch (err) {
      setError(`Analysis error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Simulate mulligan - replace suggested cards
  const handleSimulateMulligan = async () => {
    if (!mulligan || !mulligan.suggestions) {
      return;
    }

    setShuffling(true);
    setError('');

    try {
      // Get indices of cards to mulligan
      const mulliganIndices = mulligan.suggestions
        .map((s, index) => s.action === 'Mulligan' ? index : -1)
        .filter(i => i >= 0);

      const response = await fetch('http://localhost:5000/api/ai/simulate-mulligan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hand,
          mulligan: mulliganIndices,
          decklist,
        }),
      });

      if (!response.ok) {
        throw new Error('Mulligan simulation failed');
      }

      const data = await response.json();
      setHand(data.hand);
      
      // Clear analysis to force re-analysis
      setAnalysis(null);
      setMulligan(null);
    } catch (err) {
      setError(`Mulligan error: ${err.message}`);
    } finally {
      setShuffling(false);
    }
  };

  // Clear hand
  const handleClear = () => {
    setHand(Array(7).fill(''));
    setAnalysis(null);
    setMulligan(null);
    setError('');
  };

  return (
    <div className="hand-analyzer">
      <div className="hand-analyzer-header">
        <h2>🎴 Opening Hand Analyzer</h2>
        <p className="subtitle">
          {strategy ? (
            <>
              <strong>{strategy.archetype?.name || 'Unknown Deck'}</strong>
              {' - '}
              <span className="strategy-type">{strategy.archetype?.type || 'Unknown Strategy'}</span>
            </>
          ) : (
            'Analyze your 7-card opening hand and get mulligan advice'
          )}
        </p>
      </div>

      {/* Strategy Quick View */}
      {strategy && strategy.archetype && (
        <div className="strategy-banner">
          <div className="strategy-info">
            <span className="strategy-label">Strategy:</span>
            <span className="strategy-desc">{strategy.archetype.strategy}</span>
          </div>
          <div className="strategy-info">
            <span className="strategy-label">Win Condition:</span>
            <span className="strategy-desc">{strategy.archetype.winCondition}</span>
          </div>
        </div>
      )}

      {/* Hand Input */}
      <div className="hand-input-section">
        <div className="hand-cards-grid">
          {hand.map((card, index) => (
            <div key={index} className="hand-card-slot">
              <label>CARD {index + 1}</label>
              <input
                type="text"
                value={card}
                onChange={(e) => {
                  const newHand = [...hand];
                  newHand[index] = e.target.value;
                  setHand(newHand);
                }}
                placeholder={`Card ${index + 1}`}
                className="hand-card-input"
              />
            </div>
          ))}
        </div>

        <div className="hand-actions">
          <button
            onClick={handleShuffle}
            disabled={shuffling || !decklist}
            className="btn btn-shuffle"
          >
            🔀 {shuffling ? 'Shuffling...' : 'Shuffle Hand'}
          </button>

          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="btn btn-primary btn-analyze"
          >
            🔬 {loading ? 'Analyzing...' : 'Analyze Hand'}
          </button>

          <button
            onClick={handleClear}
            className="btn btn-secondary"
          >
            🗑️ Clear
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      {/* Analysis Results */}
      {analysis && (
        <div className="hand-analysis-results">
          {/* Score Card */}
          <div className="score-card">
            <div className="score-main">
              <div className="score-number" style={{
                color: analysis.score >= 70 ? '#10b981' : analysis.score >= 55 ? '#f59e0b' : '#ef4444'
              }}>
                {analysis.score}
              </div>
              <div className="score-label">Score</div>
            </div>
            <div className="score-details">
              <div className="score-rating">
                <span className={`rating-badge rating-${analysis.rating.toLowerCase().replace(' ', '-')}`}>
                  {analysis.rating}
                </span>
              </div>
              <div className="score-verdict">
                <strong>{analysis.verdict?.decision || 'Unknown'}</strong>
                <span className="verdict-confidence">
                  {Math.round((analysis.verdict?.confidence || 0) * 100)}% confident
                </span>
              </div>
              {analysis.verdict?.reasons && (
                <div className="verdict-reasons">
                  {analysis.verdict.reasons.map((reason, i) => (
                    <span key={i} className="reason-tag">{reason}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Analysis Grid */}
          <div className="analysis-grid">
            <div className="analysis-section">
              <h3>📈 Curve</h3>
              <div className="analysis-content">
                <div className="stat-row">
                  <span>Average Cost:</span>
                  <strong>{analysis.analysis.curve.avgCost}</strong>
                </div>
                <div className="stat-row">
                  <span>Turn 1 Play:</span>
                  <strong>{analysis.analysis.curve.hasTurn1 ? '✅ Yes' : '❌ No'}</strong>
                </div>
                <div className="stat-row">
                  <span>Turn 2 Play:</span>
                  <strong>{analysis.analysis.curve.hasTurn2 ? '✅ Yes' : '❌ No'}</strong>
                </div>
                <div className="stat-row">
                  <span>Turn 3 Play:</span>
                  <strong>{analysis.analysis.curve.hasTurn3 ? '✅ Yes' : '❌ No'}</strong>
                </div>
              </div>
            </div>

            <div className="analysis-section">
              <h3>💧 Ink</h3>
              <div className="analysis-content">
                <div className="stat-row">
                  <span>Inkable Cards:</span>
                  <strong>{analysis.analysis.ink.inkableCount} / 7</strong>
                </div>
                <div className="stat-row">
                  <span>Ink Ratio:</span>
                  <strong>{analysis.analysis.ink.inkableRatio}%</strong>
                </div>
                <div className="stat-row">
                  <span>Non-Inkable:</span>
                  <strong>{analysis.analysis.ink.nonInkableCount}</strong>
                </div>
                <p className="recommendation">
                  {analysis.analysis.ink.recommendation}
                </p>
              </div>
            </div>

            <div className="analysis-section">
              <h3>⚡ Playability</h3>
              <div className="analysis-content">
                <div className="stat-row">
                  <span>Turn 1 Cards:</span>
                  <strong>{analysis.analysis.playability.turn1}</strong>
                </div>
                <div className="stat-row">
                  <span>Turn 2 Cards:</span>
                  <strong>{analysis.analysis.playability.turn2}</strong>
                </div>
                <div className="stat-row">
                  <span>Turn 3 Cards:</span>
                  <strong>{analysis.analysis.playability.turn3}</strong>
                </div>
                <p className="recommendation">
                  {analysis.analysis.playability.description}
                </p>
              </div>
            </div>

            <div className="analysis-section">
              <h3>🔗 Synergies</h3>
              <div className="analysis-content">
                {analysis.analysis.synergies && analysis.analysis.synergies.length > 0 ? (
                  analysis.analysis.synergies.map((syn, i) => (
                    <div key={i} className="synergy-item">
                      <strong>{syn.cards.join(' + ')}</strong>
                      <p>{syn.description}</p>
                      <div className="synergy-strength">
                        Strength: {Math.round(syn.strength * 100)}%
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="no-synergies">No notable synergies detected</p>
                )}
              </div>
            </div>
          </div>

          {/* Mulligan Advice */}
          {mulligan && (
            <div className="mulligan-section">
              <div className="mulligan-header">
                <h3>🔄 Mulligan Advice</h3>
                {strategy && (
                  <div className="strategy-priorities">
                    <strong>Strategy Priorities:</strong>
                    {mulligan.strategy?.priorities?.map((p, i) => (
                      <span key={i} className="priority-tag">{p}</span>
                    ))}
                  </div>
                )}
              </div>

              <div className="mulligan-decision">
                <div className="decision-badge">
                  {mulligan.decision}
                </div>
                <p className="decision-reasoning">{mulligan.reasoning}</p>
                {mulligan.expectedImprovement > 0 && (
                  <p className="improvement">
                    Expected improvement: +{mulligan.expectedImprovement}% better hand
                  </p>
                )}
              </div>

              <div className="mulligan-cards-grid">
                <div className="mulligan-keep">
                  <h4>✅ Keep</h4>
                  {mulligan.keepCards?.map((card, i) => (
                    <div key={i} className="mulligan-card keep">
                      {card}
                    </div>
                  ))}
                </div>

                <div className="mulligan-swap">
                  <h4>❌ Mulligan</h4>
                  {mulligan.mulliganCards?.map((card, i) => (
                    <div key={i} className="mulligan-card mulligan">
                      {card}
                    </div>
                  ))}
                </div>
              </div>

              {mulligan.suggestions && mulligan.suggestions.some(s => s.action === 'Mulligan') && (
                <div className="mulligan-simulate">
                  <button
                    onClick={handleSimulateMulligan}
                    disabled={shuffling}
                    className="btn btn-primary"
                  >
                    🔀 {shuffling ? 'Simulating...' : 'Simulate Mulligan'}
                  </button>
                  <p className="simulate-hint">
                    This will replace the suggested cards with new random draws
                  </p>
                </div>
              )}

              {/* Detailed Suggestions */}
              {mulligan.suggestions && (
                <details className="suggestions-details">
                  <summary>View Detailed Card Analysis</summary>
                  <div className="suggestions-list">
                    {mulligan.suggestions.map((sug, i) => (
                      <div key={i} className={`suggestion-item ${sug.action.toLowerCase()}`}>
                        <div className="suggestion-header">
                          <strong>{sug.card}</strong>
                          <span className={`action-badge ${sug.action.toLowerCase()}`}>
                            {sug.action}
                          </span>
                        </div>
                        <div className="suggestion-details">
                          <span className="cost">Cost: {sug.cost}</span>
                          {sug.inkable && <span className="inkable-tag">Inkable</span>}
                          {sug.priority > 0 && (
                            <span className={`priority-badge priority-${sug.priority}`}>
                              Priority {sug.priority}
                            </span>
                          )}
                        </div>
                        <div className="suggestion-reasons">
                          {sug.reasons.map((reason, j) => (
                            <span key={j} className="reason-tag">{reason}</span>
                          ))}
                        </div>
                        {sug.alternatives && sug.alternatives.length > 0 && (
                          <div className="suggestion-alternatives">
                            <strong>Look for:</strong>
                            {sug.alternatives.map((alt, j) => (
                              <span key={j} className="alt-tag">{alt}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HandAnalyzer;
