// DeckExporter.jsx - Modal para exportar deck
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './DeckExporter.css';

const DeckExporter = ({ deck, deckName, onExport, onClose }) => {
  const { t } = useTranslation();
  const [format, setFormat] = useState('text');
  const [copied, setCopied] = useState(false);

  const exportedText = onExport(format);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleDownload = () => {
    const extension = format === 'pixelborn' ? 'json' : 'txt';
    const blob = new Blob([exportedText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${deckName}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📤 {t('deckBuilder.exportDeck')}</h2>
          <button onClick={onClose} className="btn-close">✕</button>
        </div>

        <div className="modal-body">
          <div className="export-format-selector">
            <label>{t('deckBuilder.exportFormat')}:</label>
            <div className="format-buttons">
              <button
                onClick={() => setFormat('text')}
                className={`btn-format ${format === 'text' ? 'active' : ''}`}
              >
                📄 Text
              </button>
              <button
                onClick={() => setFormat('pixelborn')}
                className={`btn-format ${format === 'pixelborn' ? 'active' : ''}`}
              >
                🎮 Pixelborn
              </button>
              <button
                onClick={() => setFormat('dreamborn')}
                className={`btn-format ${format === 'dreamborn' ? 'active' : ''}`}
              >
                💭 Dreamborn
              </button>
            </div>
          </div>

          <div className="export-preview">
            <div className="preview-header">
              <span>{t('deckBuilder.preview')}:</span>
              <button onClick={handleCopy} className="btn-copy">
                {copied ? '✅ Copied!' : '📋 Copy'}
              </button>
            </div>
            <pre className="export-text">{exportedText}</pre>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={handleDownload} className="btn-download">
            💾 Download
          </button>
          <button onClick={onClose} className="btn-cancel">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeckExporter;
