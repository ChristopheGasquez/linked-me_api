export const PlanningResponseCodes = {
  // ─── Planning — errors ───────────────────────────────────
  PLANNING_NOT_FOUND: 'planning.not_found',
  PLANNING_INVALID_TIME_RANGE: 'planning.invalid_time_range',
  PLANNING_EVENT_NOT_FOUND: 'planning.event.not_found',
  PLANNING_EVENT_INVALID_TIME_RANGE: 'planning.event.invalid_time_range',
  PLANNING_EVENT_OUT_OF_RANGE: 'planning.event.out_of_range',
  PLANNING_EVENT_OUTSIDE_DAYS: 'planning.event.outside_days',
  PLANNING_CATEGORY_NOT_IN_PLANNING: 'planning.category.not_in_planning',
  PLANNING_LIMIT_PLANNINGS: 'planning.limit.plannings',
  PLANNING_LIMIT_EVENTS: 'planning.limit.events',

  // ─── Planning — success ──────────────────────────────────
  PLANNING_DELETED: 'planning.deleted',
  PLANNING_CLEARED: 'planning.cleared',
  PLANNING_EVENT_DELETED: 'planning.event.deleted',
} as const;
