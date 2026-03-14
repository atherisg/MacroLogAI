import { AminoAcidProfile, Meal } from '../types';

export const FAO_REFERENCE = {
  histidine: 15,
  isoleucine: 30,
  leucine: 59,
  lysine: 45,
  methionine_cysteine: 22,
  phenylalanine_tyrosine: 38,
  threonine: 23,
  tryptophan: 6,
  valine: 39,
};

export function convertAminoAcidsForPortion(profile: AminoAcidProfile, portionGrams: number): AminoAcidProfile {
  const factor = portionGrams / 100;
  const result: AminoAcidProfile = {};
  
  for (const key in profile) {
    const val = profile[key as keyof AminoAcidProfile];
    if (typeof val === 'number') {
      result[key as keyof AminoAcidProfile] = val * factor;
    }
  }
  
  return result;
}

export function aggregateAminoAcids(profiles: AminoAcidProfile[]): AminoAcidProfile {
  const result: AminoAcidProfile = {};
  
  profiles.forEach(profile => {
    for (const key in profile) {
      const val = profile[key as keyof AminoAcidProfile];
      if (typeof val === 'number') {
        result[key as keyof AminoAcidProfile] = (result[key as keyof AminoAcidProfile] || 0) + val;
      }
    }
  });
  
  return result;
}

export function calculateProteinUtilizationScore(profile: AminoAcidProfile, totalProtein: number): { score: number, limitingAA: string } {
  if (totalProtein <= 0) return { score: 0, limitingAA: 'None' };

  const ratios = {
    histidine: (profile.histidine || 0) * 1000 / totalProtein / FAO_REFERENCE.histidine,
    isoleucine: (profile.isoleucine || 0) * 1000 / totalProtein / FAO_REFERENCE.isoleucine,
    leucine: (profile.leucine || 0) * 1000 / totalProtein / FAO_REFERENCE.leucine,
    lysine: (profile.lysine || 0) * 1000 / totalProtein / FAO_REFERENCE.lysine,
    methionine_cysteine: ((profile.methionine || 0) + (profile.cysteine || 0)) * 1000 / totalProtein / FAO_REFERENCE.methionine_cysteine,
    phenylalanine_tyrosine: ((profile.phenylalanine || 0) + (profile.tyrosine || 0)) * 1000 / totalProtein / FAO_REFERENCE.phenylalanine_tyrosine,
    threonine: (profile.threonine || 0) * 1000 / totalProtein / FAO_REFERENCE.threonine,
    tryptophan: (profile.tryptophan || 0) * 1000 / totalProtein / FAO_REFERENCE.tryptophan,
    valine: (profile.valine || 0) * 1000 / totalProtein / FAO_REFERENCE.valine,
  };

  let minRatio = 1.0;
  let limitingAA = 'None';

  for (const [aa, ratio] of Object.entries(ratios)) {
    if (ratio < minRatio) {
      minRatio = ratio;
      limitingAA = aa;
    }
  }

  // If all ratios are >= 1, the score is 100
  const score = Math.round(Math.min(minRatio, 1.0) * 100);
  
  // Format limiting AA for display
  const displayAA = limitingAA.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' + ');

  return { score, limitingAA: score === 100 ? 'None' : displayAA };
}

export function calculateMPSTrigger(leucine: number): 'MPS_TRIGGERED' | 'BELOW_THRESHOLD' {
  return leucine >= 2.5 ? 'MPS_TRIGGERED' : 'BELOW_THRESHOLD';
}

export function analyzeProteinDistribution(meals: Meal[]): { 
  insight: string, 
  recommendation: string, 
  values: { [mealType: string]: number },
  score: number
} {
  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
  const values: { [mealType: string]: number } = {
    breakfast: 0,
    lunch: 0,
    dinner: 0,
    snack: 0
  };

  meals.forEach(meal => {
    if (meal.mealType && mealTypes.includes(meal.mealType)) {
      values[meal.mealType] += meal.protein;
    }
  });

  const totalProtein = Object.values(values).reduce((a, b) => a + b, 0);
  if (totalProtein === 0) {
    return {
      insight: "No protein logged today.",
      recommendation: "Log your meals to see your protein distribution.",
      values,
      score: 0
    };
  }

  const sortedMeals = Object.entries(values).sort((a, b) => b[1] - a[1]);
  const maxMeal = sortedMeals[0];
  
  let insight = "";
  let recommendation = "";
  let score = 100;

  const isConcentrated = maxMeal[1] > totalProtein * 0.6;
  const isBalanced = Object.values(values).filter(v => v >= 20 && v <= 40).length >= 3;

  if (isConcentrated) {
    insight = `Your ${maxMeal[0]} contains most of today's protein intake (${Math.round(maxMeal[1])}g).`;
    recommendation = `Spreading protein more evenly across meals may improve muscle protein synthesis.`;
    score = 60;
    
    if (values.breakfast < 20) {
      recommendation += ` Adding 15–20g protein at breakfast could improve recovery.`;
      score -= 10;
    }
  } else if (isBalanced) {
    insight = "Excellent protein distribution! You've spread your protein intake effectively across your meals.";
    recommendation = "Keep maintaining this balanced approach for optimal muscle protein synthesis.";
    score = 100;
  } else {
    insight = "Your protein distribution is moderate.";
    recommendation = "Aim for 20–40g of protein per meal across 3–5 meals for optimal results.";
    
    // Calculate a basic score based on how many meals have > 20g protein
    const goodMeals = Object.values(values).filter(v => v >= 20).length;
    score = Math.min(70 + (goodMeals * 10), 90);
  }

  return { insight, recommendation, values, score };
}

export const ESSENTIAL_AA_LIST: (keyof AminoAcidProfile)[] = [
  'leucine', 'isoleucine', 'valine', 'lysine', 'methionine', 'phenylalanine', 'threonine', 'tryptophan', 'histidine'
];

export const CONDITIONALLY_ESSENTIAL_AA_LIST: (keyof AminoAcidProfile)[] = [
  'arginine', 'cysteine', 'tyrosine', 'glutamine', 'glycine', 'proline', 'serine', 'alanine', 'asparticAcid', 'glutamicAcid'
];
