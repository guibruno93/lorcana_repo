import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './ArchetypeList.css';
import { ARCHETYPE_LIST, INK_COLORS, TIER_CONFIG } from '../data/archetypes';

export default function ArchetypeList() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [filter, setFilter] = useState('all'); // 'all', 'S', 'A', 'B', 'C'
  const [sortBy, setSortBy] = useState('tier'); // 'tier', 'winRate', 'playRate', 'name'

  // Filtrar e ordenar
  const filteredArchetypes = ARCHETYPE_LIST
    .filter(arch => filter === 'all' || arch.tier === filter)
    .sort((a, b) => {
      if (sortBy === 'tier') {
        const tierOrder = { 'S': 0, 'A': 1, 'B': 2, 'C': 3 };
        return tierOrder[a.tier] - tierOrder[b.tier];
      } else if (sortBy === 'winRate') {
        return b.winRate - a.winRate;
      } else if (sortBy === 'playRate') {
        return b.playRate - a.playRate;
      } else {
        return a.name.localeCompare(b.name);
      }
    });

  return (
    <div className="archetype-list">
      {/* Filters */}
      <div className="archetype-filters">
        <div className="filter-group">
          <label className="filter-label">{t('archetypePage.filterByTier')}:</label>
          <div className="tier-filters">
            <button
              onClick={() => setFilter('all')}
              className={`tier-filter-btn ${filter === 'all' ? 'active' : ''}`}
            >
              {t('archetypePage.allTiers')}
            </button>
            {['S', 'A', 'B', 'C'].map(tier => (
              <button
                key={tier}
                onClick={() => setFilter(tier)}
                className={`tier-filter-btn ${filter === tier ? 'active' : ''}`}
                style={filter === tier ? { 
                  backgroundColor: `${TIER_CONFIG[tier].color}20`,
                  borderColor: TIER_CONFIG[tier].color,
                  color: TIER_CONFIG[tier].color
                } : {}}
              >
                {tier}
              </button>
            ))}
          </div>
        </div>

        <div className="sort-group">
          <label className="filter-label">{t('archetypePage.sortBy')}:</label>
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="sort-select"
          >
            <option value="tier">{t('archetypePage.tier')}</option>
            <option value="winRate">{t('archetypePage.winRate')}</option>
            <option value="playRate">{t('archetypePage.playRate')}</option>
            <option value="name">{t('archetypePage.name')}</option>
          </select>
        </div>
      </div>

      {/* Archetype Grid */}
      <div className="archetype-grid">
        {filteredArchetypes.map(archetype => (
          <div
            key={archetype.id}
            className="archetype-card"
            onClick={() => navigate(`/archetype/${archetype.id}`)}
          >
            <div className="archetype-card-header">
              <h3 className="archetype-card-name">{archetype.name}</h3>
              <div 
                className="archetype-tier-badge"
                style={{ backgroundColor: TIER_CONFIG[archetype.tier].color }}
              >
                {archetype.tier}
              </div>
            </div>

            <div className="archetype-card-inks">
              {archetype.inks.map(ink => (
                <div
                  key={ink}
                  className="archetype-ink-dot"
                  style={{ backgroundColor: INK_COLORS[ink] }}
                  title={ink}
                ></div>
              ))}
            </div>

            <div className="archetype-card-stats">
              <div className="archetype-stat">
                <div className="stat-label">{t('archetypePage.winRate')}</div>
                <div className="stat-value win-rate">{archetype.winRate}%</div>
              </div>
              <div className="archetype-stat">
                <div className="stat-label">{t('archetypePage.playRate')}</div>
                <div className="stat-value play-rate">{archetype.playRate}%</div>
              </div>
            </div>

            <div className="archetype-card-footer">
              <button className="view-details-btn">
                {t('archetypePage.viewDetails')} →
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredArchetypes.length === 0 && (
        <div className="empty-archetypes">
          <p>{t('archetypePage.noArchetypes')}</p>
        </div>
      )}
    </div>
  );
}
