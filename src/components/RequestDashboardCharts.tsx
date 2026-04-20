'use client';

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Label,
} from 'recharts';
import type { PieSlice } from '@/lib/requestChartUtils';

export type StackedMonthRow = {
  name: string;
  pending: number;
  approved: number;
  rejected: number;
  total: number;
};

export interface RequestDashboardChartsProps {
  variant: 'light' | 'dark';
  pieData: PieSlice[];
  stackedBarData: StackedMonthRow[];
  /** Sum of pending + approved + rejected (all requests in scope). */
  totalRequests: number;
  pieTitle?: string;
  barTitle?: string;
}

export default function RequestDashboardCharts({
  variant,
  pieData,
  stackedBarData,
  totalRequests,
  pieTitle = 'Request status',
  barTitle = 'Requests by month',
}: RequestDashboardChartsProps) {
  const isDark = variant === 'dark';
  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0';
  const centerMuted = isDark ? '#94a3b8' : '#64748b';
  const centerStrong = isDark ? '#f8fafc' : '#0f172a';

  const pendingFill = isDark ? '#fbbf24' : '#f59e0b';
  const approvedFill = isDark ? '#34d399' : '#10b981';
  const rejectedFill = isDark ? '#fb7185' : '#f43f5e';

  const tooltipStyle = isDark
    ? {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px',
        color: '#f1f5f9',
      }
    : {
        backgroundColor: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        color: '#0f172a',
      };

  const hasPie = pieData.length > 0 && pieData.some((s) => s.value > 0);
  const hasBar = stackedBarData.some((b) => b.total > 0);

  const emptyHint = (
    <div
      className={`flex items-center justify-center h-[220px] rounded-2xl border border-dashed ${
        isDark ? 'border-white/15 text-slate-500' : 'border-slate-200 text-slate-400'
      } text-sm font-medium`}
    >
      Not enough data yet for this chart
    </div>
  );

  const stackedTooltip = ({
    active,
    payload,
    label,
  }: any) => {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload as StackedMonthRow | undefined;
    const total = row?.total ?? payload.reduce((s: any, p: any) => s + Number(p.value ?? 0), 0);
    return (
      <div style={tooltipStyle} className="px-3 py-2 text-xs shadow-lg">
        <p className="font-semibold mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} style={{ color: p.color }}>
            {p.name}: {p.value}
          </p>
        ))}
        <p className={`mt-1 pt-1 border-t ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
          Total: {total}
        </p>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div
        className={`rounded-2xl border p-5 ${
          isDark ? 'bg-white/[0.04] border-white/10' : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <h3
          className={`text-sm font-bold uppercase tracking-wider mb-1 ${
            isDark ? 'text-slate-300' : 'text-slate-700'
          }`}
        >
          {pieTitle}
        </h3>
        <p
          className={`text-xs mb-4 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}
        >
          All dashboard statistics —{' '}
          <span className={isDark ? 'text-slate-300 font-semibold' : 'text-slate-800 font-semibold'}>
            {totalRequests} total
          </span>
        </p>
        {hasPie ? (
          <div className="h-[360px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={88}
                  paddingAngle={2}
                  label={(props: any) => {
                    const { cx, cy, midAngle, outerRadius: oR, value, name } = props;
                    const RADIAN = Math.PI / 180;
                    const radius = oR + 24;
                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                    return (
                      <text
                        x={x}
                        y={y}
                        fill={isDark ? '#e2e8f0' : '#334155'}
                        textAnchor={x > cx ? 'start' : 'end'}
                        dominantBaseline="central"
                        fontSize={11}
                        fontWeight={600}
                      >
                        {name}: {value}
                      </text>
                    );
                  }}
                  labelLine={{
                    stroke: isDark ? '#475569' : '#94a3b8',
                    strokeWidth: 1,
                  }}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={`cell-${i}`} fill={entry.fill} stroke="none" />
                  ))}
                  <Label
                    content={({ viewBox }) => {
                      if (!viewBox || !('cx' in viewBox) || !('cy' in viewBox)) return null;
                      const cx = (viewBox as { cx: number; cy: number }).cx;
                      const cy = (viewBox as { cx: number; cy: number }).cy;
                      return (
                        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan x={cx} y={cy - 8} fill={centerMuted} fontSize={10} fontWeight={600}>
                            Total
                          </tspan>
                          <tspan
                            x={cx}
                            y={cy + 12}
                            fill={centerStrong}
                            fontSize={22}
                            fontWeight={700}
                          >
                            {totalRequests}
                          </tspan>
                        </text>
                      );
                    }}
                  />
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: any, name: any) => [Number(value ?? 0), name]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  formatter={(value) => {
                    const entry = pieData.find((d) => d.name === value);
                    return (
                      <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>
                        {value}: <strong>{entry?.value ?? 0}</strong>
                      </span>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          emptyHint
        )}
      </div>

      <div
        className={`rounded-2xl border p-5 ${
          isDark ? 'bg-white/[0.04] border-white/10' : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <h3
          className={`text-sm font-bold uppercase tracking-wider mb-1 ${
            isDark ? 'text-slate-300' : 'text-slate-700'
          }`}
        >
          {barTitle}
        </h3>
        <p className={`text-xs mb-4 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
          Stacked: pending, approved, rejected (total height = requests that month)
        </p>
        {hasBar ? (
          <div className="h-[280px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stackedBarData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 11 }} axisLine={{ stroke: gridColor }} />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: axisColor, fontSize: 11 }}
                  axisLine={{ stroke: gridColor }}
                  width={36}
                />
                <Tooltip content={stackedTooltip} />
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  formatter={(value) => (
                    <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>{value}</span>
                  )}
                />
                <Bar dataKey="pending" stackId="req" name="Pending Requests" fill={pendingFill} radius={[0, 0, 0, 0]} />
                <Bar dataKey="approved" stackId="req" name="Approved" fill={approvedFill} radius={[0, 0, 0, 0]} />
                <Bar
                  dataKey="rejected"
                  stackId="req"
                  name="Rejected"
                  fill={rejectedFill}
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          emptyHint
        )}
      </div>
    </div>
  );
}
