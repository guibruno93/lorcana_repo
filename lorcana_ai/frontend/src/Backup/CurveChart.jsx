import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function CurveChart({ curveCounts }) {
  if (!curveCounts) return null;

  // Transform curveCounts object to array
  const data = Object.entries(curveCounts).map(([cost, count]) => ({
    cost,
    count,
    label: cost === "10+" ? "10+" : `${cost}`
  }));

  // Color gradient based on cost
  const getColor = (cost) => {
    if (cost === "10+") return "#DC2626";
    const numCost = parseInt(cost);
    if (numCost <= 2) return "#10B981"; // Green
    if (numCost <= 4) return "#3B82F6"; // Blue
    if (numCost <= 6) return "#8B5CF6"; // Purple
    if (numCost <= 8) return "#F59E0B"; // Orange
    return "#EF4444"; // Red
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="curve-tooltip">
          <div className="tooltip-label">Cost {data.payload.label}</div>
          <div className="tooltip-value">{data.value} cards</div>
        </div>
      );
    }
    return null;
  };

  // Calculate average cost (weighted)
  const totalCards = data.reduce((sum, item) => {
    if (item.cost === "10+") return sum + item.count * 10; // Assume 10+ = 10
    return sum + parseInt(item.cost) * item.count;
  }, 0);
  
  const cardCount = data.reduce((sum, item) => sum + item.count, 0);
  const avgCost = cardCount > 0 ? (totalCards / cardCount).toFixed(1) : 0;

  return (
    <div className="curve-chart-container">
      <div className="curve-stats">
        <div className="curve-stat">
          <span className="curve-stat-label">Average Cost</span>
          <span className="curve-stat-value">{avgCost}</span>
        </div>
        <div className="curve-stat">
          <span className="curve-stat-label">Total Cards</span>
          <span className="curve-stat-value">{cardCount}</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
          <XAxis 
            dataKey="label" 
            stroke="#94A3B8"
            tick={{ fill: '#94A3B8', fontSize: 12 }}
          />
          <YAxis 
            stroke="#94A3B8"
            tick={{ fill: '#94A3B8', fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
          <Bar dataKey="count" radius={[8, 8, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(entry.cost)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="curve-legend">
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: "#10B981" }} />
          <span>0-2 (Early)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: "#3B82F6" }} />
          <span>3-4 (Mid)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: "#8B5CF6" }} />
          <span>5-6 (Late-Mid)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: "#F59E0B" }} />
          <span>7-8 (Late)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: "#EF4444" }} />
          <span>9+ (Very Late)</span>
        </div>
      </div>
    </div>
  );
}
