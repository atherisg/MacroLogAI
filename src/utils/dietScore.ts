export interface DietScoreResult {
  score: number;
  proteinScore: number;
  macroScore: number;
  calorieScore: number;
  level: 'Elite Day' | 'Solid Day' | 'Decent Day' | 'Needs Improvement';
  color: string;
  insight: string;
}

export function calculateDietScore(
  actualProtein: number,
  targetProtein: number,
  actualCarbs: number,
  targetCarbs: number,
  actualFat: number,
  targetFat: number,
  actualCalories: number,
  targetCalories: number
): DietScoreResult {
  // Protein Score (40%)
  const proteinRatio = targetProtein > 0 ? Math.min(Math.max(actualProtein / targetProtein, 0), 1) : 0;
  const proteinScore = proteinRatio * 40;

  // Macro Balance Score (40%)
  const carbAccuracy = targetCarbs > 0 ? Math.min(Math.max(1 - Math.abs(actualCarbs - targetCarbs) / targetCarbs, 0), 1) : 0;
  const fatAccuracy = targetFat > 0 ? Math.min(Math.max(1 - Math.abs(actualFat - targetFat) / targetFat, 0), 1) : 0;
  const macroBalance = (carbAccuracy + fatAccuracy) / 2;
  const macroScore = macroBalance * 40;

  // Calorie Accuracy Score (20%)
  const calorieDiff = Math.abs(actualCalories - targetCalories);
  const calorieAccuracy = targetCalories > 0 ? Math.min(Math.max(1 - (calorieDiff / targetCalories), 0), 1) : 0;
  const calorieScore = calorieAccuracy * 20;

  // Final Diet Score
  const score = Math.round(proteinScore + macroScore + calorieScore);

  // Level and Color
  let level: DietScoreResult['level'] = 'Needs Improvement';
  let color = 'text-red-500';
  if (score >= 90) {
    level = 'Elite Day';
    color = 'text-green-500';
  } else if (score >= 75) {
    level = 'Solid Day';
    color = 'text-yellow-500';
  } else if (score >= 60) {
    level = 'Decent Day';
    color = 'text-orange-500';
  }

  // Insight
  let insight = '';
  if (score >= 90) {
    insight = "Incredible precision today. Macros and calories are perfectly dialed in.";
  } else if (proteinRatio < 0.8) {
    insight = "Protein intake is low today. Consider a high protein meal.";
  } else if (calorieAccuracy < 0.8) {
    if (actualCalories > targetCalories) {
      insight = "Calories slightly above goal but macros are well balanced.";
    } else {
      insight = "Calories below target. Make sure you're eating enough to fuel your body.";
    }
  } else if (carbAccuracy < 0.8) {
    insight = "Great protein intake. Carbs slightly off target.";
  } else if (fatAccuracy < 0.8) {
    insight = "Great protein intake. Fats slightly off target.";
  } else {
    insight = "Solid day overall. Keep up the consistency!";
  }

  return {
    score,
    proteinScore: Math.round(proteinScore),
    macroScore: Math.round(macroScore),
    calorieScore: Math.round(calorieScore),
    level,
    color,
    insight
  };
}
