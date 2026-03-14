import React, { useState, useRef, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { parseMealInput, estimateItemsMacros, analyzeMealImageForItems, ParsedItemMacro } from '../services/gemini';
import { MacroEstimation } from '../types';
import { 
  Sparkles, 
  Save, 
  X, 
  Loader2, 
  Camera, 
  FileText, 
  Type as TypeIcon, 
  Trash2,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import MicroButton from '../components/MicroButton';
import NumericInput from '../components/NumericInput';
import { useAppSound } from '../components/SoundProvider';
import { clsx } from 'clsx';

type LogState = 'INPUT' | 'ANALYZING_INPUT' | 'RENAME_SUGGESTED' | 'ESTIMATING_MACROS' | 'MACROS_ESTIMATED' | 'SAVING' | 'LOGGED';

export default function LogMeal({ user, onComplete, initialMealType, initialSourceType }: { user: User, onComplete: () => void, initialMealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack', initialSourceType?: 'text' | 'image' }) {
  const [logState, setLogState] = useState<LogState>('INPUT');
  const [description, setDescription] = useState('');
  const [originalName, setOriginalName] = useState('');
  const [suggestedName, setSuggestedName] = useState('');
  const [finalName, setFinalName] = useState('');
  const [parsedItems, setParsedItems] = useState<string[]>([]);
  const [itemMacros, setItemMacros] = useState<ParsedItemMacro[]>([]);
  const [totalMacros, setTotalMacros] = useState<MacroEstimation>({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [renameFeedback, setRenameFeedback] = useState(false);
  
  const [sourceType, setSourceType] = useState<'text' | 'image' | 'label'>(initialSourceType || 'text');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>(initialMealType || 'snack');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { playSuccess, playError, playClick } = useAppSound();

  useEffect(() => {
    if (initialSourceType === 'image') {
      setTimeout(() => {
        fileInputRef.current?.click();
      }, 100);
    }
  }, [initialSourceType]);

  const loadingMessages = [
    "Analyzing your meal...",
    "Consulting the AI chef...",
    "Breaking down ingredients...",
    "Estimating portion sizes..."
  ];

  useEffect(() => {
    let interval: any;
    if (logState === 'ANALYZING_INPUT' || logState === 'ESTIMATING_MACROS') {
      setLoadingMessage(logState === 'ANALYZING_INPUT' ? loadingMessages[0] : "Calculating macros...");
      let i = 1;
      interval = setInterval(() => {
        setLoadingMessage(logState === 'ANALYZING_INPUT' ? loadingMessages[i % loadingMessages.length] : "Calculating macros...");
        i++;
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [logState]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'label') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Str = reader.result as string;
        
        // Compress image to avoid Firestore 1MB limit
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxWidth = 800;
          const maxHeight = 800;

          if (width > height) {
            if (width > maxWidth) {
              height *= maxWidth / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width *= maxHeight / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          setSelectedImage(compressedBase64);
          setSourceType(type);
          handleAnalyzeImage(compressedBase64, type === 'label');
        };
        img.onerror = () => {
          // Fallback to original if compression fails
          setSelectedImage(base64Str);
          setSourceType(type);
          handleAnalyzeImage(base64Str, type === 'label');
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyzeImage = async (base64: string, isLabel: boolean) => {
    setLogState('ANALYZING_INPUT');
    try {
      const result = await analyzeMealImageForItems(base64, isLabel);
      setOriginalName("Image Upload");
      setSuggestedName(result.cleanedName);
      setParsedItems(result.items);
      setLogState('RENAME_SUGGESTED');
    } catch (err) {
      console.error(err);
      playError();
      setLogState('INPUT');
    }
  };

  const handleAnalyzeText = async () => {
    if (!description.trim()) return;
    setLogState('ANALYZING_INPUT');
    setSourceType('text');
    try {
      const result = await parseMealInput(description);
      setOriginalName(description);
      setSuggestedName(result.cleanedName);
      setParsedItems(result.items);
      setLogState('RENAME_SUGGESTED');
    } catch (err) {
      console.error(err);
      playError();
      setLogState('INPUT');
    }
  };

  const handleConfirmRename = async (accept: boolean) => {
    const chosenName = accept ? suggestedName : originalName;
    setFinalName(chosenName);
    
    if (accept) {
      playSuccess();
      setRenameFeedback(true);
      setTimeout(() => setRenameFeedback(false), 3000);
    } else {
      playClick();
    }

    setLogState('ESTIMATING_MACROS');
    try {
      const validItems = parsedItems.filter(i => i.trim() !== '');
      const macros = await estimateItemsMacros(validItems);
      setItemMacros(macros);
      
      const totals = macros.reduce((acc, curr) => ({
        calories: acc.calories + curr.calories,
        protein: acc.protein + curr.protein,
        carbs: acc.carbs + curr.carbs,
        fat: acc.fat + curr.fat
      }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
      
      setTotalMacros(totals);
      setLogState('MACROS_ESTIMATED');
    } catch (err) {
      console.error(err);
      playError();
      setLogState('RENAME_SUGGESTED');
    }
  };

  const handleSave = async () => {
    setLogState('SAVING');
    try {
      await addDoc(collection(db, 'meals'), {
        uid: user.uid,
        description: finalName,
        ...totalMacros,
        imageUrl: selectedImage || null,
        sourceType,
        mealType,
        timestamp: new Date().toISOString()
      });
      playSuccess();
      setLogState('LOGGED');
      onComplete();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'meals');
      playError();
      setLogState('MACROS_ESTIMATED');
    }
  };

  if (logState === 'ANALYZING_INPUT' || logState === 'ESTIMATING_MACROS') {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-8">
        <div className="relative">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-24 h-24 border-4 border-primary/20 border-t-primary rounded-full"
          />
          <motion.div 
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Sparkles className="text-primary" size={32} />
          </motion.div>
        </div>
        <div className="text-center space-y-2">
          <motion.h2 
            key={loadingMessage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xl font-black italic uppercase tracking-tight text-primary"
          >
            {loadingMessage}
          </motion.h2>
          <p className="text-zinc-500 text-sm">Our AI is processing your request</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-3xl font-black italic uppercase tracking-tighter text-primary">Log Meal</h2>
        <p className="text-zinc-500 text-sm">Choose your logging method. AI will analyze and estimate.</p>
      </div>

      {logState === 'INPUT' && (
        <>
          {!selectedImage && (
            <div className="grid grid-cols-3 gap-3">
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSourceType('text')}
                className={clsx(
                  "flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all",
                  sourceType === 'text' ? "bg-zinc-900 border-primary text-primary" : "bg-zinc-900/30 border-zinc-800 text-zinc-500"
                )}
              >
                <TypeIcon size={24} />
                <span className="text-[10px] font-bold uppercase">Text</span>
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-zinc-900/30 border border-zinc-800 text-zinc-500 hover:border-zinc-700 transition-all"
              >
                <Camera size={24} />
                <span className="text-[10px] font-bold uppercase">Photo</span>
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-zinc-900/30 border border-zinc-800 text-zinc-500 hover:border-zinc-700 transition-all"
              >
                <FileText size={24} />
                <span className="text-[10px] font-bold uppercase">Label</span>
              </motion.button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={(e) => handleFileChange(e, sourceType === 'text' ? 'image' : sourceType)} 
              />
            </div>
          )}

          <div className="space-y-4">
            <AnimatePresence>
              {selectedImage && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="relative w-full aspect-video rounded-3xl overflow-hidden bg-zinc-900 border border-zinc-800"
                >
                  <img src={selectedImage} alt="Meal" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  <button 
                    onClick={() => { setSelectedImage(null); setDescription(''); }}
                    className="absolute top-4 right-4 p-2 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black"
                  >
                    <X size={20} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={sourceType === 'text' ? "e.g. 2 eggs toast butter coffee..." : "AI is generating description..."}
              className="w-full h-32 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 focus:border-primary outline-none text-lg resize-none placeholder:text-zinc-700 transition-all"
            />

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Meal Type</label>
              <select 
                value={mealType}
                onChange={(e) => setMealType(e.target.value as any)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-white outline-none focus:border-primary transition-colors appearance-none"
                style={{ backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1em' }}
              >
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
                <option value="snack">Snack</option>
              </select>
            </div>

            <MicroButton
              onClick={handleAnalyzeText}
              disabled={!description.trim() && !selectedImage}
              className="w-full py-4"
              variant="secondary"
            >
              <Sparkles size={20} />
              Analyze Meal
            </MicroButton>
          </div>
        </>
      )}

      {logState === 'RENAME_SUGGESTED' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Suggested Name</h3>
            <div className="space-y-2">
              <p className="text-sm text-zinc-400">Original: <span className="text-white">{originalName}</span></p>
              <p className="text-sm text-zinc-400">Suggested: <span className="text-primary font-bold">{suggestedName}</span></p>
            </div>
            <div className="flex gap-4">
              <MicroButton onClick={() => handleConfirmRename(true)} className="flex-1">Accept Rename</MicroButton>
              <MicroButton onClick={() => handleConfirmRename(false)} variant="secondary" className="flex-1">Keep Original</MicroButton>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Parsed Items</h3>
            <div className="space-y-2">
              {parsedItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input 
                    value={item}
                    onChange={(e) => {
                      const newItems = [...parsedItems];
                      newItems[idx] = e.target.value;
                      setParsedItems(newItems);
                    }}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-sm text-white outline-none focus:border-primary"
                  />
                  <button onClick={() => setParsedItems(parsedItems.filter((_, i) => i !== idx))} className="p-3 text-zinc-500 hover:text-red-500">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <button onClick={() => setParsedItems([...parsedItems, ''])} className="text-xs text-primary font-bold uppercase tracking-widest flex items-center gap-1 mt-2">
                <Plus size={14} /> Add Item
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {logState === 'MACROS_ESTIMATED' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <AnimatePresence>
            {renameFeedback && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-primary/10 border border-primary/20 text-primary p-4 rounded-2xl flex items-center gap-3 overflow-hidden"
              >
                <Sparkles size={20} className="shrink-0" />
                <div>
                  <p className="font-bold text-sm">✨ Cleaned that up for you!</p>
                  <p className="text-xs opacity-80">"{finalName}"</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Estimated Items</h3>
            <div className="space-y-3">
              {itemMacros.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
                  <span className="text-sm font-bold">{item.name}</span>
                  <div className="text-xs text-zinc-400 flex gap-3">
                    <span>{item.calories}kcal</span>
                    <span>P:{item.protein}g</span>
                    <span>C:{item.carbs}g</span>
                    <span>F:{item.fat}g</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-6">Total Macros</h3>
            <div className="grid grid-cols-2 gap-6">
              <NumericInput label="Calories" value={totalMacros.calories} onChange={v => setTotalMacros({...totalMacros, calories: v})} min={0} max={5000} unit="kcal" />
              <NumericInput label="Protein (g)" value={totalMacros.protein} onChange={v => setTotalMacros({...totalMacros, protein: v})} min={0} max={500} unit="g" />
              <NumericInput label="Carbs (g)" value={totalMacros.carbs} onChange={v => setTotalMacros({...totalMacros, carbs: v})} min={0} max={500} unit="g" />
              <NumericInput label="Fat (g)" value={totalMacros.fat} onChange={v => setTotalMacros({...totalMacros, fat: v})} min={0} max={500} unit="g" />
            </div>
          </div>

          <MicroButton onClick={handleSave} className="w-full py-4">
            <Save size={20} /> Confirm & Save
          </MicroButton>
        </motion.div>
      )}
    </div>
  );
}

// Removed local clsx as it is imported from '../utils'
