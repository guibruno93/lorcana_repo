import React from 'react';

/**
 * MetaDashboard - Painel de visualização do meta
 * Versão atualizada com placeholder bonito
 */
export default function MetaDashboard() {
  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">
            <span className="icon">📊</span> Meta Dashboard
          </span>
          <span className="badge badge-purple">Em Desenvolvimento</span>
        </div>
        <div className="panel-body">
          <div className="empty-state">
            <div className="empty-icon" style={{ fontSize: '64px' }}>📊</div>
            <h3 style={{ margin: '16px 0 8px 0', fontSize: '20px', fontWeight: 700, color: '#1f2937' }}>
              Dashboard em Construção
            </h3>
            <p style={{ color: '#6b7280', fontSize: '15px', maxWidth: '500px', margin: '0 auto', lineHeight: 1.6 }}>
              Estamos trabalhando em um dashboard completo para análise do meta competitivo.
              Em breve você terá acesso a gráficos, estatísticas e insights valiosos!
            </p>
          </div>
        </div>
      </div>

      {/* Features Planejadas */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">
            <span className="icon">🚀</span> Features Planejadas
          </span>
        </div>
        <div className="panel-body">
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
            gap: '20px' 
          }}>
            {/* Feature 1 */}
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                📈
              </div>
              <h4 className="feature-title">Distribuição de Arquétipos</h4>
              <p className="feature-description">
                Gráficos interativos mostrando a popularidade de cada arquétipo no meta atual
              </p>
            </div>

            {/* Feature 2 */}
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
                🏆
              </div>
              <h4 className="feature-title">Rankings de Performance</h4>
              <p className="feature-description">
                Veja quais decks estão performando melhor nos torneios recentes
              </p>
            </div>

            {/* Feature 3 */}
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'linear-gradient(135deg, #fad0c4 0%, #ffd1ff 100%)' }}>
                📊
              </div>
              <h4 className="feature-title">Estatísticas Detalhadas</h4>
              <p className="feature-description">
                Análise completa de winrates, popularidade e tendências ao longo do tempo
              </p>
            </div>

            {/* Feature 4 */}
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' }}>
                🎯
              </div>
              <h4 className="feature-title">Matchup Matrix</h4>
              <p className="feature-description">
                Matriz completa de matchups mostrando winrates entre arquétipos
              </p>
            </div>

            {/* Feature 5 */}
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)' }}>
                🃏
              </div>
              <h4 className="feature-title">Cartas Mais Jogadas</h4>
              <p className="feature-description">
                Top cartas por arquétipo, formato e período de tempo
              </p>
            </div>

            {/* Feature 6 */}
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)' }}>
                🔍
              </div>
              <h4 className="feature-title">Filtros Avançados</h4>
              <p className="feature-description">
                Filtre por formato, região, período e muito mais para análises personalizadas
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '12px',
        padding: '24px',
        color: 'white',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>🚀</div>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700 }}>
          Em Breve!
        </h3>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.95 }}>
          Estamos trabalhando duro para trazer essas features o mais rápido possível.
          Fique ligado nas próximas atualizações!
        </p>
      </div>
    </div>
  );
}
