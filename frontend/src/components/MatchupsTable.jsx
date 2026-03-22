import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './MatchupsTable.css';

const DIFFICULTY_CONFIG = {
  favorable: {
    label: { 'pt-BR': 'Favorável', 'en': 'Favorable' },
    color: '#10b981',
    icon: '✓'
  },
  even: {
    label: { 'pt-BR': 'Equilibrado', 'en': 'Even' },
    color: '#f59e0b',
    icon: '='
  },
  unfavorable: {
    label: { 'pt-BR': 'Desfavorável', 'en': 'Unfavorable' },
    color: '#ef4444',
    icon: '✗'
  }
};

export default function MatchupsTable({ matchups }) {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language;
  const [sortBy, setSortBy] = useState('winRate'); // 'winRate' ou 'opponent'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' ou 'desc'

  // Ordenar matchups
  const sortedMatchups = [...matchups].sort((a, b) => {
    if (sortBy === 'winRate') {
      return sortOrder === 'desc' ? b.winRate - a.winRate : a.winRate - b.winRate;
    } else {
      return sortOrder === 'asc' 
        ? a.opponent.localeCompare(b.opponent)
        : b.opponent.localeCompare(a.opponent);
    }
  });

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  return (
    <div className="matchups-table-container">
      <table className="matchups-table">
        <thead>
          <tr>
            <th 
              onClick={() => handleSort('opponent')}
              className="sortable"
            >
              {t('archetypePage.opponent')}
              {sortBy === 'opponent' && (
                <span className="sort-indicator">
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </span>
              )}
            </th>
            <th 
              onClick={() => handleSort('winRate')}
              className="sortable"
            >
              {t('archetypePage.winRate')}
              {sortBy === 'winRate' && (
                <span className="sort-indicator">
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </span>
              )}
            </th>
            <th>{t('archetypePage.difficulty')}</th>
          </tr>
        </thead>
        <tbody>
          {sortedMatchups.map((matchup, idx) => {
            const config = DIFFICULTY_CONFIG[matchup.difficulty];
            
            return (
              <tr key={idx} className={`matchup-row ${matchup.difficulty}`}>
                <td className="opponent-cell">
                  <span className="opponent-name">{matchup.opponent}</span>
                </td>
                <td className="winrate-cell">
                  <div className="winrate-container">
                    <div className="winrate-bar-bg">
                      <div 
                        className="winrate-bar-fill"
                        style={{ 
                          width: `${matchup.winRate}%`,
                          backgroundColor: config.color
                        }}
                      ></div>
                    </div>
                    <span className="winrate-value">{matchup.winRate}%</span>
                  </div>
                </td>
                <td className="difficulty-cell">
                  <span 
                    className="difficulty-badge"
                    style={{ 
                      backgroundColor: `${config.color}20`,
                      color: config.color,
                      borderColor: config.color
                    }}
                  >
                    <span className="difficulty-icon">{config.icon}</span>
                    {config.label[currentLang] || config.label['en']}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Summary */}
      <div className="matchups-summary">
        <div className="summary-item favorable">
          <span className="summary-label">{DIFFICULTY_CONFIG.favorable.label[currentLang]}</span>
          <span className="summary-count">
            {matchups.filter(m => m.difficulty === 'favorable').length}
          </span>
        </div>
        <div className="summary-item even">
          <span className="summary-label">{DIFFICULTY_CONFIG.even.label[currentLang]}</span>
          <span className="summary-count">
            {matchups.filter(m => m.difficulty === 'even').length}
          </span>
        </div>
        <div className="summary-item unfavorable">
          <span className="summary-label">{DIFFICULTY_CONFIG.unfavorable.label[currentLang]}</span>
          <span className="summary-count">
            {matchups.filter(m => m.difficulty === 'unfavorable').length}
          </span>
        </div>
      </div>
    </div>
  );
}
