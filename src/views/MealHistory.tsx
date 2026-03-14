import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import MealEditModal from '../components/MealEditModal';
import { Meal } from '../types';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, Utensils, Edit2, ChevronDown, ChevronUp, LayoutDashboard } from 'lucide-react';
import { useAppSound } from '../components/SoundProvider';
import ConfirmModal from '../components/ConfirmModal';

export default function MealHistory({ user, onSelectDate }: { user: User, onSelectDate?: (date: string) => void }) {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [mealToDelete, setMealToDelete] = useState<string | null>(null);
  const { playClick } = useAppSound();

  useEffect(() => {
    const q = query(
      collection(db, 'meals'),
      where('uid', '==', user.uid),
      orderBy('timestamp', 'desc')
    );

    return onSnapshot(q, (snap) => {
      setMeals(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Meal)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'meals');
    });
  }, [user.uid]);

  const handleDelete = async (mealId: string) => {
    try {
      await deleteDoc(doc(db, 'meals', mealId));
      playClick();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'meals');
    }
  };

  const handleSaveEdit = async (updatedMeal: Meal) => {
    try {
      const mealRef = doc(db, 'meals', updatedMeal.id!);
      await updateDoc(mealRef, {
        description: updatedMeal.description,
        calories: updatedMeal.calories,
        protein: updatedMeal.protein,
        carbs: updatedMeal.carbs,
        fat: updatedMeal.fat,
      });
      setEditingMeal(null);
      playClick();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'meals');
    }
  };

  const groupedMeals = meals.reduce((acc, meal) => {
    const date = meal.log_date || format(parseISO(meal.timestamp), 'yyyy-MM-dd');
    if (!acc[date]) acc[date] = [];
    acc[date].push(meal);
    return acc;
  }, {} as Record<string, Meal[]>);

  // Sort dates descending
  const sortedDates = Object.keys(groupedMeals).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEEE, MMM d');
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="space-y-2">
        <h2 className="text-3xl font-black italic uppercase tracking-tighter text-primary">History</h2>
        <p className="text-zinc-500 text-sm">Review your daily nutrition summaries.</p>
      </div>

      <div className="space-y-4">
        {sortedDates.map((date) => {
          const dayMeals = groupedMeals[date];
          const dayTotals = dayMeals.reduce((acc, m) => ({
            calories: acc.calories + m.calories,
            protein: acc.protein + m.protein,
            carbs: acc.carbs + m.carbs,
            fat: acc.fat + m.fat
          }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
          const isExpanded = expandedDate === date;

          return (
            <div key={date} className="bg-zinc-900/50 rounded-3xl border border-zinc-800/50 overflow-hidden transition-all">
              <button 
                onClick={() => {
                  playClick();
                  setExpandedDate(isExpanded ? null : date);
                }}
                className="w-full text-left p-5 hover:bg-zinc-800/30 transition-colors group flex flex-col"
              >
                <div className="flex justify-between items-center mb-4 w-full">
                  <h3 className="text-lg font-black italic uppercase tracking-tight group-hover:text-primary transition-colors">
                    {getDateLabel(date)}
                  </h3>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-zinc-500 bg-zinc-800 px-2 py-1 rounded-md">
                      {dayMeals.length} {dayMeals.length === 1 ? 'Meal' : 'Meals'}
                    </span>
                    {isExpanded ? <ChevronUp size={20} className="text-zinc-500" /> : <ChevronDown size={20} className="text-zinc-500" />}
                  </div>
                </div>
                
                <div className="grid grid-cols-4 gap-2 w-full">
                  <div className="bg-zinc-800/50 p-3 rounded-2xl flex flex-col items-center justify-center">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Cals</span>
                    <span className="text-sm font-black">{Math.round(dayTotals.calories)}</span>
                  </div>
                  <div className="bg-zinc-800/50 p-3 rounded-2xl flex flex-col items-center justify-center">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-1">Pro</span>
                    <span className="text-sm font-black">{Math.round(dayTotals.protein)}g</span>
                  </div>
                  <div className="bg-zinc-800/50 p-3 rounded-2xl flex flex-col items-center justify-center">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-green-500 mb-1">Carb</span>
                    <span className="text-sm font-black">{Math.round(dayTotals.carbs)}g</span>
                  </div>
                  <div className="bg-zinc-800/50 p-3 rounded-2xl flex flex-col items-center justify-center">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-yellow-500 mb-1">Fat</span>
                    <span className="text-sm font-black">{Math.round(dayTotals.fat)}g</span>
                  </div>
                </div>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-zinc-800/50 bg-zinc-900/30"
                  >
                    <div className="p-5 space-y-3">
                      {dayMeals.map((meal) => (
                        <div key={meal.id} className="flex items-center justify-between bg-zinc-800/30 p-4 rounded-2xl border border-zinc-800/50">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400">
                              <Utensils size={18} />
                            </div>
                            <div>
                              <p className="font-bold text-sm">{meal.description}</p>
                              <p className="text-[10px] text-zinc-500 uppercase font-mono mt-1">
                                {meal.calories}kcal • P:{meal.protein}g • C:{meal.carbs}g • F:{meal.fat}g
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setEditingMeal(meal)}
                              className="p-2 text-zinc-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-xl transition-colors"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => setMealToDelete(meal.id!)}
                              className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                      
                      {onSelectDate && (
                        <button
                          onClick={() => {
                            playClick();
                            onSelectDate(date);
                          }}
                          className="w-full mt-4 py-3 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-primary bg-primary/10 hover:bg-primary/20 rounded-xl transition-colors"
                        >
                          <LayoutDashboard size={16} />
                          View Full Dashboard
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
        {sortedDates.length === 0 && (
          <div className="text-center py-10 text-zinc-500">
            <p>No meals logged yet.</p>
          </div>
        )}
      </div>

      {editingMeal && (
        <MealEditModal
          isOpen={!!editingMeal}
          onClose={() => setEditingMeal(null)}
          onSave={handleSaveEdit}
          meal={editingMeal}
        />
      )}

      <ConfirmModal
        isOpen={!!mealToDelete}
        onClose={() => setMealToDelete(null)}
        onConfirm={() => mealToDelete && handleDelete(mealToDelete)}
        title="Delete Meal"
        message="Are you sure you want to remove this meal from your history? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
