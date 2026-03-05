import React, { useState, useEffect } from 'react';
import './StrategyView.css';

const StrategyView = ({ decklist }) => {
  const [strategy, setStrategy] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (decklist && decklist.trim()) {
      loadStrategy();
    }
  }, [decklist]);

  const loadStrategy = async () => {
    if (!decklist || !decklist.trim()) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:5000/api/ai/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decklist }),
      });

      if (!response.ok) {
        throw new Error('Strategy analysis failed');
      }

      const data = await response.json();
      setStrategy(data);
    } catch (err) {
      setError(`Strategy error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="strategy-view loading">
        <div className="loader">🔍 Analyzing deck strategy...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="strategy-view error">
        <div className="error-message">❌ {error}</div>
      </div>
    );
  }

  if (!strategy) {
    return (
      <div className="strategy-view empty">
        <p>Enter a decklist to see strategy analysis</p>
      </div>
    );
  }

  const { archetype, keyCards, gamePlan, suggestions, consistency, strengths, weaknesses, confidenceScore } = strategy;

  return (
    <div className="strategy-view">
      {/* Header */}
      <div className="strategy-header">
        <div className="archetype-card">
          <h2>{archetype?.name || 'Unknown Deck'}</h2>
          <div className="archetype-meta">
            <span className={`archetype-type type-${archetype?.type?.toLowerCase()}`}>
              {archetype?.type}
            </span>
            <span className="tempo-badge">
              Tempo: {archetype?.tempo}
            </span>
            <span className="complexity-badge">
              Complexity: {archetype?.complexity}
            </span>
          </div>
          <div className="archetype-details">
            <p><strong>Strategy:</strong> {archetype?.strategy}</p>
            <p><strong>Win Condition:</strong> {archetype?.winCondition}</p>
          </div>
          <div className="confidence-score">
            Analysis Confidence: {confidenceScore}%
          </div>
        </div>
      </div>

      {/* Strengths & Weaknesses */}
      <div className="swot-grid">
        <div className="swot-section strengths">
          <h3>💪 Strengths</h3>
          {strengths && strengths.length > 0 ? (
            strengths.map((s, i) => (
              <div key={i} className={`swot-item impact-${s.impact?.toLowerCase()}`}>
                <div className="swot-header">
                  <strong>{s.aspect}</strong>
                  <span className="impact-badge">{s.impact}</span>
                </div>
                <p>{s.description}</p>
              </div>
            ))
          ) : (
            <p className="empty">No notable strengths identified</p>
          )}
        </div>

        <div className="swot-section weaknesses">
          <h3>⚠️ Weaknesses</h3>
          {weaknesses && weaknesses.length > 0 ? (
            weaknesses.map((w, i) => (
              <div key={i} className={`swot-item impact-${w.impact?.toLowerCase()}`}>
                <div className="swot-header">
                  <strong>{w.aspect}</strong>
                  <span className="impact-badge">{w.impact}</span>
                </div>
                <p>{w.description}</p>
                <p className="solution">💡 {w.solution}</p>
              </div>
            ))
          ) : (
            <p className="empty">No critical weaknesses found</p>
          )}
        </div>
      </div>

      {/* Consistency */}
      {consistency && (
        <div className="consistency-card">
          <h3>🎯 Deck Consistency</h3>
          <div className="consistency-score">
            <div className="score-circle">
              <div className="score-value" style={{
                color: consistency.score >= 70 ? '#10b981' : consistency.score >= 50 ? '#f59e0b' : '#ef4444'
              }}>
                {consistency.score}
              </div>
              <div className="score-label">{consistency.rating}</div>
            </div>
            <div className="consistency-breakdown">
              <div className="breakdown-item">
                <span>4-ofs:</span>
                <strong>{consistency.fourOfs}</strong>
              </div>
              <div className="breakdown-item">
                <span>3-ofs:</span>
                <strong>{consistency.threeOfs}</strong>
              </div>
              <div className="breakdown-item">
                <span>1-ofs:</span>
                <strong>{consistency.oneOfs}</strong>
              </div>
            </div>
          </div>
          <p className="consistency-recommendation">
            💡 {consistency.recommendation}
          </p>
        </div>
      )}

      {/* Key Cards */}
      {keyCards && keyCards.length > 0 && (
        <div className="key-cards-section">
          <h3>🎴 Key Cards</h3>
          <div className="key-cards-grid">
            {keyCards.slice(0, 12).map((card, i) => (
              <div key={i} className={`key-card-item importance-${card.importance?.toLowerCase()}`}>
                <div className="card-header">
                  <strong>{card.name}</strong>
                  <span className="cost-badge">{card.cost}</span>
                </div>
                <div className="card-meta">
                  <span className={`role-badge role-${card.role?.toLowerCase()}`}>
                    {card.role}
                  </span>
                  <span className="quantity">x{card.quantity}</span>
                </div>
                <p className="card-reason">{card.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Game Plan */}
      {gamePlan && (
        <div className="gameplan-section">
          <h3>📋 Game Plan</h3>
          
          <div className="gameplan-grid">
            <div className="gameplan-phase">
              <h4>🌅 Early Game (Turns 1-3)</h4>
              <ul>
                {gamePlan.earlyGame?.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            </div>

            <div className="gameplan-phase">
              <h4>⚡ Mid Game (Turns 4-7)</h4>
              <ul>
                {gamePlan.midGame?.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            </div>

            <div className="gameplan-phase">
              <h4>🏁 Late Game (Turn 8+)</h4>
              <ul>
                {gamePlan.lateGame?.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="gameplan-guides">
            <div className="mulligan-guide">
              <h4>🔄 Mulligan Guide</h4>
              <ul>
                {gamePlan.mulliganGuide?.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </div>

            <div className="key-decisions">
              <h4>🎯 Key Decisions</h4>
              <ul>
                {gamePlan.keyDecisions?.map((decision, i) => (
                  <li key={i}>{decision}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Card Suggestions */}
      {suggestions && suggestions.length > 0 && (
        <div className="suggestions-section">
          <h3>💡 Card Suggestions</h3>
          <p className="suggestions-intro">
            These cards could strengthen your deck based on identified gaps and strategy:
          </p>
          {suggestions.map((sug, i) => (
            <div key={i} className={`suggestion-group priority-${sug.priority?.toLowerCase()}`}>
              <div className="suggestion-header">
                <h4>{sug.category}</h4>
                <span className="priority-badge">{sug.priority} Priority</span>
              </div>
              <div className="suggested-cards">
                {sug.cards?.map((card, j) => (
                  <div key={j} className="suggested-card">
                    <strong>{card.name}</strong>
                    <p>{card.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StrategyView;
