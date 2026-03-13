import React, { createContext, useContext, useCallback } from 'react';
import useSound from 'use-sound';

interface SoundContextType {
  playSuccess: () => void;
  playReward: () => void;
  playError: () => void;
  playClick: () => void;
}

const SoundContext = createContext<SoundContextType | null>(null);

const SFX = {
  success: 'https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3',
  reward: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
  error: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
  click: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
};

export function SoundProvider({ children, enabled }: { children: React.ReactNode; enabled: boolean }) {
  const [playSuccessSfx] = useSound(SFX.success, { volume: 0.5, soundEnabled: enabled });
  const [playRewardSfx] = useSound(SFX.reward, { volume: 0.5, soundEnabled: enabled });
  const [playErrorSfx] = useSound(SFX.error, { volume: 0.4, soundEnabled: enabled });
  const [playClickSfx] = useSound(SFX.click, { volume: 0.3, soundEnabled: enabled });

  const playSuccess = useCallback(() => playSuccessSfx(), [playSuccessSfx]);
  const playReward = useCallback(() => playRewardSfx(), [playRewardSfx]);
  const playError = useCallback(() => playErrorSfx(), [playErrorSfx]);
  const playClick = useCallback(() => playClickSfx(), [playClickSfx]);

  return (
    <SoundContext.Provider value={{ playSuccess, playReward, playError, playClick }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useAppSound() {
  const context = useContext(SoundContext);
  if (!context) throw new Error('useAppSound must be used within a SoundProvider');
  return context;
}
