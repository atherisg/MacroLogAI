import React, { useState, useRef, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { parseMealInput, estimateItemsMacros, analyzeMealImagesForItems, ParsedItemMacro, getAminoAcidInsights, estimateAminoAcids, getDetailedProteinQuality, getMicronutrientInsights, estimateMicronutrients } from '../services/gemini';
import { MacroEstimation, UserProfile, AminoAcidProfile, ProteinQualityAnalysis, MicronutrientProfile } from '../types';
import { 
  Sparkles, 
  Save, 
  X, 
  Loader2, 
  Camera, 
  FileText, 
  Type as TypeIcon, 
  Trash2,
  Plus,
  Image as ImageIcon,
  Zap,
  Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import MicroButton from '../components/MicroButton';
import NumericInput from '../components/NumericInput';
import { useAppSound } from '../components/SoundProvider';
import { clsx } from 'clsx';
import ReactMarkdown from 'react-markdown';
import { aggregateAminoAcids, calculateProteinUtilizationScore, convertAminoAcidsForPortion, calculateMPSTrigger } from '../services/aminoAcidService';
import { calculateNutrientTargets } from '../services/nutrition';
import AminoAcidRadarChart from '../components/AminoAcidRadarChart';
import AminoAcidBarChart from '../components/AminoAcidBarChart';
import PremiumLocked from '../components/PremiumLocked';
import { hasPremiumAccess } from '../utils/premium';
import { MicronutrientIntelligence } from '../components/MicronutrientIntelligence';

type LogState = 'INPUT' | 'ANALYZING_INPUT' | 'RENAME_SUGGESTED' | 'ESTIMATING_MACROS' | 'MACROS_ESTIMATED' | 'SAVING' | 'LOGGED';

const MAX_IMAGES = 6;

export default function LogMeal({ user, profile, onComplete, initialMealType, initialSourceType, onNavigate }: { user: User, profile: UserProfile, onComplete: () => void, initialMealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack', initialSourceType?: 'text' | 'image', onNavigate?: (view: any) => void }) {
  const [logState, setLogState] = useState<LogState>('INPUT');
  const [description, setDescription] = useState('');
  const [originalName, setOriginalName] = useState('');
  const [suggestedName, setSuggestedName] = useState('');
  const [finalName, setFinalName] = useState('');
  const [parsedItems, setParsedItems] = useState<string[]>([]);
  const [itemMacros, setItemMacros] = useState<ParsedItemMacro[]>([]);
  const [totalMacros, setTotalMacros] = useState<MacroEstimation>({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [confidenceScore, setConfidenceScore] = useState<number | undefined>(undefined);
  const [renameFeedback, setRenameFeedback] = useState(false);
  
  const [aminoAcidTotals, setAminoAcidTotals] = useState<AminoAcidProfile | undefined>(undefined);
  const [utilizationScore, setUtilizationScore] = useState<{ score: number, limitingAA: string } | undefined>(undefined);
  const [mpsTrigger, setMpsTrigger] = useState<'MPS_TRIGGERED' | 'BELOW_THRESHOLD' | undefined>(undefined);
  const [aaInsights, setAaInsights] = useState<string | undefined>(undefined);
  const [proteinQualityAnalysis, setProteinQualityAnalysis] = useState<ProteinQualityAnalysis | undefined>(undefined);
  const [analyzingAA, setAnalyzingAA] = useState(false);
  
  const [micronutrientTotals, setMicronutrientTotals] = useState<MicronutrientProfile | undefined>(undefined);
  const [microInsights, setMicroInsights] = useState<string | undefined>(undefined);
  const [analyzingMicros, setAnalyzingMicros] = useState(false);
  
  const [sourceType, setSourceType] = useState<'text' | 'image' | 'label'>(initialSourceType || 'text');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
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
      const isMultiImage = selectedImages.length > 1;
      setLoadingMessage(logState === 'ANALYZING_INPUT' ? (isMultiImage ? `Analyzing ingredients across ${selectedImages.length} images...` : loadingMessages[0]) : "Calculating macros...");
      let i = 1;
      interval = setInterval(() => {
        setLoadingMessage(logState === 'ANALYZING_INPUT' ? (isMultiImage ? `Analyzing ingredients across ${selectedImages.length} images...` : loadingMessages[i % loadingMessages.length]) : "Calculating macros...");
        i++;
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [logState, selectedImages.length]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = MAX_IMAGES - selectedImages.length;
    const filesToProcess = files.slice(0, remainingSlots);

    if (files.length > remainingSlots) {
      alert(`You can only upload up to ${MAX_IMAGES} images.`);
    }

    filesToProcess.forEach(file => {
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
          setSelectedImages(prev => [...prev, compressedBase64]);
          setSourceType('image');
        };
        img.onerror = () => {
          // Fallback to original if compression fails
          setSelectedImages(prev => [...prev, base64Str]);
          setSourceType('image');
        };
      };
      reader.readAsDataURL(file);
    });
    
    // Reset file input so the same file can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    if (selectedImages.length === 1) {
      setSourceType('text');
    }
  };

  const handleAnalyzeImages = async () => {
    if (selectedImages.length === 0) return;
    setLogState('ANALYZING_INPUT');
    setLoadingMessage('Identifying foods and estimating macros...');
    try {
      const result = await analyzeMealImagesForItems(selectedImages);
      setOriginalName(selectedImages.length > 1 ? "Multi-Image Upload" : "Image Upload");
      setSuggestedName(result.cleanedName);
      setParsedItems(result.items);
      setTotalMacros(result.macros);
      setConfidenceScore(result.confidenceScore);
      setFinalName(result.cleanedName);
      
      if (profile.isPremium && result.macros.protein > 0) {
        setLoadingMessage('Analyzing amino acid profile and protein quality...');
        await processAminoAcids(result.items, result.macros.protein);
      }

      if (profile.isPremium) {
        setLoadingMessage('Analyzing micronutrient profile...');
        await processMicronutrients(result.items);
      }
      
      setLogState('MACROS_ESTIMATED'); // Skip RENAME_SUGGESTED for multi-image as it returns macros directly
    } catch (err) {
      console.error(err);
      playError();
      setLogState('INPUT');
    }
  };

  const handleAnalyzeText = async () => {
    if (!description.trim()) return;
    setLogState('ANALYZING_INPUT');
    setLoadingMessage('Parsing meal description...');
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
    setLoadingMessage('Calculating nutritional breakdown...');
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

      if (profile.isPremium && totals.protein > 0) {
        setLoadingMessage('Performing deep amino acid analysis...');
        await processAminoAcids(validItems, totals.protein);
      }

      if (profile.isPremium) {
        setLoadingMessage('Analyzing micronutrient profile...');
        await processMicronutrients(validItems);
      }
      
      setLogState('MACROS_ESTIMATED');
    } catch (err) {
      console.error(err);
      playError();
      setLogState('RENAME_SUGGESTED');
    }
  };

  const processAminoAcids = async (items: string[], totalProtein: number) => {
    if (totalProtein <= 0 || items.length === 0) {
      console.log("MacroLog AI: Skipping AA analysis - no protein or items");
      return;
    }
    
    setAnalyzingAA(true);
    console.log("MacroLog AI: Starting AI-based AA analysis for items:", items);
    
    try {
      // Use AI to estimate the combined AA profile directly
      const totals = await estimateAminoAcids(items);
      
      if (totals && Object.keys(totals).length > 0) {
        setAminoAcidTotals(totals);
        
        const score = calculateProteinUtilizationScore(totals, totalProtein);
        setUtilizationScore(score);
        
        const trigger = calculateMPSTrigger(totals.leucine || 0);
        setMpsTrigger(trigger);
        
        console.log("MacroLog AI: Requesting Gemini AA insights and detailed quality");
        const [insights, quality] = await Promise.all([
          getAminoAcidInsights(profile, totals, totalProtein),
          getDetailedProteinQuality(items, totals, totalProtein)
        ]);
        setAaInsights(insights);
        setProteinQualityAnalysis(quality);
      } else {
        console.warn("MacroLog AI: No amino acid profile could be estimated by AI");
      }
    } catch (err) {
      console.error("MacroLog AI: Amino acid analysis failed:", err);
    } finally {
      setAnalyzingAA(false);
    }
  };

  const processMicronutrients = async (items: string[]) => {
    if (items.length === 0) return;
    setAnalyzingMicros(true);
    try {
      // Use AI to estimate the combined micronutrient profile
      const aggregated = await estimateMicronutrients(items.join(", "), 100); // Using 100 as a placeholder or could use total weight if known
      
      setMicronutrientTotals(aggregated);
      
      // Get AI insights
      const targets = calculateNutrientTargets(profile);
      const insights = await getMicronutrientInsights(profile, aggregated, targets);
      setMicroInsights(insights);
    } catch (err) {
      console.error("Micronutrient analysis failed:", err);
    } finally {
      setAnalyzingMicros(false);
    }
  };

  const handleSave = async () => {
    setLogState('SAVING');
    try {
      await addDoc(collection(db, 'meals'), {
        uid: user.uid,
        description: finalName,
        ...totalMacros,
        imageUrls: selectedImages.length > 0 ? selectedImages : null,
        confidenceScore: confidenceScore || null,
        sourceType,
        mealType,
        timestamp: new Date().toISOString(),
        // Amino Acid Intelligence fields
        aminoAcidTotals: aminoAcidTotals || null,
        proteinUtilizationScore: utilizationScore?.score || null,
        proteinQualityScore: proteinQualityAnalysis?.proteinQualityScore || utilizationScore?.score || null,
        proteinQualityAnalysis: proteinQualityAnalysis || null,
        mpsTriggerStatus: mpsTrigger || null,
        aiAminoAcidInsights: aaInsights || null,
        // Micronutrient Intelligence fields
        micronutrients: micronutrientTotals || null,
        aiMicronutrientInsights: microInsights || null
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
          <div className="grid grid-cols-2 gap-3">
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
              className={clsx(
                "flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all",
                sourceType === 'image' || sourceType === 'label' ? "bg-zinc-900 border-primary text-primary" : "bg-zinc-900/30 border-zinc-800 text-zinc-500"
              )}
            >
              <Camera size={24} />
              <span className="text-[10px] font-bold uppercase">Photos</span>
            </motion.button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              multiple
              onChange={handleFileChange} 
            />
          </div>

          <div className="space-y-4">
            <AnimatePresence>
              {selectedImages.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                      Attached Photos ({selectedImages.length}/{MAX_IMAGES})
                    </h3>
                    {selectedImages.length < MAX_IMAGES && (
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs text-primary font-bold uppercase tracking-widest flex items-center gap-1"
                      >
                        <Plus size={14} /> Add More
                      </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3">
                    {selectedImages.map((img, idx) => (
                      <motion.div 
                        key={idx}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="relative aspect-square rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 group"
                      >
                        <img src={img} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <button 
                          onClick={() => removeImage(idx)}
                          className="absolute top-2 right-2 p-1.5 bg-black/60 backdrop-blur-md rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                        >
                          <X size={14} />
                        </button>
                      </motion.div>
                    ))}
                    {selectedImages.length < MAX_IMAGES && (
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-square rounded-2xl border-2 border-dashed border-zinc-800 flex flex-col items-center justify-center gap-2 text-zinc-500 hover:border-primary hover:text-primary transition-colors bg-zinc-900/30"
                      >
                        <ImageIcon size={24} />
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-500 italic">
                    Tip: Upload multiple photos for better accuracy — ingredients, nutrition labels, and the final dish.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {sourceType === 'text' && (
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g. 2 eggs toast butter coffee..."
                className="w-full h-32 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 focus:border-primary outline-none text-lg resize-none placeholder:text-zinc-700 transition-all"
              />
            )}

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
              onClick={selectedImages.length > 0 ? handleAnalyzeImages : handleAnalyzeText}
              disabled={!description.trim() && selectedImages.length === 0}
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
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Detected Meal</h3>
              {confidenceScore !== undefined && (
                <span className={clsx(
                  "text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest",
                  confidenceScore >= 80 ? "bg-green-500/20 text-green-500" :
                  confidenceScore >= 50 ? "bg-orange-500/20 text-orange-500" :
                  "bg-red-500/20 text-red-500"
                )}>
                  {confidenceScore}% Confidence
                </span>
              )}
            </div>
            
            <input 
              value={finalName}
              onChange={(e) => setFinalName(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-lg font-bold text-white outline-none focus:border-primary"
            />

            <div className="pt-4 border-t border-zinc-800">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">Detected Ingredients</h4>
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
                      className="flex-1 bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-2 text-sm text-zinc-300 outline-none focus:border-primary"
                    />
                    <button onClick={() => setParsedItems(parsedItems.filter((_, i) => i !== idx))} className="p-2 text-zinc-500 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button onClick={() => setParsedItems([...parsedItems, ''])} className="text-[10px] text-primary font-bold uppercase tracking-widest flex items-center gap-1 mt-2">
                  <Plus size={12} /> Add Ingredient
                </button>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-6">Estimated Macros</h3>
            <div className="grid grid-cols-2 gap-6">
              <NumericInput label="Calories" value={totalMacros.calories} onChange={v => setTotalMacros({...totalMacros, calories: v})} min={0} max={5000} unit="kcal" />
              <NumericInput label="Protein (g)" value={totalMacros.protein} onChange={v => setTotalMacros({...totalMacros, protein: v})} min={0} max={500} unit="g" step={0.1} />
              <NumericInput label="Carbs (g)" value={totalMacros.carbs} onChange={v => setTotalMacros({...totalMacros, carbs: v})} min={0} max={500} unit="g" step={0.1} />
              <NumericInput label="Fat (g)" value={totalMacros.fat} onChange={v => setTotalMacros({...totalMacros, fat: v})} min={0} max={500} unit="g" step={0.1} />
            </div>
          </div>

          {/* Premium Amino Acid Intelligence Section */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="text-primary" size={18} />
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Amino Acid Intelligence</h3>
              </div>
              {analyzingAA && (
                <div className="flex items-center gap-2 text-[10px] text-primary font-bold uppercase animate-pulse">
                  <Loader2 size={12} className="animate-spin" /> Analyzing...
                </div>
              )}
            </div>

            {!hasPremiumAccess(profile) ? (
              <PremiumLocked 
                title="Amino Acid Intelligence"
                message="Deep analysis of protein quality, leucine triggers, and essential amino acid profiles for every meal."
                onUpgrade={() => onNavigate?.('premium')}
              />
            ) : aminoAcidTotals ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white">Protein Quality Score</span>
                        <span className={clsx(
                          "text-[10px] font-bold uppercase tracking-widest",
                          (proteinQualityAnalysis?.proteinQualityScore ?? utilizationScore!.score) >= 90 ? "text-green-500" :
                          (proteinQualityAnalysis?.proteinQualityScore ?? utilizationScore!.score) >= 70 ? "text-primary" :
                          "text-red-500"
                        )}>
                          {proteinQualityAnalysis?.rating || (utilizationScore!.score >= 90 ? "High Quality" : utilizationScore!.score >= 75 ? "Good Quality" : "Moderate Quality")}
                        </span>
                      </div>
                      <span className={clsx(
                        "text-lg font-black italic",
                        (proteinQualityAnalysis?.proteinQualityScore ?? utilizationScore!.score) >= 90 ? "text-green-500" :
                        (proteinQualityAnalysis?.proteinQualityScore ?? utilizationScore!.score) >= 70 ? "text-primary" :
                        "text-red-500"
                      )}>
                        {proteinQualityAnalysis?.proteinQualityScore ?? utilizationScore?.score}/100
                      </span>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${proteinQualityAnalysis?.proteinQualityScore ?? utilizationScore?.score}%` }}
                        className={clsx(
                          "h-full rounded-full",
                          (proteinQualityAnalysis?.proteinQualityScore ?? utilizationScore!.score) >= 90 ? "bg-green-500" :
                          (proteinQualityAnalysis?.proteinQualityScore ?? utilizationScore!.score) >= 70 ? "bg-primary" :
                          "bg-red-500"
                        )}
                      />
                    </div>

                    {proteinQualityAnalysis && (
                      <div className="bg-zinc-800/20 rounded-xl p-3 space-y-2 border border-white/5">
                        <div className="flex flex-wrap gap-1">
                          {proteinQualityAnalysis.limitingAminoAcids.length > 0 ? (
                            proteinQualityAnalysis.limitingAminoAcids.map(aa => (
                              <span key={aa} className="text-[9px] font-bold uppercase px-1.5 py-0.5 bg-red-500/10 text-red-400 rounded border border-red-500/20">
                                Limiting: {aa}
                              </span>
                            ))
                          ) : (
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 bg-green-500/10 text-green-400 rounded border border-green-500/20">
                              Complete Profile
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-400 leading-relaxed italic">
                          {proteinQualityAnalysis.comments}
                        </p>
                      </div>
                    )}
                    
                    <div className="pt-2 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-zinc-500">Leucine Level</span>
                        <span className={clsx(
                          "text-xs font-bold",
                          (aminoAcidTotals.leucine || 0) >= 2.5 ? "text-green-500" :
                          (aminoAcidTotals.leucine || 0) >= 1.5 ? "text-orange-500" :
                          "text-red-500"
                        )}>
                          {aminoAcidTotals.leucine?.toFixed(1)}g
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-zinc-500">MPS Trigger</span>
                        <span className={clsx(
                          "text-[10px] font-black uppercase italic px-2 py-0.5 rounded transition-all duration-500",
                          mpsTrigger === 'MPS_TRIGGERED' 
                            ? "bg-green-500/20 text-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]" 
                            : "bg-red-500/20 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]"
                        )}>
                          {mpsTrigger === 'MPS_TRIGGERED' ? 'Activated' : 'Not Reached'}
                        </span>
                      </div>
                    </div>

                    <p className="text-[10px] text-zinc-500 leading-relaxed pt-2">
                      {mpsTrigger === 'MPS_TRIGGERED' 
                        ? "This meal contains enough leucine to stimulate muscle protein synthesis."
                        : "MPS Trigger: Not reached. Consider adding eggs, whey protein, chicken, or fish."}
                    </p>
                    
                    {/* Redundant limiting AA text removed in favor of detailed analysis above */}
                  </div>

                  <div className="h-[400px] w-full relative">
                    <AminoAcidRadarChart profile={aminoAcidTotals} />
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-800">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-4">Essential Amino Acid Profile</h4>
                  <div className="h-[400px] w-full relative">
                    <AminoAcidBarChart profile={aminoAcidTotals} totalProtein={totalMacros.protein} />
                  </div>
                </div>

                {aaInsights && (
                  <div className="pt-4 border-t border-zinc-800">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-2">
                      <Sparkles size={12} /> AI Insights
                    </h4>
                    <div className="bg-zinc-800/30 rounded-2xl p-4 text-xs text-zinc-300 leading-relaxed italic whitespace-pre-wrap break-words markdown-body">
                      <ReactMarkdown>{aaInsights}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            ) : !analyzingAA && (
              <div className="py-8 text-center space-y-2">
                <p className="text-zinc-500 text-xs italic">No amino acid data available for these ingredients.</p>
                <button 
                  onClick={() => processAminoAcids(parsedItems, totalMacros.protein)}
                  className="text-[10px] text-primary font-bold uppercase tracking-widest"
                >
                  Retry Analysis
                </button>
              </div>
            )}
          </div>

          {/* Premium Micronutrient Intelligence Section */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="text-primary" size={18} />
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Micronutrient Intelligence</h3>
              </div>
              {analyzingMicros && (
                <div className="flex items-center gap-2 text-[10px] text-primary font-bold uppercase animate-pulse">
                  <Loader2 size={12} className="animate-spin" /> Analyzing...
                </div>
              )}
            </div>

            {!hasPremiumAccess(profile) ? (
              <PremiumLocked 
                title="Micronutrient Intelligence"
                message="Track vitamins, minerals, and electrolytes for every meal with AI-powered insights."
                onUpgrade={() => onNavigate?.('premium')}
              />
            ) : micronutrientTotals ? (
              <div className="space-y-6">
                <MicronutrientIntelligence 
                  intake={micronutrientTotals} 
                  targets={calculateNutrientTargets(profile)} 
                  isPremium={true} 
                />
                
                {microInsights && (
                  <div className="pt-4 border-t border-zinc-800">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-2">
                      <Sparkles size={12} /> AI Micronutrient Insights
                    </h4>
                    <div className="bg-zinc-800/30 rounded-2xl p-4 text-xs text-zinc-300 leading-relaxed italic whitespace-pre-wrap break-words markdown-body">
                      <ReactMarkdown>{microInsights}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            ) : !analyzingMicros && (
              <div className="py-8 text-center space-y-2">
                <p className="text-zinc-500 text-xs italic">No micronutrient data available for these ingredients.</p>
                <button 
                  onClick={() => processMicronutrients(parsedItems)}
                  className="text-[10px] text-primary font-bold uppercase tracking-widest"
                >
                  Retry Analysis
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <MicroButton onClick={() => setLogState('INPUT')} variant="secondary" className="flex-1">
              Rescan
            </MicroButton>
            <MicroButton onClick={handleSave} className="flex-[2] py-4">
              <Save size={20} /> Confirm & Log
            </MicroButton>
          </div>
        </motion.div>
      )}
    </div>
  );
}
