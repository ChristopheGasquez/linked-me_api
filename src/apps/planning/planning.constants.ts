// Exposed to clients in /docs/constants
export const PlanningConstants = {
  MAX_PLANNINGS_PER_USER: 50,
  MAX_CATEGORIES_PER_PLANNING: 20,
  MAX_EVENTS_PER_PLANNING: 500,
  // Category color = hue index of the front theme palette, not a color code
  COLOR_MIN: 1,
  COLOR_MAX: 5,
  // ISO days: 1 = Monday ... 7 = Sunday
  DAY_MIN: 1,
  DAY_MAX: 7,
  MINUTES_PER_DAY: 1440,
  NAME_MAX_LENGTH: 100,
  CATEGORY_NAME_MAX_LENGTH: 50,
  EVENT_TITLE_MAX_LENGTH: 100,
  EVENT_LOCATION_MAX_LENGTH: 200,
  EVENT_DESCRIPTION_MAX_LENGTH: 2000,
} as const;
