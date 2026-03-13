import React, { useState, useEffect } from 'react';
import { User, signOut, deleteUser, updateEmail, updatePassword } from 'firebase/auth';
import { doc, setDoc, collection, addDoc, query, where, orderBy, onSnapshot, deleteDoc, getDocs } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { 
  UserProfile, 
  ActivityLevel, 
  FitnessGoal, 
  Gender, 
  NutritionMode, 
  ThemeType, 
  AccentColor,
  Supplement,
  BodyMetric
} from '../types';
import { calculateBMI, calculateTargets } from '../utils';
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
  BrainCircuit
} from 'lucide-react';
import MicroButton from '../components/MicroButton';
import SupplementModal from '../components/SupplementModal';
import { motion, AnimatePresence } from 'motion/react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

type Tab = 'profile' | 'nutrition' | 'supplements' | 'appearance' | 'notifications' | 'privacy' | 'account';

export default function Profile({ user, profile }: { user: User, profile: UserProfile | null }) {
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

    const newProfile: UserProfile = {
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
    };

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

  const handleExportData = async () => {
    try {
      const q = query(collection(db, 'meals'), where('uid', '==', user.uid));
      const snap = await getDocs(q);
      const meals = snap.docs.map(doc => doc.data());
      
      if (meals.length === 0) {
        alert('No data to export');
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
    if (!window.confirm('Are you sure? This will permanently delete ALL your data.')) return;
    
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
      alert('Failed to delete account. You may need to re-authenticate first.');
    }
  };

  const bmiData = calculateBMI(formData.weight, formData.height);
  const targets = calculateTargets(formData);

  const tabs: { id: Tab, icon: any, label: string }[] = [
    { id: 'profile', icon: UserIcon, label: 'Profile' },
    { id: 'nutrition', icon: Target, label: 'Nutrition' },
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
        <div className="flex items-center gap-4">
          <AnimatePresence>
            {saveStatus === 'success' && (
              <motion.span 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="text-primary text-[10px] font-bold uppercase tracking-widest"
              >
                Saved successfully
              </motion.span>
            )}
          </AnimatePresence>
          <MicroButton onClick={handleSave} disabled={saving} className="px-6">
            {saving ? 'Saving...' : <><Save size={18} /> Save Changes</>}
          </MicroButton>
        </div>
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
                          className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 focus:border-primary outline-none text-white font-bold"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Email Address</label>
                        <input 
                          type="email" 
                          value={user.email || ''}
                          disabled
                          className="w-full bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-3 text-zinc-500 cursor-not-allowed outline-none font-mono text-sm"
                        />
                      </div>
                    </div>
                    <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Member since {profile?.createdAt ? format(new Date(profile.createdAt), 'MMMM yyyy') : 'Today'}</p>
                  </div>
                </div>
              </section>

              <section className="space-y-6">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-800 pb-2 block">Physical Metrics</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Age</label>
                      <input
                        type="number"
                        value={formData.age}
                        onChange={e => setFormData({...formData, age: parseInt(e.target.value)})}
                        className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 focus:border-primary outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Gender</label>
                      <select
                        value={formData.gender}
                        onChange={e => setFormData({...formData, gender: e.target.value as Gender})}
                        className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 focus:border-primary outline-none"
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Height (cm)</label>
                      <input
                        type="number"
                        value={formData.height}
                        onChange={e => setFormData({...formData, height: parseInt(e.target.value)})}
                        className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 focus:border-primary outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Weight (kg)</label>
                      <input
                        type="number"
                        value={formData.weight}
                        onChange={e => setFormData({...formData, weight: parseInt(e.target.value)})}
                        className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 focus:border-primary outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl space-y-1">
                        <p className="text-[10px] font-bold uppercase text-zinc-500">BMI</p>
                        <p className="text-xl font-black text-primary">{bmiData.value}</p>
                        <p className="text-[10px] font-bold uppercase text-zinc-400">{bmiData.category}</p>
                      </div>
                      <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl space-y-1">
                        <p className="text-[10px] font-bold uppercase text-zinc-500">Goal</p>
                        <p className="text-sm font-black uppercase text-white">{formData.fitnessGoal.replace('_', ' ')}</p>
                      </div>
                    </div>
                    <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase text-zinc-500">Daily Calorie Target</p>
                        <p className="text-2xl font-black text-primary">{targets.calorieTarget} kcal</p>
                      </div>
                      <TrendingUp className="text-primary/20" size={32} />
                    </div>
                  </div>
                </div>
              </section>

              {/* Weight History Chart */}
              {metrics.length > 0 && (
                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Weight Trend</label>
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
                </div>
              )}
            </div>
          )}

          {activeTab === 'nutrition' && (
            <div className="space-y-8">
              <div className="space-y-4">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Nutrition Mode</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setFormData({...formData, nutritionMode: 'auto'})}
                    className={clsx(
                      "p-6 rounded-3xl border flex flex-col items-start gap-2 transition-all text-left",
                      formData.nutritionMode === 'auto' ? "bg-primary/10 border-primary" : "bg-zinc-900/50 border-zinc-800"
                    )}
                  >
                    <div className={clsx("p-2 rounded-xl", formData.nutritionMode === 'auto' ? "bg-primary text-black" : "bg-zinc-800 text-zinc-500")}>
                      <Zap size={20} />
                    </div>
                    <div className="space-y-1">
                      <p className={clsx("font-bold uppercase tracking-tighter", formData.nutritionMode === 'auto' ? "text-primary" : "text-white")}>Auto Mode</p>
                      <p className="text-[10px] text-zinc-500 leading-tight">AI manages your targets based on your metrics and goals.</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setFormData({...formData, nutritionMode: 'manual'})}
                    className={clsx(
                      "p-6 rounded-3xl border flex flex-col items-start gap-2 transition-all text-left",
                      formData.nutritionMode === 'manual' ? "bg-primary/10 border-primary" : "bg-zinc-900/50 border-zinc-800"
                    )}
                  >
                    <div className={clsx("p-2 rounded-xl", formData.nutritionMode === 'manual' ? "bg-primary text-black" : "bg-zinc-800 text-zinc-500")}>
                      <Settings size={20} />
                    </div>
                    <div className="space-y-1">
                      <p className={clsx("font-bold uppercase tracking-tighter", formData.nutritionMode === 'manual' ? "text-primary" : "text-white")}>Manual Mode</p>
                      <p className="text-[10px] text-zinc-500 leading-tight">You have full control over your daily macro targets.</p>
                    </div>
                  </button>
                </div>
              </div>

              {formData.nutritionMode === 'manual' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-6"
                >
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Daily Calories</label>
                    <input
                      type="number"
                      value={formData.calorieTarget}
                      onChange={e => setFormData({...formData, calorieTarget: parseInt(e.target.value)})}
                      className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-xl font-black text-primary focus:border-primary outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Protein (g)</label>
                      <input
                        type="number"
                        value={formData.proteinTarget}
                        onChange={e => setFormData({...formData, proteinTarget: parseInt(e.target.value)})}
                        className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 focus:border-primary outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Carbs (g)</label>
                      <input
                        type="number"
                        value={formData.carbsTarget}
                        onChange={e => setFormData({...formData, carbsTarget: parseInt(e.target.value)})}
                        className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 focus:border-primary outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Fat (g)</label>
                      <input
                        type="number"
                        value={formData.fatTarget}
                        onChange={e => setFormData({...formData, fatTarget: parseInt(e.target.value)})}
                        className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 focus:border-primary outline-none"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-3xl flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-bold uppercase tracking-tighter">AI Macro Optimization</p>
                  <p className="text-[10px] text-zinc-500">Automatically adjust targets weekly based on progress.</p>
                </div>
                <button
                  onClick={() => setFormData({...formData, aiMacroOptimization: !formData.aiMacroOptimization})}
                  className={clsx(
                    "w-12 h-6 rounded-full p-1 transition-colors relative",
                    formData.aiMacroOptimization ? "bg-primary" : "bg-zinc-800"
                  )}
                >
                  <div className={clsx(
                    "w-4 h-4 bg-white rounded-full transition-transform",
                    formData.aiMacroOptimization ? "translate-x-6" : "translate-x-0"
                  )} />
                </button>
              </div>
            </div>
          )}

          {activeTab === 'supplements' && (
            <div className="space-y-8">
              <section className="space-y-6">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Supplement Management</label>
                    <p className="text-[10px] text-zinc-600">Define your daily supplement stack</p>
                  </div>
                  <button 
                    onClick={() => {
                      setEditingSupp(null);
                      setIsSuppModalOpen(true);
                    }}
                    className="flex items-center gap-2 text-primary text-[10px] font-bold uppercase tracking-widest hover:opacity-80 transition-opacity"
                  >
                    <Plus size={14} /> Add New Supplement
                  </button>
                </div>

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
                            onClick={() => {
                              if (confirm('Delete this supplement?')) {
                                deleteDoc(doc(db, 'supplements', supp.id!));
                              }
                            }}
                            className="p-2 text-zinc-500 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

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
              <div className="space-y-6">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Theme System</label>
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
              </div>

              <div className="space-y-6">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Accent Color</label>
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
              </div>

              <div className="space-y-6">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Interface Preferences</label>
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
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-8">
              <div className="space-y-4">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Notification Channels</label>
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
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Reminder Schedule</label>
                <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-tighter">Daily Morning Reminder</span>
                  <input 
                    type="time" 
                    value={notificationSettings.reminderTime}
                    onChange={e => setNotificationSettings({...notificationSettings, reminderTime: e.target.value})}
                    className="bg-zinc-800 border-none rounded-lg p-2 text-primary font-bold outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-8">
              <div className="space-y-4">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Privacy Controls</label>
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
              </div>
            </div>
          )}

          {activeTab === 'account' && (
            <div className="space-y-10">
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
                    onClick={() => alert('PDF Export coming soon!')}
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
                    onClick={handleDeleteAccount}
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
    </div>
  );
}

function clsx(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
