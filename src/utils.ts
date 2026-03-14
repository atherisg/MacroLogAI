import { ActivityLevel, FitnessGoal, Gender, MacroStrategy, UserProfile } from "./types";

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

export const kgToLbs = (kg: number) => kg * 2.20462;
export const lbsToKg = (lbs: number) => lbs / 2.20462;
export const cmToFtIn = (cm: number) => {
  const totalInches = cm / 2.54;
  const ft = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { ft, in: inches };
};
export const ftInToCm = (ft: number, inches: number) => {
  const totalInches = (ft * 12) + inches;
  return totalInches * 2.54;
};

export const calculateTargets = (profile: {
  age: number;
  gender: Gender;
  height: number;
  weight: number;
  activityLevel: ActivityLevel;
  fitnessGoal: FitnessGoal;
  macroStrategy?: MacroStrategy;
  proteinGramsPerKg?: number;
  fatGramsPerKg?: number;
}) => {
  const { 
    macroStrategy = 'balanced', 
    proteinGramsPerKg = 2.0, 
    fatGramsPerKg = 0.8 
  } = profile;
  // Mifflin-St Jeor Formula
  let bmr = 0;
  if (profile.gender === 'male') {
    bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5;
  } else if (profile.gender === 'female') {
    bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age - 161;
  } else {
    // For 'other', use the average of male and female formulas
    bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age - 78;
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
  if (profile.fitnessGoal === 'lose_fat') {
    // 20% deficit is standard, capped at 500kcal for safety
    calorieTarget = Math.max(bmr, tdee - Math.min(500, tdee * 0.2));
  } else if (profile.fitnessGoal === 'build_muscle') {
    // 10% surplus is standard for lean bulk
    calorieTarget = tdee + Math.min(300, tdee * 0.1);
  } else if (profile.fitnessGoal === 'recomposition') {
    // Recomp is maintenance
    calorieTarget = tdee;
  }

  // Macro Calculation Logic
  let proteinGrams = 0;
  let fatGrams = 0;
  let carbsGrams = 0;

  if (macroStrategy === 'bodyweight') {
    proteinGrams = profile.weight * proteinGramsPerKg;
    fatGrams = profile.weight * fatGramsPerKg;
    carbsGrams = (calorieTarget - (proteinGrams * 4) - (fatGrams * 9)) / 4;
  } else if (macroStrategy === 'low_carb') {
    // 40% Protein, 20% Carbs, 40% Fat
    proteinGrams = (calorieTarget * 0.40) / 4;
    carbsGrams = (calorieTarget * 0.20) / 4;
    fatGrams = (calorieTarget * 0.40) / 9;
  } else if (macroStrategy === 'high_protein') {
    // 45% Protein, 35% Carbs, 20% Fat
    proteinGrams = (calorieTarget * 0.45) / 4;
    carbsGrams = (calorieTarget * 0.35) / 4;
    fatGrams = (calorieTarget * 0.20) / 9;
  } else {
    // Balanced Diet (Default)
    // 30% Protein, 40% Carbs, 30% Fat
    proteinGrams = (calorieTarget * 0.30) / 4;
    fatGrams = (calorieTarget * 0.30) / 9;
    carbsGrams = (calorieTarget * 0.40) / 4;
  }

  // Safety check: ensure carbs don't drop below a healthy minimum (15% of calories)
  const minCarbPtc = 0.15;
  if (carbsGrams * 4 < calorieTarget * minCarbPtc) {
    carbsGrams = (calorieTarget * minCarbPtc) / 4;
    // Adjust protein and fat proportionally to stay within calorie target
    const remainingKcal = calorieTarget - (carbsGrams * 4);
    const currentProteinFatKcal = (proteinGrams * 4) + (fatGrams * 9);
    const scaleFactor = remainingKcal / currentProteinFatKcal;
    proteinGrams *= scaleFactor;
    fatGrams *= scaleFactor;
  }

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
