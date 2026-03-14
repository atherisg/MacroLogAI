import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, getDocs, updateDoc, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { PantryItem, Recipe, UserProfile, RecipeFilters, Meal, SavedRecipe } from '../types';
import { generateRecipesFromPantry } from '../services/gemini';
import { Plus, Trash2, Sparkles, Loader2, ChefHat, Clock, Info, ArrowRight, Save, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { RecipeCard } from '../components/RecipeCard';
import { motion, AnimatePresence } from 'motion/react';

export default function Pantry({ user, profile }: { user: User, profile: UserProfile }) {
  const [items, setItems] = useState<PantryItem[]>([]);
  const [newItem, setNewItem] = useState('');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [generating, setGenerating] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [savingRecipeIdx, setSavingRecipeIdx] = useState<number | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<SavedRecipe | null>(null);
  const [autoSave, setAutoSave] = useState(false);
  
  const [filters, setFilters] = useState<RecipeFilters>({
    dietary: [],
    cuisine: '',
    maxTime: 30,
    mealType: 'Meal',
    customInstructions: ''
  });

  const dietaryOptions = ['Vegetarian', 'Vegan', 'Gluten Free', 'Dairy Free', 'High Protein', 'Low Carb', 'Keto'];
  const cuisineOptions = ['Italian', 'Mexican', 'Japanese', 'Mediterranean', 'American', 'Asian Fusion'];
  const mealTypeOptions = ['Meal', 'Snack', 'Dessert', 'Meal Prep', 'Breakfast', 'Post-Workout'];
  const timeOptions = [10, 20, 30, 60];

  useEffect(() => {
    const q = query(collection(db, 'pantry'), where('uid', '==', user.uid));
    const unsubPantry = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PantryItem)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'pantry');
    });

    const qSaved = query(
      collection(db, 'saved_recipes'), 
      where('uid', '==', user.uid)
    );
    const unsubSaved = onSnapshot(qSaved, (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SavedRecipe));
      docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setSavedRecipes(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'saved_recipes');
    });

    return () => {
      unsubPantry();
      unsubSaved();
    };
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

  const saveRecipe = async (recipe: Recipe, idx?: number) => {
    if (idx !== undefined) setSavingRecipeIdx(idx);
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
      handleFirestoreError(err, OperationType.WRITE, 'saved_recipes');
    } finally {
      if (idx !== undefined) {
        setTimeout(() => setSavingRecipeIdx(null), 2000);
      }
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

      if (autoSave) {
        for (const r of result) {
          await saveRecipe(r);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const handleLogMeal = async (recipe: SavedRecipe) => {
    try {
      await addDoc(collection(db, 'meals'), {
        uid: user.uid,
        description: recipe.title,
        calories: recipe.macros.calories,
        protein: recipe.macros.protein,
        carbs: recipe.macros.carbs,
        fat: recipe.macros.fat,
        timestamp: new Date().toISOString(),
        sourceType: 'text',
        mealType: 'lunch' // Default
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'meals');
    }
  };

  const handleDeleteRecipe = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'saved_recipes', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'saved_recipes/' + id);
    }
  };

  const handleUpdateRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecipe || !editingRecipe.id) return;
    try {
      await updateDoc(doc(db, 'saved_recipes', editingRecipe.id), {
        title: editingRecipe.title,
        calories: editingRecipe.macros.calories,
        protein: editingRecipe.macros.protein,
        carbs: editingRecipe.macros.carbs,
        fat: editingRecipe.macros.fat,
        ingredients: editingRecipe.ingredients,
        instructions: editingRecipe.instructions
      });
      setEditingRecipe(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'saved_recipes/' + editingRecipe.id);
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
                <p className="text-[10px] font-bold uppercase text-zinc-500">Meal Category</p>
                <select
                  value={filters.mealType}
                  onChange={e => setFilters({...filters, mealType: e.target.value})}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-2 text-xs outline-none focus:border-primary"
                >
                  {mealTypeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
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
            </div>

            <div className="grid grid-cols-2 gap-4">
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
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase text-zinc-500">Custom Instructions</p>
                <input
                  type="text"
                  value={filters.customInstructions}
                  onChange={e => setFilters({...filters, customInstructions: e.target.value})}
                  placeholder="e.g. low salt, spicy..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-2 text-xs outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">AI Meal Planning</span>
          </div>
          <label className="flex items-center gap-2 cursor-pointer group">
            <span className="text-[10px] font-bold uppercase text-zinc-500 group-hover:text-zinc-300 transition-colors">Auto-save recipes</span>
            <div 
              onClick={() => setAutoSave(!autoSave)}
              className={clsx(
                "w-8 h-4 rounded-full transition-colors relative",
                autoSave ? "bg-primary" : "bg-zinc-800"
              )}
            >
              <div className={clsx(
                "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all",
                autoSave ? "left-4.5" : "left-0.5"
              )} />
            </div>
          </label>
        </div>
        <button
          onClick={handleGenerateRecipes}
          disabled={generating || items.length === 0}
          className="w-full py-4 bg-zinc-900 border border-zinc-800 text-primary font-bold rounded-2xl flex items-center justify-center gap-2 hover:border-primary transition-colors disabled:opacity-50"
        >
          {generating ? <Loader2 className="animate-spin" /> : <Sparkles size={20} />}
          {generating ? 'Chef is thinking...' : 'Generate Smart Meal Plan'}
        </button>
      </div>

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

              <div className="pt-4 border-t border-zinc-800 flex justify-between items-center">
                <div className="flex gap-6">
                  <div className="text-center">
                    <p className="text-[8px] font-bold uppercase text-zinc-500">Calories</p>
                    <p className="font-bold text-sm">{recipe.macros.calories}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[8px] font-bold uppercase text-zinc-500">Protein</p>
                    <p className="font-bold text-sm text-primary">{recipe.macros.protein}g</p>
                  </div>
                </div>
                
                <button 
                  onClick={() => saveRecipe(recipe, idx)}
                  disabled={savingRecipeIdx === idx}
                  className={clsx(
                    "flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-bold uppercase transition-all",
                    savingRecipeIdx === idx ? "bg-green-500 text-white" : "bg-zinc-800 text-white hover:bg-zinc-700"
                  )}
                >
                  {savingRecipeIdx === idx ? <Check size={14} /> : <Save size={14} />}
                  {savingRecipeIdx === idx ? 'Saved' : 'Save Recipe'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Saved Recipes Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-sm font-black italic uppercase tracking-tighter text-white">My Saved Recipes</h3>
          <span className="text-[10px] font-bold uppercase text-zinc-500">{savedRecipes.length} Recipes</span>
        </div>

        {savedRecipes.length === 0 ? (
          <div className="bg-zinc-900/30 border border-zinc-800 border-dashed rounded-[2.5rem] p-12 text-center space-y-2">
            <ChefHat size={40} className="mx-auto text-zinc-800" />
            <p className="text-sm text-zinc-600 font-medium">Your recipe collection is empty.</p>
            <p className="text-[10px] text-zinc-700 uppercase tracking-widest">Generate and save recipes to see them here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {savedRecipes.map(recipe => (
              <RecipeCard 
                key={recipe.id} 
                recipe={recipe} 
                onLog={handleLogMeal}
                onEdit={setEditingRecipe}
                onDelete={handleDeleteRecipe}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit Recipe Modal */}
      <AnimatePresence>
        {editingRecipe && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingRecipe(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">Edit Recipe</h3>
                <button onClick={() => setEditingRecipe(null)} className="text-zinc-500 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleUpdateRecipe} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-zinc-500 ml-2">Recipe Name</label>
                  <input 
                    type="text"
                    value={editingRecipe.title}
                    onChange={e => setEditingRecipe({...editingRecipe, title: e.target.value})}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-sm outline-none focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-zinc-500 ml-2">Calories</label>
                    <input 
                      type="number"
                      value={editingRecipe.macros.calories}
                      onChange={e => setEditingRecipe({...editingRecipe, macros: {...editingRecipe.macros, calories: parseInt(e.target.value)}})}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-sm outline-none focus:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-zinc-500 ml-2">Protein (g)</label>
                    <input 
                      type="number"
                      value={editingRecipe.macros.protein}
                      onChange={e => setEditingRecipe({...editingRecipe, macros: {...editingRecipe.macros, protein: parseInt(e.target.value)}})}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-sm outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-bold uppercase text-zinc-500 ml-2">Ingredients</p>
                  {editingRecipe.ingredients.map((ing, i) => (
                    <input 
                      key={i}
                      type="text"
                      value={ing}
                      onChange={e => {
                        const newIngs = [...editingRecipe.ingredients];
                        newIngs[i] = e.target.value;
                        setEditingRecipe({...editingRecipe, ingredients: newIngs});
                      }}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-2 text-xs outline-none focus:border-primary mb-2"
                    />
                  ))}
                </div>

                <button 
                  type="submit"
                  className="w-full bg-primary text-black py-4 rounded-2xl font-bold uppercase tracking-widest text-xs hover:scale-[1.02] transition-transform"
                >
                  Save Changes
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function clsx(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
