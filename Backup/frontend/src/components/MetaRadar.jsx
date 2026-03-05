import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis
} from "recharts";

export default function MetaRadar({ matchupScore, metaAvg }) {
  if (!matchupScore) return null;

  const data = [
    { matchup: "Aggro", deck: matchupScore.aggro, meta: metaAvg ?? 70 },
    { matchup: "Midrange", deck: matchupScore.midrange, meta: metaAvg ?? 70 },
    { matchup: "Control", deck: matchupScore.control, meta: metaAvg ?? 70 }
  ];

  return (
    <div>
      <h3>📊 Deck vs Tier 1</h3>
      <RadarChart width={400} height={300} data={data}>
        <PolarGrid />
        <PolarAngleAxis dataKey="matchup" />
        <PolarRadiusAxis domain={[0, 100]} />
        <Radar
          name="Seu Deck"
          dataKey="deck"
          stroke="#2563eb"
          fill="#2563eb"
          fillOpacity={0.6}
        />
        <Radar
          name="Tier 1"
          dataKey="meta"
          stroke="#16a34a"
          fill="#16a34a"
          fillOpacity={0.3}
        />
      </RadarChart>
    </div>
  );
}
