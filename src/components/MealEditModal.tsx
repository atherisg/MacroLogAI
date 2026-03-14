import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Utensils } from 'lucide-react';
import MicroButton from './MicroButton';
import { Meal } from '../types';

interface MealEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (meal: Meal) => void;
  meal: Meal;
}

export default function MealEditModal({ isOpen, onClose, onSave, meal }: MealEditModalProps) {
  const [formData, setFormData] = useState<Meal>({ ...meal });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                  <Utensils size={24} />
                </div>
                <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">
                  Edit Meal
                </h3>
              </div>
              <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Description</label>
                <input
                  autoFocus
                  type="text"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 outline-none focus:border-primary transition-all font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Calories</label>
                  <input
                    type="number"
                    value={formData.calories}
                    onChange={e => setFormData({ ...formData, calories: parseInt(e.target.value) || 0 })}
                    className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 outline-none focus:border-primary transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Protein (g)</label>
                  <input
                    type="number"
                    value={formData.protein}
                    onChange={e => setFormData({ ...formData, protein: parseInt(e.target.value) || 0 })}
                    className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 outline-none focus:border-primary transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Carbs (g)</label>
                  <input
                    type="number"
                    value={formData.carbs}
                    onChange={e => setFormData({ ...formData, carbs: parseInt(e.target.value) || 0 })}
                    className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 outline-none focus:border-primary transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Fat (g)</label>
                  <input
                    type="number"
                    value={formData.fat}
                    onChange={e => setFormData({ ...formData, fat: parseInt(e.target.value) || 0 })}
                    className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 outline-none focus:border-primary transition-all"
                  />
                </div>
              </div>

              <div className="pt-4">
                <MicroButton type="submit" className="w-full">
                  Update Meal
                </MicroButton>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
