import React, { useState, useEffect } from 'react';
import { User, signOut, deleteUser, updateEmail, updatePassword } from 'firebase/auth';
import { doc, setDoc, updateDoc, collection, addDoc, query, where, orderBy, onSnapshot, deleteDoc, getDocs } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import confetti from 'canvas-confetti';
import { 
  UserProfile, 
  ActivityLevel, 
  FitnessGoal, 
  Gender, 
  NutritionMode, 
  MacroStrategy,
  UnitPreference,
  ThemeType, 
  AccentColor,
  Supplement,
  BodyMetric
} from '../types';
import { calculateBMI, calculateTargets, kgToLbs, lbsToKg, cmToFtIn, ftInToCm } from '../utils';
import { 
  Save, 
  User as UserIcon, 
  Volume2, 
  VolumeX, 
  Zap, 
  ZapOff, 
  Settings, 
  Target, 
  Pill, 
  Palette, 
  Bell, 
  Shield, 
  UserCog,
  Plus,
  Trash2,
  ChevronRight,
  LogOut,
  Download,
  FileText,
  AlertTriangle,
  Scale,
  TrendingUp,
  Edit2,
  BrainCircuit,
  Activity,
  HeartPulse,
  Star,
  Repeat,
  Loader2
} from 'lucide-react';
import MicroButton from '../components/MicroButton';
import SupplementModal from '../components/SupplementModal';
import { CollapsibleSection } from '../components/CollapsibleSection';
import { motion, AnimatePresence } from 'motion/react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

import AnimatedNumber from '../components/AnimatedNumber';
import MacroCircleBar from '../components/MacroCircleBar';
import NumericInput from '../components/NumericInput';
import CompactNumericInput from '../components/CompactNumericInput';
import DataTile from '../components/DataTile';
import ConfirmModal from '../components/ConfirmModal';
import AlertModal from '../components/AlertModal';
import SegmentedControl from '../components/SegmentedControl';

type Tab = 'profile' | 'supplements' | 'appearance' | 'notifications' | 'privacy' | 'account';

const ACTIVITY_LEVELS: { id: ActivityLevel; label: string; description: string }[] = [
  { id: 'sedentary', label: 'Sedentary', description: 'Office job, little to no exercise' },
  { id: 'lightly_active', label: 'Lightly Active', description: 'Light exercise 1-3 days/week' },
  { id: 'moderately_active', label: 'Moderately Active', description: 'Moderate exercise 3-5 days/week' },
  { id: 'very_active', label: 'Very Active', description: 'Hard exercise 6-7 days/week' },
  { id: 'athlete', label: 'Athlete', description: 'Very hard exercise, physical job, 2x training' },
];

const FITNESS_GOALS: { id: FitnessGoal; label: string; description: string }[] = [
  { id: 'lose_fat', label: 'Lose Weight', description: 'Calorie deficit for fat loss' },
  { id: 'maintain', label: 'Maintain', description: 'Eat at your TDEE' },
  { id: 'build_muscle', label: 'Build Muscle', description: 'Calorie surplus for muscle gain' },
  { id: 'recomposition', label: 'Recomposition', description: 'Body recomposition (lose fat, gain muscle)' },
];

const MACRO_STRATEGIES: { id: MacroStrategy; label: string; description: string }[] = [
  { id: 'bodyweight', label: 'Bodyweight Based', description: 'Custom g/kg for protein and fat' },
  { id: 'balanced', label: 'Balanced Diet', description: '30% Protein, 40% Carbs, 30% Fat' },
  { id: 'low_carb', label: 'Low Carb / Keto', description: '40% Protein, 20% Carbs, 40% Fat' },
  { id: 'high_protein', label: 'High Protein', description: '45% Protein, 35% Carbs, 20% Fat' },
];

