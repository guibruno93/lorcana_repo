import React, { useState } from 'react';
import './Login.css'; // ou o nome do seu arquivo CSS

export default function Login() {
  // ... seus outros estados
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  return (
    <div className="login-container">
      {/* ... seu conteúdo de login ... */}

      {/* RODAPÉ COM BOTÃO */}
      <div className="login-footer">
        <button
          type="button"
          className="link-button-small"
          onClick={() => setShowDisclaimer(true)}
        >
          ⚠️ Avisos Importantes
        </button>
      </div>

      {/* MODAL DE DISCLAIMER */}
      {showDisclaimer && (
        <div className="disclaimer-overlay" onClick={() => setShowDisclaimer(false)}>
          <div className="disclaimer-modal" onClick={(e) => e.stopPropagation()}>
            <div className="disclaimer-header">
              <h2>⚠️ Avisos Legais e Importantes</h2>
              <button 
                className="close-button"
                onClick={() => setShowDisclaimer(false)}
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <div className="disclaimer-content">
              <section className="disclaimer-section">
                <h3>🎴 Sobre o Conteúdo</h3>
                <p>
                  <strong>Inkwell Labs</strong> é um projeto de fãs, não oficial e sem fins lucrativos. 
                  Disney Lorcana™ é uma marca registrada da Disney Enterprises, Inc. 
                  Todas as imagens de cartas, logos e conteúdo relacionado são propriedade 
                  de seus respectivos donos.
                </p>
                <p>
                  Este site não é afiliado, endossado ou patrocinado pela Disney, 
                  Ravensburger ou qualquer outra empresa relacionada ao jogo Disney Lorcana.
                </p>
              </section>

              <section className="disclaimer-section">
                <h3>📊 Dados e Privacidade</h3>
                <ul>
                  <li>Seus dados de deck são armazenados de forma segura</li>
                  <li>Não vendemos ou compartilhamos suas informações pessoais</li>
                  <li>Você pode excluir sua conta a qualquer momento</li>
                  <li>Usamos cookies apenas para autenticação e melhorias de UX</li>
                </ul>
              </section>

              <section className="disclaimer-section">
                <h3>🤖 Meta-Análise e IA</h3>
                <p>
                  As análises de meta e sugestões de deck são geradas por algoritmos 
                  baseados em dados da comunidade. <strong>Não garantimos precisão absoluta</strong> 
                  e recomendamos usar como referência, não como verdade definitiva.
                </p>
                <p>
                  Os dados de winrate e popularidade são estimados com base em amostras 
                  limitadas e podem não refletir o meta competitivo global.
                </p>
              </section>

              <section className="disclaimer-section">
                <h3>⚖️ Termos de Uso</h3>
                <ul>
                  <li>Você é responsável pelo conteúdo que publica (nomes de deck, comentários)</li>
                  <li>Não toleramos discurso de ódio, spam ou comportamento abusivo</li>
                  <li>Reservamos o direito de remover conteúdo inadequado</li>
                  <li>O serviço é fornecido "como está", sem garantias</li>
                </ul>
              </section>

              <section className="disclaimer-section">
                <h3>🚧 Beta e Bugs</h3>
                <p>
                  Inkwell Labs está em desenvolvimento ativo. Bugs podem ocorrer e 
                  funcionalidades podem mudar sem aviso prévio. Agradecemos seu feedback 
                  e paciência enquanto melhoramos a plataforma!
                </p>
              </section>

              <section className="disclaimer-section disclaimer-footer-section">
                <p style={{ textAlign: 'center', color: '#999', fontSize: '13px', marginTop: '20px' }}>
                  Ao usar Inkwell Labs, você concorda com estes termos.<br />
                  <strong>Versão 1.0 - Março 2026</strong>
                </p>
              </section>
            </div>

            <div className="disclaimer-actions">
              <button 
                className="btn-primary"
                onClick={() => setShowDisclaimer(false)}
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
