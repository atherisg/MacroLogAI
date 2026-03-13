import React, { useState, useRef, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { estimateMealMacros, analyzeMealImage } from '../services/gemini';
import { MacroEstimation } from '../types';
import { 
  Sparkles, 
  Save, 
  X, 
  Loader2, 
  Camera, 
  FileText, 
  Type as TypeIcon, 
  Upload,
  Check,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import MicroButton from '../components/MicroButton';
import { useAppSound } from '../components/SoundProvider';
import { clsx } from 'clsx';

export default function LogMeal({ user, onComplete }: { user: User, onComplete: () => void }) {
  const [description, setDescription] = useState('');
  const [estimating, setEstimating] = useState(false);
  const [estimation, setEstimation] = useState<MacroEstimation | null>(null);
  const [saving, setSaving] = useState(false);
  const [sourceType, setSourceType] = useState<'text' | 'image' | 'label'>('text');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { playSuccess, playError } = useAppSound();

  const loadingMessages = [
    "Analyzing your meal...",
    "Calculating macros...",
    "Consulting the AI chef...",
    "Breaking down ingredients...",
    "Estimating portion sizes..."
  ];

  useEffect(() => {
    let interval: any;
    if (estimating) {
      setLoadingMessage(loadingMessages[0]);
      let i = 1;
      interval = setInterval(() => {
        setLoadingMessage(loadingMessages[i % loadingMessages.length]);
        i++;
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [estimating]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'label') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        setSourceType(type);
        handleAnalyzeImage(reader.result as string, type === 'label');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyzeImage = async (base64: string, isLabel: boolean) => {
    setEstimating(true);
    setEstimation(null);
    try {
      const result = await analyzeMealImage(base64, isLabel);
      setDescription(result.description);
      setEstimation(result.macros);
    } catch (err) {
      console.error(err);
      playError();
    } finally {
      setEstimating(false);
    }
  };

  const handleEstimateText = async () => {
    if (!description.trim()) return;
    setEstimating(true);
    setSourceType('text');
    try {
      const result = await estimateMealMacros(description);
      setEstimation(result);
    } catch (err) {
      console.error(err);
      playError();
    } finally {
      setEstimating(false);
    }
  };

  const handleSave = async () => {
    if (!estimation) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'meals'), {
        uid: user.uid,
        description,
        ...estimation,
        imageUrl: selectedImage || null,
        sourceType,
        timestamp: new Date().toISOString()
      });
      playSuccess();
      onComplete();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'meals');
      playError();
    } finally {
      setSaving(false);
    }
  };

  const updateMacro = (key: keyof MacroEstimation, val: string) => {
    if (!estimation) return;
    const num = parseFloat(val) || 0;
    setEstimation({ ...estimation, [key]: num });
  };

  if (estimating && !estimation) {
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

      {/* Method Selection */}
      {!selectedImage && !estimation && (
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
              <img src={selectedImage} alt="Meal" className="w-full h-full object-cover" />
              <button 
                onClick={() => { setSelectedImage(null); setEstimation(null); setDescription(''); }}
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
          placeholder={sourceType === 'text' ? "e.g. 2 scrambled eggs with rice..." : "AI is generating description..."}
          className="w-full h-32 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 focus:border-primary outline-none text-lg resize-none placeholder:text-zinc-700 transition-all"
        />

        {!estimation ? (
          <MicroButton
            onClick={handleEstimateText}
            disabled={estimating || !description.trim()}
            className="w-full py-4"
            variant="secondary"
          >
            {estimating ? <Loader2 className="animate-spin" /> : <Sparkles size={20} />}
            {estimating ? 'Analyzing...' : 'Estimate Macros'}
          </MicroButton>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Confirm Macros</h3>
                <button onClick={() => setEstimation(null)} className="text-zinc-500 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-zinc-500">Calories</label>
                  <input 
                    type="number" 
                    value={estimation.calories} 
                    onChange={e => updateMacro('calories', e.target.value)}
                    className="w-full bg-transparent text-3xl font-black italic text-primary outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-zinc-500">Protein (g)</label>
                  <input 
                    type="number" 
                    value={estimation.protein} 
                    onChange={e => updateMacro('protein', e.target.value)}
                    className="w-full bg-transparent text-3xl font-black italic text-[#4ade80] outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-zinc-500">Carbs (g)</label>
                  <input 
                    type="number" 
                    value={estimation.carbs} 
                    onChange={e => updateMacro('carbs', e.target.value)}
                    className="w-full bg-transparent text-3xl font-black italic text-[#22c55e] outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-zinc-500">Fat (g)</label>
                  <input 
                    type="number" 
                    value={estimation.fat} 
                    onChange={e => updateMacro('fat', e.target.value)}
                    className="w-full bg-transparent text-3xl font-black italic text-[#166534] outline-none"
                  />
                </div>
              </div>
            </div>

            <MicroButton
              onClick={handleSave}
              disabled={saving}
              className="w-full py-4"
            >
              {saving ? 'Saving...' : <><Save size={20} /> Confirm & Save</>}
            </MicroButton>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// Removed local clsx as it is imported from '../utils'
