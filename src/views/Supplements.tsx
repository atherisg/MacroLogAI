import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, orderBy, limit, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Supplement, SupplementLog, UserProfile, WaterLog } from '../types';
import { Plus, Trash2, Check, Flame, History as HistoryIcon, Pill, Edit2, Droplets, Minus } from 'lucide-react';
import { format, subDays, isSameDay, startOfDay, endOfDay } from 'date-fns';
import SupplementModal from '../components/SupplementModal';
import { CollapsibleSection } from '../components/CollapsibleSection';
import { motion, AnimatePresence } from 'motion/react';
import { hasPremiumAccess } from '../utils/premium';
import PremiumLocked from '../components/PremiumLocked';
import ConfirmModal from '../components/ConfirmModal';

export default function Supplements({ user, profile, onUpgrade }: { user: User, profile: UserProfile, onUpgrade: () => void }) {
  const [supps, setSupps] = useState<Supplement[]>([]);
  const [logs, setLogs] = useState<SupplementLog[]>([]);
  const [waterLogs, setWaterLogs] = useState<WaterLog[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupp, setEditingSupp] = useState<Supplement | null>(null);
  const [suppToDelete, setSuppToDelete] = useState<string | null>(null);

  const isPremium = hasPremiumAccess(profile);

  useEffect(() => {
    const qSupps = query(collection(db, 'supplements'), where('uid', '==', user.uid));
    const qLogs = query(
      collection(db, 'supplementLogs'), 
      where('uid', '==', user.uid),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    const unsubSupps = onSnapshot(qSupps, (snap) => {
      setSupps(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplement)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'supplements');
    });

    const unsubLogs = onSnapshot(qLogs, (snap) => {
      setLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupplementLog)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'supplementLogs');
    });

    // Water logs for today
    const today = format(new Date(), 'yyyy-MM-dd');
    const qWater = query(
      collection(db, 'water_logs'),
      where('uid', '==', user.uid),
      where('date', '==', today)
    );

    const unsubWater = onSnapshot(qWater, (snap) => {
      setWaterLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WaterLog)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'water_logs');
    });

    return () => {
      unsubSupps();
      unsubLogs();
      unsubWater();
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
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'supplements');
    }
  };

  const logIntake = async (supp: Supplement) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const alreadyLogged = logs.some(l => l.supplementId === supp.id && l.date === today);
    
    if (alreadyLogged) return;

    try {
      await addDoc(collection(db, 'supplementLogs'), {
        uid: user.uid,
        supplementId: supp.id,
        supplementName: supp.name,
        timestamp: new Date().toISOString(),
        date: today
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'supplementLogs');
    }
  };

  const logWater = async (amount: number) => {
    if (!isPremium) return;
    const today = format(new Date(), 'yyyy-MM-dd');
    try {
      await addDoc(collection(db, 'water_logs'), {
        uid: user.uid,
        amountMl: amount,
        source: 'water',
        timestamp: new Date().toISOString(),
        date: today
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'water_logs');
    }
  };

  const removeLastWater = async () => {
    if (!isPremium || waterLogs.length === 0) return;
    const lastLog = [...waterLogs].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
    if (lastLog.id) {
      try {
        await deleteDoc(doc(db, 'water_logs', lastLog.id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'water_logs/' + lastLog.id);
      }
    }
  };

  const handleDeleteSupplement = async (suppId: string) => {
    try {
      await deleteDoc(doc(db, 'supplements', suppId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'supplements/' + suppId);
    }
  };
  const totalWater = waterLogs.reduce((acc, log) => acc + log.amountMl, 0);
  const waterTarget = profile.waterTarget || 2500;
  const waterProgress = Math.min((totalWater / waterTarget) * 100, 100);

  const calculateStreak = (suppId: string) => {
    let streak = 0;
    let checkDate = new Date();
    
    while (true) {
      const dateStr = format(checkDate, 'yyyy-MM-dd');
      const found = logs.some(l => l.supplementId === suppId && l.date === dateStr);
      if (found) {
        streak++;
        checkDate = subDays(checkDate, 1);
      } else {
        // If not found today, streak might still be alive if it was found yesterday
        if (streak === 0 && isSameDay(checkDate, new Date())) {
          checkDate = subDays(checkDate, 1);
          continue;
        }
        break;
      }
    }
    return streak;
  };

  return (
    <div className="space-y-12">
      {/* Hydration Section */}
      <CollapsibleSection title="Hydration" icon={Droplets}>
        {!isPremium ? (
          <PremiumLocked 
            title="Hydration Tracking"
            message="Track your daily water intake and stay hydrated with Premium."
            onUpgrade={onUpgrade}
          />
        ) : (
          <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-[2.5rem] space-y-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="space-y-4 text-center md:text-left">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Daily Progress</p>
                  <h3 className="text-5xl font-black italic tracking-tighter">
                    {totalWater} <span className="text-xl text-zinc-500 not-italic">/ {waterTarget}ml</span>
                  </h3>
                </div>
                <div className="w-full md:w-64 h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${waterProgress}%` }}
                    className="h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                  />
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-3">
                {[250, 500, 750].map(amount => (
                  <button
                    key={amount}
                    onClick={() => logWater(amount)}
                    className="flex flex-col items-center gap-2 p-4 bg-zinc-800/50 border border-zinc-700 rounded-2xl hover:border-blue-500 hover:bg-blue-500/10 transition-all group"
                  >
                    <Droplets size={20} className="text-blue-500 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold font-mono">+{amount}ml</span>
                  </button>
                ))}
                <button
                  onClick={removeLastWater}
                  disabled={waterLogs.length === 0}
                  className="flex flex-col items-center gap-2 p-4 bg-zinc-800/50 border border-zinc-700 rounded-2xl hover:border-red-500 hover:bg-red-500/10 transition-all disabled:opacity-30 disabled:hover:border-zinc-700 disabled:hover:bg-zinc-800/50"
                >
                  <Minus size={20} className="text-red-500" />
                  <span className="text-xs font-bold uppercase tracking-widest">Undo</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* Supplements Section */}
      <CollapsibleSection 
        title="Supplements" 
        icon={Pill}
        headerRight={
          <button 
            onClick={() => {
              setEditingSupp(null);
              setIsModalOpen(true);
            }}
            className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-primary hover:bg-zinc-800 transition-colors"
          >
            <Plus size={24} />
          </button>
        }
      >
        <div className="grid grid-cols-1 gap-4">
          {supps.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-zinc-800 rounded-[2rem]">
              <Pill className="mx-auto text-zinc-800 mb-4" size={48} />
              <p className="text-zinc-500 text-sm">No supplements added yet.</p>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="mt-4 text-primary text-xs font-bold uppercase tracking-widest"
              >
                Add your first supplement
              </button>
            </div>
          ) : (
            supps.map(supp => {
              const streak = calculateStreak(supp.id!);
              const today = format(new Date(), 'yyyy-MM-dd');
              const takenToday = logs.some(l => l.supplementId === supp.id && l.date === today);

              return (
                <motion.div 
                  layout
                  key={supp.id} 
                  className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-[2rem] flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => logIntake(supp)}
                      disabled={takenToday}
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                        takenToday 
                          ? "bg-primary text-black shadow-lg shadow-primary/20" 
                          : "bg-zinc-800 text-zinc-500 hover:border-primary border border-transparent"
                      }`}
                    >
                      {takenToday ? <Check size={28} /> : <Plus size={24} />}
                    </button>
                    <div className="space-y-1">
                      <h4 className="font-black uppercase tracking-tighter text-white">{supp.name}</h4>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] text-zinc-500 font-mono">{supp.defaultDose}{supp.unit}</p>
                        {supp.reminderTime && (
                          <span className="text-[8px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-widest">
                            {supp.reminderTime}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className={`flex items-center gap-1 ${streak > 0 ? 'text-orange-500' : 'text-zinc-700'}`}>
                        <Flame size={16} fill={streak > 0 ? 'currentColor' : 'none'} />
                        <span className="text-lg font-black italic">{streak}</span>
                      </div>
                      <p className="text-[8px] font-bold uppercase text-zinc-500 tracking-widest">Day Streak</p>
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button 
                        onClick={() => {
                          setEditingSupp(supp);
                          setIsModalOpen(true);
                        }}
                        className="p-2 text-zinc-600 hover:text-white transition-colors"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => setSuppToDelete(supp.id!)}
                        className="p-2 text-zinc-600 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </CollapsibleSection>

      <SupplementModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveSupplement}
        initialData={editingSupp}
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
    </div>
  );
}
