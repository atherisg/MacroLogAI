import React from 'react';

interface DataTileProps {
  label: string;
  value: React.ReactNode;
  unit: string;
  color?: string;
}

export default function DataTile({ label, value, unit, color = 'text-white' }: DataTileProps) {
  return (
    <div className="p-4 bg-zinc-900/20 border border-white/10 rounded-2xl backdrop-blur-md text-center">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">{label}</p>
      <div className={`text-lg sm:text-xl font-black ${color} truncate`}>{value}</div>
      <p className="text-[9px] font-bold uppercase text-zinc-400 mt-1">{unit}</p>
    </div>
  );
}
