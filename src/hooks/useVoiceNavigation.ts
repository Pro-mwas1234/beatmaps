// src/hooks/useVoiceNavigation.ts
import { useState, useEffect, useCallback } from 'react';
import NavigationService, { TurnInstruction } from '../services/NavigationService';

interface VoiceOptions {
  enabled: boolean;
  volume: number;
  rate: number;
  pitch: number;
}

export function useVoiceNavigation(options: VoiceOptions) {
  const [speaking, setSpeaking] = useState(false);
  const [currentAnnouncement, setCurrentAnnouncement] = useState<string | null>(null);

  const speak = useCallback((text: string) => {
    if (!options.enabled || !('speechSynthesis' in window)) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = options.volume;
    utterance.rate = options.rate;
    utterance.pitch = options.pitch;

    // Try to find a good English voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(voice => 
      voice.lang.includes('en-US') || voice.lang.includes('en-GB')
    );
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
    setCurrentAnnouncement(text);
  }, [options.enabled, options.volume, options.rate, options.pitch]);

  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
  }, []);

  return { speak, stopSpeaking, speaking, currentAnnouncement };
}

export default useVoiceNavigation;
