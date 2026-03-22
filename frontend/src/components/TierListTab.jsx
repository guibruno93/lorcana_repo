/**
 * frontend/src/components/TierListTab.jsx
 * Versão DEBUG para identificar problema
 */

import React from 'react';

function TierListTab({ tierList }) {
  console.log('🔍 TierListTab rendered');
  console.log('📊 tierList received:', tierList);
  console.log('📊 tierList type:', typeof tierList);
  console.log('📊 tierList keys:', tierList ? Object.keys(tierList) : 'null');
  
  if (!tierList) {
    console.log('⚠️ tierList is null/undefined');
    return (
      <div style={{ 
        padding: '60px', 
        textAlign: 'center',
        color: '#999',
        background: 'rgba(231, 76, 60, 0.1)',
        borderRadius: '12px',
        border: '2px dashed #e74c3c',
        margin: '20px'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#e74c3c', marginBottom: '10px' }}>
          Tier List Not Loaded
        </div>
        <div style={{ fontSize: '14px', color: '#aaa' }}>
          tierList is null or undefined
        </div>
        <div style={{ 
          marginTop: '20px', 
          padding: '15px',
          background: 'rgba(0,0,0,0.4)',
          borderRadius: '8px',
          fontSize: '12px',
          fontFamily: 'monospace',
          textAlign: 'left',
          color: '#fff'
        }}>
          <div>Debug Info:</div>
          <div>• tierList: {String(tierList)}</div>
          <div>• type: {typeof tierList}</div>
        </div>
      </div>
    );
  }

  // Verificar se tem dados
  const hasTiers = Object.keys(tierList).length > 0;
  console.log(`📊 Has tiers: ${hasTiers}`);
  
  if (!hasTiers) {
    console.log('⚠️ tierList is empty object');
    return (
      <div style={{ 
        padding: '60px', 
        textAlign: 'center',
        color: '#999',
        background: 'rgba(255, 165, 2, 0.1)',
        borderRadius: '12px',
        border: '2px dashed #ffa502',
        margin: '20px'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>📦</div>
        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#ffa502', marginBottom: '10px' }}>
          Tier List is Empty
        </div>
        <div style={{ fontSize: '14px', color: '#aaa' }}>
          No tiers found in data
        </div>
        <div style={{ 
          marginTop: '20px', 
          padding: '15px',
          background: 'rgba(0,0,0,0.4)',
          borderRadius: '8px',
          fontSize: '12px',
          fontFamily: 'monospace',
          textAlign: 'left',
          color: '#fff'
        }}>
          <div>Debug Info:</div>
          <div>• tierList keys: {Object.keys(tierList).join(', ') || 'none'}</div>
          <div>• tierList: {JSON.stringify(tierList)}</div>
        </div>
      </div>
    );
  }

  const tierColors = {
    S: '#ff4757',
    A: '#ffa502',
    B: '#eccc68',
    C: '#70a1ff',
    D: '#a4b0be'
  };

  return (
    <div style={{ padding: '20px' }}>
      {/* Debug Info Box */}
      <div style={{
        padding: '15px',
        background: 'rgba(103, 126, 234, 0.1)',
        borderRadius: '8px',
        marginBottom: '20px',
        border: '1px solid rgba(103, 126, 234, 0.3)'
      }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#667eea', marginBottom: '8px' }}>
          🔍 Debug Info:
        </div>
        <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#aaa' }}>
          <div>• Tiers available: {Object.keys(tierList).join(', ')}</div>
          <div>• Total archetypes: {Object.values(tierList).reduce((sum, tier) => sum + (tier?.length || 0), 0)}</div>
        </div>
      </div>

      {/* Tier List */}
      {['S', 'A', 'B', 'C', 'D'].map(tier => {
        const archetypes = tierList[tier] || [];
        console.log(`📊 Tier ${tier}:`, archetypes.length, 'archetypes');
        
        if (archetypes.length === 0) {
          return (
            <div key={tier} style={{
              marginBottom: '20px',
              padding: '20px',
              background: 'rgba(30, 30, 40, 0.3)',
              borderRadius: '12px',
              border: '1px solid rgba(100, 100, 100, 0.3)'
            }}>
              <div style={{ 
                fontSize: '18px', 
                fontWeight: 'bold',
                color: tierColors[tier],
                marginBottom: '10px'
              }}>
                TIER {tier}
              </div>
              <div style={{ fontSize: '14px', color: '#666', textAlign: 'center', padding: '20px' }}>
                No archetypes in this tier
              </div>
            </div>
          );
        }

        return (
          <div key={tier} style={{ marginBottom: '32px' }}>
            {/* Tier Header */}
            <div style={{
              background: tierColors[tier],
              padding: '16px 24px',
              borderRadius: '12px 12px 0 0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{
                fontSize: '28px',
                fontWeight: 'bold',
                color: '#fff',
                letterSpacing: '2px'
              }}>
                TIER {tier}
              </div>
              <div style={{
                fontSize: '16px',
                color: 'rgba(255,255,255,0.9)',
                background: 'rgba(0,0,0,0.2)',
                padding: '6px 16px',
                borderRadius: '20px'
              }}>
                {archetypes.length} archetype{archetypes.length !== 1 ? 's' : ''}
              </div>
            </div>
            
            {/* Archetypes */}
            <div style={{
              background: 'rgba(30, 30, 40, 0.6)',
              border: '1px solid rgba(103, 126, 234, 0.3)',
              borderTop: 'none',
              borderRadius: '0 0 12px 12px'
            }}>
              {archetypes.map((archetype, idx) => (
                <div key={idx} style={{
                  padding: '20px 24px',
                  borderBottom: idx < archetypes.length - 1 ? '1px solid rgba(103, 126, 234, 0.2)' : 'none'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    {/* Left: Name */}
                    <div style={{ flex: 1 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginBottom: '8px'
                      }}>
                        <span style={{
                          fontSize: '20px',
                          fontWeight: 'bold',
                          color: '#fff'
                        }}>
                          {archetype.archetype || 'Unknown'}
                        </span>
                        
                        <span style={{
                          fontSize: '16px',
                          fontWeight: 'bold',
                          color: tierColors[tier],
                          background: 'rgba(0,0,0,0.3)',
                          padding: '4px 12px',
                          borderRadius: '6px'
                        }}>
                          {archetype.power_level || 0}/100
                        </span>
                      </div>
                      
                      {/* Inks */}
                      {archetype.inks && (
                        <div style={{
                          display: 'flex',
                          gap: '6px',
                          flexWrap: 'wrap'
                        }}>
                          {archetype.inks.map((ink, j) => (
                            <span key={j} style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              background: 'rgba(103, 126, 234, 0.5)',
                              color: '#fff'
                            }}>
                              {ink}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Right: Stats */}
                    <div style={{
                      display: 'flex',
                      gap: '24px'
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff' }}>
                          {archetype.win_rate != null ? archetype.win_rate.toFixed(1) : '0.0'}%
                        </div>
                        <div style={{ fontSize: '12px', color: '#aaa' }}>Win Rate</div>
                      </div>
                      
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#667eea' }}>
                          {archetype.meta_share != null ? archetype.meta_share.toFixed(1) : '0.0'}%
                        </div>
                        <div style={{ fontSize: '12px', color: '#aaa' }}>Meta Share</div>
                      </div>
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

export default TierListTab;
