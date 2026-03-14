import React from 'react';
import { motion } from 'motion/react';
import { Lock, Zap, Star } from 'lucide-react';

interface PremiumLockedProps {
  title?: string;
  message?: string;
  onUpgrade?: () => void;
}

export default function PremiumLocked({ 
  title = "Premium Feature", 
  message = "Unlock advanced nutrition intelligence with MacroLog Premium.",
  onUpgrade 
}: PremiumLockedProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-8 bg-zinc-900/60 border border-primary/20 rounded-[2rem] backdrop-blur-xl flex flex-col items-center text-center space-y-4 relative overflow-hidden group"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary relative">
        <Lock size={24} className="absolute -top-1 -right-1 bg-zinc-900 rounded-full p-1 border border-primary/30" />
        <Star size={32} className="fill-primary/20" />
      </div>

      <div className="space-y-2 relative">
        <h3 className="text-lg font-bold uppercase tracking-tighter text-white">{title}</h3>
        <p className="text-xs text-zinc-500 max-w-[200px] mx-auto leading-relaxed">
          {message}
        </p>
      </div>

      <button 
        onClick={onUpgrade}
        className="px-6 py-2 bg-primary text-black text-[10px] font-black uppercase tracking-widest rounded-full hover:scale-105 transition-transform flex items-center gap-2"
      >
        <Zap size={12} />
        Upgrade Now
      </button>
    </motion.div>
  );
}
