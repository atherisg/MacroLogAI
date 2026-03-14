import { UserProfile, MicronutrientProfile, ActivityLevel, FitnessGoal, Gender } from "../types";

export const calculateNutrientTargets = (profile: UserProfile): MicronutrientProfile => {
  const { age, gender, weight, fitnessGoal } = profile;
  const isMale = gender === 'male';
  
  // Base DRI values (simplified NIH/WHO guidelines)
  const targets: MicronutrientProfile = {
    vitaminA: isMale ? 900 : 700,
    vitaminB1: isMale ? 1.2 : 1.1,
    vitaminB2: isMale ? 1.3 : 1.1,
    vitaminB3: isMale ? 16 : 14,
    vitaminB5: 5,
    vitaminB6: age > 50 ? 1.7 : 1.3,
    vitaminB9: 400,
    vitaminB12: 2.4,
    vitaminC: isMale ? 90 : 75,
    vitaminD: 15, // 600 IU
    vitaminE: 15,
    vitaminK: isMale ? 120 : 90,
    calcium: age > 50 ? 1200 : 1000,
    iron: isMale ? 8 : 18,
    magnesium: isMale ? 420 : 320,
    phosphorus: 700,
    potassium: 4700,
    sodium: 2300,
    zinc: isMale ? 11 : 8,
    copper: 0.9,
    manganese: isMale ? 2.3 : 1.8,
    selenium: 55,
    iodine: 150
  };

  // Adjustments for build_muscle goal
  if (fitnessGoal === 'build_muscle') {
    if (targets.magnesium) targets.magnesium *= 1.2;
    if (targets.potassium) targets.potassium *= 1.1;
    if (targets.zinc) targets.zinc *= 1.2;
    if (targets.vitaminD) targets.vitaminD *= 1.5;
    // Electrolytes for performance
    if (targets.sodium) targets.sodium *= 1.2;
    if (targets.calcium) targets.calcium *= 1.1;
  }

  return targets;
};

export const calculateHydrationTarget = (profile: UserProfile): number => {
  const { weight, activityLevel, gender } = profile;
  let base = weight * 35; // 35ml per kg
  
  if (gender === 'male') base += 500;
  
  const activityMultipliers: { [key in ActivityLevel]: number } = {
    sedentary: 1,
    lightly_active: 1.1,
    moderately_active: 1.2,
    very_active: 1.4,
    athlete: 1.6
  };

  return Math.round(base * activityMultipliers[activityLevel]);
};
