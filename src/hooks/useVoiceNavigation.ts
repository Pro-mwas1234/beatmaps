// src/hooks/useVoiceNavigation.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import NavigationService, { TurnInstruction } from '../services/NavigationService';

interface VoiceOptions {
  enabled: boolean;
  volume: number;
  rate: number;
  pitch: number;
}

interface AudioDuckingOptions {
  enabled: boolean;
  targetVolume?: number;
  transitionDuration?: number;
}

export function useVoiceNavigation(
  options: VoiceOptions,
  duckingOptions?: AudioDuckingOptions
) {
  const [speaking, setSpeaking] = useState(false);
  const [currentAnnouncement, setCurrentAnnouncement] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaElementSourceRef = useRef<MediaElementSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const originalVolumeRef = useRef<number>(1.0);
  const isDuckingRef = useRef<boolean>(false);

  // Initialize Web Audio API for audio ducking
  const initAudioDucking = useCallback((mediaElement?: HTMLAudioElement) => {
    if (!duckingOptions?.enabled || !mediaElement) return;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      if (!gainNodeRef.current && audioContextRef.current) {
        gainNodeRef.current = audioContextRef.current.createGain();
        gainNodeRef.current.connect(audioContextRef.current.destination);
        
        if (mediaElement) {
          mediaElementSourceRef.current = audioContextRef.current.createMediaElementSource(mediaElement);
          mediaElementSourceRef.current.connect(gainNodeRef.current);
        }
        
        originalVolumeRef.current = mediaElement.volume || 1.0;
      }
    } catch (error) {
      console.warn('Audio ducking initialization failed:', error);
    }
  }, [duckingOptions?.enabled]);

  // Apply audio ducking (lower volume during speech)
  const applyDucking = useCallback(async (isSpeaking: boolean) => {
    if (!duckingOptions?.enabled || !gainNodeRef.current || !audioContextRef.current) return;

    const targetVolume = isSpeaking ? (duckingOptions.targetVolume ?? 0.3) : originalVolumeRef.current;
    const duration = duckingOptions.transitionDuration ?? 0.3;

    try {
      // Resume audio context if suspended (browser autoplay policy)
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const currentTime = audioContextRef.current.currentTime;
      gainNodeRef.current.gain.cancelScheduledValues(currentTime);
      gainNodeRef.current.gain.setValueAtTime(gainNodeRef.current.gain.value, currentTime);
      gainNodeRef.current.gain.linearRampToValueAtTime(targetVolume, currentTime + duration);
      
      isDuckingRef.current = isSpeaking;
    } catch (error) {
      console.warn('Audio ducking failed:', error);
    }
  }, [duckingOptions?.enabled, duckingOptions?.targetVolume, duckingOptions?.transitionDuration]);

  const speak = useCallback((text: string, onSpeechStart?: () => void, onSpeechEnd?: () => void) => {
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

    utterance.onstart = () => {
      setSpeaking(true);
      applyDucking(true);
      onSpeechStart?.();
    };
    
    utterance.onend = () => {
      setSpeaking(false);
      applyDucking(false);
      onSpeechEnd?.();
    };
    
    utterance.onerror = () => {
      setSpeaking(false);
      applyDucking(false);
    };

    window.speechSynthesis.speak(utterance);
    setCurrentAnnouncement(text);
  }, [options.enabled, options.volume, options.rate, options.pitch, applyDucking]);

  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      applyDucking(false);
    }
  }, [applyDucking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  return { 
    speak, 
    stopSpeaking, 
    speaking, 
    currentAnnouncement,
    initAudioDucking,
    applyDucking,
    isDucking: isDuckingRef.current
  };
}

export default useVoiceNavigation;
