// DeckStats.jsx - Estatísticas e visualizações do deck
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import './DeckStats.css';

const DeckStats = ({ deck }) => {
  const { t } = useTranslation();

  // Calculate mana curve
  const curve = useMemo(() => {
    const distribution = Array(11).fill(0);
    let totalCost = 0;
    let totalCards = 0;

    deck.forEach(entry => {
      const cost = Math.min(10, entry.card.ink_cost || 0);
      distribution[cost] += entry.quantity;
      totalCost += (entry.card.ink_cost || 0) * entry.quantity;
      totalCards += entry.quantity;
    });

    return {
      distribution,
      avgCost: totalCards > 0 ? (totalCost / totalCards).toFixed(2) : 0,
      maxCount: Math.max(...distribution)
    };
  }, [deck]);

  // Calculate ink distribution
  const inkDistribution = useMemo(() => {
    const inks = {};
    deck.forEach(entry => {
      const ink = entry.card.ink_type || 'None';
      inks[ink] = (inks[ink] || 0) + entry.quantity;
    });
    return inks;
  }, [deck]);

  // Calculate general stats
  const stats = useMemo(() => {
    const totalCards = deck.reduce((sum, e) => sum + e.quantity, 0);
    const creatures = deck.filter(e => e.card.type === 'Character').reduce((sum, e) => sum + e.quantity, 0);
    const actions = deck.filter(e => e.card.type === 'Action').reduce((sum, e) => sum + e.quantity, 0);
    const items = deck.filter(e => e.card.type === 'Item').reduce((sum, e) => sum + e.quantity, 0);
    
    const inkwellCards = deck.filter(e => e.card.inkwell).reduce((sum, e) => sum + e.quantity, 0);
    const inkwellPercentage = totalCards > 0 ? ((inkwellCards / totalCards) * 100).toFixed(1) : 0;

    return {
      totalCards,
      creatures,
      actions,
      items,
      inkwellCards,
      inkwellPercentage
    };
  }, [deck]);

  const inkColors = {
    'Amber': '#FFB84D',
    'Amethyst': '#9B59B6',
    'Emerald': '#2ECC71',
    'Ruby': '#E74C3C',
    'Sapphire': '#3498DB',
    'Steel': '#95A5A6',
    'None': '#666'
  };

  return (
    <div className="deck-stats">
      <div className="stats-header">
        <h2>📊 {t('deckBuilder.statistics')}</h2>
      </div>

      {/* Mana Curve */}
      <div className="stat-section">
        <h3>{t('deckBuilder.manaCurve')}</h3>
        <div className="curve-chart">
          {curve.distribution.map((count, cost) => (
            <div key={cost} className="curve-bar-container">
              <div
                className={`curve-bar ${count === 0 ? 'empty' : ''}`}
                style={{
                  height: curve.maxCount > 0 ? `${(count / curve.maxCount) * 100}%` : '0%'
                }}
              >
                {count > 0 && <span className="bar-count">{count}</span>}
              </div>
              <div className="bar-label">{cost}</div>
            </div>
          ))}
        </div>
        <div className="curve-info">
          {t('deckBuilder.avgCost')}: <strong>{curve.avgCost}</strong>
        </div>
      </div>

      {/* Ink Distribution */}
      <div className="stat-section">
        <h3>{t('deckBuilder.inkDistribution')}</h3>
        <div className="ink-distribution">
          {Object.entries(inkDistribution).map(([ink, count]) => (
            <div key={ink} className="ink-bar-container">
              <div className="ink-label">{ink}</div>
              <div className="ink-bar-track">
                <div
                  className="ink-bar-fill"
                  style={{
                    width: `${(count / stats.totalCards) * 100}%`,
                    backgroundColor: inkColors[ink]
                  }}
                />
              </div>
              <div className="ink-count">{count}</div>
            </div>
          ))}
        </div>
      </div>

      {/* General Stats */}
      <div className="stat-section">
        <h3>{t('deckBuilder.generalStats')}</h3>
        <div className="general-stats">
          <div className="stat-row">
            <span className="stat-label">{t('deckBuilder.totalCards')}:</span>
            <span className="stat-value">{stats.totalCards}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">{t('deckBuilder.creatures')}:</span>
            <span className="stat-value">{stats.creatures}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">{t('deckBuilder.actions')}:</span>
            <span className="stat-value">{stats.actions}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">{t('deckBuilder.items')}:</span>
            <span className="stat-value">{stats.items}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">{t('deckBuilder.inkwellCards')}:</span>
            <span className="stat-value">
              {stats.inkwellCards} ({stats.inkwellPercentage}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeckStats;
