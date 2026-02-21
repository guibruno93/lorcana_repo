/**
 * TestDeckComparison.jsx
 * Componente de teste standalone para DeckComparison
 * Use para testar antes de integrar no projeto principal
 */

import React from 'react';
import DeckComparison from './DeckComparison';

// Dados de exemplo para teste
const MOCK_ANALYSIS = {
  cards: [
    { name: "Basil - Practiced Detective", quantity: 4, cost: 1, type: "character", ink: "Sapphire", inkable: true },
    { name: "Rafiki - Mystical Fighter", quantity: 2, cost: 1, type: "character", ink: "Amethyst", inkable: true },
    { name: "Royal Guard - Octopus Soldier", quantity: 3, cost: 1, type: "character", ink: "Amethyst", inkable: true },
    { name: "Tipo - Growing Son", quantity: 4, cost: 2, type: "character", ink: "Sapphire", inkable: true },
    { name: "Cheshire Cat - Inexplicable", quantity: 4, cost: 3, type: "character", ink: "Amethyst", inkable: true },
    { name: "Dumbo - Ninth Wonder of the Universe", quantity: 4, cost: 4, type: "character", ink: "Amethyst", inkable: true },
    { name: "Genie - Wish Fulfilled", quantity: 4, cost: 4, type: "character", ink: "Sapphire", inkable: true },
    { name: "Iago - Giant Spectral Parrot", quantity: 2, cost: 4, type: "character", ink: "Amethyst", inkable: true },
    { name: "Tigger - Bouncing All the Way", quantity: 3, cost: 5, type: "character", ink: "Amethyst", inkable: false },
    { name: "Elsa - The Fifth Spirit", quantity: 4, cost: 6, type: "character", ink: "Amethyst", inkable: false },
    { name: "Hades - Looking for a Deal", quantity: 2, cost: 6, type: "character", ink: "Sapphire", inkable: false },
    { name: "Demona - Scourge of the Wyvern Clan", quantity: 2, cost: 7, type: "character", ink: "Amethyst", inkable: false },
    { name: "Hades - Infernal Schemer", quantity: 4, cost: 8, type: "character", ink: "Amethyst", inkable: false },
    { name: "Junior Woodchuck Guidebook", quantity: 4, cost: 2, type: "item", ink: "Sapphire", inkable: true },
    { name: "Sail the Azurite Sea", quantity: 4, cost: 3, type: "song", ink: "Sapphire", inkable: true },
    { name: "Into the Unknown", quantity: 3, cost: 5, type: "song", ink: "Amethyst", inkable: false },
    { name: "Let It Go", quantity: 3, cost: 8, type: "song", ink: "Amethyst", inkable: false },
  ],
  totalCards: 60,
};

function TestDeckComparison() {
  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>🧪 Teste do Componente DeckComparison</h1>
      
      <div style={{ 
        background: '#f3f4f6', 
        padding: '16px', 
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h3>ℹ️ Instruções</h3>
        <ol>
          <li>Certifique-se que o backend está rodando em <code>http://localhost:3002</code></li>
          <li>Clique nos botões de filtro para testar</li>
          <li>Clique em "Comparar com Meta" para ver o resultado</li>
          <li>Se funcionar aqui, está pronto para integrar no projeto!</li>
        </ol>
        
        <p><strong>Backend Status:</strong> Teste acessando <a href="http://localhost:3002/api/health" target="_blank">http://localhost:3002/api/health</a></p>
      </div>

      <div style={{
        background: '#e0f2fe',
        padding: '16px',
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h3>📊 Deck de Teste</h3>
        <p>Cores: <strong>Amethyst/Sapphire</strong></p>
        <p>Total de cards: <strong>60</strong></p>
        <p>Cards únicos: <strong>17</strong></p>
      </div>

      {/* Componente sendo testado */}
      <DeckComparison analysis={MOCK_ANALYSIS} />

      <div style={{ 
        marginTop: '40px',
        padding: '16px',
        background: '#fef3c7',
        borderRadius: '8px'
      }}>
        <h3>🔧 Troubleshooting</h3>
        <ul>
          <li><strong>Erro de conexão:</strong> Verifique se backend está rodando</li>
          <li><strong>CORS error:</strong> Backend deve ter CORS habilitado</li>
          <li><strong>404 Not Found:</strong> Rota não registrada no server.js</li>
          <li><strong>Componente não aparece:</strong> Verifique imports e CSS</li>
        </ul>
        
        <h4>Comandos úteis:</h4>
        <pre style={{ background: '#1f2937', color: '#10b981', padding: '12px', borderRadius: '4px' }}>
{`# Backend
cd backend
npm start

# Testar API
curl http://localhost:3002/api/deck-comparison/stats`}
        </pre>
      </div>
    </div>
  );
}

export default TestDeckComparison;
