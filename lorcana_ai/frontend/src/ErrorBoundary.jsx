import React from 'react';
import './ErrorBoundary.css';

/**
 * Error Boundary Component
 * Captura erros de componentes filhos e evita crash completo da aplicação
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState(prevState => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // Opcional: Enviar erro para serviço de logging
    // logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, errorCount } = this.state;
      const showDetails = process.env.NODE_ENV === 'development';

      // Se muitos erros, sugerir reload completo
      if (errorCount >= 3) {
        return (
          <div className="error-boundary">
            <div className="error-content">
              <div className="error-icon">⚠️</div>
              <h2 className="error-title">Múltiplos Erros Detectados</h2>
              <p className="error-message">
                A aplicação encontrou múltiplos erros. 
                Recomendamos recarregar a página.
              </p>
              <div className="error-actions">
                <button className="btn btn-primary" onClick={this.handleReload}>
                  🔄 Recarregar Página
                </button>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="error-boundary">
          <div className="error-content">
            <div className="error-icon">⚠️</div>
            <h2 className="error-title">Algo deu errado</h2>
            <p className="error-message">
              Desculpe, ocorreu um erro inesperado. 
              Você pode tentar novamente ou recarregar a página.
            </p>

            {showDetails && (
              <details className="error-details">
                <summary>Detalhes do erro (modo desenvolvimento)</summary>
                <div className="error-stack">
                  <h4>Error:</h4>
                  <pre>{error && error.toString()}</pre>
                  
                  <h4>Component Stack:</h4>
                  <pre>{errorInfo && errorInfo.componentStack}</pre>
                </div>
              </details>
            )}

            <div className="error-actions">
              <button className="btn btn-primary" onClick={this.handleReset}>
                🔄 Tentar Novamente
              </button>
              <button className="btn btn-ghost" onClick={this.handleReload}>
                ↻ Recarregar Página
              </button>
            </div>

            <div className="error-help">
              <p>
                Se o erro persistir, tente:
              </p>
              <ul>
                <li>Limpar o cache do navegador</li>
                <li>Usar uma aba anônima</li>
                <li>Verificar a console do navegador (F12)</li>
              </ul>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
