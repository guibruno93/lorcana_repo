import { BarChart, Bar, XAxis, Tooltip } from "recharts";

export default function MetaCompareChart({ deckScore }) {
  const data = [
    { name: "Seu Deck", score: deckScore },
    { name: "Tier 1", score: 85 }
  ];

  return (
    <BarChart width={300} height={200} data={data}>
      <XAxis dataKey="name" />
      <Tooltip />
      <Bar dataKey="score" fill="#4caf50" />
    </BarChart>
  );
}
