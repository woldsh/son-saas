/** Parse Firestore-style timestamps from material request documents */
export function getRequestCreatedDate(d: Record<string, unknown>): Date | null {
  const createdAt = d.createdAt as { toDate?: () => Date; seconds?: number } | undefined;
  const created_at = d.created_at as { toDate?: () => Date; seconds?: number } | undefined;
  if (createdAt?.toDate) return createdAt.toDate();
  if (typeof createdAt?.seconds === 'number') return new Date(createdAt.seconds * 1000);
  if (created_at?.toDate) return created_at.toDate();
  if (typeof created_at?.seconds === 'number') return new Date(created_at.seconds * 1000);
  return null;
}

/** Must match dashboard stat logic per area (each request counts once). */
export type DashboardStatsMode = 'employee' | 'teacher' | 'academic' | 'academic_coordinator' | 'md' | 'team_leader';

export type DashboardBucketCounts = {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
};

function strStatus(status: unknown): string {
  return String(status ?? '');
}

/**
 * Exclusive bucket: Pending requests, Approved (fulfilled / cleared), Rejected.
 * Matches EmployeeDashboard / TeacherDashboardContent rules where applicable.
 */
export function categorizeDashboardStatus(
  status: unknown,
  mode: DashboardStatsMode
): 'pending' | 'approved' | 'rejected' {
  const s = strStatus(status);
  if (s.includes('rejected')) return 'rejected';

  switch (mode) {
    case 'employee':
      if (['approved', 'completed', 'received'].includes(s)) return 'approved';
      if (['pending', 'forwarded_to_team_leader', 'approved_by_team_leader'].includes(s)) return 'pending';
      return 'pending';
    case 'teacher':
      if (['approved', 'completed', 'received', 'approved_by_md'].includes(s)) return 'approved';
      if (
        [
          'pending',
          'forwarded_to_team_leader',
          'approved_by_team_leader',
          'approved_by_head',
          'approved_by_coordinator',
        ].includes(s)
      )
        return 'pending';
      return 'pending';
    case 'academic':
    case 'academic_coordinator':
      if (s === 'completed') return 'approved';
      if (s.includes('approved')) return 'approved';
      return 'pending';
    case 'md':
      if (['approved_by_md', 'completed', 'received', 'issued'].includes(s)) return 'approved';
      if (['approved_by_coordinator'].includes(s)) return 'pending';
      return 'pending';
    case 'team_leader':
      if (s.includes('approved') || s === 'completed' || s === 'received' || s === 'issued') return 'approved';
      if (s.includes('forwarded_to_team_leader') || s === 'pending_procurement') return 'pending';
      return 'pending';
    default:
      return 'pending';
  }
}

export function countDashboardBuckets(
  docs: { status?: unknown }[],
  mode: DashboardStatsMode
): DashboardBucketCounts {
  let pending = 0;
  let approved = 0;
  let rejected = 0;
  for (const d of docs) {
    const b = categorizeDashboardStatus(d.status, mode);
    if (b === 'pending') pending++;
    else if (b === 'approved') approved++;
    else rejected++;
  }
  return {
    pending,
    approved,
    rejected,
    total: docs.length,
  };
}

export type PieSlice = { name: string; value: number; fill: string };

const PIE_ORDER = ['pending', 'approved', 'rejected'] as const;

export function dashboardBucketsToPieData(
  counts: DashboardBucketCounts,
  variant: 'light' | 'dark'
): PieSlice[] {
  // Distinct colors: amber for pending, emerald for approved, rose for rejected
  const colors =
    variant === 'dark'
      ? { pending: '#fbbf24', approved: '#34d399', rejected: '#fb7185' }
      : { pending: '#f59e0b', approved: '#10b981', rejected: '#f43f5e' };

  const labels: Record<(typeof PIE_ORDER)[number], string> = {
    pending: 'Pending requests',
    approved: 'Approved',
    rejected: 'Rejected',
  };

  const map: Record<(typeof PIE_ORDER)[number], number> = {
    pending: counts.pending,
    approved: counts.approved,
    rejected: counts.rejected,
  };

  return PIE_ORDER.filter((k) => map[k] > 0).map((k) => ({
    name: labels[k],
    value: map[k],
    fill: colors[k],
  }));
}

/** Stacked bars: pending / approved / rejected per month (same rules as pie). */
export function buildLastNMonthsStackedData(
  docs: Record<string, unknown>[],
  mode: DashboardStatsMode,
  n = 6
): { name: string; pending: number; approved: number; rejected: number; total: number }[] {
  const now = new Date();
  const buckets: {
    key: string;
    name: string;
    pending: number;
    approved: number;
    rejected: number;
  }[] = [];

  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets.push({
      key,
      name: d.toLocaleString('default', { month: 'short' }),
      pending: 0,
      approved: 0,
      rejected: 0,
    });
  }

  for (const doc of docs) {
    const dt = getRequestCreatedDate(doc);
    if (!dt) continue;
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    const b = buckets.find((x) => x.key === key);
    if (!b) continue;
    const cat = categorizeDashboardStatus(doc.status, mode);
    if (cat === 'pending') b.pending++;
    else if (cat === 'approved') b.approved++;
    else b.rejected++;
  }

  return buckets.map(({ name, pending, approved, rejected }) => ({
    name,
    pending,
    approved,
    rejected,
    total: pending + approved + rejected,
  }));
}