const Profile = React.forwardRef(({ user, profile }: { user: User, profile: UserProfile | null }, ref) => {
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [isSuppModalOpen, setIsSuppModalOpen] = useState(false);
  const [editingSupp, setEditingSupp] = useState<Supplement | null>(null);
  
  // Form States
  const [formData, setFormData] = useState({
    name: profile?.name || user.displayName || '',
    photoURL: profile?.photoURL || user.photoURL || '',
    age: profile?.age || 25,
    gender: profile?.gender || 'male' as Gender,
    height: profile?.height || 175,
    weight: profile?.weight || 70,
    activityLevel: profile?.activityLevel || 'sedentary' as ActivityLevel,
    fitnessGoal: profile?.fitnessGoal || 'maintain' as FitnessGoal,
    macroStrategy: profile?.macroStrategy || 'balanced' as MacroStrategy,
    proteinGramsPerKg: profile?.proteinGramsPerKg || 2.0,
    fatGramsPerKg: profile?.fatGramsPerKg || 0.8,
    unitPreference: profile?.unitPreference || 'metric' as UnitPreference,
    nutritionMode: profile?.nutritionMode || 'auto' as NutritionMode,
    aiMacroOptimization: profile?.aiMacroOptimization ?? true,
    calorieTarget: profile?.calorieTarget || 2000,
    proteinTarget: profile?.proteinTarget || 150,
    carbsTarget: profile?.carbsTarget || 200,
    fatTarget: profile?.fatTarget || 60,
    theme: profile?.theme || 'dark' as ThemeType,
    accentColor: profile?.accentColor || 'neon-green' as AccentColor,
  });

  const [settings, setSettings] = useState({
    animationsEnabled: profile?.settings?.animationsEnabled ?? true,
    soundsEnabled: profile?.settings?.soundsEnabled ?? true,
    aiSuggestionsEnabled: profile?.settings?.aiSuggestionsEnabled ?? true,
    macroAlertsEnabled: profile?.settings?.macroAlertsEnabled ?? true,
    streakNotificationsEnabled: profile?.settings?.streakNotificationsEnabled ?? true,
  });

  const [notificationSettings, setNotificationSettings] = useState({
    mealReminders: profile?.notificationSettings?.mealReminders ?? true,
    macroAlerts: profile?.notificationSettings?.macroAlerts ?? true,
    supplementReminders: profile?.notificationSettings?.supplementReminders ?? true,
    weeklyReports: profile?.notificationSettings?.weeklyReports ?? true,
    streakReminders: profile?.notificationSettings?.streakReminders ?? true,
    reminderTime: profile?.notificationSettings?.reminderTime ?? '08:00',
  });

  const [privacy, setPrivacy] = useState({
    isPrivate: profile?.privacy?.isPrivate ?? true,
    leaderboardVisible: profile?.privacy?.leaderboardVisible ?? false,
    anonymousAnalytics: profile?.privacy?.anonymousAnalytics ?? true,
  });

  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
  const [suppToDelete, setSuppToDelete] = useState<string | null>(null);
  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; title: string; message: string; variant: 'info' | 'success' | 'error' }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'info'
  });
  
  // Fetch Metrics and Supplements
  useEffect(() => {
    const metricsQuery = query(
      collection(db, 'metrics'),
      where('uid', '==', user.uid),
      orderBy('date', 'asc')
    );
    const unsubscribeMetrics = onSnapshot(metricsQuery, (snap) => {
      setMetrics(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BodyMetric)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'metrics');
    });

    const supplementsQuery = query(
      collection(db, 'supplements'),
      where('uid', '==', user.uid)
    );
    const unsubscribeSupps = onSnapshot(supplementsQuery, (snap) => {
      setSupplements(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplement)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'supplements');
    });

    return () => {
      unsubscribeMetrics();
      unsubscribeSupps();
    };
  }, [user.uid]);

  const handleSaveSupplement = async (suppData: Partial<Supplement>) => {
    try {
      if (editingSupp) {
        await setDoc(doc(db, 'supplements', editingSupp.id!), { ...editingSupp, ...suppData }, { merge: true });
      } else {
        await addDoc(collection(db, 'supplements'), {
          uid: user.uid,
          ...suppData
        });
      }
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'supplements');
    }
  };

  const handleDeleteSupplement = async (suppId: string) => {
    try {
      await deleteDoc(doc(db, 'supplements', suppId));
      setSuppToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'supplements/' + suppId);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    
    let targets = {
      calorieTarget: formData.calorieTarget,
      proteinTarget: formData.proteinTarget,
      carbsTarget: formData.carbsTarget,
      fatTarget: formData.fatTarget,
    };

    if (formData.nutritionMode === 'auto') {
      const calculated = calculateTargets(formData);
      targets = {
        calorieTarget: calculated.calorieTarget,
        proteinTarget: calculated.proteinTarget,
        carbsTarget: calculated.carbsTarget,
        fatTarget: calculated.fatTarget,
      };
    }

    const newProfile: any = {
      ...(profile || {}),
      uid: user.uid,
      email: user.email!,
      ...formData,
      ...targets,
      settings,
      notificationSettings,
      privacy,
      dashboardWidgets: profile?.dashboardWidgets || ['macros', 'score', 'history', 'supplements', 'streak', 'analytics', 'ai'],
      createdAt: profile?.createdAt || new Date().toISOString(),
      role: profile?.role || 'client',
      isPremium: profile?.isPremium ?? true,
    };

    if (profile?.premiumExpiresAt !== undefined) {
      newProfile.premiumExpiresAt = profile.premiumExpiresAt;
    }

    // Remove any undefined values to prevent Firestore errors
    Object.keys(newProfile).forEach(key => {
      if (newProfile[key] === undefined) {
        delete newProfile[key];
      }
    });

    try {
      await setDoc(doc(db, 'users', user.uid), newProfile);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
      
      // Log weight if it changed
      if (formData.weight !== profile?.weight) {
        const bmi = calculateBMI(formData.weight, formData.height).value;
        await addDoc(collection(db, 'metrics'), {
          uid: user.uid,
          weight: formData.weight,
          bmi,
          date: format(new Date(), 'yyyy-MM-dd')
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'users/' + user.uid);
    } finally {
      setSaving(false);
    }
  };

  React.useImperativeHandle(ref, () => ({
    handleSave,
    saving
  }));

  const handleExportData = async () => {
    try {
      const q = query(collection(db, 'meals'), where('uid', '==', user.uid));
      const snap = await getDocs(q);
      const meals = snap.docs.map(doc => doc.data());
      
      if (meals.length === 0) {
        setAlertConfig({
          isOpen: true,
          title: 'No Data',
          message: 'You have no logged meals to export.',
          variant: 'info'
        });
        return;
      }

      const headers = ['Date', 'Description', 'Calories', 'Protein', 'Carbs', 'Fat'];
      const rows = meals.map(m => [
        m.timestamp,
        m.description,
        m.calories,
        m.protein,
        m.carbs,
        m.fat
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(r => r.join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `macrolog_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      // Delete user-related data (best effort)
      const collectionsToDelete = ['meals', 'supplements', 'metrics'];
      for (const collName of collectionsToDelete) {
        const q = query(collection(db, collName), where('uid', '==', user.uid));
        const snap = await getDocs(q);
        const deletePromises = snap.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
      }

      await deleteDoc(doc(db, 'users', user.uid));
      await deleteUser(auth.currentUser!);
    } catch (error) {
      console.error('Delete account failed:', error);
      setAlertConfig({
        isOpen: true,
        title: 'Delete Failed',
        message: 'Failed to delete account. You may need to re-authenticate first.',
        variant: 'error'
      });
    }
  };

  const handleResetHistory = async () => {
    if (resetConfirmText !== 'Reset Progress') return;
    setResetting(true);
    try {
      const collectionsToReset = [
        'meals', 
        'water_logs', 
        'daily_nutrition_insights', 
        'daily_nutrition_summaries',
        'metrics',
        'supplementLogs',
        'weekly_reports'
      ];
      for (const collName of collectionsToReset) {
        const q = query(collection(db, collName), where('uid', '==', user.uid));
        const snap = await getDocs(q);
        const deletePromises = snap.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
      }
      setIsResetModalOpen(false);
      setResetConfirmText('');
      setAlertConfig({
        isOpen: true,
        title: 'Success',
        message: 'History has been reset successfully.',
        variant: 'success'
      });
    } catch (error) {
      console.error('Reset failed:', error);
      handleFirestoreError(error, OperationType.DELETE, 'history');
    } finally {
      setResetting(false);
    }
  };

  const bmiData = calculateBMI(formData.weight, formData.height);
  const targets = calculateTargets(formData);

  const tabs: { id: Tab, icon: any, label: string }[] = [
    { id: 'profile', icon: UserIcon, label: 'Profile' },
    { id: 'supplements', icon: Pill, label: 'Supplements' },
    { id: 'appearance', icon: Palette, label: 'Appearance' },
    { id: 'notifications', icon: Bell, label: 'Alerts' },
    { id: 'privacy', icon: Shield, label: 'Privacy' },
    { id: 'account', icon: UserCog, label: 'Account' },
  ];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-black italic uppercase tracking-tighter text-primary">Settings</h2>
          <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest">Manage your profile and preferences</p>
        </div>
      </div>

      {/* Floating Save Button */}
      <div className="fixed bottom-24 right-6 z-50 flex items-center gap-4">
        <AnimatePresence>
          {saveStatus === 'success' && (
            <motion.span 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="bg-zinc-900 border border-primary/30 text-primary px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-primary/10"
            >
              Saved successfully
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Tabs Navigation */}
      <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all text-xs font-bold uppercase tracking-tighter border",
              activeTab === tab.id 
                ? "bg-primary text-black border-primary" 
                : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700"
            )}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="bg-zinc-900/40 border border-zinc-800/50 rounded-[2.5rem] p-8 backdrop-blur-xl"
        >
          {activeTab === 'profile' && (
            <div className="space-y-10">
              <section className="space-y-6">
                <div className="flex items-center gap-6">
                  <div className="relative group">
                    <img 
                      src={formData.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                      alt="Profile" 
                      className="w-24 h-24 rounded-[2rem] object-cover border-2 border-primary/20"
                      referrerPolicy="no-referrer"
                    />
                    <button className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-[2rem]">
                      <Edit2 size={20} className="text-white" />
                    </button>
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Display Name</label>
                        <input 
                          type="text" 
                          value={formData.name}
                          onChange={e => setFormData({...formData, name: e.target.value})}
                          placeholder="Your Name"
                          className="w-full h-12 bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 focus:border-primary outline-none text-white font-bold"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Email Address</label>
                        <input 
                          type="email" 
                          value={user.email || ''}
                          disabled
                          className="w-full h-12 bg-zinc-900/30 border border-zinc-800/50 rounded-xl px-4 text-zinc-500 cursor-not-allowed outline-none font-mono text-sm"
                        />
                      </div>
                    </div>
                    <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Member since {profile?.createdAt ? format(new Date(profile.createdAt), 'MMMM yyyy') : 'Today'}</p>
                  </div>
                </div>
              </section>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column: Inputs */}
                <div className="space-y-6">
                  {/* Personal Information Card */}
                  <CollapsibleSection title="Personal Info" icon={UserIcon}>
                    <div className="bg-zinc-900/20 border border-white/10 rounded-3xl p-6 space-y-6 backdrop-blur-md overflow-hidden">
                      <div className="flex justify-end">
                        <SegmentedControl 
                          options={[{id: 'metric', label: 'Metric'}, {id: 'imperial', label: 'Imperial'}]} 
                          value={formData.unitPreference} 
                          onChange={v => setFormData({...formData, unitPreference: v as UnitPreference})} 
                        />
                      </div>
                      <div className="space-y-4">
                        <NumericInput label="Age" value={formData.age} onChange={v => setFormData({...formData, age: v})} min={18} max={80} unit="yrs" />
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Gender</label>
                          <div className="flex gap-2">
                            {['male', 'female', 'other'].map(g => (
                              <button
                                key={g}
                                onClick={() => setFormData({...formData, gender: g as Gender})}
                                className={clsx(
                                  "flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors border",
                                  formData.gender === g ? "bg-primary text-black border-primary" : "bg-zinc-950/50 text-zinc-400 border-white/5 hover:border-zinc-600"
                                )}
                              >
                                {g}
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        {formData.unitPreference === 'metric' ? (
                          <>
                            <NumericInput label="Height" value={formData.height} onChange={v => setFormData({...formData, height: v})} min={100} max={250} unit="cm" />
                            <NumericInput label="Weight" value={formData.weight} onChange={v => setFormData({...formData, weight: v})} min={30} max={200} unit="kg" />
                          </>
                        ) : (
                          <>
                            <div className="grid grid-cols-2 gap-4">
                              <NumericInput 
                                label="Height (ft)" 
                                value={cmToFtIn(formData.height).ft} 
                                onChange={v => {
                                  const current = cmToFtIn(formData.height);
                                  setFormData({...formData, height: ftInToCm(v, current.in)});
                                }} 
                                min={3} max={8} unit="ft" 
                              />
                              <NumericInput 
                                label="Height (in)" 
                                value={cmToFtIn(formData.height).in} 
                                onChange={v => {
                                  const current = cmToFtIn(formData.height);
                                  setFormData({...formData, height: ftInToCm(current.ft, v)});
                                }} 
                                min={0} max={11} unit="in" 
                              />
                            </div>
                            <NumericInput 
                              label="Weight (lbs)" 
                              value={Math.round(kgToLbs(formData.weight))} 
                              onChange={v => setFormData({...formData, weight: lbsToKg(v)})} 
                              min={60} max={500} unit="lbs" 
                            />
                          </>
                        )}
                      </div>
                    </div>
                  </CollapsibleSection>

                  {/* Fitness Configuration Card */}
                  <CollapsibleSection title="Fitness Config" icon={Activity}>
                    <div className="bg-zinc-900/20 border border-white/10 rounded-3xl p-6 space-y-6 backdrop-blur-md">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Nutrition Mode</label>
                          <SegmentedControl 
                            options={[{id: 'auto', label: 'Auto'}, {id: 'manual', label: 'Manual'}]} 
                            value={formData.nutritionMode} 
                            onChange={v => {
                              if (v === 'manual') {
                                setFormData({
                                  ...formData, 
                                  nutritionMode: 'manual',
                                  calorieTarget: targets.calorieTarget,
                                  proteinTarget: targets.proteinTarget,
                                  carbsTarget: targets.carbsTarget,
                                  fatTarget: targets.fatTarget
                                });
                              } else {
                                setFormData({...formData, nutritionMode: 'auto'});
                              }
                            }} 
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Activity Level</label>
                          <div className="grid grid-cols-1 gap-2">
                            {ACTIVITY_LEVELS.map((level) => (
                              <button
                                key={level.id}
                                onClick={() => setFormData({ ...formData, activityLevel: level.id })}
                                className={clsx(
                                  "w-full p-4 rounded-2xl text-left transition-all border flex flex-col gap-1",
                                  formData.activityLevel === level.id
                                    ? "bg-primary/10 border-primary text-primary shadow-[0_0_20px_rgba(130,217,93,0.1)]"
                                    : "bg-zinc-950/50 border-white/5 text-zinc-400 hover:border-zinc-700"
                                )}
                              >
                                <span className="text-xs font-black uppercase tracking-tight">{level.label}</span>
                                <span className="text-[10px] opacity-60 font-medium leading-tight">{level.description}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleSection>

                  {/* Macro Strategy Card */}
                  <CollapsibleSection title="Macro Strategy" icon={BrainCircuit}>
                    <div className="bg-zinc-900/20 border border-white/10 rounded-3xl p-6 space-y-6 backdrop-blur-md">
                      <div className="grid grid-cols-1 gap-2">
                        {MACRO_STRATEGIES.map((strategy) => (
                          <button
                            key={strategy.id}
                            onClick={() => setFormData({ ...formData, macroStrategy: strategy.id })}
                            className={clsx(
                              "w-full p-4 rounded-2xl text-left transition-all border flex flex-col gap-1",
                              formData.macroStrategy === strategy.id
                                ? "bg-primary/10 border-primary text-primary shadow-[0_0_20px_rgba(130,217,93,0.1)]"
                                : "bg-zinc-950/50 border-white/5 text-zinc-400 hover:border-zinc-700"
                            )}
                          >
                            <span className="text-xs font-black uppercase tracking-tight">{strategy.label}</span>
                            <span className="text-[10px] opacity-60 font-medium leading-tight">{strategy.description}</span>
                          </button>
                        ))}
                      </div>

                      {formData.macroStrategy === 'bodyweight' && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="pt-4 border-t border-white/5 space-y-4"
                        >
                          <NumericInput 
                            label={formData.unitPreference === 'imperial' ? "Protein (g/lb)" : "Protein (g/kg)"} 
                            value={formData.unitPreference === 'imperial' ? Number((formData.proteinGramsPerKg / 2.20462).toFixed(2)) : formData.proteinGramsPerKg} 
                            onChange={v => setFormData({...formData, proteinGramsPerKg: formData.unitPreference === 'imperial' ? v * 2.20462 : v})} 
                            min={formData.unitPreference === 'imperial' ? 0.2 : 0.5} 
                            max={formData.unitPreference === 'imperial' ? 2.0 : 4.0} 
                            step={0.1} 
                            unit={formData.unitPreference === 'imperial' ? "g/lb" : "g/kg"} 
                          />
                          <NumericInput 
                            label={formData.unitPreference === 'imperial' ? "Fat (g/lb)" : "Fat (g/kg)"} 
                            value={formData.unitPreference === 'imperial' ? Number((formData.fatGramsPerKg / 2.20462).toFixed(2)) : formData.fatGramsPerKg} 
                            onChange={v => setFormData({...formData, fatGramsPerKg: formData.unitPreference === 'imperial' ? v * 2.20462 : v})} 
                            min={formData.unitPreference === 'imperial' ? 0.1 : 0.3} 
                            max={formData.unitPreference === 'imperial' ? 1.0 : 2.0} 
                            step={0.1} 
                            unit={formData.unitPreference === 'imperial' ? "g/lb" : "g/kg"} 
                          />
                          <p className="text-[10px] text-zinc-500 italic">Carbs will be calculated from remaining calories.</p>
                        </motion.div>
                      )}
                    </div>
                  </CollapsibleSection>
                </div>

                {/* Right Column: Outputs */}
                <div className="space-y-6">
                  {/* Body Metrics Card */}
                  <CollapsibleSection title="Body Metrics" icon={HeartPulse}>
                    <div className="bg-zinc-900/20 border border-white/10 rounded-3xl p-6 space-y-6 backdrop-blur-md overflow-hidden">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <DataTile label="BMI" value={bmiData.value} unit={bmiData.category} color={bmiData.category === 'Normal' ? 'text-emerald-400' : bmiData.category === 'Underweight' ? 'text-blue-400' : bmiData.category === 'Overweight' ? 'text-yellow-400' : 'text-red-400'} />
                        <DataTile label="Goal" value={FITNESS_GOALS.find(g => g.id === formData.fitnessGoal)?.label || 'Maintain'} unit="Current" color="text-primary" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <DataTile label="BMR" value={<AnimatedNumber value={targets.bmr} />} unit="kcal" />
                        <DataTile label="TDEE" value={<AnimatedNumber value={targets.tdee} />} unit="kcal" />
                        <DataTile label="Target" value={<AnimatedNumber value={targets.calorieTarget} />} unit="kcal" color="text-primary" />
                      </div>
                    </div>
                  </CollapsibleSection>

                  {/* Nutrition Targets Card */}
                  <CollapsibleSection 
                    title="Nutrition Targets" 
                    icon={Target}
                    headerRight={
                      <SegmentedControl 
                        options={[{id: 'auto', label: 'Auto'}, {id: 'manual', label: 'Manual'}]} 
                        value={formData.nutritionMode} 
                        onChange={v => {
                          if (v === 'manual') {
                            setFormData({
                              ...formData, 
                              nutritionMode: 'manual',
                              calorieTarget: targets.calorieTarget,
                              proteinTarget: targets.proteinTarget,
                              carbsTarget: targets.carbsTarget,
                              fatTarget: targets.fatTarget
                            });
                          } else {
                            setFormData({...formData, nutritionMode: 'auto'});
                          }
                        }} 
                      />
                    }
                  >
                    <div className="bg-zinc-900/20 border border-white/10 rounded-3xl p-6 space-y-6 backdrop-blur-md overflow-hidden">
                      <div className="space-y-4">
                        <div className="p-6 bg-zinc-950/30 rounded-2xl border border-white/5 flex flex-col items-center justify-center relative overflow-hidden">
                          <MacroCircleBar 
                            protein={formData.nutritionMode === 'manual' ? formData.proteinTarget : targets.proteinTarget}
                            carbs={formData.nutritionMode === 'manual' ? formData.carbsTarget : targets.carbsTarget}
                            fat={formData.nutritionMode === 'manual' ? formData.fatTarget : targets.fatTarget}
                            calories={formData.nutritionMode === 'manual' ? formData.calorieTarget : targets.calorieTarget}
                          />
                          
                          {formData.nutritionMode === 'manual' && (
                            <div className="mt-4 flex items-center gap-2 z-10">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Manual Kcal:</label>
                              <CompactNumericInput value={formData.calorieTarget} onChange={v => setFormData({...formData, calorieTarget: v})} min={1000} max={5000} step={50} />
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <DataTile label="Protein" value={formData.nutritionMode === 'manual' ? <CompactNumericInput value={formData.proteinTarget} onChange={v => setFormData({...formData, proteinTarget: v})} min={0} max={500} /> : <AnimatedNumber value={targets.proteinTarget} />} unit="g" color="text-emerald-500" />
                          <DataTile label="Carbs" value={formData.nutritionMode === 'manual' ? <CompactNumericInput value={formData.carbsTarget} onChange={v => setFormData({...formData, carbsTarget: v})} min={0} max={500} /> : <AnimatedNumber value={targets.carbsTarget} />} unit="g" color="text-blue-500" />
                          <DataTile label="Fat" value={formData.nutritionMode === 'manual' ? <CompactNumericInput value={formData.fatTarget} onChange={v => setFormData({...formData, fatTarget: v})} min={0} max={500} /> : <AnimatedNumber value={targets.fatTarget} />} unit="g" color="text-amber-500" />
                        </div>
                      </div>
                    </div>
                  </CollapsibleSection>

                  {/* Fitness Goal Card */}
                  <CollapsibleSection title="Fitness Goal" icon={Activity}>
                    <div className="bg-zinc-900/20 border border-white/10 rounded-3xl p-6 space-y-6 backdrop-blur-md overflow-hidden">
                      <div className="grid grid-cols-1 gap-2">
                        {FITNESS_GOALS.map((goal) => (
                          <button
                            key={goal.id}
                            onClick={() => {
                              setFormData({ ...formData, fitnessGoal: goal.id });
                              // If they change goal, they probably want to see the new targets
                              if (formData.nutritionMode === 'manual') {
                                setAlertConfig({
                                  isOpen: true,
                                  title: 'Manual Mode Active',
                                  message: 'You are currently in Manual Mode. To use the new targets calculated for this goal, switch to Auto Mode in the Nutrition Targets section.',
                                  variant: 'info'
                                });
                              }
                            }}
                            className={clsx(
                              "w-full p-4 rounded-2xl text-left transition-all border flex flex-col gap-1",
                              formData.fitnessGoal === goal.id
                                ? "bg-primary/10 border-primary text-primary shadow-[0_0_20px_rgba(130,217,93,0.1)]"
                                : "bg-zinc-950/50 border-white/5 text-zinc-400 hover:border-zinc-700"
                            )}
                          >
                            <span className="text-xs font-black uppercase tracking-tight">{goal.label}</span>
                            <span className="text-[10px] opacity-60 font-medium leading-tight">{goal.description}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </CollapsibleSection>
                </div>
              </div>

              {/* Weight History Chart */}
              {metrics && metrics.length > 0 && 
                <CollapsibleSection title="Weight Trend" icon={TrendingUp}>
                  <div className="h-48 w-full bg-zinc-900/50 border border-zinc-800 rounded-3xl p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={metrics}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                        <XAxis 
                          dataKey="date" 
                          hide 
                        />
                        <YAxis 
                          domain={['dataMin - 5', 'dataMax + 5']} 
                          hide 
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }}
                          labelStyle={{ color: '#71717a', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="weight" 
                          stroke="#82D95D" 
                          strokeWidth={3} 
                          dot={{ fill: '#82D95D', strokeWidth: 2 }} 
                          activeDot={{ r: 6, strokeWidth: 0 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CollapsibleSection>
              }
            </div>
          )}

          {activeTab === 'supplements' && (
            <div className="space-y-8">
              <CollapsibleSection 
                title="Supplement Management" 
                icon={Pill}
                headerRight={
                  <button 
                    onClick={() => {
                      setEditingSupp(null);
                      setIsSuppModalOpen(true);
                    }}
                    className="flex items-center gap-2 text-primary text-[10px] font-bold uppercase tracking-widest hover:opacity-80 transition-opacity"
                  >
                    <Plus size={14} /> Add New
                  </button>
                }
              >
                <div className="grid grid-cols-1 gap-4">
                  {supplements.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-zinc-800 rounded-[2rem]">
                      <Pill className="mx-auto text-zinc-800 mb-4" size={48} />
                      <p className="text-zinc-500 text-sm">No supplements added yet.</p>
                    </div>
                  ) : (
                    supplements.map(supp => (
                      <div key={supp.id} className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-3xl flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                            <Pill size={20} />
                          </div>
                          <div className="space-y-1">
                            <p className="font-bold uppercase tracking-tighter">{supp.name}</p>
                            <p className="text-[10px] text-zinc-500 font-mono">{supp.defaultDose} {supp.unit} • {supp.reminderTime || 'No reminder'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => {
                              setEditingSupp(supp);
                              setIsSuppModalOpen(true);
                            }}
                            className="p-2 text-zinc-500 hover:text-white transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => setSuppToDelete(supp.id!)}
                            className="p-2 text-zinc-500 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CollapsibleSection>

              <SupplementModal 
                isOpen={isSuppModalOpen}
                onClose={() => setIsSuppModalOpen(false)}
                onSave={handleSaveSupplement}
                initialData={editingSupp}
              />
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-10">
              <CollapsibleSection title="Theme System" icon={Palette}>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {(['dark', 'light', 'midnight', 'forest', 'ocean'] as ThemeType[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setFormData({...formData, theme: t})}
                      className={clsx(
                        "p-4 rounded-3xl border flex flex-col items-center gap-3 transition-all",
                        formData.theme === t ? "border-primary bg-primary/10" : "border-zinc-800 bg-zinc-900/50"
                      )}
                    >
                      <div className={clsx(
                        "w-full aspect-video rounded-xl",
                        t === 'dark' && "bg-[#050505]",
                        t === 'light' && "bg-white",
                        t === 'midnight' && "bg-[#0a0a1a]",
                        t === 'forest' && "bg-[#0a1a0a]",
                        t === 'ocean' && "bg-[#0a1a2a]"
                      )} />
                      <span className={clsx("text-[10px] font-bold uppercase tracking-widest", formData.theme === t ? "text-primary" : "text-zinc-500")}>{t}</span>
                    </button>
                  ))}
                </div>
              </CollapsibleSection>

              <CollapsibleSection title="Accent Color" icon={Zap}>
                <div className="flex flex-wrap gap-4">
                  {(['neon-green', 'blue', 'purple', 'orange', 'red'] as AccentColor[]).map(c => (
                    <button
                      key={c}
                      onClick={() => setFormData({...formData, accentColor: c})}
                      className={clsx(
                        "w-12 h-12 rounded-2xl transition-all flex items-center justify-center",
                        formData.accentColor === c ? "scale-110 ring-2 ring-white ring-offset-4 ring-offset-[#050505]" : "opacity-50 hover:opacity-100",
                        c === 'neon-green' && "bg-[#82D95D]",
                        c === 'blue' && "bg-[#3b82f6]",
                        c === 'purple' && "bg-[#a855f7]",
                        c === 'orange' && "bg-[#f97316]",
                        c === 'red' && "bg-[#ef4444]"
                      )}
                    >
                      {formData.accentColor === c && <Zap size={20} className="text-black" />}
                    </button>
                  ))}
                </div>
              </CollapsibleSection>

              <CollapsibleSection title="Interface Preferences" icon={Settings}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { id: 'animationsEnabled', label: 'Animations', icon: Zap },
                    { id: 'soundsEnabled', label: 'Sound Effects', icon: Volume2 },
                    { id: 'aiSuggestionsEnabled', label: 'AI Suggestions', icon: BrainCircuit },
                    { id: 'macroAlertsEnabled', label: 'Macro Alerts', icon: AlertTriangle },
                    { id: 'streakNotificationsEnabled', label: 'Streak Notifications', icon: TrendingUp },
                  ].map(pref => (
                    <button
                      key={pref.id}
                      onClick={() => setSettings(s => ({ ...s, [pref.id]: !s[pref.id as keyof typeof s] }))}
                      className={clsx(
                        "p-4 rounded-2xl border flex items-center justify-between transition-all",
                        settings[pref.id as keyof typeof settings] ? "bg-primary/10 border-primary text-primary" : "bg-zinc-900/50 border-zinc-800 text-zinc-500"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <pref.icon size={18} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{pref.label}</span>
                      </div>
                      <div className={clsx(
                        "w-10 h-5 rounded-full p-1 transition-colors relative",
                        settings[pref.id as keyof typeof settings] ? "bg-primary" : "bg-zinc-800"
                      )}>
                        <div className={clsx(
                          "w-3 h-3 bg-white rounded-full transition-transform",
                          settings[pref.id as keyof typeof settings] ? "translate-x-5" : "translate-x-0"
                        )} />
                      </div>
                    </button>
                  ))}
                </div>
              </CollapsibleSection>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-8">
              <CollapsibleSection title="Notification Channels" icon={Bell}>
                <div className="space-y-3">
                  {[
                    { id: 'mealReminders', label: 'Meal Reminders' },
                    { id: 'macroAlerts', label: 'Macro Alerts' },
                    { id: 'supplementReminders', label: 'Supplement Reminders' },
                    { id: 'weeklyReports', label: 'Weekly Nutrition Reports' },
                    { id: 'streakReminders', label: 'Streak Reminders' },
                  ].map(notif => (
                    <div key={notif.id} className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-tighter">{notif.label}</span>
                      <button
                        onClick={() => setNotificationSettings(s => ({ ...s, [notif.id]: !s[notif.id as keyof typeof s] }))}
                        className={clsx(
                          "w-12 h-6 rounded-full p-1 transition-colors relative",
                          notificationSettings[notif.id as keyof typeof notificationSettings] ? "bg-primary" : "bg-zinc-800"
                        )}
                      >
                        <div className={clsx(
                          "w-4 h-4 bg-white rounded-full transition-transform",
                          notificationSettings[notif.id as keyof typeof notificationSettings] ? "translate-x-6" : "translate-x-0"
                        )} />
                      </button>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>

              <CollapsibleSection title="Reminder Schedule" icon={Settings}>
                <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-tighter">Daily Morning Reminder</span>
                  <input 
                    type="time" 
                    value={notificationSettings.reminderTime}
                    onChange={e => setNotificationSettings({...notificationSettings, reminderTime: e.target.value})}
                    className="bg-zinc-800 border-none rounded-lg p-2 text-primary font-bold outline-none"
                  />
                </div>
              </CollapsibleSection>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-8">
              <CollapsibleSection title="Privacy Controls" icon={Shield}>
                <div className="space-y-3">
                  {[
                    { id: 'isPrivate', label: 'Private Account', desc: 'Hide your profile from others.' },
                    { id: 'leaderboardVisible', label: 'Leaderboard Visibility', desc: 'Show your progress on global rankings.' },
                    { id: 'anonymousAnalytics', label: 'Anonymous Analytics', desc: 'Share usage data to help improve the AI.' },
                  ].map(p => (
                    <div key={p.id} className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-3xl flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="font-bold uppercase tracking-tighter">{p.label}</p>
                        <p className="text-[10px] text-zinc-500">{p.desc}</p>
                      </div>
                      <button
                        onClick={() => setPrivacy(s => ({ ...s, [p.id]: !s[p.id as keyof typeof s] }))}
                        className={clsx(
                          "w-12 h-6 rounded-full p-1 transition-colors relative",
                          privacy[p.id as keyof typeof privacy] ? "bg-primary" : "bg-zinc-800"
                        )}
                      >
                        <div className={clsx(
                          "w-4 h-4 bg-white rounded-full transition-transform",
                          privacy[p.id as keyof typeof privacy] ? "translate-x-6" : "translate-x-0"
                        )} />
                      </button>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            </div>
          )}

          {activeTab === 'account' && (
            <div className="space-y-10">
              <div className="space-y-6">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Premium Subscription</label>
                <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-3xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={clsx(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        profile?.isPremium ? "bg-primary/20 text-primary" : "bg-zinc-800 text-zinc-500"
                      )}>
                        <Star size={20} className={profile?.isPremium ? "fill-primary" : ""} />
                      </div>
                      <div>
                        <p className="font-bold uppercase tracking-tighter">
                          {profile?.isPremium ? "MacroLog Premium" : "Free Plan"}
                        </p>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
                          {profile?.isPremium ? "Active Subscription" : "Limited Access"}
                        </p>
                      </div>
                    </div>
                    {profile?.isPremium && (
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase text-zinc-500">Expires</p>
                        <p className="text-xs font-mono text-white">
                          {profile.premiumExpiresAt ? format(new Date(profile.premiumExpiresAt), 'MMM dd, yyyy') : 'Never (Dev Mode)'}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {!profile?.isPremium && (
                    <button 
                      onClick={async () => {
                        try {
                          const userRef = doc(db, 'users', user.uid);
                          await updateDoc(userRef, {
                            isPremium: true,
                            premiumExpiresAt: null
                          });
                          confetti({
                            particleCount: 100,
                            spread: 70,
                            origin: { y: 0.6 }
                          });
                        } catch (error) {
                          handleFirestoreError(error, OperationType.WRITE, 'users/' + user.uid);
                        }
                      }}
                      className="w-full py-3 bg-primary text-black font-black uppercase tracking-widest rounded-xl text-xs hover:scale-[1.02] transition-transform"
                    >
                      Upgrade to Premium (Free)
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Data Management</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button 
                    onClick={handleExportData}
                    className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-3xl flex items-center gap-4 hover:border-primary/50 transition-all group"
                  >
                    <div className="p-3 bg-zinc-800 text-zinc-400 group-hover:bg-primary/20 group-hover:text-primary rounded-2xl transition-colors">
                      <Download size={20} />
                    </div>
                    <div className="text-left">
                      <p className="font-bold uppercase tracking-tighter">Export CSV</p>
                      <p className="text-[10px] text-zinc-500">Download full nutrition data.</p>
                    </div>
                  </button>
                  <button 
                    onClick={() => setAlertConfig({
                      isOpen: true,
                      title: 'Coming Soon',
                      message: 'PDF Export is currently in development and will be available in a future update.',
                      variant: 'info'
                    })}
                    className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-3xl flex items-center gap-4 hover:border-primary/50 transition-all group"
                  >
                    <div className="p-3 bg-zinc-800 text-zinc-400 group-hover:bg-primary/20 group-hover:text-primary rounded-2xl transition-colors">
                      <FileText size={20} />
                    </div>
                    <div className="text-left">
                      <p className="font-bold uppercase tracking-tighter">Download PDF</p>
                      <p className="text-[10px] text-zinc-500">Weekly nutrition summary.</p>
                    </div>
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 text-red-500">Danger Zone</label>
                <div className="space-y-4">
                  <button 
                    onClick={() => signOut(auth)}
                    className="w-full p-6 bg-zinc-900/50 border border-zinc-800 rounded-3xl flex items-center justify-between hover:bg-zinc-900 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <LogOut className="text-zinc-500" size={20} />
                      <span className="font-bold uppercase tracking-tighter">Sign Out</span>
                    </div>
                    <ChevronRight size={16} className="text-zinc-700" />
                  </button>
                  <button 
                    onClick={() => setIsResetModalOpen(true)}
                    className="w-full p-6 bg-orange-500/5 border border-orange-500/20 rounded-3xl flex items-center justify-between hover:bg-orange-500/10 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <Repeat className="text-orange-500" size={20} />
                      <span className="font-bold uppercase tracking-tighter text-orange-500">Reset Progress</span>
                    </div>
                    <ChevronRight size={16} className="text-orange-900" />
                  </button>
                  <button 
                    onClick={() => setIsDeleteAccountModalOpen(true)}
                    className="w-full p-6 bg-red-500/5 border border-red-500/20 rounded-3xl flex items-center justify-between hover:bg-red-500/10 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <Trash2 className="text-red-500" size={20} />
                      <span className="font-bold uppercase tracking-tighter text-red-500">Delete Account</span>
                    </div>
                    <ChevronRight size={16} className="text-red-900" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {isResetModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 max-w-md w-full space-y-6 shadow-2xl"
            >
              <div className="space-y-2 text-center">
                <div className="w-16 h-16 bg-orange-500/10 text-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle size={32} />
                </div>
                <h3 className="text-2xl font-black italic uppercase tracking-tight text-white">Reset Progress?</h3>
                <p className="text-zinc-500 text-sm">This will permanently delete all your meal history, water logs, and nutrition insights. This cannot be undone.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Type "Reset Progress" to confirm</label>
                  <input 
                    type="text" 
                    value={resetConfirmText}
                    onChange={e => setResetConfirmText(e.target.value)}
                    placeholder="Reset Progress"
                    className="w-full h-12 bg-zinc-950 border border-zinc-800 rounded-xl px-4 focus:border-orange-500 outline-none text-white font-bold text-center"
                  />
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => {
                      setIsResetModalOpen(false);
                      setResetConfirmText('');
                    }}
                    className="flex-1 py-4 bg-zinc-800 text-zinc-400 font-bold uppercase tracking-widest rounded-2xl text-[10px] hover:bg-zinc-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    disabled={resetConfirmText !== 'Reset Progress' || resetting}
                    onClick={handleResetHistory}
                    className="flex-1 py-4 bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black uppercase tracking-widest rounded-2xl text-[10px] hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
                  >
                    {resetting ? <Loader2 className="animate-spin" size={14} /> : 'Reset Now'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={isDeleteAccountModalOpen}
        onClose={() => setIsDeleteAccountModalOpen(false)}
        onConfirm={handleDeleteAccount}
        title="Delete Account"
        message="Are you sure you want to permanently delete your account and all associated data? This action cannot be undone."
        confirmText="Delete Account"
        variant="danger"
      />

      <ConfirmModal
        isOpen={!!suppToDelete}
        onClose={() => setSuppToDelete(null)}
        onConfirm={() => suppToDelete && handleDeleteSupplement(suppToDelete)}
        title="Delete Supplement"
        message="Are you sure you want to remove this supplement? This will stop tracking its logs and streaks."
        confirmText="Delete"
        variant="danger"
      />

      <AlertModal
        isOpen={alertConfig.isOpen}
        onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
        title={alertConfig.title}
        message={alertConfig.message}
        variant={alertConfig.variant}
      />
    </div>
  );
});

export default Profile;

function clsx(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
