import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger'
}: ConfirmModalProps) {
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
              variant === 'danger' ? 'bg-red-500' : variant === 'warning' ? 'bg-orange-500' : 'bg-primary'
            }`} />

            <div className="flex justify-between items-start relative z-10">
              <div className={`p-3 rounded-2xl ${
                variant === 'danger' ? 'bg-red-500/10 text-red-500' : variant === 'warning' ? 'bg-orange-500/10 text-orange-500' : 'bg-primary/10 text-primary'
              }`}>
                <AlertTriangle size={24} />
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

            <div className="flex gap-3 relative z-10">
              <button
                onClick={onClose}
                className="flex-1 py-4 bg-zinc-800 text-zinc-400 font-bold uppercase tracking-widest rounded-2xl text-[10px] hover:bg-zinc-700 transition-colors"
              >
                {cancelText}
              </button>
              <button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={`flex-1 py-4 font-black uppercase tracking-widest rounded-2xl text-[10px] hover:scale-[1.02] transition-transform ${
                  variant === 'danger' ? 'bg-red-500 text-white' : variant === 'warning' ? 'bg-orange-500 text-black' : 'bg-primary text-black'
                }`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
