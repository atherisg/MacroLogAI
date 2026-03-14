import React, { useState } from 'react';
import { ChefHat, Clock, ChevronDown, ChevronUp, Trash2, Edit2, Plus, Check } from 'lucide-react';
import { SavedRecipe } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface RecipeCardProps {
  recipe: SavedRecipe;
  onLog: (recipe: SavedRecipe) => void;
  onEdit: (recipe: SavedRecipe) => void;
  onDelete: (id: string) => void;
}

export const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, onLog, onEdit, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const [logged, setLogged] = useState(false);

  const handleLog = () => {
    onLog(recipe);
    setLogged(true);
    setTimeout(() => setLogged(false), 2000);
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden transition-all hover:border-zinc-700">
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2 text-primary">
            <ChefHat size={20} />
            <h4 className="font-black italic uppercase text-lg leading-tight">{recipe.title}</h4>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => onEdit(recipe)}
              className="p-2 text-zinc-500 hover:text-white transition-colors"
            >
              <Edit2 size={16} />
            </button>
            <button 
              onClick={() => onDelete(recipe.id!)}
              className="p-2 text-zinc-500 hover:text-red-500 transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 py-3 border-y border-zinc-800/50">
          <div className="text-center">
            <p className="text-[8px] font-bold uppercase text-zinc-500">Cals</p>
            <p className="font-bold text-sm">{recipe.macros.calories.toFixed(0)}</p>
          </div>
          <div className="text-center">
            <p className="text-[8px] font-bold uppercase text-zinc-500">Prot</p>
            <p className="font-bold text-sm text-primary">{recipe.macros.protein.toFixed(1)}g</p>
          </div>
          <div className="text-center">
            <p className="text-[8px] font-bold uppercase text-zinc-500">Carb</p>
            <p className="font-bold text-sm text-primary/80">{recipe.macros.carbs.toFixed(1)}g</p>
          </div>
          <div className="text-center">
            <p className="text-[8px] font-bold uppercase text-zinc-500">Fat</p>
            <p className="font-bold text-sm text-primary/60">{recipe.macros.fat.toFixed(1)}g</p>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <button 
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[10px] font-bold uppercase text-zinc-500 hover:text-white transition-colors"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {expanded ? 'Hide Details' : 'View Details'}
          </button>
          
          <button 
            onClick={handleLog}
            disabled={logged}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase transition-all ${
              logged ? 'bg-green-500 text-white' : 'bg-primary text-black hover:scale-105'
            }`}
          >
            {logged ? <Check size={14} /> : <Plus size={14} />}
            {logged ? 'Logged' : 'Log Meal'}
          </button>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden pt-4 space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase text-zinc-500">Ingredients</p>
                  <ul className="text-xs text-zinc-400 space-y-1">
                    {recipe.ingredients.map((ing, i) => <li key={i} className="flex items-start gap-2">• {ing}</li>)}
                  </ul>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase text-zinc-500">Instructions</p>
                  <ol className="text-xs text-zinc-400 space-y-2">
                    {recipe.instructions.map((step, i) => <li key={i} className="flex gap-2"><span className="text-primary font-bold">{i+1}.</span> {step}</li>)}
                  </ol>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
