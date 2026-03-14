import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Segment {
  name: string;
  value: number;
  color: string;
}

interface SegmentedProgressBarProps {
  label: string;
  segments: Segment[];
  target: number;
  unit: string;
  className?: string;
}

export const SegmentedProgressBar: React.FC<SegmentedProgressBarProps> = ({
  label,
  segments,
  target,
  unit,
  className
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  const totalValue = segments.reduce((acc, s) => acc + s.value, 0);
  const totalPercentage = Math.min(100, (totalValue / target) * 100);
  
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex justify-between items-end">
        <span className="text-[10px] font-bold uppercase text-zinc-400 tracking-widest">{label}</span>
        <span className="text-[10px] font-mono text-zinc-500">
          {totalValue.toFixed(1)}{unit} / {target.toFixed(0)}{unit} ({Math.round((totalValue / target) * 100)}%)
        </span>
      </div>
      
      <div className="relative h-3 bg-zinc-800/50 rounded-full overflow-visible flex">
        {segments.map((segment, index) => {
          if (segment.value <= 0) return null;
          
          const width = (segment.value / target) * 100;
          const contribution = Math.round((segment.value / totalValue) * 100);
          
          return (
            <div 
              key={`${segment.name}-${index}`}
              className="relative h-full first:rounded-l-full last:rounded-r-full"
              style={{ width: `${width}%`, zIndex: hoveredIndex === index ? 50 : 1 }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ 
                  width: '100%',
                  scale: hoveredIndex === index ? 1.1 : 1,
                }}
                transition={{ 
                  width: { duration: 0.6, ease: "easeOut" },
                  scale: { duration: 0.2 }
                }}
                className="h-full relative cursor-pointer"
                style={{ 
                  backgroundColor: segment.color,
                  boxShadow: hoveredIndex === index ? `0 0 15px ${segment.color}` : 'none',
                  borderRadius: 'inherit'
                }}
              />
              
              <AnimatePresence>
                {hoveredIndex === index && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: -40, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-[100] pointer-events-none"
                  >
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 shadow-2xl whitespace-nowrap min-w-[140px]">
                      <p className="text-[10px] font-bold uppercase text-zinc-500 mb-1">{segment.name}</p>
                      <div className="flex justify-between items-end gap-4">
                        <span className="text-sm font-black italic uppercase text-white">
                          {segment.value.toFixed(1)}{unit}
                        </span>
                        <span className="text-[10px] font-bold text-primary">
                          {contribution}% of total
                        </span>
                      </div>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-zinc-900" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
};
