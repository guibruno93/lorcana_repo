import React, { useState, useEffect } from 'react';
import './DesignSystem.css';
import './HandAnalyzer.css';

const HandAnalyzer = ({ decklist }) => {
  const [hand, setHand] = useState(Array(7).fill(''));
  const [analysis, setAnalysis] = useState(null);
  const [mulligan, setMulligan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shuffling, setShuffling] = useState(false);

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
      setError(`❌ Shuffle error: ${err.message}`);
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
      setError('Please fill all 7 card slots or use Shuffle Hand');
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
      setError(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Simulate mulligan
  const handleSimulateMulligan = async () => {
    if (!mulligan || !mulligan.suggestions) {
      return;
    }

    setShuffling(true);
    setError('');

    try {
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
      
      setAnalysis(null);
      setMulligan(null);
    } catch (err) {
      setError(`❌ ${err.message}`);
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
    <div className="hand-analyzer-v3">
      {/* Header */}
      <div className="card mb-4">
        <div className="card-header">
          <h2 className="text-2xl font-bold mb-2">🎴 Opening Hand Analyzer</h2>
          <p className="text-gray-600">
            Shuffle a random hand from your deck and get AI-powered mulligan advice
          </p>
        </div>
      </div>

      {/* Hand Input Grid */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="hand-cards-grid">
            {hand.map((card, index) => (
              <div key={index} className="form-group mb-3">
                <label className="form-label">Card {index + 1}</label>
                <input
                  type="text"
                  value={card}
                  onChange={(e) => {
                    const newHand = [...hand];
                    newHand[index] = e.target.value;
                    setHand(newHand);
                  }}
                  placeholder={`Card ${index + 1}`}
                  className="input"
                />
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleShuffle}
              disabled={shuffling || !decklist}
              className="btn btn-primary flex-1"
            >
              🎲 {shuffling ? 'Shuffling...' : 'Shuffle Hand'}
            </button>

            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="btn btn-success flex-1"
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
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert alert-danger mb-4">
          {error}
        </div>
      )}

      {/* Mulligan Decision (Priority Display) */}
      {mulligan && (
        <div className="card mb-4">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">🔄 Mulligan Decision</h3>
              {mulligan.strategy && (
                <span className="badge badge-primary">
                  {mulligan.strategy.type} Strategy
                </span>
              )}
            </div>
          </div>
          <div className="card-body">
            {/* Decision Badge */}
            <div className={`mulligan-decision-badge ${
              mulligan.decision === 'Keep' ? 'keep' :
              mulligan.decision === 'Partial Mulligan' ? 'partial' :
              'full'
            }`}>
              <div className="decision-label">{mulligan.decision}</div>
              <div className="decision-confidence">
                {Math.round(mulligan.confidence * 100)}% confident
              </div>
            </div>

            {/* Reasoning */}
            <p className="text-gray-700 mb-4">{mulligan.reasoning}</p>

            {/* Strategy Priorities */}
            {mulligan.strategy && mulligan.strategy.priorities && (
              <div className="mb-4">
                <h4 className="font-semibold mb-2 text-gray-700">Strategy Priorities:</h4>
                <div className="flex flex-wrap gap-2">
                  {mulligan.strategy.priorities.map((priority, i) => (
                    <span key={i} className="badge badge-info">
                      {priority}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Expected Improvement */}
            {mulligan.expectedImprovement > 0 && (
              <div className="alert alert-info">
                <strong>Expected Improvement:</strong> +{mulligan.expectedImprovement}% better hand
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mulligan Cards Grid */}
      {mulligan && mulligan.suggestions && (
        <div className="card mb-4">
          <div className="card-header">
            <h3 className="text-xl font-bold">📋 Card-by-Card Analysis</h3>
          </div>
          <div className="card-body">
            <div className="mulligan-suggestions-grid">
              {mulligan.suggestions.map((sug, i) => (
                <div
                  key={i}
                  className={`mulligan-card-item ${sug.action.toLowerCase()}`}
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <strong className="text-sm">{sug.card}</strong>
                      {sug.role && (
                        <span className="badge badge-secondary text-xs">
                          {sug.role}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="cost-badge">{sug.cost}</span>
                      {sug.inkable && (
                        <span className="badge badge-info text-xs">💧 Inkable</span>
                      )}
                    </div>
                  </div>

                  {/* Action Badge */}
                  <div className={`action-badge ${sug.action.toLowerCase()}`}>
                    {sug.action === 'Keep' ? '✅ Keep' : '❌ Mulligan'}
                  </div>

                  {/* Reasons */}
                  <div className="reasons-list">
                    {sug.reasons.map((reason, j) => (
                      <div key={j} className="reason-item">
                        {reason}
                      </div>
                    ))}
                  </div>

                  {/* Effects */}
                  {sug.effects && sug.effects.length > 0 && (
                    <div className="effects-list">
                      {sug.effects.map((effect, j) => (
                        <span key={j} className="badge badge-secondary text-xs">
                          {effect}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Priority */}
                  {sug.priority > 0 && (
                    <div className={`priority-indicator priority-${sug.priority}`}>
                      Priority {sug.priority}
                    </div>
                  )}

                  {/* Alternatives */}
                  {sug.alternatives && sug.alternatives.length > 0 && (
                    <div className="alternatives">
                      <strong className="text-xs">Alternatives:</strong>
                      {sug.alternatives.map((alt, j) => (
                        <p key={j} className="text-xs text-gray-600">{alt}</p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Simulate Mulligan Button */}
            {mulligan.mulliganCards && mulligan.mulliganCards.length > 0 && (
              <div className="mt-4 text-center">
                <button
                  onClick={handleSimulateMulligan}
                  disabled={shuffling}
                  className="btn btn-warning btn-lg"
                >
                  🔄 {shuffling ? 'Simulating...' : `Mulligan ${mulligan.mulliganCards.length} Cards`}
                </button>
                <p className="text-sm text-gray-600 mt-2">
                  This will replace suggested cards with new random draws
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hand Analysis Results */}
      {analysis && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-xl font-bold">📊 Hand Analysis</h3>
          </div>
          <div className="card-body">
            {/* Score */}
            <div className="score-display">
              <div className="score-number" style={{
                color: analysis.score >= 70 ? 'var(--success)' : 
                       analysis.score >= 55 ? 'var(--warning)' : 
                       'var(--danger)'
              }}>
                {analysis.score}
              </div>
              <div className="score-label">/ 100</div>
              <span className={`badge badge-${
                analysis.rating === 'Excellent' || analysis.rating === 'Good' ? 'success' :
                analysis.rating === 'Average' ? 'warning' : 'danger'
              } ml-3`}>
                {analysis.rating}
              </span>
            </div>

            {/* Quick Stats */}
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-label">Avg Cost</div>
                <div className="stat-value">{analysis.analysis?.curve?.avgCost || 'N/A'}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Inkable</div>
                <div className="stat-value">
                  {analysis.analysis?.ink?.inkableCount || 0} / 7
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Playability</div>
                <div className="stat-value">
                  {analysis.analysis?.playability?.description || 'N/A'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HandAnalyzer;
