import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function QualificationBarChart({ data }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e3f0df" />
          <XAxis dataKey="name" tick={{ fill: "#68726b", fontSize: 12 }} axisLine={{ stroke: "#cddbc9" }} />
          <YAxis allowDecimals={false} tick={{ fill: "#68726b", fontSize: 12 }} axisLine={{ stroke: "#cddbc9" }} />
          <Tooltip />
          <Bar dataKey="value" radius={[8, 8, 0, 0]}>
            {data.map((entry) => <Cell key={entry.name} fill={entry.name === "Not Qualified" ? "#f3b5bd" : "#087f5b"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
