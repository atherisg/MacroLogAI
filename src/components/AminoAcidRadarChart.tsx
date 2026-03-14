import React from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import { AminoAcidProfile } from '../types';
import { ESSENTIAL_AA_LIST } from '../services/aminoAcidService';

interface Props {
  profile: AminoAcidProfile;
  title?: string;
}

export default function AminoAcidRadarChart({ profile, title = "Amino Acid Profile" }: Props) {
  const data = ESSENTIAL_AA_LIST.map(key => ({
    subject: key.charAt(0).toUpperCase() + key.slice(1),
    value: profile[key] || 0,
    fullMark: 10, // Just a reference
  }));

  return (
    <div className="w-full h-full bg-black/20 rounded-2xl p-4 border border-white/5">
      {title && <h3 className="text-sm font-medium text-white/60 mb-2 uppercase tracking-wider">{title}</h3>}
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid stroke="rgba(255,255,255,0.1)" />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} 
          />
          <Radar
            name="Amount (g)"
            dataKey="value"
            stroke="#10b981"
            fill="#10b981"
            fillOpacity={0.5}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
            itemStyle={{ color: '#10b981' }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
