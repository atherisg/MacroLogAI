export const MEAL_COLORS = [
  '#ef4444', // Red (Breakfast)
  '#22c55e', // Green (Lunch)
  '#3b82f6', // Blue (Dinner)
  '#f97316', // Orange (Snack)
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#eab308', // Yellow
  '#6366f1', // Indigo
  '#14b8a6', // Teal
];

export const getMealColor = (index: number) => {
  return MEAL_COLORS[index % MEAL_COLORS.length];
};
