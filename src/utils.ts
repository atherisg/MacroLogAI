import { ActivityLevel, FitnessGoal, Gender, UserProfile } from "./types";

export const calculateBMI = (weight: number, height: number) => {
  const heightInMeters = height / 100;
  const bmi = weight / (heightInMeters * heightInMeters);
  
  let category = "";
  if (bmi < 18.5) category = "Underweight";
  else if (bmi < 25) category = "Normal";
  else if (bmi < 30) category = "Overweight";
  else category = "Obese";

  return { value: parseFloat(bmi.toFixed(1)), category };
};

export const calculateTargets = (profile: {
  age: number;
  gender: Gender;
  height: number;
  weight: number;
  activityLevel: ActivityLevel;
  fitnessGoal: FitnessGoal;
}) => {
  // Mifflin-St Jeor Formula
  let bmr = 0;
  if (profile.gender === 'male') {
    bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5;
  } else {
    bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age - 161;
  }

  const multipliers = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    very_active: 1.725,
    athlete: 1.9
  };

  const tdee = bmr * multipliers[profile.activityLevel];

  let calorieTarget = tdee;
  if (profile.fitnessGoal === 'lose_fat') calorieTarget -= 500;
  if (profile.fitnessGoal === 'build_muscle') calorieTarget += 300;
  // Recomposition usually means eating at maintenance or a very slight deficit/surplus, we'll use maintenance.

  // Macro split: 30% Protein, 40% Carbs, 30% Fat
  // Protein: 4 kcal/g, Carbs: 4 kcal/g, Fat: 9 kcal/g
  const proteinGrams = (calorieTarget * 0.30) / 4;
  const carbsGrams = (calorieTarget * 0.40) / 4;
  const fatGrams = (calorieTarget * 0.30) / 9;

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calorieTarget: Math.round(calorieTarget),
    proteinTarget: Math.round(proteinGrams),
    carbsTarget: Math.round(carbsGrams),
    fatTarget: Math.round(fatGrams)
  };
};

export const calculateDailyScore = (
  actual: { calories: number; protein: number; carbs: number; fat: number },
  target: { calories: number; protein: number; carbs: number; fat: number }
) => {
  if (target.calories === 0) return 0;

  // Protein Score (40%)
  const proteinRatio = target.protein > 0 ? Math.min(Math.max(actual.protein / target.protein, 0), 1) : 0;
  const proteinScore = proteinRatio * 40;

  // Macro Balance Score (40%)
  const carbAccuracy = target.carbs > 0 ? Math.min(Math.max(1 - Math.abs(actual.carbs - target.carbs) / target.carbs, 0), 1) : 0;
  const fatAccuracy = target.fat > 0 ? Math.min(Math.max(1 - Math.abs(actual.fat - target.fat) / target.fat, 0), 1) : 0;
  const macroBalance = (carbAccuracy + fatAccuracy) / 2;
  const macroScore = macroBalance * 40;

  // Calorie Accuracy Score (20%)
  const calorieDiff = Math.abs(actual.calories - target.calories);
  const calorieAccuracy = target.calories > 0 ? Math.min(Math.max(1 - (calorieDiff / target.calories), 0), 1) : 0;
  const calorieScore = calorieAccuracy * 20;

  // Final Diet Score
  const score = Math.round(proteinScore + macroScore + calorieScore);
  return Math.max(0, Math.min(100, score));
};
