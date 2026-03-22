import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import './MetaEvolutionChart.css';

export default function MetaEvolutionChart({ evolution }) {
  const { t } = useTranslation();

  // Custom tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      return (
        <div className="chart-tooltip">
          <div className="tooltip-header">{data.week}</div>
          <div className="tooltip-body">
            <div className="tooltip-item play-rate">
              <span className="tooltip-label">{t('archetypePage.playRate')}:</span>
              <span className="tooltip-value">{data.playRate}%</span>
            </div>
            <div className="tooltip-item win-rate">
              <span className="tooltip-label">{t('archetypePage.winRate')}:</span>
              <span className="tooltip-value">{data.winRate}%</span>
            </div>
            <div className="tooltip-item tier">
              <span className="tooltip-label">{t('archetypePage.tier')}:</span>
              <span className="tooltip-value">{data.tier}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="meta-evolution-chart">
      <ResponsiveContainer width="100%" height={400}>
        <LineChart
          data={evolution}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          
          <XAxis 
            dataKey="week" 
            stroke="#9ca3af"
            style={{ fontSize: 12 }}
          />
          
          <YAxis 
            stroke="#9ca3af"
            style={{ fontSize: 12 }}
          />
          
          <Tooltip content={<CustomTooltip />} />
          
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            formatter={(value) => {
              if (value === 'playRate') return t('archetypePage.playRate');
              if (value === 'winRate') return t('archetypePage.winRate');
              return value;
            }}
          />
          
          <Line
            type="monotone"
            dataKey="playRate"
            stroke="#8b5cf6"
            strokeWidth={3}
            dot={{ fill: '#8b5cf6', r: 5 }}
            activeDot={{ r: 7 }}
          />
          
          <Line
            type="monotone"
            dataKey="winRate"
            stroke="#10b981"
            strokeWidth={3}
            dot={{ fill: '#10b981', r: 5 }}
            activeDot={{ r: 7 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Insights */}
      <div className="evolution-insights">
        <div className="insight-card">
          <div className="insight-icon">📈</div>
          <div className="insight-content">
            <div className="insight-label">{t('archetypePage.trend')}</div>
            <div className="insight-value">
              {evolution[evolution.length - 1].playRate > evolution[0].playRate 
                ? t('archetypePage.growing')
                : t('archetypePage.declining')}
            </div>
          </div>
        </div>

        <div className="insight-card">
          <div className="insight-icon">🎯</div>
          <div className="insight-content">
            <div className="insight-label">{t('archetypePage.peakWinRate')}</div>
            <div className="insight-value">
              {Math.max(...evolution.map(e => e.winRate))}%
            </div>
          </div>
        </div>

        <div className="insight-card">
          <div className="insight-icon">👥</div>
          <div className="insight-content">
            <div className="insight-label">{t('archetypePage.peakPlayRate')}</div>
            <div className="insight-value">
              {Math.max(...evolution.map(e => e.playRate))}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
