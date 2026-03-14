import React from 'react';
import clsx from 'clsx';

interface SegmentedControlProps {
  options: { id: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}

export default function SegmentedControl({ options, value, onChange }: SegmentedControlProps) {
  return (
    <div className="flex p-1 bg-zinc-950/50 border border-white/5 rounded-xl">
      {options.map(option => (
        <button
          key={option.id}
          onClick={() => onChange(option.id)}
          className={clsx(
            "flex-1 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
            value === option.id 
              ? "bg-zinc-800 text-white shadow-sm" 
              : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
