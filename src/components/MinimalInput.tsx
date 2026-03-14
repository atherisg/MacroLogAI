import React from 'react';

interface MinimalInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  unit: string;
}

export default function MinimalInput({ label, value, onChange, min, max, unit }: MinimalInputProps) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{label}</label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={min}
            max={max}
            value={value}
            onChange={e => onChange(parseInt(e.target.value) || min)}
            className="w-12 bg-transparent text-right text-sm font-bold text-primary focus:outline-none"
          />
          <span className="text-xs font-bold text-zinc-500">{unit}</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(parseInt(e.target.value))}
        className="w-full h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-primary"
      />
    </div>
  );
}
