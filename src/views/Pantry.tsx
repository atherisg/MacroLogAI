import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { PantryItem, Recipe, UserProfile, RecipeFilters, Meal } from '../types';
import { generateRecipesFromPantry } from '../services/gemini';
import { Plus, Trash2, Sparkles, Loader2, ChefHat, Clock, Info, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

export default function Pantry({ user, profile }: { user: User, profile: UserProfile }) {
  const [items, setItems] = useState<PantryItem[]>([]);
  const [newItem, setNewItem] = useState('');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [generating, setGenerating] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  const [filters, setFilters] = useState<RecipeFilters>({
    dietary: [],
    cuisine: '',
    maxTime: 30
  });

  const dietaryOptions = ['Vegetarian', 'Vegan', 'Gluten Free', 'Dairy Free', 'High Protein', 'Low Carb', 'Keto'];
  const cuisineOptions = ['Italian', 'Mexican', 'Japanese', 'Mediterranean', 'American', 'Asian Fusion'];
  const timeOptions = [10, 20, 30, 60];

  useEffect(() => {
    const q = query(collection(db, 'pantry'), where('uid', '==', user.uid));
    return onSnapshot(q, (snap) => {
      setItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PantryItem)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'pantry');
    });
  }, [user.uid]);

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    try {
      await addDoc(collection(db, 'pantry'), {
        uid: user.uid,
        name: newItem.trim(),
        createdAt: new Date().toISOString()
      });
      setNewItem('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'pantry');
    }
  };

  const removeItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'pantry', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'pantry/' + id);
    }
  };

  const handleGenerateRecipes = async () => {
    if (items.length === 0) return;
    setGenerating(true);
    try {
      // Calculate remaining macros for today
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const mealsSnap = await getDocs(query(
        collection(db, 'meals'),
        where('uid', '==', user.uid),
        where('timestamp', '>=', startOfDay.toISOString())
      ));
      
      const todayMeals = mealsSnap.docs.map(d => d.data() as Meal);
      const totals = todayMeals.reduce((acc, m) => ({
        calories: acc.calories + m.calories,
        protein: acc.protein + m.protein,
        carbs: acc.carbs + m.carbs,
        fat: acc.fat + m.fat
      }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

      const remaining = {
        calories: Math.max(0, profile.calorieTarget - totals.calories),
        protein: Math.max(0, profile.proteinTarget - totals.protein),
        carbs: Math.max(0, profile.carbsTarget - totals.carbs),
        fat: Math.max(0, profile.fatTarget - totals.fat)
      };

      const result = await generateRecipesFromPantry(
        items.map(i => i.name),
        filters,
        profile,
        remaining
      );
      setRecipes(result);
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const toggleDietary = (option: string) => {
    setFilters(prev => ({
      ...prev,
      dietary: prev.dietary.includes(option) 
        ? prev.dietary.filter(o => o !== option)
        : [...prev.dietary, option]
    }));
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-3xl font-black italic uppercase tracking-tighter text-primary">Pantry</h2>
        <p className="text-zinc-500 text-sm">Manage ingredients and generate smart meal plans.</p>
      </div>

      <div className="space-y-4">
        <form onSubmit={addItem} className="flex gap-2">
          <input
            type="text"
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            placeholder="Add ingredient..."
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 focus:border-primary outline-none"
          />
          <button type="submit" className="bg-primary text-black p-3 rounded-xl font-bold">
            <Plus size={24} />
          </button>
        </form>

        <div className="flex flex-wrap gap-2">
          {items.map(item => (
            <div key={item.id} className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-full flex items-center gap-2 group">
              <span className="text-sm font-medium">{item.name}</span>
              <button onClick={() => removeItem(item.id!)} className="text-zinc-600 hover:text-red-500 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Filters Section */}
      <div className="space-y-4">
        <button 
          onClick={() => setShowFilters(!showFilters)}
          className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2 hover:text-white transition-colors"
        >
          {showFilters ? 'Hide Filters' : 'Show Filters'}
          <ArrowRight size={12} className={showFilters ? 'rotate-90' : ''} />
        </button>

        {showFilters && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 space-y-6 animate-in fade-in slide-in-from-top-4">
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase text-zinc-500">Dietary Restrictions</p>
              <div className="flex flex-wrap gap-2">
                {dietaryOptions.map(opt => (
                  <button
                    key={opt}
                    onClick={() => toggleDietary(opt)}
                    className={clsx(
                      "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase border transition-all",
                      filters.dietary.includes(opt) ? "bg-primary text-black border-primary" : "bg-zinc-800 text-zinc-500 border-zinc-700"
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase text-zinc-500">Cuisine</p>
                <select
                  value={filters.cuisine}
                  onChange={e => setFilters({...filters, cuisine: e.target.value})}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-2 text-xs outline-none focus:border-primary"
                >
                  <option value="">Any Cuisine</option>
                  {cuisineOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase text-zinc-500">Max Time</p>
                <select
                  value={filters.maxTime}
                  onChange={e => setFilters({...filters, maxTime: parseInt(e.target.value)})}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-2 text-xs outline-none focus:border-primary"
                >
                  {timeOptions.map(opt => <option key={opt} value={opt}>{opt} mins</option>)}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={handleGenerateRecipes}
        disabled={generating || items.length === 0}
        className="w-full py-4 bg-zinc-900 border border-zinc-800 text-primary font-bold rounded-2xl flex items-center justify-center gap-2 hover:border-primary transition-colors disabled:opacity-50"
      >
        {generating ? <Loader2 className="animate-spin" /> : <Sparkles size={20} />}
        {generating ? 'Chef is thinking...' : 'Generate Smart Meal Plan'}
      </button>

      {recipes.length > 0 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Personalized Suggestions</h3>
            <div className="flex items-center gap-1 text-[10px] text-primary font-bold uppercase">
              <Info size={12} />
              Optimized for remaining macros
            </div>
          </div>
          {recipes.map((recipe, idx) => (
            <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-6">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2 text-primary">
                  <ChefHat size={20} />
                  <h4 className="font-black italic uppercase text-lg leading-tight">{recipe.title}</h4>
                </div>
                <div className="flex items-center gap-1 text-zinc-500 text-xs font-bold">
                  <Clock size={14} />
                  {recipe.prepTime}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
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

              {(recipe.mealPrepTips || recipe.substitutions) && (
                <div className="bg-zinc-800/30 rounded-2xl p-4 space-y-3">
                  {recipe.mealPrepTips && (
                    <div className="space-y-1">
                      <p className="text-[8px] font-bold uppercase text-primary">Meal Prep Tip</p>
                      <p className="text-[10px] text-zinc-400 italic">{recipe.mealPrepTips}</p>
                    </div>
                  )}
                  {recipe.substitutions && recipe.substitutions.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[8px] font-bold uppercase text-zinc-500">Substitutions</p>
                      <p className="text-[10px] text-zinc-500">{recipe.substitutions.join(', ')}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-zinc-800 flex justify-between">
                <div className="text-center">
                  <p className="text-[8px] font-bold uppercase text-zinc-500">Calories</p>
                  <p className="font-bold text-sm">{recipe.macros.calories}</p>
                </div>
                <div className="text-center">
                  <p className="text-[8px] font-bold uppercase text-zinc-500">Protein</p>
                  <p className="font-bold text-sm text-[#82D95D]">{recipe.macros.protein}g</p>
                </div>
                <div className="text-center">
                  <p className="text-[8px] font-bold uppercase text-zinc-500">Carbs</p>
                  <p className="font-bold text-sm text-[#4ade80]">{recipe.macros.carbs}g</p>
                </div>
                <div className="text-center">
                  <p className="text-[8px] font-bold uppercase text-zinc-500">Fat</p>
                  <p className="font-bold text-sm text-[#22c55e]">{recipe.macros.fat}g</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function clsx(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
