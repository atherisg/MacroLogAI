import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Pill, Clock } from 'lucide-react';
import MicroButton from './MicroButton';
import { Supplement } from '../types';

interface SupplementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (supp: Partial<Supplement>) => void;
  initialData?: Supplement | null;
}

export default function SupplementModal({ isOpen, onClose, onSave, initialData }: SupplementModalProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    defaultDose: initialData?.defaultDose || '',
    unit: initialData?.unit || 'mg',
    reminderTime: initialData?.reminderTime || '08:00',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    onSave(formData);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                  <Pill size={24} />
                </div>
                <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">
                  {initialData ? 'Edit Supplement' : 'Add Supplement'}
                </h3>
              </div>
              <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Supplement Name</label>
                <input
                  autoFocus
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Creatine Monohydrate"
                  className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 outline-none focus:border-primary transition-all font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Default Dose</label>
                  <input
                    type="text"
                    value={formData.defaultDose}
                    onChange={e => setFormData({ ...formData, defaultDose: e.target.value })}
                    placeholder="5"
                    className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 outline-none focus:border-primary transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Unit</label>
                  <select
                    value={formData.unit}
                    onChange={e => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 outline-none focus:border-primary transition-all"
                  >
                    <option value="g">g</option>
                    <option value="mg">mg</option>
                    <option value="mcg">mcg</option>
                    <option value="IU">IU</option>
                    <option value="capsules">capsules</option>
                    <option value="scoops">scoops</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Reminder Time (Optional)</label>
                <div className="relative">
                  <Clock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="time"
                    value={formData.reminderTime}
                    onChange={e => setFormData({ ...formData, reminderTime: e.target.value })}
                    className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 pl-12 outline-none focus:border-primary transition-all text-primary font-bold"
                  />
                </div>
              </div>

              <div className="pt-4">
                <MicroButton type="submit" className="w-full">
                  {initialData ? 'Update Supplement' : 'Add Supplement'}
                </MicroButton>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
