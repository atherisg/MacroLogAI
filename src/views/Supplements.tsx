import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, orderBy, limit, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Supplement, SupplementLog } from '../types';
import { Plus, Trash2, Check, Flame, History as HistoryIcon, Pill, Edit2 } from 'lucide-react';
import { format, subDays, isSameDay } from 'date-fns';
import SupplementModal from '../components/SupplementModal';
import { motion, AnimatePresence } from 'motion/react';

export default function Supplements({ user }: { user: User }) {
  const [supps, setSupps] = useState<Supplement[]>([]);
  const [logs, setLogs] = useState<SupplementLog[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupp, setEditingSupp] = useState<Supplement | null>(null);

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

    return () => {
      unsubSupps();
      unsubLogs();
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
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <h2 className="text-3xl font-black italic uppercase tracking-tighter text-primary">Supplements</h2>
          <p className="text-zinc-500 text-sm">Track your daily intake and maintain streaks.</p>
        </div>
        <button 
          onClick={() => {
            setEditingSupp(null);
            setIsModalOpen(true);
          }}
          className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-primary hover:bg-zinc-800 transition-colors"
        >
          <Plus size={24} />
        </button>
      </div>

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
                      onClick={async () => {
                        if (confirm('Delete this supplement?')) {
                          try {
                            await deleteDoc(doc(db, 'supplements', supp.id!));
                          } catch (error) {
                            handleFirestoreError(error, OperationType.DELETE, 'supplements/' + supp.id);
                          }
                        }
                      }}
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

      <SupplementModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveSupplement}
        initialData={editingSupp}
      />
    </div>
  );
}
