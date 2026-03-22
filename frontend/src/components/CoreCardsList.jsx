import React from 'react';
import { useTranslation } from 'react-i18next';
import './CoreCardsList.css';

const IMPORTANCE_CONFIG = {
  essential: { 
    label: { 'pt-BR': 'Essencial', 'en': 'Essential' },
    color: '#ef4444',
    icon: '⭐'
  },
  core: { 
    label: { 'pt-BR': 'Core', 'en': 'Core' },
    color: '#f59e0b',
    icon: '🔶'
  },
  flex: { 
    label: { 'pt-BR': 'Flex', 'en': 'Flex' },
    color: '#3b82f6',
    icon: '🔷'
  },
  tech: { 
    label: { 'pt-BR': 'Tech', 'en': 'Tech' },
    color: '#8b5cf6',
    icon: '⚙️'
  }
};

const ROLE_LABELS = {
  'finisher': { 'pt-BR': 'Finalizador', 'en': 'Finisher' },
  'removal': { 'pt-BR': 'Remoção', 'en': 'Removal' },
  'card-draw': { 'pt-BR': 'Card Draw', 'en': 'Card Draw' },
  'value': { 'pt-BR': 'Valor', 'en': 'Value' },
  'aggro': { 'pt-BR': 'Aggro', 'en': 'Aggro' },
  'ramp': { 'pt-BR': 'Ramp', 'en': 'Ramp' },
  'evasion': { 'pt-BR': 'Evasão', 'en': 'Evasion' }
};

export default function CoreCardsList({ cards }) {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language;

  // Agrupar por importância
  const groupedCards = {
    essential: cards.filter(c => c.importance === 'essential'),
    core: cards.filter(c => c.importance === 'core'),
    flex: cards.filter(c => c.importance === 'flex'),
    tech: cards.filter(c => c.importance === 'tech')
  };

  return (
    <div className="core-cards-list">
      {Object.entries(groupedCards).map(([importance, cards]) => {
        if (cards.length === 0) return null;

        const config = IMPORTANCE_CONFIG[importance];

        return (
          <div key={importance} className="card-group">
            <div className="group-header">
              <span className="group-icon">{config.icon}</span>
              <h3 className="group-title" style={{ color: config.color }}>
                {config.label[currentLang] || config.label['en']}
              </h3>
              <span className="group-count">{cards.length} {t('archetypePage.cards')}</span>
            </div>

            <div className="cards-grid">
              {cards.map((card, idx) => (
                <div key={idx} className="card-item">
                  <div className="card-qty">{card.qty}x</div>
                  <div className="card-info">
                    <div className="card-name">{card.name}</div>
                    <div className="card-role">
                      {ROLE_LABELS[card.role]?.[currentLang] || 
                       ROLE_LABELS[card.role]?.['en'] || 
                       card.role}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
