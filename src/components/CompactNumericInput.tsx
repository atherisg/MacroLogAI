import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

interface CompactNumericInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

export default function CompactNumericInput({ value, onChange, min = 0, max = 10000, step = 1, className }: CompactNumericInputProps) {
  const handleIncrement = () => {
    if (value < max) onChange(Math.min(max, value + step));
  };
  const handleDecrement = () => {
    if (value > min) onChange(Math.max(min, value - step));
  };

  return (
    <div className={clsx("relative flex items-center bg-transparent border border-white/10 rounded-lg overflow-hidden focus-within:border-[#9DFF70] transition-all group", className)}>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || min)}
        className="w-16 h-8 bg-transparent outline-none text-white font-black text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <div className="flex flex-col border-l border-white/10 h-full bg-zinc-900/50 group-hover:bg-white/5 transition-colors">
        <button 
          onClick={handleIncrement}
          className="flex-1 px-1 flex items-center justify-center hover:text-[#9DFF70] transition-all active:translate-y-[-1px] active:text-white"
        >
          <ChevronUp size={10} />
        </button>
        <button 
          onClick={handleDecrement}
          className="flex-1 px-1 flex items-center justify-center hover:text-[#9DFF70] transition-all active:translate-y-[1px] active:text-white"
        >
          <ChevronDown size={10} />
        </button>
      </div>
    </div>
  );
}
