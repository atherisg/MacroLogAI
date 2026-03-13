import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, Meal } from '../types';
import { calculateBMI, calculateDailyScore } from '../utils';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Zap, Target, Flame, Trophy } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import AnimatedNumber from '../components/AnimatedNumber';
import confetti from 'canvas-confetti';
import { useAppSound } from '../components/SoundProvider';

export default function Dashboard({ user, profile }: { user: User, profile: UserProfile }) {
  const [todayMeals, setTodayMeals] = useState<Meal[]>([]);
  const [supplements, setSupplements] = useState<any[]>([]);
  const { playReward } = useAppSound();
  const today = format(new Date(), 'yyyy-MM-dd');

  const activeWidgets = profile.dashboardWidgets || [
    'nutrition_score',
    'macro_progress',
    'meal_history',
    'supplement_tracker'
  ];

  useEffect(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const q = query(
      collection(db, 'meals'),
      where('uid', '==', user.uid),
      where('timestamp', '>=', startOfDay.toISOString()),
      orderBy('timestamp', 'desc')
    );

    const unsubMeals = onSnapshot(q, (snap) => {
      setTodayMeals(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Meal)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'meals');
    });

    const qSupps = query(collection(db, 'supplements'), where('uid', '==', user.uid));
    const unsubSupps = onSnapshot(qSupps, (snap) => {
      setSupplements(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'supplements');
    });

    return () => {
      unsubMeals();
      unsubSupps();
    };
  }, [user.uid]);

  const totals = todayMeals.reduce((acc, meal) => ({
    calories: acc.calories + meal.calories,
    protein: acc.protein + meal.protein,
    carbs: acc.carbs + meal.carbs,
    fat: acc.fat + meal.fat
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const score = calculateDailyScore(totals, {
    calories: profile.calorieTarget,
    protein: profile.proteinTarget,
    carbs: profile.carbsTarget,
    fat: profile.fatTarget
  });

  useEffect(() => {
    if (score >= 90 && todayMeals.length > 0) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#82D95D', '#ffffff']
      });
      playReward();
    }
  }, [score, playReward, todayMeals.length]);

  const bmi = calculateBMI(profile.weight, profile.height);

  const macroData = [
    { name: 'Protein', value: totals.protein * 4, color: 'var(--color-primary)' },
    { name: 'Carbs', value: totals.carbs * 4, color: '#4ade80' },
    { name: 'Fat', value: totals.fat * 9, color: '#22c55e' }
  ];

  const StatCard = ({ label, value, target, unit, color }: any) => (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl"
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</span>
        <span className={clsx("text-[10px] font-bold", totals[label.toLowerCase()] > target ? "text-red-500" : "text-primary")}>
          <AnimatedNumber value={Math.round((value / target) * 100)} />%
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-black italic">
          <AnimatedNumber value={Math.round(value)} />
        </span>
        <span className="text-xs text-zinc-500">/ {target}{unit}</span>
      </div>
      <div className="mt-3 h-1 bg-zinc-800 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, (value / target) * 100)}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="h-full" 
          style={{ backgroundColor: color }}
        />
      </div>
    </motion.div>
  );

  const renderWidget = (widgetId: string) => {
    switch (widgetId) {
      case 'nutrition_score':
        return (
          <motion.div 
            key="nutrition_score"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden bg-zinc-900 border border-zinc-800 rounded-3xl p-8"
          >
            <div className="relative z-10 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Daily Performance</p>
                <h2 className="text-5xl font-black italic text-primary">
                  <AnimatedNumber value={score} />
                </h2>
                <p className="text-sm text-zinc-400">Nutrition Score</p>
              </div>
              <div className="w-24 h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={macroData}
                      innerRadius={30}
                      outerRadius={45}
                      paddingAngle={5}
                      dataKey="value"
                      animationDuration={800}
                    >
                      {macroData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <motion.div 
              animate={{ 
                opacity: [0.05, 0.1, 0.05],
                scale: [1, 1.2, 1]
              }}
              transition={{ duration: 5, repeat: Infinity }}
              className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full -mr-16 -mt-16" 
            />
          </motion.div>
        );

      case 'macro_progress':
        return (
          <div key="macro_progress" className="grid grid-cols-2 gap-4">
            <StatCard label="Calories" value={totals.calories} target={profile.calorieTarget} unit="kcal" color="var(--color-primary)" />
            <StatCard label="Protein" value={totals.protein} target={profile.proteinTarget} unit="g" color="#4ade80" />
          </div>
        );

      case 'meal_history':
        return (
          <div key="meal_history" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500">Today's Logs</h3>
              <span className="text-xs text-zinc-600">{todayMeals.length} items</span>
            </div>
            {todayMeals.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-zinc-900 rounded-3xl">
                <p className="text-zinc-600 text-sm">No meals logged today</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayMeals.map(meal => (
                  <div key={meal.id} className="bg-zinc-900/30 border border-zinc-800/50 p-4 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm">{meal.description}</p>
                      <p className="text-[10px] text-zinc-500 uppercase font-mono">
                        {meal.calories}kcal • P:{meal.protein}g • C:{meal.carbs}g • F:{meal.fat}g
                      </p>
                    </div>
                    <div className="text-zinc-600">
                      {format(new Date(meal.timestamp), 'HH:mm')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'supplement_tracker':
        return (
          <div key="supplement_tracker" className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500">Supplements</h3>
              <Zap size={16} className="text-primary" />
            </div>
            {supplements.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-4">No supplements tracked</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {supplements.map(supp => (
                  <div key={supp.id} className="bg-zinc-800/50 p-2 rounded-lg flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-xs font-medium truncate">{supp.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'streak_counter':
        return (
          <div key="streak_counter" className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <Flame size={20} className="text-orange-500" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-zinc-500">Current Streak</p>
                <p className="font-bold text-xl">12 Days</p>
              </div>
            </div>
            <Trophy size={20} className="text-yellow-500" />
          </div>
        );

      case 'ai_suggestions':
        return (
          <div key="ai_suggestions" className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={14} className="text-primary" />
              <p className="text-[10px] font-bold uppercase text-primary">AI Insight</p>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              "You're 20g short on protein today. Consider a Greek yogurt snack to hit your target."
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {activeWidgets.map(widgetId => renderWidget(widgetId))}
      </AnimatePresence>

      {/* BMI & Metrics (Always show or make it a widget?) */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center">
            <Target size={20} className="text-primary" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-zinc-500">Current BMI</p>
            <p className="font-bold">{bmi.value} <span className="text-xs font-normal text-zinc-400">({bmi.category})</span></p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase text-zinc-500">Goal</p>
          <p className="font-bold text-primary uppercase tracking-tighter italic">{profile.fitnessGoal.replace('_', ' ')}</p>
        </div>
      </div>
    </div>
  );
}

function clsx(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
