import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Info, X } from 'lucide-react';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  buttonText?: string;
  variant?: 'info' | 'success' | 'error';
}

export default function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  buttonText = 'Got it',
  variant = 'info'
}: AlertModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 max-w-md w-full space-y-6 shadow-2xl relative overflow-hidden"
          >
            {/* Background Glow */}
            <div className={`absolute -top-24 -right-24 w-48 h-48 blur-[100px] opacity-20 rounded-full ${
              variant === 'error' ? 'bg-red-500' : variant === 'success' ? 'bg-emerald-500' : 'bg-primary'
            }`} />

            <div className="flex justify-between items-start relative z-10">
              <div className={`p-3 rounded-2xl ${
                variant === 'error' ? 'bg-red-500/10 text-red-500' : variant === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-primary/10 text-primary'
              }`}>
                <Info size={24} />
              </div>
              <button 
                onClick={onClose}
                className="p-2 text-zinc-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-2 relative z-10">
              <h3 className="text-2xl font-black italic uppercase tracking-tight text-white">{title}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">{message}</p>
            </div>

            <div className="relative z-10">
              <button
                onClick={onClose}
                className={`w-full py-4 font-black uppercase tracking-widest rounded-2xl text-[10px] hover:scale-[1.02] transition-transform ${
                  variant === 'error' ? 'bg-red-500 text-white' : variant === 'success' ? 'bg-emerald-500 text-black' : 'bg-primary text-black'
                }`}
              >
                {buttonText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
