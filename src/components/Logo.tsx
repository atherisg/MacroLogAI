import React from 'react';

export default function Logo({ className = "w-8 h-8", color = "currentColor" }: { className?: string, color?: string }) {
  return (
    <svg 
      viewBox="0 0 512 512" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
    >
      {/* The "M" shape - thick and rounded */}
      <path 
        d="M100 400L180 150L256 300L332 150L412 400" 
        stroke={color} 
        strokeWidth="60" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      {/* The "dot/leaf" shape */}
      <path 
        d="M440 320C440 320 480 320 480 360C480 400 440 400 440 400C440 400 400 400 400 360C400 320 440 320 440 320Z" 
        fill={color}
      />
    </svg>
  );
}
