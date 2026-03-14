import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList
} from 'recharts';
import { AminoAcidProfile } from '../types';
import { ESSENTIAL_AA_LIST, FAO_REFERENCE } from '../services/aminoAcidService';

interface Props {
  profile: AminoAcidProfile;
  totalProtein?: number;
}

export default function AminoAcidBarChart({ profile, totalProtein = 0 }: Props) {
  const data = ESSENTIAL_AA_LIST.map(key => {
    const value = profile[key] || 0;
    let target = 0;
    let percent = 0;

    // Handle combined FAO references
    if (key === 'methionine') {
      const combined = (profile.methionine || 0) + (profile.cysteine || 0);
      target = (totalProtein * FAO_REFERENCE.methionine_cysteine) / 1000;
      percent = target > 0 ? (combined / target) * 100 : 0;
    } else if (key === 'phenylalanine') {
      const combined = (profile.phenylalanine || 0) + (profile.tyrosine || 0);
      target = (totalProtein * FAO_REFERENCE.phenylalanine_tyrosine) / 1000;
      percent = target > 0 ? (combined / target) * 100 : 0;
    } else if (key in FAO_REFERENCE) {
      target = (totalProtein * FAO_REFERENCE[key as keyof typeof FAO_REFERENCE]) / 1000;
      percent = target > 0 ? (value / target) * 100 : 0;
    }

    return {
      name: key.charAt(0).toUpperCase() + key.slice(1),
      value: Number(value.toFixed(1)),
      target: Number(target.toFixed(1)),
      percent: Math.round(percent),
      key
    };
  }).sort((a, b) => b.value - a.value);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl shadow-2xl">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1">{item.name}</p>
          <div className="space-y-1">
            <p className="text-sm font-black text-white">{item.value}g <span className="text-[10px] text-zinc-500 font-normal">Actual</span></p>
            {item.target > 0 && (
              <>
                <p className="text-sm font-black text-primary/80">{item.target}g <span className="text-[10px] text-zinc-500 font-normal">Target</span></p>
                <p className={item.percent >= 100 ? "text-green-500 text-xs font-bold" : "text-orange-500 text-xs font-bold"}>
                  {item.percent}% of Reference
                </p>
              </>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-full bg-black/20 rounded-2xl p-4 border border-white/5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider">Essential Amino Acids (g)</h3>
        {totalProtein > 0 && (
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Target based on {totalProtein}g Protein</span>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 40, top: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
            <XAxis type="number" hide />
            <YAxis 
              dataKey="name" 
              type="category" 
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
              width={80}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} content={<CustomTooltip />} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
              {data.map((entry, index) => {
                let color = '#10b981'; // Green (Good)
                if (totalProtein > 0) {
                  if (entry.percent < 70) color = '#ef4444'; // Red (Lacking)
                  else if (entry.percent < 100) color = '#f59e0b'; // Orange (Low)
                } else {
                  color = entry.value > 1 ? '#10b981' : '#f59e0b';
                }
                return <Cell key={`cell-${index}`} fill={color} />;
              })}
              <LabelList 
                dataKey="value" 
                position="right" 
                content={(props: any) => {
                  const { x, y, width, value, index } = props;
                  const item = data[index];
                  return (
                    <text 
                      x={x + width + 5} 
                      y={y + 14} 
                      fill="rgba(255,255,255,0.5)" 
                      fontSize={10} 
                      fontWeight="bold"
                    >
                      {value.toFixed(1)}g {item.percent > 0 ? `(${item.percent}%)` : ''}
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
