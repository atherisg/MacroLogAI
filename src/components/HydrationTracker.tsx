import React, { useState } from 'react';
import { Droplets, Plus, Minus } from 'lucide-react';
import { motion } from 'motion/react';

interface HydrationTrackerProps {
  current: number;
  target: number;
  onLog: (amount: number, source: 'water') => void;
  isPremium: boolean;
}

export const HydrationTracker: React.FC<HydrationTrackerProps> = ({ current, target, onLog, isPremium }) => {
  const [amount, setAmount] = useState(250);
  const percentage = Math.min(100, (current / target) * 100);

  if (!isPremium) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center p-6 text-center">
          <Droplets className="text-primary mb-2" size={32} />
          <h3 className="font-black italic uppercase text-lg">Hydration Intelligence</h3>
          <p className="text-xs text-zinc-400 mt-1 mb-4">Unlock hydration tracking and electrolyte balance with Premium.</p>
          <button className="bg-primary text-black px-6 py-2 rounded-xl font-bold text-xs uppercase hover:scale-105 transition-all">
            Upgrade to Premium
          </button>
        </div>
        <div className="opacity-20">
          <div className="flex justify-between items-end mb-4">
             <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Hydration</h3>
          </div>
          <div className="h-4 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Hydration</h3>
          <p className="text-2xl font-black italic mt-1">
            {current.toLocaleString()} <span className="text-xs text-zinc-500 uppercase not-italic">/ {target.toLocaleString()} ml</span>
          </p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
          <Droplets size={24} />
        </div>
      </div>

      <div className="relative h-6 bg-zinc-800 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          className="absolute inset-y-0 left-0 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)] flex items-center"
        >
          <motion.div 
            animate={{ x: [0, -20, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            className="absolute right-0 h-full w-10 bg-blue-400/50 rounded-full blur-sm"
          />
        </motion.div>
      </div>

      <div className="flex justify-center gap-3">
        <button 
          onClick={() => onLog(amount, 'water')}
          className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-zinc-800/50 border border-zinc-700/50 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group w-full"
        >
          <Plus size={24} className="text-blue-400 group-hover:scale-110 transition-transform" />
          <span className="text-[10px] font-bold uppercase">Add Water</span>
        </button>
        <button 
          onClick={() => onLog(-Math.min(amount, current), 'water')}
          disabled={current <= 0}
          className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-zinc-800/50 border border-zinc-700/50 hover:border-red-500/50 hover:bg-red-500/5 transition-all group w-full disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-zinc-700/50 disabled:hover:bg-zinc-800/50"
        >
          <Minus size={24} className="text-red-400 group-hover:scale-110 transition-transform" />
          <span className="text-[10px] font-bold uppercase">Subtract</span>
        </button>
      </div>

      <div className="flex items-center justify-between bg-zinc-800/30 rounded-2xl p-2 border border-zinc-800">
        <button 
          onClick={() => setAmount(Math.max(50, amount - 50))}
          className="p-2 hover:bg-zinc-700 rounded-xl transition-colors"
        >
          <Minus size={16} />
        </button>
        <div className="text-center">
          <span className="text-sm font-bold">{amount}</span>
          <span className="text-[8px] uppercase text-zinc-500 ml-1">ml</span>
        </div>
        <button 
          onClick={() => setAmount(Math.min(1000, amount + 50))}
          className="p-2 hover:bg-zinc-700 rounded-xl transition-colors"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
};
