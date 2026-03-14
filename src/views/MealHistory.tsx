import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import MealEditModal from '../components/MealEditModal';
import { Meal } from '../types';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, Utensils, Edit2 } from 'lucide-react';
import { useAppSound } from '../components/SoundProvider';

export default function MealHistory({ user }: { user: User }) {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const { playClick, playSuccess, playError } = useAppSound();

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

  const handleDelete = async (id: string) => {
    try {
      playClick();
      await deleteDoc(doc(db, 'meals', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'meals/' + id);
      playError();
    }
  };

  const handleEdit = (meal: Meal) => {
    setEditingMeal(meal);
    setIsEditModalOpen(true);
    playClick();
  };

  const handleSaveEdit = async (updatedMeal: Meal) => {
    if (!updatedMeal.id) return;
    try {
      const mealRef = doc(db, 'meals', updatedMeal.id);
      await updateDoc(mealRef, {
        description: updatedMeal.description,
        calories: updatedMeal.calories,
        protein: updatedMeal.protein,
        carbs: updatedMeal.carbs,
        fat: updatedMeal.fat
      });
      playSuccess();
      setIsEditModalOpen(false);
      setEditingMeal(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'meals');
      playError();
    }
  };

  const groupedMeals = meals.reduce((acc, meal) => {
    const date = format(parseISO(meal.timestamp), 'yyyy-MM-dd');
    if (!acc[date]) acc[date] = [];
    acc[date].push(meal);
    return acc;
  }, {} as Record<string, Meal[]>);

  const getDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEEE, MMM d');
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-3xl font-black italic uppercase tracking-tighter text-primary">History</h2>
        <p className="text-zinc-500 text-sm">Review your past meals and macro trends.</p>
      </div>

      <div className="space-y-10">
        {Object.entries(groupedMeals).map(([date, dayMeals]) => {
          const dayTotals = dayMeals.reduce((acc, m) => ({
            calories: acc.calories + m.calories,
            protein: acc.protein + m.protein,
            carbs: acc.carbs + m.carbs,
            fat: acc.fat + m.fat
          }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

          return (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              key={date} 
              className="space-y-4"
            >
              <div className="flex justify-between items-end border-b border-zinc-900 pb-2">
                <h3 className="font-black italic uppercase text-lg text-primary">{getDateLabel(date)}</h3>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase text-zinc-500">Daily Total</p>
                  <p className="text-sm font-bold">{Math.round(dayTotals.calories)} kcal</p>
                </div>
              </div>

              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {dayMeals.map(meal => (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20, scale: 0.95 }}
                      key={meal.id} 
                      className="group bg-zinc-900/30 border border-zinc-800/50 p-4 rounded-2xl flex items-center gap-4 hover:border-zinc-700 transition-all"
                    >
                      {meal.imageUrl ? (
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-zinc-800 flex-shrink-0">
                          <img src={meal.imageUrl} alt={meal.description} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-500 flex-shrink-0">
                          <Utensils size={24} />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-sm">{meal.description}</p>
                            <span className="text-[8px] font-bold uppercase text-zinc-600 tracking-widest">{meal.sourceType} log</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-zinc-600 font-mono">{format(parseISO(meal.timestamp), 'h:mm a')}</span>
                            <button 
                              onClick={() => meal.id && handleDelete(meal.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-zinc-600 hover:text-red-500 transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        <div className="mt-2 flex justify-between items-end">
                          <div className="flex gap-4">
                            <div className="text-center">
                              <p className="text-[8px] font-bold uppercase text-zinc-500">Cals</p>
                              <p className="text-xs font-bold">{meal.calories}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-[8px] font-bold uppercase text-zinc-500">Prot</p>
                              <p className="text-xs font-bold text-[#82D95D]">{meal.protein}g</p>
                            </div>
                            <div className="text-center">
                              <p className="text-[8px] font-bold uppercase text-zinc-500">Carb</p>
                              <p className="text-xs font-bold text-[#4ade80]">{meal.carbs}g</p>
                            </div>
                            <div className="text-center">
                              <p className="text-[8px] font-bold uppercase text-zinc-500">Fat</p>
                              <p className="text-xs font-bold text-[#22c55e]">{meal.fat}g</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-zinc-600 font-mono">{format(parseISO(meal.timestamp), 'h:mm a')}</span>
                            <button 
                              onClick={() => handleEdit(meal)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-zinc-600 hover:text-primary transition-all"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button 
                              onClick={() => meal.id && handleDelete(meal.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-zinc-600 hover:text-red-500 transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </div>
      {isEditModalOpen && editingMeal && (
        <MealEditModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSave={handleSaveEdit}
          meal={editingMeal}
        />
      )}
    </div>
  );
}
