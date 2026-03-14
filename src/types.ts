export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'athlete';
export type FitnessGoal = 'lose_fat' | 'maintain' | 'build_muscle' | 'recomposition';
export type Gender = 'male' | 'female' | 'other';
export type NutritionMode = 'auto' | 'manual';
export type ThemeType = 'dark' | 'light' | 'midnight' | 'forest' | 'ocean';
export type AccentColor = 'neon-green' | 'blue' | 'purple' | 'orange' | 'red';
export type MacroStrategy = 'bodyweight' | 'balanced' | 'low_carb' | 'high_protein';
export type UnitPreference = 'metric' | 'imperial';

export interface UserSettings {
  animationsEnabled: boolean;
  soundsEnabled: boolean;
  aiSuggestionsEnabled: boolean;
  macroAlertsEnabled: boolean;
  streakNotificationsEnabled: boolean;
}

export interface NotificationSettings {
  mealReminders: boolean;
  macroAlerts: boolean;
  supplementReminders: boolean;
  weeklyReports: boolean;
  streakReminders: boolean;
  reminderTime: string; // HH:mm
}

export interface PrivacySettings {
  isPrivate: boolean;
  leaderboardVisible: boolean;
  anonymousAnalytics: boolean;
}

export interface MicronutrientProfile {
  // Vitamins
  vitaminA?: number; // mcg RAE
  vitaminB1?: number; // mg
  vitaminB2?: number; // mg
  vitaminB3?: number; // mg
  vitaminB5?: number; // mg
  vitaminB6?: number; // mg
  vitaminB9?: number; // mcg DFE (Folate)
  vitaminB12?: number; // mcg
  vitaminC?: number; // mg
  vitaminD?: number; // mcg
  vitaminE?: number; // mg
  vitaminK?: number; // mcg
  // Minerals
  calcium?: number; // mg
  iron?: number; // mg
  magnesium?: number; // mg
  phosphorus?: number; // mg
  potassium?: number; // mg
  sodium?: number; // mg
  zinc?: number; // mg
  copper?: number; // mg
  manganese?: number; // mg
  selenium?: number; // mcg
  iodine?: number; // mcg
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  age: number;
  gender: Gender;
  height: number;
  weight: number;
  activityLevel: ActivityLevel;
  fitnessGoal: FitnessGoal;
  nutritionMode: NutritionMode;
  macroStrategy: MacroStrategy;
  proteinGramsPerKg: number;
  fatGramsPerKg: number;
  unitPreference: UnitPreference;
  aiMacroOptimization: boolean;
  calorieTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
  waterTarget?: number; // in ml
  micronutrientTargets?: MicronutrientProfile;
  theme: ThemeType;
  accentColor: AccentColor;
  dashboardWidgets: string[];
  notificationSettings: NotificationSettings;
  privacy: PrivacySettings;
  createdAt: string;
  settings: UserSettings;
  role?: 'admin' | 'client';
  isPremium?: boolean;
  premiumExpiresAt?: string;
  currentStreakDays?: number;
  longestStreak?: number;
  lastScoredDate?: string;
}

export interface BodyMetric {
  id?: string;
  uid: string;
  weight: number;
  bmi: number;
  bodyFat?: number;
  date: string; // YYYY-MM-DD
}

export interface Meal {
  id?: string;
  uid: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  timestamp: string;
  log_date?: string; // YYYY-MM-DD
  imageUrl?: string;
  imageUrls?: string[];
  confidenceScore?: number;
  sourceType: 'text' | 'image' | 'label';
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  aminoAcidTotals?: AminoAcidProfile;
  micronutrients?: MicronutrientProfile;
  proteinUtilizationScore?: number;
  aiAminoAcidInsights?: string;
  mpsTriggerStatus?: 'MPS_TRIGGERED' | 'BELOW_THRESHOLD';
  proteinQualityAnalysis?: ProteinQualityAnalysis;
}

export interface ProteinQualityAnalysis {
  proteinQualityScore: number;
  rating: string;
  limitingAminoAcids: string[];
  comments: string;
}

export interface AminoAcidProfile {
  // Essential
  leucine?: number;
  isoleucine?: number;
  valine?: number;
  lysine?: number;
  methionine?: number;
  phenylalanine?: number;
  threonine?: number;
  tryptophan?: number;
  histidine?: number;
  // Conditionally Essential / Others
  arginine?: number;
  cysteine?: number;
  tyrosine?: number;
  glutamine?: number;
  glycine?: number;
  proline?: number;
  serine?: number;
  alanine?: number;
  asparticAcid?: number;
  glutamicAcid?: number;
}

export interface FoodItem {
  id?: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  aminoAcidProfile: AminoAcidProfile; // grams per 100g
  micronutrients: MicronutrientProfile; // per 100g
  createdAt: string;
}

export interface PantryItem {
  id?: string;
  uid: string;
  name: string;
  createdAt: string;
}

export interface Supplement {
  id?: string;
  uid: string;
  name: string;
  defaultDose: string;
  unit: string;
  reminderTime?: string; // HH:mm
}

export interface SupplementLog {
  id?: string;
  uid: string;
  supplementId: string;
  supplementName: string;
  timestamp: string;
  date: string;
}

export interface MacroEstimation {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Recipe {
  title: string;
  ingredients: string[];
  instructions: string[];
  macros: MacroEstimation;
  prepTime: string;
  mealPrepTips?: string;
  substitutions?: string[];
}

export interface RecipeFilters {
  dietary: string[];
  cuisine: string;
  maxTime: number;
  mealType?: string;
  customInstructions?: string;
}

export interface SavedRecipe extends Recipe {
  id?: string;
  uid: string;
  createdAt: string;
}

export interface QuickMeal {
  id?: string;
  uid: string;
  mealName: string;
  foods: string[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  timesLogged: number;
  createdAt: string;
}

export interface WeeklyReport {
  id?: string;
  uid: string;
  startDate: string;
  endDate: string;
  avgCalories: number;
  avgProtein: number;
  avgCarbs: number;
  avgFat: number;
  avgDietScore: number;
  daysProteinTargetMet: number;
  daysCalorieTargetMet: number;
  bestDietScore: number;
  worstDietScore: number;
  aiInsights: string;
  createdAt: string;
}

export interface DailyNutritionInsights {
  id?: string;
  uid: string;
  date: string; // YYYY-MM-DD
  proteinDistributionInsight: string;
  proteinDistributionRecommendation: string;
  mealProteinValues: { [mealType: string]: number };
  proteinDistributionScore?: number;
  micronutrientInsights?: string;
  createdAt: string;
}

export interface DailyNutritionSummary {
  id?: string;
  uid: string;
  date: string; // YYYY-MM-DD
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  micronutrients: MicronutrientProfile;
  waterIntakeMl: number;
  createdAt: string;
}

export interface WaterLog {
  id?: string;
  uid: string;
  amountMl: number;
  source: 'water';
  timestamp: string;
  date: string; // YYYY-MM-DD
}
