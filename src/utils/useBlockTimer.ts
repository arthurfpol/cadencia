import { useEffect, useRef, useState } from 'react';
import type { EnergyLevel, RoutineBlock, TimerPresetKind } from '../types/routine';
import { getEffectiveDuration } from './routineEngine';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed';

interface InternalTimerState {
  blockId: string | null;
  status: TimerStatus;
  totalSeconds: number;
  remainingSecondsSnapshot: number;
  endTimestampMs: number | null;
  presetKind: TimerPresetKind;
}

export interface BlockTimerController {
  status: TimerStatus;
  isRunning: boolean;
  secondsLeft: number;
  totalSeconds: number;
  elapsedRatio: number;
  formattedTime: string;
  presetKind: TimerPresetKind;
  toggle: () => void;
  adjustMinutes: (deltaMinutes: number) => void;
  reset: () => void;
  startPreset: (durationSeconds: number, kind: TimerPresetKind, autoStartBlock?: boolean) => void;
}

export function formatTimerSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

interface UseBlockTimerOptions {
  block: RoutineBlock | null;
  energy: EnergyLevel;
  onAutoStartBlock: (blockId: string) => void;
  onTimerComplete: (blockTitle: string) => void;
}

export function useBlockTimer({
  block,
  energy,
  onAutoStartBlock,
  onTimerComplete,
}: UseBlockTimerOptions): BlockTimerController {
  const currentBlockId = block?.id ?? null;
  const currentBlockTitle = block?.title ?? '';
  const defaultMinutes = block ? getEffectiveDuration(block, energy) : 0;
  const defaultSeconds = Math.max(60, defaultMinutes * 60);

  const [internal, setInternal] = useState<InternalTimerState>(() => ({
    blockId: currentBlockId,
    status: 'idle',
    totalSeconds: defaultSeconds,
    remainingSecondsSnapshot: defaultSeconds,
    endTimestampMs: null,
    presetKind: 'padrao',
  }));

  const onTimerCompleteRef = useRef(onTimerComplete);
  useEffect(() => {
    onTimerCompleteRef.current = onTimerComplete;
  }, [onTimerComplete]);

  // Derivação pura durante o render: evita qualquer setState síncrono em useEffect ao trocar bloco ou energia
  const isSameBlock = currentBlockId !== null && internal.blockId === currentBlockId;
  const effectiveStatus: TimerStatus = isSameBlock ? internal.status : 'idle';
  const effectivePresetKind: TimerPresetKind = isSameBlock ? internal.presetKind : 'padrao';

  // Se o cronômetro ainda está 'idle' (não iniciado nem ajustado manualmente), acompanha mudanças de energia
  const effectiveTotalSeconds =
    !isSameBlock || effectiveStatus === 'idle' ? defaultSeconds : internal.totalSeconds;

  const effectiveSecondsLeft =
    !isSameBlock || effectiveStatus === 'idle'
      ? defaultSeconds
      : effectiveStatus === 'completed'
        ? 0
        : internal.remainingSecondsSnapshot;

  const isRunning = effectiveStatus === 'running' && internal.endTimestampMs !== null;
  const activeEndTimestampMs = isRunning ? internal.endTimestampMs : null;

  useEffect(() => {
    if (!isRunning || activeEndTimestampMs === null || !currentBlockId) return;

    let finishedNotified = false;

    const syncFromClock = () => {
      const remainingMs = activeEndTimestampMs - Date.now();
      if (remainingMs <= 0) {
        if (!finishedNotified) {
          finishedNotified = true;
          setInternal((prev) => {
            if (prev.blockId !== currentBlockId || prev.status !== 'running') {
              return prev;
            }
            return {
              ...prev,
              status: 'completed',
              remainingSecondsSnapshot: 0,
              endTimestampMs: null,
            };
          });
          onTimerCompleteRef.current(currentBlockTitle);
        }
        return;
      }

      const nextSeconds = Math.ceil(remainingMs / 1000);
      setInternal((prev) => {
        if (
          prev.blockId !== currentBlockId ||
          prev.status !== 'running' ||
          prev.remainingSecondsSnapshot === nextSeconds
        ) {
          return prev;
        }
        return {
          ...prev,
          remainingSecondsSnapshot: nextSeconds,
        };
      });
    };

    const intervalId = window.setInterval(syncFromClock, 250);
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState !== 'hidden') {
        syncFromClock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [isRunning, activeEndTimestampMs, currentBlockId, currentBlockTitle]);

  const toggle = () => {
    if (!block) return;

    if (isRunning && activeEndTimestampMs !== null) {
      const remaining = Math.max(0, Math.ceil((activeEndTimestampMs - Date.now()) / 1000));
      setInternal({
        blockId: block.id,
        status: remaining === 0 ? 'completed' : 'paused',
        totalSeconds: effectiveTotalSeconds,
        remainingSecondsSnapshot: remaining,
        endTimestampMs: null,
        presetKind: effectivePresetKind,
      });
      return;
    }

    if (block.status === 'pendente') {
      onAutoStartBlock(block.id);
    }

    const secondsToRun = effectiveSecondsLeft > 0 ? effectiveSecondsLeft : defaultSeconds;
    const nextTotal = effectiveSecondsLeft > 0 ? effectiveTotalSeconds : defaultSeconds;
    const nextPreset: TimerPresetKind = effectiveSecondsLeft > 0 ? effectivePresetKind : 'padrao';

    setInternal({
      blockId: block.id,
      status: 'running',
      totalSeconds: nextTotal,
      remainingSecondsSnapshot: secondsToRun,
      endTimestampMs: Date.now() + secondsToRun * 1000,
      presetKind: nextPreset,
    });
  };

  const adjustMinutes = (deltaMinutes: number) => {
    if (!block) return;
    const deltaSeconds = Math.round(deltaMinutes * 60);
    const currentRemaining =
      isRunning && activeEndTimestampMs !== null
        ? Math.max(0, Math.ceil((activeEndTimestampMs - Date.now()) / 1000))
        : effectiveSecondsLeft;

    const nextRemaining = Math.max(60, currentRemaining + deltaSeconds);

    const nextTotal = Math.max(effectiveTotalSeconds, nextRemaining);

    if (isRunning) {
      setInternal({
        blockId: block.id,
        status: 'running',
        totalSeconds: nextTotal,
        remainingSecondsSnapshot: nextRemaining,
        endTimestampMs: Date.now() + nextRemaining * 1000,
        presetKind: effectivePresetKind,
      });
    } else {
      setInternal({
        blockId: block.id,
        status: 'paused',
        totalSeconds: nextTotal,
        remainingSecondsSnapshot: nextRemaining,
        endTimestampMs: null,
        presetKind: effectivePresetKind,
      });
    }
  };

  const reset = () => {
    if (!block) return;
    setInternal({
      blockId: block.id,
      status: 'idle',
      totalSeconds: defaultSeconds,
      remainingSecondsSnapshot: defaultSeconds,
      endTimestampMs: null,
      presetKind: 'padrao',
    });
  };

  const startPreset = (
    durationSeconds: number,
    kind: TimerPresetKind,
    autoStartBlock = true,
  ) => {
    if (!block) return;
    const cleanSeconds = Math.max(60, Math.round(durationSeconds));
    if (autoStartBlock && block.status === 'pendente') {
      onAutoStartBlock(block.id);
    }
    setInternal({
      blockId: block.id,
      status: 'running',
      totalSeconds: cleanSeconds,
      remainingSecondsSnapshot: cleanSeconds,
      endTimestampMs: Date.now() + cleanSeconds * 1000,
      presetKind: kind,
    });
  };

  const safeTotal = Math.max(60, effectiveTotalSeconds);
  const elapsedRatio = Math.min(
    100,
    Math.max(0, Math.round(((safeTotal - effectiveSecondsLeft) / safeTotal) * 100)),
  );

  return {
    status: effectiveStatus,
    isRunning,
    secondsLeft: effectiveSecondsLeft,
    totalSeconds: safeTotal,
    elapsedRatio,
    formattedTime: formatTimerSeconds(effectiveSecondsLeft),
    presetKind: effectivePresetKind,
    toggle,
    adjustMinutes,
    reset,
    startPreset,
  };
}
