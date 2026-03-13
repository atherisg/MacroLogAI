export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active';
export type FitnessGoal = 'lose_fat' | 'maintain' | 'build_muscle';
export type Gender = 'male' | 'female' | 'other';
export type NutritionMode = 'auto' | 'manual';
export type ThemeType = 'dark' | 'light' | 'midnight' | 'forest' | 'ocean';
export type AccentColor = 'neon-green' | 'blue' | 'purple' | 'orange' | 'red';

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
  aiMacroOptimization: boolean;
  calorieTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
  theme: ThemeType;
  accentColor: AccentColor;
  dashboardWidgets: string[];
  notificationSettings: NotificationSettings;
  privacy: PrivacySettings;
  createdAt: string;
  settings: UserSettings;
  role?: 'admin' | 'client';
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
  imageUrl?: string;
  sourceType: 'text' | 'image' | 'label';
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
}
