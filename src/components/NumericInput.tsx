import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

interface NumericInputProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  className?: string;
}

export default function NumericInput({ label, value, onChange, min = 0, max = 10000, step = 1, unit, className }: NumericInputProps) {
  const handleIncrement = () => {
    if (value < max) onChange(Math.min(max, value + step));
  };
  const handleDecrement = () => {
    if (value > min) onChange(Math.max(min, value - step));
  };

  return (
    <div className={clsx("space-y-1", className)}>
      {label && <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{label}</label>}
      <div className="relative flex items-center bg-zinc-950 border border-white/10 rounded-xl overflow-hidden focus-within:border-[#9DFF70] focus-within:shadow-[0_0_10px_rgba(157,255,112,0.2)] transition-all group">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value) || min)}
          className="w-full h-12 bg-transparent px-4 outline-none text-white font-bold text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        {unit && <span className="absolute right-12 text-[10px] font-bold text-zinc-500 pointer-events-none">{unit}</span>}
        <div className="flex flex-col border-l border-white/10 h-full bg-zinc-900/50 group-hover:bg-white/5 transition-colors">
          <button 
            onClick={handleIncrement}
            className="flex-1 px-2 flex items-center justify-center hover:text-[#9DFF70] transition-all active:translate-y-[-1px] active:text-white"
          >
            <ChevronUp size={14} />
          </button>
          <button 
            onClick={handleDecrement}
            className="flex-1 px-2 flex items-center justify-center hover:text-[#9DFF70] transition-all active:translate-y-[1px] active:text-white"
          >
            <ChevronDown size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
