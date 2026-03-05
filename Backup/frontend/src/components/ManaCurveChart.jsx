import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function ManaCurveChart({ curve }) {
  const data = Object.entries(curve).map(([cost, qty]) => ({
    cost,
    qty
  }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data}>
        <XAxis dataKey="cost" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="qty" />
      </BarChart>
    </ResponsiveContainer>
  );
}
