import React from 'react';
import { useTranslation } from 'react-i18next';
import './ArchetypeOverview.css';
import { INK_COLORS, TIER_CONFIG } from '../data/archetypes';

export default function ArchetypeOverview({ archetype }) {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language;

  return (
    <div className="archetype-overview">
      <div className="overview-header">
        <div className="overview-title-section">
          <h1 className="archetype-title">{archetype.name}</h1>
          <p className="archetype-description">
            {archetype.description[currentLang] || archetype.description['en']}
          </p>
        </div>

        <div className="overview-badges">
          {/* Tier Badge */}
          <div 
            className="tier-badge" 
            style={{ 
              background: `linear-gradient(135deg, ${TIER_CONFIG[archetype.tier].color} 0%, ${TIER_CONFIG[archetype.tier].color}dd 100%)` 
            }}
          >
            <span className="tier-label">{t('archetypePage.tier')}</span>
            <span className="tier-value">{archetype.tier}</span>
          </div>

          {/* Power Level */}
          <div className="power-level-badge">
            <span className="power-label">{t('archetypePage.powerLevel')}</span>
            <div className="power-bar-container">
              <div 
                className="power-bar-fill" 
                style={{ width: `${archetype.powerLevel}%` }}
              ></div>
            </div>
            <span className="power-value">{archetype.powerLevel}</span>
          </div>
        </div>
      </div>

      <div className="overview-stats">
        {/* Inks */}
        <div className="stat-card ink-stat">
          <div className="stat-label">{t('archetypePage.inks')}</div>
          <div className="ink-badges">
            {archetype.inks.map(ink => (
              <div 
                key={ink}
                className="ink-badge"
                style={{ backgroundColor: INK_COLORS[ink] }}
              >
                {ink}
              </div>
            ))}
          </div>
        </div>

        {/* Win Rate */}
        <div className="stat-card">
          <div className="stat-label">{t('archetypePage.winRate')}</div>
          <div className="stat-value win-rate">
            {archetype.winRate}%
          </div>
        </div>

        {/* Play Rate */}
        <div className="stat-card">
          <div className="stat-label">{t('archetypePage.playRate')}</div>
          <div className="stat-value play-rate">
            {archetype.playRate}%
          </div>
        </div>

        {/* Playstyle */}
        <div className="stat-card">
          <div className="stat-label">{t('archetypePage.playstyle')}</div>
          <div className="stat-value playstyle">
            {archetype.playstyle[currentLang] || archetype.playstyle['en']}
          </div>
        </div>
      </div>
    </div>
  );
}
