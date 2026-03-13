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
    very_active: 1.725
  };

  const tdee = bmr * multipliers[profile.activityLevel];

  let calorieTarget = tdee;
  if (profile.fitnessGoal === 'lose_fat') calorieTarget -= 500;
  if (profile.fitnessGoal === 'build_muscle') calorieTarget += 300;

  // Macro split: 30% Protein, 40% Carbs, 30% Fat
  // Protein: 4 kcal/g, Carbs: 4 kcal/g, Fat: 9 kcal/g
  const proteinGrams = (calorieTarget * 0.30) / 4;
  const carbsGrams = (calorieTarget * 0.40) / 4;
  const fatGrams = (calorieTarget * 0.30) / 9;

  return {
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

  const calDiff = Math.abs(actual.calories - target.calories) / target.calories;
  const protDiff = Math.abs(actual.protein - target.protein) / target.protein;
  
  // Simple score: 100 - (weighted average of deviations)
  // Accuracy within 10% is good
  const score = 100 - (calDiff * 50 + protDiff * 50) * 100;
  return Math.max(0, Math.min(100, Math.round(score)));
};
