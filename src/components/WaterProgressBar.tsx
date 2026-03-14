import React from 'react';
import { motion } from 'motion/react';

interface WaterProgressBarProps {
  current: number;
  target: number;
}

export const WaterProgressBar: React.FC<WaterProgressBarProps> = ({ current, target }) => {
  const progress = Math.min(1, Math.max(0, current / target));
  const height = `${progress * 100}%`;

  return (
    <div className="space-y-2">
      <div className="text-center">
        <span className="text-sm font-bold">{current.toLocaleString()} / {target.toLocaleString()} ml</span>
      </div>
      <div className="relative w-full h-48 bg-zinc-800 rounded-3xl overflow-hidden border border-zinc-700 shadow-inner">
        {/* Water Layer */}
        <motion.div 
          className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-blue-700 to-blue-400"
          initial={{ height: 0 }}
          animate={{ height }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        >
          {/* Wave SVG */}
          <svg className="absolute -top-10 w-full h-10" viewBox="0 0 100 10" preserveAspectRatio="none">
            <motion.path
              d="M0 5 Q 25 0, 50 5 T 100 5 V 10 H 0 Z"
              className="fill-blue-400/80"
              animate={{ x: [-100, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
            />
            <motion.path
              d="M0 5 Q 25 10, 50 5 T 100 5 V 10 H 0 Z"
              className="fill-blue-500/60"
              animate={{ x: [0, -100] }}
              transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
            />
          </svg>
        </motion.div>
      </div>
      <div className="text-center">
        <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{Math.round(progress * 100)}%</span>
      </div>
    </div>
  );
};
