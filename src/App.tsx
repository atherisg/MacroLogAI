import React, { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, User, signInWithPopup, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';
import { UserProfile } from './types';
import { 
  LayoutDashboard, 
  Refrigerator, 
  History, 
  LogOut, 
  Plus, 
  BrainCircuit,
  TrendingUp,
  ArrowRight,
  Settings,
  Camera,
  FileText,
  Zap,
  Save,
  Star
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'motion/react';
import Logo from './components/Logo';
import { SoundProvider } from './components/SoundProvider';
import PageTransition from './components/PageTransition';
import MicroButton from './components/MicroButton';

// Views
import Dashboard from './views/Dashboard';
import Profile from './views/Profile';
import Pantry from './views/Pantry';
import Supplements from './views/Supplements';
import MealHistory from './views/MealHistory';
import LogMeal from './views/LogMeal';
import AIAssistant from './views/AIAssistant';
import Premium from './views/Premium';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'profile' | 'pantry' | 'supplements' | 'history' | 'log' | 'ai' | 'premium'>('dashboard');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showOverride, setShowOverride] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack' | undefined>(undefined);
  const profileRef = useRef<any>(null);
  const [logMode, setLogMode] = useState<'text' | 'image'>('text');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  useEffect(() => {
    const timer = setTimeout(() => setShowOverride(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    console.log("MacroLog AI: Initializing Auth Listener");
    
    // Safety timeout to prevent getting stuck
    const safetyTimeout = setTimeout(() => {
      console.warn("MacroLog AI: Initialization safety timeout reached");
      setLoading(false);
    }, 10000);

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      console.log("MacroLog AI: Auth State Changed", u ? `User: ${u.uid}` : "No User");
      setUser(u);
      
      if (!u) {
        setProfile(null);
        setLoading(false);
        clearTimeout(safetyTimeout);
      } else {
        const profileRef = doc(db, 'users', u.uid);
        const unsubProfile = onSnapshot(profileRef, (docSnap) => {
          console.log("MacroLog AI: Profile Snapshot Received", docSnap.exists() ? "Profile Exists" : "No Profile");
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            setProfile(null);
          }
          setLoading(false);
          clearTimeout(safetyTimeout);
        }, (error) => {
          console.error("MacroLog AI: Profile Snapshot Error", error);
          setProfile(null);
          setLoading(false);
          clearTimeout(safetyTimeout);
        });
        
        return () => unsubProfile();
      }
    });

    return () => {
      unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, []);

  const handleLogin = async () => {
    setAuthError(null);
    setLoggingIn(true);
    console.log("MacroLog AI: Starting Google Login Popup");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      console.log("MacroLog AI: Login Successful", result.user.uid);
    } catch (err: any) {
      console.error("MacroLog AI: Login Error", err);
      setAuthError(err.message || "Failed to sign in with Google. Please check if popups are blocked.");
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => signOut(auth);

  const soundsEnabled = profile?.settings?.soundsEnabled ?? true;
  const theme = profile?.theme || 'dark';
  const accentColor = profile?.accentColor || 'neon-green';

  useEffect(() => {
    // Apply theme and accent color to document root
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-accent', accentColor);
    
    // Update primary color based on accent
    const colors: Record<string, string> = {
      'neon-green': '#82D95D',
      'blue': '#3b82f6',
      'purple': '#a855f7',
      'orange': '#f97316',
      'red': '#ef4444'
    };
    root.style.setProperty('--color-primary', colors[accentColor]);
  }, [theme, accentColor]);

  const NavItem = ({ id, icon: Icon, label }: { id: typeof currentView, icon: any, label: string }) => (
    <button
      onClick={() => setCurrentView(id)}
      className={cn(
        "flex flex-col items-center justify-center gap-1 py-2 px-4 transition-all duration-300",
        currentView === id ? "text-primary scale-110 drop-shadow-[0_0_8px_var(--color-primary)]" : "text-zinc-500 hover:text-zinc-300"
      )}
    >
      <Icon size={20} className={cn(currentView === id && "drop-shadow-[0_0_8px_var(--color-primary)]")} />
      <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
    </button>
  );

  return (
    <SoundProvider enabled={soundsEnabled}>
      {loading ? (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center">
          <div className="flex flex-col items-center gap-8">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative"
            >
              <Logo className="w-24 h-24 text-primary animate-pulse" />
              <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full -z-10" />
            </motion.div>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              transition={{ delay: 0.5 }}
              className="text-primary font-mono text-xs tracking-[0.3em] uppercase"
            >
              Initializing MacroLog AI
            </motion.p>
            {showOverride && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => setLoading(false)}
                className="mt-4 text-[10px] text-zinc-500 hover:text-primary transition-colors uppercase tracking-widest border border-zinc-800 px-4 py-2 rounded-full"
              >
                Force Start
              </motion.button>
            )}
          </div>
        </div>
      ) : !user ? (
        <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-white overflow-hidden">
          {/* Background Glow */}
          <motion.div 
            animate={{ 
              scale: [1, 1.1, 1],
              opacity: [0.1, 0.15, 0.1]
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/10 blur-[120px] rounded-full" 
          />
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.05, 0.08, 0.05]
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-primary/5 blur-[120px] rounded-full" 
          />

          <div className="max-w-md w-full space-y-12 text-center relative z-10">
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="flex flex-col items-center gap-6"
            >
              <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-[2.5rem] backdrop-blur-xl shadow-2xl">
                <Logo className="w-20 h-20 text-primary" />
              </div>
              <div className="space-y-2">
                <h1 className="text-5xl font-black tracking-tighter uppercase italic text-white">
                  MacroLog <span className="text-primary">AI</span>
                </h1>
                <p className="text-zinc-500 font-medium tracking-wide">Intelligent Nutrition Optimization</p>
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-zinc-900/40 border border-zinc-800/50 p-10 rounded-[3rem] backdrop-blur-2xl space-y-8 shadow-2xl"
            >
              <div className="space-y-2">
                <h2 className="text-xl font-bold">Welcome Back</h2>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  Connect your account to access your personalized AI nutrition coach and meal planning engine.
                </p>
              </div>
              <div className="space-y-4">
                <MicroButton 
                  onClick={handleLogin}
                  disabled={loggingIn}
                  className="w-full py-5"
                >
                  {loggingIn ? "Connecting..." : "Get Started"} <ArrowRight size={20} className={loggingIn ? "animate-pulse" : ""} />
                </MicroButton>
                {authError && (
                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-red-500 text-xs font-bold uppercase tracking-tight"
                  >
                    {authError}
                  </motion.p>
                )}
              </div>
              <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Powered by Gemini 3.1 Pro</p>
            </motion.div>
          </div>
        </div>
      ) : !profile && currentView !== 'profile' ? (
        <Profile user={user} profile={null} />
      ) : (
        <div className="min-h-screen bg-[#050505] text-white font-sans pb-24">
          <header className="sticky top-0 z-50 bg-[#050505]/80 backdrop-blur-md border-b border-zinc-900 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Logo className="w-8 h-8 text-primary" />
              <h1 className="text-xl font-black tracking-tighter uppercase italic">MacroLog <span className="text-primary">AI</span></h1>
            </div>
            <div className="flex items-center gap-4">
              {profile?.isPremium && (
                <div className="hidden md:flex items-center gap-1 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full">
                  <Star size={10} className="text-primary fill-primary" />
                  <span className="text-[8px] font-black uppercase tracking-widest text-primary">Premium</span>
                </div>
              )}
              {!profile?.isPremium && (
                <button 
                  onClick={() => setCurrentView('premium')}
                  className="hidden md:flex items-center gap-1 px-3 py-1 bg-zinc-800 border border-zinc-700 rounded-full hover:border-primary/50 transition-colors"
                >
                  <Zap size={10} className="text-primary" />
                  <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Upgrade</span>
                </button>
              )}
              {currentView === 'profile' && (
                <button 
                  onClick={() => profileRef.current?.handleSave()} 
                  disabled={profileRef.current?.saving}
                  className="bg-primary text-black px-4 py-2 rounded-full font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 hover:scale-105 transition-transform disabled:opacity-50"
                >
                  <Save size={14} /> Save
                </button>
              )}
              <button onClick={() => setCurrentView('profile')} className={cn("transition-colors", currentView === 'profile' ? "text-primary" : "text-zinc-500 hover:text-white")}>
                <Settings size={20} />
              </button>
              <button onClick={handleLogout} className="text-zinc-500 hover:text-white transition-colors">
                <LogOut size={20} />
              </button>
            </div>
          </header>

          <main className="max-w-5xl mx-auto p-6">
            <AnimatePresence mode="wait">
              <PageTransition key={currentView}>
                {currentView === 'dashboard' && <Dashboard user={user} profile={profile!} onAddFood={(type) => { setSelectedMealType(type as any); setLogMode('text'); setCurrentView('log'); }} onNavigate={setCurrentView} selectedDate={selectedDate} onDateChange={setSelectedDate} />}
                {currentView === 'profile' && <Profile ref={profileRef} user={user} profile={profile} />}
                {currentView === 'pantry' && <Pantry user={user} profile={profile!} />}
                {currentView === 'supplements' && <Supplements user={user} profile={profile!} onUpgrade={() => setCurrentView('premium')} />}
                {currentView === 'history' && <MealHistory user={user} onSelectDate={(date) => { setSelectedDate(date); setCurrentView('dashboard'); }} />}
                {currentView === 'log' && <LogMeal user={user} profile={profile!} onComplete={() => setCurrentView('dashboard')} initialMealType={selectedMealType} initialSourceType={logMode} onNavigate={setCurrentView} initialDate={selectedDate} />}
                {currentView === 'ai' && <AIAssistant user={user} profile={profile!} />}
                {currentView === 'premium' && <Premium user={user} isPremium={!!profile?.isPremium} />}
              </PageTransition>
            </AnimatePresence>
          </main>

          {/* Add Menu Overlay */}
          <AnimatePresence>
            {showAddMenu && (
              <>
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowAddMenu(false)}
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                />
                <motion.div 
                  initial={{ opacity: 0, y: 100, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 100, scale: 0.9 }}
                  className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-3"
                >
                  <button 
                    onClick={() => { setShowAddMenu(false); setSelectedMealType(undefined); setLogMode('text'); setCurrentView('log'); }}
                    className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 px-6 py-3 rounded-full hover:bg-zinc-800 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <FileText size={16} className="text-primary" />
                    </div>
                    <span className="font-bold text-sm">Log Food</span>
                  </button>
                  <button 
                    onClick={() => { setShowAddMenu(false); setSelectedMealType(undefined); setLogMode('image'); setCurrentView('log'); }}
                    className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 px-6 py-3 rounded-full hover:bg-zinc-800 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <Camera size={16} className="text-blue-500" />
                    </div>
                    <span className="font-bold text-sm">Scan Food</span>
                  </button>
                  <button 
                    onClick={() => { setShowAddMenu(false); setSelectedMealType(undefined); setLogMode('text'); setCurrentView('log'); }}
                    className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 px-6 py-3 rounded-full hover:bg-zinc-800 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
                      <Plus size={16} className="text-orange-500" />
                    </div>
                    <span className="font-bold text-sm">Add Recipe</span>
                  </button>
                  <button 
                    onClick={() => { setShowAddMenu(false); setCurrentView('supplements'); }}
                    className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 px-6 py-3 rounded-full hover:bg-zinc-800 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <Zap size={16} className="text-purple-500" />
                    </div>
                    <span className="font-bold text-sm">Log Supplement</span>
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900/90 backdrop-blur-xl border-t border-zinc-800 px-2 py-2 flex items-center justify-around z-50">
            <NavItem id="dashboard" icon={LayoutDashboard} label="Home" />
            <NavItem id="history" icon={History} label="History" />
            <motion.button 
              whileHover={{ scale: 1.1, y: -10 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowAddMenu(!showAddMenu)}
              className={cn(
                "w-14 h-14 rounded-full flex items-center justify-center -mt-8 shadow-lg border-4 border-[#050505] transition-all z-50",
                showAddMenu ? "bg-zinc-800 text-white shadow-zinc-900/50 rotate-45" : "bg-primary text-black shadow-primary/30"
              )}
            >
              <Plus size={28} />
            </motion.button>
            <NavItem id="pantry" icon={Refrigerator} label="Pantry" />
            <NavItem id="ai" icon={BrainCircuit} label="AI Coach" />
          </nav>
        </div>
      )}
    </SoundProvider>
  );
}
