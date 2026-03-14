import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy, getDocs, doc, updateDoc, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, Meal, QuickMeal, WeeklyReport, Recipe, MacroEstimation, WaterLog, MicronutrientProfile } from '../types';
import { calculateDietScore } from '../utils/dietScore';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Zap, Plus, Minus, Sparkles, Repeat, BarChart3, Flame, Loader2, ChevronRight, Save, Check, Trash2, Lock, Droplets, Shield } from 'lucide-react';
import { format, subDays, isBefore, startOfDay, endOfDay, differenceInDays, startOfWeek, endOfWeek, isSameDay, addDays } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import AnimatedNumber from '../components/AnimatedNumber';
import confetti from 'canvas-confetti';
import { useAppSound } from '../components/SoundProvider';
import { clsx } from 'clsx';
import { DietScoreWidget } from '../components/DietScoreWidget';
import { StreakCalendar } from '../components/StreakCalendar';
import { CollapsibleSection } from '../components/CollapsibleSection';
import { getMealSuggestions, getWeeklyInsights } from '../services/gemini';
import { addDoc, deleteDoc, setDoc } from 'firebase/firestore';
import AminoAcidCoverage from '../components/AminoAcidCoverage';
import PremiumLocked from '../components/PremiumLocked';
import { hasPremiumAccess } from '../utils/premium';
import { AminoAcidProfile, DailyNutritionInsights } from '../types';
import { analyzeProteinDistribution } from '../services/aminoAcidService';
import { HydrationTracker } from '../components/HydrationTracker';
import { MicronutrientIntelligence } from '../components/MicronutrientIntelligence';
import { calculateHydrationTarget, calculateNutrientTargets } from '../services/nutrition';
import { getMealColor } from '../utils/colors';
import { SegmentedProgressBar } from '../components/SegmentedProgressBar';
import ConfirmModal from '../components/ConfirmModal';

