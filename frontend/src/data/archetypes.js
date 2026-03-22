// Mock data para desenvolvimento - Arquétipos de Lorcana
// Este arquivo será substituído por chamadas de API depois

export const ARCHETYPES = {
  'ruby-amethyst': {
    id: 'ruby-amethyst',
    name: 'Ruby Amethyst',
    shortName: 'Ruby/Amethyst',
    inks: ['Ruby', 'Amethyst'],
    tier: 'S',
    powerLevel: 95,
    playRate: 18.5,
    winRate: 54.2,
    description: {
      'pt-BR': 'Arquétipo agressivo que combina a remoção eficiente do Ruby com o card draw do Amethyst. Foca em controlar o board enquanto pressiona o oponente.',
      'en': 'Aggressive archetype combining Ruby\'s efficient removal with Amethyst\'s card draw. Focuses on board control while pressuring the opponent.'
    },
    playstyle: {
      'pt-BR': 'Aggro-Control',
      'en': 'Aggro-Control'
    },
    
    // Core Cards (Top 15 essenciais)
    coreCards: [
      { name: 'Simba - Returned King', qty: 4, importance: 'essential', role: 'finisher' },
      { name: 'Maleficent - Monstrous Dragon', qty: 3, importance: 'essential', role: 'finisher' },
      { name: 'Beast - Hardheaded', qty: 4, importance: 'essential', role: 'value' },
      { name: 'Aladdin - Heroic Outlaw', qty: 4, importance: 'essential', role: 'card-draw' },
      { name: 'Mother Gothel - Withered and Wicked', qty: 3, importance: 'core', role: 'removal' },
      { name: 'Dr. Facilier - Agent Provocateur', qty: 4, importance: 'core', role: 'card-draw' },
      { name: 'Cinderella - Stouthearted', qty: 2, importance: 'core', role: 'value' },
      { name: 'Gaston - Arrogant Hunter', qty: 4, importance: 'core', role: 'removal' },
      { name: 'Elsa - Snow Queen', qty: 3, importance: 'flex', role: 'value' },
      { name: 'Rapunzel - Letting Down Her Hair', qty: 3, importance: 'flex', role: 'card-draw' },
      { name: 'Mickey Mouse - Brave Little Tailor', qty: 4, importance: 'flex', role: 'aggro' },
      { name: 'Moana - Of Motunui', qty: 2, importance: 'flex', role: 'ramp' },
      { name: 'Tinker Bell - Tiny Tactician', qty: 2, importance: 'tech', role: 'evasion' },
      { name: 'Jasmine - Heir of Agrabah', qty: 2, importance: 'tech', role: 'value' },
      { name: 'Be Prepared', qty: 4, importance: 'essential', role: 'removal' }
    ],
    
    // Matchups vs outros arquétipos
    matchups: [
      { opponent: 'Amber Steel', winRate: 58, difficulty: 'favorable' },
      { opponent: 'Emerald Steel', winRate: 52, difficulty: 'even' },
      { opponent: 'Ruby Sapphire', winRate: 45, difficulty: 'unfavorable' },
      { opponent: 'Steel Song', winRate: 62, difficulty: 'favorable' },
      { opponent: 'Amber Amethyst', winRate: 49, difficulty: 'even' },
      { opponent: 'Emerald Ruby', winRate: 56, difficulty: 'favorable' },
      { opponent: 'Sapphire Steel', winRate: 48, difficulty: 'even' }
    ],
    
    // Meta evolution (últimos 30 dias)
    metaEvolution: [
      { week: 'Week 1', playRate: 15.2, winRate: 52.8, tier: 'A' },
      { week: 'Week 2', playRate: 16.8, winRate: 53.5, tier: 'S' },
      { week: 'Week 3', playRate: 17.9, winRate: 54.1, tier: 'S' },
      { week: 'Week 4', playRate: 18.5, winRate: 54.2, tier: 'S' }
    ],
    
    // Exemplo de decklists
    exampleDecklists: [
      {
        name: 'Ruby Amethyst Aggro',
        author: 'ProPlayer123',
        event: 'Lorcana Challenge',
        placement: '1st Place',
        date: '2024-03-15',
        decklist: `4x Simba - Returned King
4x Mickey Mouse - Brave Little Tailor
4x Beast - Hardheaded
4x Aladdin - Heroic Outlaw
3x Maleficent - Monstrous Dragon
4x Gaston - Arrogant Hunter
4x Dr. Facilier - Agent Provocateur
3x Mother Gothel - Withered and Wicked
3x Elsa - Snow Queen
3x Rapunzel - Letting Down Her Hair
2x Cinderella - Stouthearted
2x Moana - Of Motunui
2x Tinker Bell - Tiny Tactician
2x Jasmine - Heir of Agrabah
4x Be Prepared
10x Ruby Ink
10x Amethyst Ink`
      }
    ],
    
    // Strengths & Weaknesses
    strengths: {
      'pt-BR': ['Remoção eficiente', 'Card advantage', 'Boas finalizações', 'Versátil'],
      'en': ['Efficient removal', 'Card advantage', 'Strong finishers', 'Versatile']
    },
    weaknesses: {
      'pt-BR': ['Vulnerável a aggro rápido', 'Dependente de algumas cartas-chave'],
      'en': ['Vulnerable to fast aggro', 'Dependent on key cards']
    },
    
    // Dicas de pilotagem
    tips: {
      'pt-BR': [
        'Mantenha cartas na mão para maximizar Beast',
        'Use remoção de forma conservadora',
        'Priorize card draw no early game',
        'Guarde Simba para finalizar'
      ],
      'en': [
        'Keep cards in hand to maximize Beast',
        'Use removal conservatively',
        'Prioritize card draw in early game',
        'Save Simba for lethal'
      ]
    }
  },
  
  'amber-steel': {
    id: 'amber-steel',
    name: 'Amber Steel',
    shortName: 'Amber/Steel',
    inks: ['Amber', 'Steel'],
    tier: 'A',
    powerLevel: 88,
    playRate: 12.3,
    winRate: 51.5,
    description: {
      'pt-BR': 'Deck midrange que combina cartas resistentes do Steel com card advantage do Amber.',
      'en': 'Midrange deck combining Steel\'s resilient cards with Amber\'s card advantage.'
    },
    playstyle: {
      'pt-BR': 'Midrange',
      'en': 'Midrange'
    },
    coreCards: [
      { name: 'Aladdin - Heroic Outlaw', qty: 4, importance: 'essential', role: 'card-draw' },
      { name: 'Mickey Mouse - Brave Little Tailor', qty: 4, importance: 'essential', role: 'aggro' },
      { name: 'Belle - Strange but Special', qty: 3, importance: 'core', role: 'value' }
    ],
    matchups: [
      { opponent: 'Ruby Amethyst', winRate: 42, difficulty: 'unfavorable' },
      { opponent: 'Emerald Steel', winRate: 55, difficulty: 'favorable' }
    ],
    metaEvolution: [
      { week: 'Week 1', playRate: 14.1, winRate: 50.2, tier: 'A' },
      { week: 'Week 2', playRate: 13.2, winRate: 51.0, tier: 'A' },
      { week: 'Week 3', playRate: 12.8, winRate: 51.3, tier: 'A' },
      { week: 'Week 4', playRate: 12.3, winRate: 51.5, tier: 'A' }
    ],
    exampleDecklists: [],
    strengths: {
      'pt-BR': ['Consistente', 'Boa curva'],
      'en': ['Consistent', 'Good curve']
    },
    weaknesses: {
      'pt-BR': ['Falta finalizações', 'Lento vs aggro'],
      'en': ['Lacks finishers', 'Slow vs aggro']
    },
    tips: {
      'pt-BR': ['Jogue pelo valor', 'Controle o board'],
      'en': ['Play for value', 'Control the board']
    }
  }
};

// Lista de todos os arquétipos para navegação
export const ARCHETYPE_LIST = Object.values(ARCHETYPES).map(arch => ({
  id: arch.id,
  name: arch.name,
  inks: arch.inks,
  tier: arch.tier,
  winRate: arch.winRate,
  playRate: arch.playRate
}));

// Cores dos inks
export const INK_COLORS = {
  'Amber': '#f59e0b',
  'Amethyst': '#a855f7',
  'Emerald': '#10b981',
  'Ruby': '#ef4444',
  'Sapphire': '#3b82f6',
  'Steel': '#6b7280'
};

// Níveis de tier
export const TIER_CONFIG = {
  'S': { color: '#fbbf24', label: 'S Tier' },
  'A': { color: '#60a5fa', label: 'A Tier' },
  'B': { color: '#34d399', label: 'B Tier' },
  'C': { color: '#a78bfa', label: 'C Tier' }
};
