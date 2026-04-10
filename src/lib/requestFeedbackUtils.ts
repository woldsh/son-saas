/**
 * Feedback from Academic Coordinator / Managing Director lives on Request_materials.history.
 * History uses display titles from getRoleTitle (e.g. "Academic Coordinator") or snake_case in some paths.
 */

function roleLooksAcademicCoordinatorOrMD(role: unknown): boolean {
  const s = String(role ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return false;
  return (
    s.includes('academic coordinator') ||
    s.includes('managing director') ||
    s === 'academic_coordinator' ||
    s === 'managing_director'
  );
}

function isAcOrMdHistoryActor(entry: {
  userRole?: unknown;
  rejectorRole?: unknown;
}): boolean {
  return (
    roleLooksAcademicCoordinatorOrMD(entry.userRole) ||
    roleLooksAcademicCoordinatorOrMD(entry.rejectorRole)
  );
}

/**
 * Count history events from AC or MD that are feedback to the requester:
 * - rejection (status rejected)
 * - quantity / adjustment messages (note mentions "adjust")
 */
export function countAcademicCoordinatorMdFeedback(
  request: { history?: unknown }
): number {
  const history = request.history;
  if (!Array.isArray(history)) return 0;

  return history.filter((raw: unknown) => {
    const h = raw as {
      status?: unknown;
      note?: unknown;
      userRole?: unknown;
      rejectorRole?: unknown;
    };
    if (!isAcOrMdHistoryActor(h)) return false;

    const st = String(h.status ?? '').toLowerCase();
    const note = String(h.note ?? '').toLowerCase();

    if (st === 'rejected') return true;
    if (note.includes('adjust')) return true;

    return false;
  }).length;
}
