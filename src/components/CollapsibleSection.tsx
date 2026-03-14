import React, { useState } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'motion/react';
import { Plus, Minus, GripVertical } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  icon?: any;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
  defaultExpanded?: boolean;
  className?: string;
  dragHandle?: boolean;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ 
  title, 
  icon: Icon, 
  children, 
  headerRight,
  defaultExpanded = true,
  className = "",
  dragHandle = false
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const dragControls = useDragControls();

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between px-2 gap-4">
        <div className="flex items-center gap-2 min-w-0">
          {dragHandle && (
            <div 
              onPointerDown={(e) => dragControls.start(e)}
              className="cursor-grab text-zinc-600 hover:text-primary shrink-0"
            >
              <GripVertical size={16} />
            </div>
          )}
          {Icon && <Icon className="text-primary shrink-0" size={16} />}
          <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 truncate">{title}</h3>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {headerRight}
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-primary"
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? <Minus size={16} /> : <Plus size={16} />}
          </button>
        </div>
      </div>
      
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