export default function Dashboard({ user, profile, onAddFood, onNavigate, selectedDate, onDateChange }: { user: User, profile: UserProfile, onAddFood?: (mealType: string) => void, onNavigate?: (view: any) => void, selectedDate: string, onDateChange: (date: string) => void }) {
  const [todayMeals, setTodayMeals] = useState<Meal[]>([]);
  const [quickMeals, setQuickMeals] = useState<QuickMeal[]>([]);
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null);
  const [suggestions, setSuggestions] = useState<Recipe[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [weeklyScores, setWeeklyScores] = useState<{date: Date, score: number}[]>([]);
  const [savingRecipeIdx, setSavingRecipeIdx] = useState<number | null>(null);
  const [dailyInsights, setDailyInsights] = useState<DailyNutritionInsights | null>(null);
  const [todayWaterLogs, setTodayWaterLogs] = useState<WaterLog[]>([]);
  const [mealToDelete, setMealToDelete] = useState<string | null>(null);
  
  const { playReward, playClick } = useAppSound();
  const today = selectedDate; // Use selectedDate instead of current date
  const actualToday = format(new Date(), 'yyyy-MM-dd');
  const isToday = today === actualToday;

  useEffect(() => {
    const checkAndUpdateStreak = async () => {
      const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
      const lastScored = profile.lastScoredDate;

      if (!lastScored) {
        // First time scoring, set to yesterday so it starts fresh today
        await updateDoc(doc(db, 'users', user.uid), {
          lastScoredDate: yesterday,
          currentStreakDays: 0,
          longestStreak: profile.longestStreak || 0
        });
        return;
      }

      if (lastScored >= yesterday) {
        // Already scored up to yesterday
        return;
      }

      // We need to score days from lastScored + 1 to yesterday
      const daysToScore = differenceInDays(new Date(yesterday), new Date(lastScored));
      
      // If it's been more than 7 days, just reset the streak to avoid massive queries
      if (daysToScore > 7) {
        await updateDoc(doc(db, 'users', user.uid), {
          lastScoredDate: yesterday,
          currentStreakDays: 0
        });
        return;
      }

      let currentStreak = profile.currentStreakDays || 0;
      let longestStreak = profile.longestStreak || 0;

      for (let i = daysToScore; i >= 1; i--) {
        const dateToScore = subDays(new Date(), i);
        const start = startOfDay(dateToScore).toISOString();
        const end = endOfDay(dateToScore).toISOString();

        const q = query(
          collection(db, 'meals'),
          where('uid', '==', user.uid),
          where('timestamp', '>=', start),
          where('timestamp', '<=', end)
        );

        const snap = await getDocs(q);
        const meals = snap.docs.map(doc => doc.data() as Meal);

        const totals = meals.reduce((acc, meal) => ({
          calories: acc.calories + meal.calories,
          protein: acc.protein + meal.protein,
          carbs: acc.carbs + meal.carbs,
          fat: acc.fat + meal.fat
        }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

        const scoreResult = calculateDietScore(
          totals.protein, profile.proteinTarget,
          totals.carbs, profile.carbsTarget,
          totals.fat, profile.fatTarget,
          totals.calories, profile.calorieTarget
        );

        if (scoreResult.score >= 75) {
          currentStreak += 1;
          if (currentStreak > longestStreak) {
            longestStreak = currentStreak;
          }
        } else {
          currentStreak = 0;
        }
      }

      await updateDoc(doc(db, 'users', user.uid), {
        lastScoredDate: yesterday,
        currentStreakDays: currentStreak,
        longestStreak: longestStreak
      });
    };

    checkAndUpdateStreak().catch(err => console.error("Failed to update streak:", err));
  }, [user.uid, profile.lastScoredDate, profile.currentStreakDays, profile.longestStreak, profile.proteinTarget, profile.carbsTarget, profile.fatTarget, profile.calorieTarget]);

  // Fetch Quick Meals and Weekly Report
  useEffect(() => {
    const unsubQuick = onSnapshot(
      query(collection(db, 'quick_meals'), where('uid', '==', user.uid), orderBy('timesLogged', 'desc')),
      (snap) => setQuickMeals(snap.docs.map(d => ({ id: d.id, ...d.data() } as QuickMeal))),
      (err) => console.error("Quick meals fetch failed:", err)
    );

    const unsubReport = onSnapshot(
      query(collection(db, 'weekly_reports'), where('uid', '==', user.uid), orderBy('createdAt', 'desc'), limit(1)),
      (snap) => {
        if (!snap.empty) setWeeklyReport({ id: snap.docs[0].id, ...snap.docs[0].data() } as WeeklyReport);
      },
      (err) => console.error("Weekly report fetch failed:", err)
    );

    const unsubWater = onSnapshot(
      query(collection(db, 'water_logs'), where('uid', '==', user.uid), where('date', '==', selectedDate)),
      (snap) => setTodayWaterLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as WaterLog))),
      (err) => console.error("Water logs fetch failed:", err)
    );

    return () => {
      unsubQuick();
      unsubReport();
      unsubWater();
    };
  }, [user.uid, selectedDate]);

  // Fetch Weekly Scores for Heatmap
  useEffect(() => {
    const fetchWeeklyScores = async () => {
      const start = startOfWeek(new Date(), { weekStartsOn: 1 });
      const scores: {date: Date, score: number}[] = [];

      for (let i = 0; i < 7; i++) {
        const date = addDays(start, i);
        if (isBefore(new Date(), startOfDay(date)) && !isSameDay(date, new Date())) continue;

        const s = startOfDay(date).toISOString();
        const e = endOfDay(date).toISOString();

        const q = query(
          collection(db, 'meals'),
          where('uid', '==', user.uid),
          where('timestamp', '>=', s),
          where('timestamp', '<=', e)
        );

        const snap = await getDocs(q);
        const meals = snap.docs.map(doc => doc.data() as Meal);

        const t = meals.reduce((acc, meal) => ({
          calories: acc.calories + meal.calories,
          protein: acc.protein + meal.protein,
          carbs: acc.carbs + meal.carbs,
          fat: acc.fat + meal.fat
        }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

        const scoreRes = calculateDietScore(
          t.protein, profile.proteinTarget,
          t.carbs, profile.carbsTarget,
          t.fat, profile.fatTarget,
          t.calories, profile.calorieTarget
        );

        scores.push({ date, score: scoreRes.score });
      }
      setWeeklyScores(scores);
    };

    fetchWeeklyScores();
  }, [user.uid, todayMeals, profile.proteinTarget, profile.carbsTarget, profile.fatTarget, profile.calorieTarget]);

  // Quick Meal Detection
  useEffect(() => {
    const detectQuickMeals = async () => {
      if (todayMeals.length === 0) return;

      // Group meals by description to find repeats
      const mealCounts: Record<string, { count: number, meal: Meal }> = {};
      
      // Fetch all meals for the last 30 days to find patterns
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      const q = query(
        collection(db, 'meals'),
        where('uid', '==', user.uid),
        where('timestamp', '>=', thirtyDaysAgo)
      );
      
      const snap = await getDocs(q);
      const allMeals = snap.docs.map(d => d.data() as Meal);

      allMeals.forEach(m => {
        const key = m.description.toLowerCase().trim();
        if (!mealCounts[key]) {
          mealCounts[key] = { count: 0, meal: m };
        }
        mealCounts[key].count++;
      });

      for (const key in mealCounts) {
        if (mealCounts[key].count >= 3) {
          // Check if already in quick_meals
          const existing = quickMeals.find(qm => qm.mealName.toLowerCase().trim() === key);
          if (!existing) {
            const m = mealCounts[key].meal;
            await addDoc(collection(db, 'quick_meals'), {
              uid: user.uid,
              mealName: m.description,
              foods: [m.description],
              calories: m.calories,
              protein: m.protein,
              carbs: m.carbs,
              fat: m.fat,
              timesLogged: mealCounts[key].count,
              createdAt: new Date().toISOString()
            });
          } else if (existing.timesLogged !== mealCounts[key].count) {
            await updateDoc(doc(db, 'quick_meals', existing.id!), {
              timesLogged: mealCounts[key].count
            });
          }
        }
      }
    };

    detectQuickMeals();
  }, [user.uid, todayMeals.length, quickMeals.length]);

  // Weekly Report Generation
  useEffect(() => {
    const generateWeeklyReport = async () => {
      const lastReport = weeklyReport;
      const weekAgo = subDays(new Date(), 7);
      
      if (lastReport && new Date(lastReport.createdAt) > weekAgo) return;

      const start = startOfWeek(subDays(new Date(), 7), { weekStartsOn: 1 });
      const end = endOfWeek(subDays(new Date(), 7), { weekStartsOn: 1 });

      const q = query(
        collection(db, 'meals'),
        where('uid', '==', user.uid),
        where('timestamp', '>=', start.toISOString()),
        where('timestamp', '<=', end.toISOString())
      );

      const snap = await getDocs(q);
      const meals = snap.docs.map(d => d.data() as Meal);

      if (meals.length === 0) return;

      // Group by day
      const days: Record<string, Meal[]> = {};
      meals.forEach(m => {
        const d = format(new Date(m.timestamp), 'yyyy-MM-dd');
        if (!days[d]) days[d] = [];
        days[d].push(m);
      });

      const dayStats = Object.values(days).map(dayMeals => {
        const t = dayMeals.reduce((acc, m) => ({
          calories: acc.calories + m.calories,
          protein: acc.protein + m.protein,
          carbs: acc.carbs + m.carbs,
          fat: acc.fat + m.fat
        }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

        const score = calculateDietScore(
          t.protein, profile.proteinTarget,
          t.carbs, profile.carbsTarget,
          t.fat, profile.fatTarget,
          t.calories, profile.calorieTarget
        );

        return { totals: t, score: score.score };
      });

      const avgCalories = dayStats.reduce((acc, s) => acc + s.totals.calories, 0) / 7;
      const avgProtein = dayStats.reduce((acc, s) => acc + s.totals.protein, 0) / 7;
      const avgCarbs = dayStats.reduce((acc, s) => acc + s.totals.carbs, 0) / 7;
      const avgFat = dayStats.reduce((acc, s) => acc + s.totals.fat, 0) / 7;
      const avgDietScore = dayStats.reduce((acc, s) => acc + s.score, 0) / 7;

      const daysProteinTargetMet = dayStats.filter(s => s.totals.protein >= profile.proteinTarget).length;
      const daysCalorieTargetMet = dayStats.filter(s => Math.abs(s.totals.calories - profile.calorieTarget) < 200).length;
      const bestDietScore = Math.max(...dayStats.map(s => s.score));
      const worstDietScore = Math.min(...dayStats.map(s => s.score));

      const reportData: Partial<WeeklyReport> = {
        uid: user.uid,
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(end, 'yyyy-MM-dd'),
        avgCalories,
        avgProtein,
        avgCarbs,
        avgFat,
        avgDietScore,
        daysProteinTargetMet,
        daysCalorieTargetMet,
        bestDietScore,
        worstDietScore,
        createdAt: new Date().toISOString()
      };

      const aiInsights = await getWeeklyInsights(reportData, profile);
      reportData.aiInsights = aiInsights;

      await addDoc(collection(db, 'weekly_reports'), reportData);
    };

    generateWeeklyReport();
  }, [user.uid, weeklyReport, profile]);

  useEffect(() => {
    const q = query(
      collection(db, 'meals'),
      where('uid', '==', user.uid),
      where('log_date', '==', selectedDate)
    );

    const unsubMeals = onSnapshot(q, (snap) => {
      // Sort in memory since we are querying by log_date
      const meals = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Meal));
      meals.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setTodayMeals(meals);
    }, (error) => {
      console.error("Meals fetch failed:", error);
    });

    return () => {
      unsubMeals();
    };
  }, [user.uid, selectedDate]);

  useEffect(() => {
    const q = query(
      collection(db, 'daily_nutrition_insights'),
      where('uid', '==', user.uid),
      where('date', '==', selectedDate)
    );

    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setDailyInsights({ id: snap.docs[0].id, ...snap.docs[0].data() } as DailyNutritionInsights);
      } else {
        setDailyInsights(null);
      }
    }, (err) => {
      console.error("Daily insights fetch failed:", err);
      // Don't throw here as it's an async callback
    });

    return () => unsub();
  }, [user.uid, selectedDate]);

  useEffect(() => {
    if (!hasPremiumAccess(profile) || todayMeals.length === 0) return;

    const updateDailyInsights = async () => {
      const distribution = analyzeProteinDistribution(todayMeals);
      
      const q = query(
        collection(db, 'daily_nutrition_insights'),
        where('uid', '==', user.uid),
        where('date', '==', selectedDate)
      );
      
      const snap = await getDocs(q);
      const insightData = {
        uid: user.uid,
        date: selectedDate,
        proteinDistributionInsight: distribution.insight,
        proteinDistributionRecommendation: distribution.recommendation,
        mealProteinValues: distribution.values,
        proteinDistributionScore: distribution.score,
        createdAt: new Date().toISOString()
      };

      if (snap.empty) {
        await addDoc(collection(db, 'daily_nutrition_insights'), insightData);
      } else {
        const existingDoc = snap.docs[0];
        const existingData = existingDoc.data();
        
        // Only update if values changed
        const valuesChanged = JSON.stringify(existingData.mealProteinValues) !== JSON.stringify(distribution.values);
        if (valuesChanged) {
          await updateDoc(doc(db, 'daily_nutrition_insights', existingDoc.id), insightData);
        }
      }
    };

    const timer = setTimeout(updateDailyInsights, 2000); // Debounce updates
    return () => clearTimeout(timer);
  }, [user.uid, todayMeals, profile, selectedDate]);

  const totals = todayMeals.reduce((acc, meal) => ({
    calories: acc.calories + meal.calories,
    protein: acc.protein + meal.protein,
    carbs: acc.carbs + meal.carbs,
    fat: acc.fat + meal.fat
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const dailyAminoAcids = todayMeals.reduce((acc, meal) => {
    if (!meal.aminoAcidTotals) return acc;
    const newAcc = { ...acc };
    Object.keys(meal.aminoAcidTotals).forEach(key => {
      const k = key as keyof AminoAcidProfile;
      newAcc[k] = (newAcc[k] || 0) + (meal.aminoAcidTotals![k] || 0);
    });
    return newAcc;
  }, {} as AminoAcidProfile);

  const dailyMicronutrients = todayMeals.reduce((acc, meal) => {
    if (!meal.micronutrients) return acc;
    const newAcc = { ...acc };
    Object.keys(meal.micronutrients).forEach(key => {
      const k = key as keyof MicronutrientProfile;
      newAcc[k] = (newAcc[k] || 0) + (meal.micronutrients![k] || 0);
    });
    return newAcc;
  }, {} as MicronutrientProfile);

  const totalWater = todayWaterLogs.reduce((acc, log) => acc + log.amountMl, 0);
  const hydrationTarget = calculateHydrationTarget(profile);
  const micronutrientTargets = calculateNutrientTargets(profile);

  const scoreResult = calculateDietScore(
    totals.protein, profile.proteinTarget,
    totals.carbs, profile.carbsTarget,
    totals.fat, profile.fatTarget,
    totals.calories, profile.calorieTarget
  );

  useEffect(() => {
    if (scoreResult.score >= 90 && todayMeals.length > 0) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#82D95D', '#ffffff']
      });
      playReward();
    }
  }, [scoreResult.score, playReward, todayMeals.length]);

  const macroData = [
    { name: 'Protein', value: totals.protein * 4, color: '#82D95D' },
    { name: 'Carbs', value: totals.carbs * 4, color: '#38bdf8' },
    { name: 'Fat', value: totals.fat * 9, color: '#fbbf24' }
  ];

  const CircularProgress = ({ label, value, target, unit, color, precision = 0 }: any) => {
    const percentage = Math.min(100, (value / target) * 100);
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <div className="flex flex-col items-center gap-2">
        <div className="relative w-24 h-24">
          <svg className="w-full h-full -rotate-90">
            <circle
              cx="48"
              cy="48"
              r={radius}
              className="stroke-zinc-800"
              strokeWidth="6"
              fill="transparent"
            />
            <motion.circle
              cx="48"
              cy="48"
              r={radius}
              stroke={color}
              strokeWidth="6"
              fill="transparent"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]"
              style={{ filter: `drop-shadow(0 0 8px ${color})` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-sm font-black italic"><AnimatedNumber value={value} precision={precision} /></span>
            <span className="text-[10px] text-zinc-500 uppercase">{unit}</span>
          </div>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</span>
      </div>
    );
  };

  const categorizeMeal = (meal: Meal) => {
    if (meal.mealType) return meal.mealType;
    const hour = new Date(meal.timestamp).getHours();
    if (hour >= 5 && hour < 11) return 'breakfast';
    if (hour >= 11 && hour < 15) return 'lunch';
    if (hour >= 15 && hour < 21) return 'dinner';
    return 'snack';
  };

  const mealsByCategory = {
    breakfast: todayMeals.filter(m => categorizeMeal(m) === 'breakfast'),
    lunch: todayMeals.filter(m => categorizeMeal(m) === 'lunch'),
    dinner: todayMeals.filter(m => categorizeMeal(m) === 'dinner'),
    snack: todayMeals.filter(m => categorizeMeal(m) === 'snack'),
  };

  const handleDeleteMeal = async (mealId: string) => {
    try {
      await deleteDoc(doc(db, 'meals', mealId));
      playClick();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'meals');
    }
  };

  const MealSection = ({ title, type, meals }: { title: string, type: string, meals: Meal[] }) => (
    <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-3xl overflow-hidden">
      <div className="p-4 flex justify-between items-center border-b border-zinc-800/50 bg-zinc-900/50">
        <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">{title}</h3>
        <button 
          onClick={() => onAddFood && onAddFood(type)}
          className="text-primary hover:text-primary/80 transition-colors flex items-center gap-1 text-xs font-bold uppercase tracking-wider"
        >
          <Plus size={14} /> Add Food
        </button>
      </div>
      <div className="p-2">
        {meals.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-xs text-zinc-600">No foods logged</p>
          </div>
        ) : (
          <div className="space-y-1">
            {meals.map(meal => (
              <div key={meal.id} className="p-3 bg-zinc-800/20 hover:bg-zinc-800/40 transition-colors rounded-2xl flex justify-between items-center group">
                <div className="flex-1">
                  <p className="font-bold text-sm">{meal.description}</p>
                  <p className="text-[10px] text-zinc-500 uppercase font-mono mt-1">
                    {meal.calories}kcal • P:{meal.protein}g • C:{meal.carbs}g • F:{meal.fat}g
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-[10px] text-zinc-600 font-mono">
                    {format(new Date(meal.timestamp), 'h:mm a')}
                  </div>
                  <button 
                    onClick={() => setMealToDelete(meal.id!)}
                    className="p-2 text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // Simple AI Insight generation based on macros
  const getAIInsight = () => {
    if (todayMeals.length === 0) return "Log your first meal to get personalized AI insights.";
    
    const proteinDiff = profile.proteinTarget - totals.protein;
    if (proteinDiff > 20) {
      return `You are ${Math.round(proteinDiff)}g short of your protein goal. Consider a high-protein snack like Greek yogurt or a shake to optimize muscle synthesis.`;
    }
    
    const caloriesDiff = profile.calorieTarget - totals.calories;
    if (caloriesDiff > 300) {
      return `You have ${Math.round(caloriesDiff)} calories remaining. A balanced meal with complex carbs and healthy fats would be ideal now.`;
    }
    
    if (caloriesDiff < -100) {
      return `You've exceeded your calorie target by ${Math.round(Math.abs(caloriesDiff))}kcal. Focus on hydration and fiber-rich vegetables for the rest of the day.`;
    }

    if (dailyInsights?.proteinDistributionScore && dailyInsights.proteinDistributionScore < 80) {
      return `Your protein distribution is currently ${dailyInsights.proteinDistributionScore}% optimized. Try to spread your protein more evenly across your next meals.`;
    }

    return "You're doing great today! Your macros and distribution are looking balanced and optimized.";
  };

  const handleGetSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const remaining = {
        calories: Math.max(0, profile.calorieTarget - totals.calories),
        protein: Math.max(0, profile.proteinTarget - totals.protein),
        carbs: Math.max(0, profile.carbsTarget - totals.carbs),
        fat: Math.max(0, profile.fatTarget - totals.fat)
      };
      const res = await getMealSuggestions(remaining, profile);
      setSuggestions(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleLogQuickMeal = async (meal: QuickMeal) => {
    try {
      await addDoc(collection(db, 'meals'), {
        uid: user.uid,
        description: meal.mealName,
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fat: meal.fat,
        timestamp: new Date().toISOString(),
        sourceType: 'text'
      });
      // Update times logged
      await updateDoc(doc(db, 'quick_meals', meal.id!), {
        timesLogged: meal.timesLogged + 1
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'meals');
    }
  };

  const handleRepeatYesterday = async () => {
    try {
      const yesterday = subDays(new Date(), 1);
      const start = startOfDay(yesterday).toISOString();
      const end = endOfDay(yesterday).toISOString();

      const q = query(
        collection(db, 'meals'),
        where('uid', '==', user.uid),
        where('timestamp', '>=', start),
        where('timestamp', '<=', end)
      );

      const snap = await getDocs(q);
      const yesterdayMeals = snap.docs.map(d => d.data() as Meal);

      for (const m of yesterdayMeals) {
        await addDoc(collection(db, 'meals'), {
          ...m,
          timestamp: new Date().toISOString()
        });
      }
      playReward();
    } catch (err) {
      console.error(err);
    }
  };

  const saveSuggestionAsRecipe = async (recipe: Recipe, idx: number) => {
    setSavingRecipeIdx(idx);
    try {
      await addDoc(collection(db, 'saved_recipes'), {
        uid: user.uid,
        title: recipe.title,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        calories: recipe.macros.calories,
        protein: recipe.macros.protein,
        carbs: recipe.macros.carbs,
        fat: recipe.macros.fat,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setSavingRecipeIdx(null), 2000);
    }
  };

  const logSuggestion = async (recipe: Recipe) => {
    try {
      await addDoc(collection(db, 'meals'), {
        uid: user.uid,
        description: recipe.title,
        calories: recipe.macros.calories,
        protein: recipe.macros.protein,
        carbs: recipe.macros.carbs,
        fat: recipe.macros.fat,
        timestamp: new Date().toISOString(),
        sourceType: 'text'
      });
      playReward();
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogWater = async (amount: number, source: 'water') => {
    try {
      await addDoc(collection(db, 'water_logs'), {
        uid: user.uid,
        amountMl: amount,
        source,
        timestamp: new Date().toISOString(),
        date: selectedDate
      });
      playReward();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'water_logs');
    }
  };

  const getStreakMilestone = (days: number) => {
    if (days >= 30) return "Elite Consistency";
    if (days >= 14) return "Nutrition Focused";
    if (days >= 7) return "Weekly Discipline";
    if (days >= 3) return "Consistency Starting";
    return null;
  };

  const milestone = getStreakMilestone(profile.currentStreakDays || 0);

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center justify-between bg-zinc-900/50 p-3 rounded-2xl border border-zinc-800/50">
        <button 
          onClick={() => onDateChange(format(subDays(new Date(selectedDate + 'T00:00:00'), 1), 'yyyy-MM-dd'))}
          className="p-2 rounded-xl hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
        >
          <ChevronRight size={20} className="rotate-180" />
        </button>
        
        <div className="flex flex-col items-center">
          <span className="text-sm font-bold uppercase tracking-widest text-primary">
            {isToday ? 'Today' : format(new Date(selectedDate + 'T00:00:00'), 'MMM d, yyyy')}
          </span>
          {!isToday && (
            <button 
              onClick={() => onDateChange(actualToday)}
              className="text-[10px] text-zinc-500 hover:text-white uppercase tracking-widest mt-1"
            >
              Back to Today
            </button>
          )}
        </div>

        <button 
          onClick={() => onDateChange(format(addDays(new Date(selectedDate + 'T00:00:00'), 1), 'yyyy-MM-dd'))}
          disabled={isToday}
          className="p-2 rounded-xl hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
            <Flame size={24} className={clsx((profile.currentStreakDays || 0) > 0 && "animate-pulse")} />
          </div>
          <div>
            <h2 className="text-xl font-black italic uppercase tracking-tighter leading-none">
              {profile.currentStreakDays || 0} Day Streak
            </h2>
            <p className="text-[10px] font-bold uppercase text-zinc-500 mt-1">
              Longest: {profile.longestStreak || 0} days
            </p>
          </div>
        </div>
        {milestone && (
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-primary text-black px-3 py-1 rounded-full text-[10px] font-black uppercase italic"
          >
            {milestone}
          </motion.div>
        )}
      </div>

      <CollapsibleSection title="Daily Performance" icon={BarChart3}>
        <DietScoreWidget
          actualProtein={totals.protein}
          targetProtein={profile.proteinTarget}
          actualCarbs={totals.carbs}
          targetCarbs={profile.carbsTarget}
          actualFat={totals.fat}
          targetFat={profile.fatTarget}
          actualCalories={totals.calories}
          targetCalories={profile.calorieTarget}
          currentStreakDays={profile.currentStreakDays || 0}
          longestStreak={profile.longestStreak || 0}
        />
      </CollapsibleSection>

      <CollapsibleSection title="Consistency" icon={Flame}>
        <StreakCalendar scores={weeklyScores} />
      </CollapsibleSection>

      <CollapsibleSection title="Hydration" icon={Droplets}>
        <div className="px-2">
          <HydrationTracker 
            current={totalWater} 
            target={hydrationTarget} 
            onLog={handleLogWater} 
            isPremium={hasPremiumAccess(profile)} 
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection 
        title="Smart Meal Suggestions" 
        icon={Sparkles}
        headerRight={
          <button 
            onClick={handleGetSuggestions}
            disabled={loadingSuggestions}
            className="text-primary text-[10px] font-bold uppercase flex items-center gap-1 hover:opacity-80 transition-opacity disabled:opacity-50"
          >
            {loadingSuggestions ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {suggestions.length > 0 ? 'Refresh' : 'Get Suggestions'}
          </button>
        }
      >
        {suggestions.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-4 px-2 no-scrollbar">
            {suggestions.map((s, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="min-w-[280px] bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4"
              >
                <div>
                  <h4 className="font-black italic uppercase text-sm text-white leading-tight">{s.title}</h4>
                  <p className="text-[10px] text-zinc-500 uppercase mt-1">{s.prepTime}</p>
                </div>
                <div className="flex justify-between items-center bg-zinc-800/50 rounded-2xl p-3">
                  <div className="text-center">
                    <p className="text-[8px] font-bold uppercase text-zinc-500">Cals</p>
                    <p className="text-xs font-bold">{s.macros.calories.toFixed(0)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[8px] font-bold uppercase text-zinc-500">Prot</p>
                    <p className="text-xs font-bold text-primary">{s.macros.protein.toFixed(1)}g</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[8px] font-bold uppercase text-zinc-500">Carb</p>
                    <p className="text-xs font-bold text-blue-400">{s.macros.carbs.toFixed(1)}g</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[8px] font-bold uppercase text-zinc-500">Fat</p>
                    <p className="text-xs font-bold text-yellow-500">{s.macros.fat.toFixed(1)}g</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => logSuggestion(s)}
                    className="flex-1 bg-primary text-black py-2 rounded-xl text-[10px] font-bold uppercase"
                  >
                    Log Meal
                  </button>
                  <button 
                    onClick={() => saveSuggestionAsRecipe(s, i)}
                    className="p-2 bg-zinc-800 text-white rounded-xl hover:bg-zinc-700 transition-colors"
                  >
                    {savingRecipeIdx === i ? <Check size={14} className="text-green-500" /> : <Save size={14} />}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="bg-zinc-900/30 border border-zinc-800 border-dashed rounded-3xl p-8 text-center space-y-2 mx-2">
            <p className="text-xs text-zinc-500 italic">"{getAIInsight()}"</p>
          </div>
        )}

        {suggestions.length > 0 && getAIInsight() && (
          <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 flex gap-3 mx-2 mt-4">
            <Sparkles size={16} className="text-primary shrink-0 mt-1" />
            <p className="text-xs text-zinc-400 leading-relaxed italic">
              {getAIInsight()}
            </p>
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection 
        title="Quick Meals" 
        headerRight={
          <button 
            onClick={handleRepeatYesterday}
            className="text-zinc-400 text-[10px] font-bold uppercase flex items-center gap-1 hover:text-white transition-colors"
          >
            <Repeat size={12} /> Repeat Yesterday
          </button>
        }
      >
        <div className="grid grid-cols-1 gap-3 px-2">
          {quickMeals.slice(0, 3).map(meal => (
            <div key={meal.id} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 flex justify-between items-center group">
              <div>
                <h4 className="font-bold text-sm text-white">{meal.mealName}</h4>
                <p className="text-[10px] text-zinc-500 uppercase font-mono mt-0.5">
                  {meal.calories.toFixed(0)}kcal • P:{meal.protein.toFixed(1)}g • C:{meal.carbs.toFixed(1)}g • F:{meal.fat.toFixed(1)}g
                </p>
              </div>
              <button 
                onClick={() => handleLogQuickMeal(meal)}
                className="bg-zinc-800 hover:bg-primary hover:text-black p-2 rounded-xl transition-all"
              >
                <Plus size={16} />
              </button>
            </div>
          ))}
          {quickMeals.length === 0 && (
            <p className="text-center text-[10px] text-zinc-600 uppercase py-4">Log meals regularly to see quick repeats here.</p>
          )}
        </div>
      </CollapsibleSection>

      {weeklyReport && (
        <CollapsibleSection 
          title="Weekly Nutrition Report" 
          headerRight={<span className="text-[10px] font-bold text-zinc-600 uppercase">{weeklyReport.startDate} - {weeklyReport.endDate}</span>}
        >
          <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-6 space-y-6 mx-2">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase text-zinc-500">Avg Calories</p>
                <p className="text-2xl font-black italic uppercase tracking-tighter">{Math.round(weeklyReport.avgCalories)} kcal</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase text-zinc-500">Avg Diet Score</p>
                <p className="text-2xl font-black italic uppercase tracking-tighter text-primary">{Math.round(weeklyReport.avgDietScore)}/100</p>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 border-t border-zinc-800 pt-6">
              <div className="text-center">
                <p className="text-[8px] font-bold uppercase text-zinc-500">Avg Protein</p>
                <p className="font-bold">{Math.round(weeklyReport.avgProtein)}g</p>
              </div>
              <div className="text-center">
                <p className="text-[8px] font-bold uppercase text-zinc-500">Avg Carbs</p>
                <p className="font-bold">{Math.round(weeklyReport.avgCarbs)}g</p>
              </div>
              <div className="text-center">
                <p className="text-[8px] font-bold uppercase text-zinc-500">Avg Fat</p>
                <p className="font-bold">{Math.round(weeklyReport.avgFat)}g</p>
              </div>
            </div>

            {!hasPremiumAccess(profile) ? (
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-4 flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 text-primary">
                  <Lock size={12} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Premium Insight</span>
                </div>
                <p className="text-[10px] text-zinc-500 text-center">Upgrade to Premium to unlock AI-powered nutrition analysis.</p>
                <button onClick={() => onNavigate?.('premium')} className="text-[10px] text-primary font-bold underline">Learn More</button>
              </div>
            ) : (
              <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 flex gap-3">
                <Sparkles size={16} className="text-primary shrink-0 mt-1" />
                <p className="text-xs text-zinc-400 leading-relaxed italic">
                  {weeklyReport.aiInsights}
                </p>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      <CollapsibleSection title="Daily Nutrition">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-2">
          <CircularProgress label="Calories" value={totals.calories} target={profile.calorieTarget} unit="kcal" color="#82D95D" />
          <CircularProgress label="Protein" value={totals.protein} target={profile.proteinTarget} unit="g" color="#4ade80" precision={1} />
          <CircularProgress label="Carbs" value={totals.carbs} target={profile.carbsTarget} unit="g" color="#38bdf8" precision={1} />
          <CircularProgress label="Fat" value={totals.fat} target={profile.fatTarget} unit="g" color="#fbbf24" precision={1} />
        </div>
        
        <div className="mt-8 space-y-6 px-2">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-4">Nutrient Breakdown by Meal</h4>
          <SegmentedProgressBar 
            label="Protein" 
            unit="g" 
            target={profile.proteinTarget} 
            segments={todayMeals.map((m, i) => ({ name: m.description, value: m.protein, color: getMealColor(i) }))} 
          />
          <SegmentedProgressBar 
            label="Carbohydrates" 
            unit="g" 
            target={profile.carbsTarget} 
            segments={todayMeals.map((m, i) => ({ name: m.description, value: m.carbs, color: getMealColor(i) }))} 
          />
          <SegmentedProgressBar 
            label="Fat" 
            unit="g" 
            target={profile.fatTarget} 
            segments={todayMeals.map((m, i) => ({ name: m.description, value: m.fat, color: getMealColor(i) }))} 
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Smart Protein Distribution" icon={BarChart3}>
        {!hasPremiumAccess(profile) ? (
          <div className="px-2">
            <PremiumLocked 
              title="Smart Protein Distribution"
              message="Analyze your protein intake timing and get personalized recommendations for muscle growth."
              onUpgrade={() => onNavigate?.('premium')}
            />
          </div>
        ) : dailyInsights ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-6 space-y-6 mx-2">
            <div className="grid grid-cols-4 gap-2">
              {['breakfast', 'lunch', 'dinner', 'snack'].map(type => (
                <div key={type} className="space-y-2">
                  <div className="h-24 bg-zinc-800/50 rounded-xl relative overflow-hidden flex flex-col justify-end">
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.min((dailyInsights.mealProteinValues[type] || 0) / 50 * 100, 100)}%` }}
                      className={clsx(
                        "w-full rounded-t-lg",
                        (dailyInsights.mealProteinValues[type] || 0) >= 20 && (dailyInsights.mealProteinValues[type] || 0) <= 40 
                          ? "bg-primary" : "bg-zinc-700"
                      )}
                    />
                  </div>
                  <p className="text-[8px] font-bold uppercase text-zinc-500 text-center truncate">{type}</p>
                  <p className="text-[10px] font-black text-white text-center">{Math.round(dailyInsights.mealProteinValues[type] || 0)}g</p>
                </div>
              ))}
            </div>

            <div className="space-y-3 pt-4 border-t border-zinc-800">
              <div className="flex gap-3">
                <Sparkles size={16} className="text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs text-zinc-300 leading-relaxed font-medium">
                    {dailyInsights.proteinDistributionInsight}
                  </p>
                  <p className="text-[10px] text-zinc-500 leading-relaxed italic">
                    {dailyInsights.proteinDistributionRecommendation}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 bg-zinc-900/40 border border-zinc-800/50 rounded-[2rem] text-center mx-2">
            <p className="text-zinc-500 text-xs italic">Log your meals to see your protein distribution analysis.</p>
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Amino Acid Coverage" icon={Zap}>
        {!hasPremiumAccess(profile) ? (
          <div className="px-2">
            <PremiumLocked 
              title="Amino Acid Coverage"
              message="Track your daily essential amino acid intake and identify potential deficiencies."
              onUpgrade={() => onNavigate?.('premium')}
            />
          </div>
        ) : Object.keys(dailyAminoAcids).length > 0 ? (
          <div className="px-2">
            <AminoAcidCoverage profile={dailyAminoAcids} weightKg={profile.weight || 70} />
          </div>
        ) : (
          <div className="p-8 bg-zinc-900/40 border border-zinc-800/50 rounded-[2rem] text-center mx-2">
            <p className="text-zinc-500 text-xs italic">Log meals with protein to see your amino acid coverage.</p>
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Micronutrient Intelligence" icon={Shield}>
        <div className="px-2">
          <MicronutrientIntelligence 
            intake={dailyMicronutrients} 
            targets={micronutrientTargets} 
            isPremium={hasPremiumAccess(profile)} 
            meals={todayMeals}
          />
          {hasPremiumAccess(profile) && dailyInsights?.micronutrientInsights && (
            <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 flex gap-3 mt-4">
              <Sparkles size={16} className="text-primary shrink-0 mt-1" />
              <p className="text-xs text-zinc-400 leading-relaxed italic">
                {dailyInsights.micronutrientInsights}
              </p>
            </div>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Today's Meals">
        <div className="space-y-4 px-2">
          <MealSection title="Breakfast" type="breakfast" meals={mealsByCategory.breakfast} />
          <MealSection title="Lunch" type="lunch" meals={mealsByCategory.lunch} />
          <MealSection title="Dinner" type="dinner" meals={mealsByCategory.dinner} />
          <MealSection title="Snacks" type="snack" meals={mealsByCategory.snack} />
        </div>
      </CollapsibleSection>
      <ConfirmModal
        isOpen={!!mealToDelete}
        onClose={() => setMealToDelete(null)}
        onConfirm={() => mealToDelete && handleDeleteMeal(mealToDelete)}
        title="Delete Meal"
        message="Are you sure you want to remove this meal from your log? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
