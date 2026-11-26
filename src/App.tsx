import { BarChart3, CalendarRange, Compass } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BlockFormModal } from './components/BlockFormModal';
import { DayTimeline } from './components/DayTimeline';
import { HeaderBar } from './components/HeaderBar';
import { NowCompass } from './components/NowCompass';
import { PresetsPlannerView, RhythmReviewView } from './components/RhythmAndPresetsView';
import type {
  ActiveView,
  EnergyLevel,
  RoutineAppState,
  RoutineBlock,
  RoutineBlockDraft,
  RoutinePreset,
} from './types/routine';
import {
  computeRoutineInsights,
  detectScheduleConflicts,
  dismissOverdueBlocks,
  findGuidedBlock,
  formatMinutesToTime,
  getEffectiveDuration,
  inferPeriodFromTime,
  instantiatePresetBlocks,
  parseTimeToMinutes,
  recalibrateScheduleFromNow,
  sortBlocksChronologically,
} from './utils/routineEngine';
import {
  getLocalTodayKey,
  loadRoutineState,
  parseAndSanitizeState,
  rollOverDayIfNeeded,
  saveRoutineState,
} from './utils/storage';
import { useBlockTimer } from './utils/useBlockTimer';

function getCurrentTimeHHMM(now = new Date()): string {
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function getGreetingByMinutes(mins: number): string {
  if (mins < 12 * 60) return 'Bom dia';
  if (mins < 18 * 60) return 'Boa tarde';
  return 'Boa noite';
}

interface ToastState {
  id: number;
  message: string;
  onUndo?: () => void;
}

export function App() {
  const [appState, setAppState] = useState<RoutineAppState>(() => loadRoutineState());
  const [activeView, setActiveView] = useState<ActiveView>('hoje');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const attr = document.documentElement.getAttribute('data-theme');
    return attr === 'light' ? 'light' : 'dark';
  });
  const [clockHHMM, setClockHHMM] = useState<string>(() => getCurrentTimeHHMM());
  const [customTimeOverride, setCustomTimeOverride] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<RoutineBlock | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const modalTriggerRef = useRef<HTMLElement | null>(null);
  const toastCounterRef = useRef(0);

  const tabRefs = useRef<Record<ActiveView, HTMLButtonElement | null>>({
    hoje: null,
    planejar: null,
    ritmo: null,
  });

  const showToast = useCallback((message: string, onUndo?: () => void) => {
    toastCounterRef.current += 1;
    setToast({
      id: toastCounterRef.current,
      message,
      onUndo,
    });
  }, []);

  useEffect(() => {
    const syncClockAndDay = () => {
      if (document.visibilityState === 'hidden') return;
      const now = new Date();
      setClockHHMM(getCurrentTimeHHMM(now));
      const todayKey = getLocalTodayKey(now);
      setAppState((prev) => rollOverDayIfNeeded(prev, todayKey));
    };

    const id = window.setInterval(syncClockAndDay, 30_000);
    document.addEventListener('visibilitychange', syncClockAndDay);
    window.addEventListener('focus', syncClockAndDay);

    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', syncClockAndDay);
      window.removeEventListener('focus', syncClockAndDay);
    };
  }, []);

  useEffect(() => {
    saveRoutineState(appState);
  }, [appState]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('cadencia:theme', theme);
    } catch {
      // Ignora indisponibilidade de armazenamento privado
    }
  }, [theme]);

  useEffect(() => {
    if (!toast) return;
    const durationMs = toast.onUndo ? 7_000 : 4_200;
    const t = window.setTimeout(() => setToast(null), durationMs);
    return () => window.clearTimeout(t);
  }, [toast]);

  const effectiveTimeHHMM = customTimeOverride ?? clockHHMM;
  const nowMinutes = parseTimeToMinutes(effectiveTimeHHMM);
  const greeting = getGreetingByMinutes(nowMinutes);

  const guidedBlock = useMemo(
    () => findGuidedBlock(appState.blocks, nowMinutes, appState.energy),
    [appState.blocks, nowMinutes, appState.energy],
  );

  const insights = useMemo(
    () => computeRoutineInsights(appState.blocks, appState.history, appState.energy, nowMinutes),
    [appState.blocks, appState.history, appState.energy, nowMinutes],
  );

  const scheduleConflicts = useMemo(
    () => detectScheduleConflicts(appState.blocks, appState.energy),
    [appState.blocks, appState.energy],
  );

  const markBlockInProgress = useCallback((blockId: string) => {
    setAppState((prev) => ({
      ...prev,
      blocks: prev.blocks.map((block) => {
        if (block.id === blockId) {
          return { ...block, status: 'em_andamento' };
        }
        if (block.status === 'em_andamento') {
          return { ...block, status: 'pendente' };
        }
        return block;
      }),
    }));
  }, []);

  const handleTimerComplete = useCallback(
    (blockTitle: string) => {
      showToast(
        `Tempo sugerido concluído em "${blockTitle}" — decida se encerra o bloco ou soma 5 min.`,
      );
    },
    [showToast],
  );

  const timer = useBlockTimer({
    block: guidedBlock,
    energy: appState.energy,
    onAutoStartBlock: markBlockInProgress,
    onTimerComplete: handleTimerComplete,
  });

  const openCreateModal = useCallback((triggerEl?: HTMLElement | null) => {
    modalTriggerRef.current =
      triggerEl ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setEditingBlock(null);
    setIsModalOpen(true);
  }, []);

  const openEditModal = useCallback((block: RoutineBlock, triggerEl?: HTMLElement | null) => {
    modalTriggerRef.current =
      triggerEl ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setEditingBlock(block);
    setIsModalOpen(true);
  }, []);

  const restoreModalTriggerFocus = useCallback(() => {
    const trigger = modalTriggerRef.current;
    if (trigger && trigger.isConnected) {
      trigger.focus();
    }
  }, []);

  const handleSetEnergy = (energy: EnergyLevel) => {
    setAppState((prev) => ({ ...prev, energy }));
    const label =
      energy === 'essencial'
        ? 'Modo Essencial ativado — tempos ajustados ao piso mínimo.'
        : energy === 'sustentavel'
          ? 'Ritmo Sustentável ativado.'
          : 'Energia Plena ativada.';
    showToast(label);
  };

  const handleFocusBlock = (blockId: string) => {
    markBlockInProgress(blockId);
    setActiveView('hoje');
  };

  const handleToggleStep = (blockId: string, stepId: string) => {
    setAppState((prev) => ({
      ...prev,
      blocks: prev.blocks.map((block) => {
        if (block.id !== blockId) return block;
        return {
          ...block,
          steps: block.steps.map((step) =>
            step.id === stepId ? { ...step, done: !step.done } : step,
          ),
        };
      }),
    }));
  };

  const handleCompleteBlock = (
    blockId: string,
    mode: 'completo' | 'essencial' = appState.energy === 'essencial' ? 'essencial' : 'completo',
  ) => {
    const target = appState.blocks.find((b) => b.id === blockId);
    setAppState((prev) => ({
      ...prev,
      blocks: prev.blocks.map((block) =>
        block.id === blockId ? { ...block, status: 'concluido', completedMode: mode } : block,
      ),
    }));
    if (target) {
      showToast(
        mode === 'essencial'
          ? `Piso mínimo concluído em "${target.title}".`
          : `Bloco "${target.title}" concluído.`,
      );
    }
  };

  const handleSkipBlock = (blockId: string) => {
    const target = appState.blocks.find((b) => b.id === blockId);
    setAppState((prev) => ({
      ...prev,
      blocks: prev.blocks.map((block) =>
        block.id === blockId ? { ...block, status: 'pulado', completedMode: undefined } : block,
      ),
    }));
    if (target) {
      showToast(`"${target.title}" pulado hoje — foco direcionado ao próximo bloco.`);
    }
  };

  const handleReopenBlock = (blockId: string) => {
    setAppState((prev) => ({
      ...prev,
      blocks: prev.blocks.map((block) =>
        block.id === blockId ? { ...block, status: 'pendente', completedMode: undefined } : block,
      ),
    }));
  };

  const handleUpdateBlockNote = (blockId: string, note: string) => {
    setAppState((prev) => ({
      ...prev,
      blocks: prev.blocks.map((block) => (block.id === blockId ? { ...block, note } : block)),
    }));
  };

  const handleRecalibrateNow = useCallback(() => {
    const previousBlocks = appState.blocks;
    const result = recalibrateScheduleFromNow(previousBlocks, nowMinutes, appState.energy);

    if (result.adjustedCount === 0) {
      if (result.overflowedDayEnd) {
        showToast(
          'Os blocos pendentes não cabem mais antes da meia-noite. Ative o Modo Essencial ou pule os anteriores.',
        );
      } else {
        showToast('Não há blocos pendentes para recalibrar hoje.');
      }
      return;
    }

    setAppState((prev) => ({ ...prev, blocks: result.blocks }));
    const message = result.overflowedDayEnd
      ? `${result.adjustedCount} blocos recalibrados (${result.overflowCount} excederam o fim da noite — considere o Modo Essencial).`
      : `Horários recalibrados para ${result.adjustedCount} blocos a partir de ${effectiveTimeHHMM}.`;

    showToast(message, () => {
      setAppState((prev) => ({ ...prev, blocks: previousBlocks }));
      showToast('Horários anteriores restaurados.');
    });
  }, [appState.blocks, appState.energy, effectiveTimeHHMM, nowMinutes, showToast]);

  const handleDismissOverdue = () => {
    const previousBlocks = appState.blocks;
    const result = dismissOverdueBlocks(previousBlocks, nowMinutes, appState.energy);
    if (result.dismissedCount === 0) {
      showToast('Não há blocos anteriores em aberto para pular.');
      return;
    }

    setAppState((prev) => ({ ...prev, blocks: result.blocks }));
    showToast(
      `${result.dismissedCount} ${
        result.dismissedCount === 1
          ? 'bloco anterior pulado'
          : 'blocos anteriores pulados'
      } — retomando a partir de agora.`,
      () => {
        setAppState((prev) => ({ ...prev, blocks: previousBlocks }));
        showToast('Blocos anteriores restaurados.');
      },
    );
  };

  const handleMoveBlock = (blockId: string, direction: 'up' | 'down') => {
    setAppState((prev) => {
      const idx = prev.blocks.findIndex((b) => b.id === blockId);
      if (idx < 0) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.blocks.length) return prev;
      const next = [...prev.blocks];
      const [moved] = next.splice(idx, 1);
      next.splice(targetIdx, 0, moved);
      return { ...prev, blocks: next };
    });
  };

  const handleDuplicateBlock = (blockId: string) => {
    const original = appState.blocks.find((b) => b.id === blockId);
    if (!original) return;

    const previousBlocks = appState.blocks;
    const effectiveDur = getEffectiveDuration(original, appState.energy);
    const candidateStartMins = parseTimeToMinutes(original.startTime) + effectiveDur + 5;
    const fitsAfter = candidateStartMins <= 23 * 60 + 55 && candidateStartMins + effectiveDur <= 1440;
    const nextStartTime = fitsAfter ? formatMinutesToTime(candidateStartTimeOrFallback(candidateStartMins)) : original.startTime;

    const copyId = `bloco-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const duplicated: RoutineBlock = {
      ...original,
      id: copyId,
      title: `${original.title} (cópia)`,
      startTime: nextStartTime,
      period: inferPeriodFromTime(nextStartTime),
      status: 'pendente',
      completedMode: undefined,
      note: undefined,
      steps: original.steps.map((s, idx) => ({
        id: `${copyId}-s-${idx}`,
        text: s.text,
        done: false,
      })),
    };

    const originalIdx = previousBlocks.findIndex((b) => b.id === blockId);
    const nextBlocks = [...previousBlocks];
    nextBlocks.splice(originalIdx + 1, 0, duplicated);

    setAppState((prev) => ({
      ...prev,
      blocks: sortBlocksChronologically(nextBlocks),
    }));

    showToast(`Bloco "${original.title}" duplicado na trilha.`, () => {
      setAppState((prev) => ({ ...prev, blocks: previousBlocks }));
      showToast('Duplicação desfeita.');
    });
  };

  const handleDeleteBlock = (blockId: string) => {
    const previousBlocks = appState.blocks;
    const target = previousBlocks.find((b) => b.id === blockId);
    if (!target) return;

    setAppState((prev) => ({
      ...prev,
      blocks: prev.blocks.filter((b) => b.id !== blockId),
    }));

    showToast(`Bloco "${target.title}" removido da trilha.`, () => {
      setAppState((prev) => ({ ...prev, blocks: previousBlocks }));
      showToast(`Bloco "${target.title}" restaurado.`);
    });
  };

  const handleSaveBlockDraft = (draft: RoutineBlockDraft, existingId?: string) => {
    const stepsLines = draft.stepsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const cleanStartTime = draft.startTime.trim();
    const period = inferPeriodFromTime(cleanStartTime);

    if (existingId) {
      setAppState((prev) => {
        const previousTarget = prev.blocks.find((b) => b.id === existingId);
        const startTimeChanged = previousTarget && previousTarget.startTime !== cleanStartTime;

        const updatedBlocks = prev.blocks.map((block) => {
          if (block.id !== existingId) return block;
          return {
            ...block,
            title: draft.title.trim(),
            startTime: cleanStartTime,
            period,
            category: draft.category,
            durationMinutes: Number(draft.durationMinutes),
            essentialDurationMinutes: Number(draft.essentialDurationMinutes),
            triggerCue: draft.triggerCue.trim(),
            essentialFloor: draft.essentialFloor.trim(),
            steps: stepsLines.map((text, idx) => ({
              id: block.steps[idx]?.id ?? `${existingId}-step-${Date.now()}-${idx}`,
              text,
              done: block.steps[idx]?.text === text ? block.steps[idx].done : false,
            })),
          };
        });

        return {
          ...prev,
          blocks: startTimeChanged ? sortBlocksChronologically(updatedBlocks) : updatedBlocks,
        };
      });
      showToast(`Alterações salvas em "${draft.title.trim()}".`);
    } else {
      const newId = `bloco-${Date.now()}`;
      const created: RoutineBlock = {
        id: newId,
        title: draft.title.trim(),
        startTime: cleanStartTime,
        period,
        category: draft.category,
        durationMinutes: Number(draft.durationMinutes),
        essentialDurationMinutes: Number(draft.essentialDurationMinutes),
        triggerCue: draft.triggerCue.trim(),
        essentialFloor: draft.essentialFloor.trim(),
        steps: stepsLines.map((text, idx) => ({
          id: `${newId}-s-${idx}`,
          text,
          done: false,
        })),
        status: 'pendente',
      };
      setAppState((prev) => ({
        ...prev,
        blocks: sortBlocksChronologically([...prev.blocks, created]),
      }));
      showToast(`Bloco "${created.title}" adicionado à trilha.`);
    }

    setIsModalOpen(false);
    setEditingBlock(null);
  };

  const handleApplyPreset = (preset: RoutinePreset) => {
    setAppState((prev) => ({
      ...prev,
      activePresetId: preset.id,
      blocks: instantiatePresetBlocks(preset),
    }));
    setActiveView('hoje');
    showToast(`Modelo "${preset.name}" aplicado.`);
  };

  const handleResetTodayStatuses = () => {
    const previousBlocks = appState.blocks;
    setAppState((prev) => ({
      ...prev,
      blocks: prev.blocks.map((block) => ({
        ...block,
        status: 'pendente',
        completedMode: undefined,
        steps: block.steps.map((s) => ({ ...s, done: false })),
      })),
    }));
    showToast('Marcações de hoje reiniciadas.', () => {
      setAppState((prev) => ({ ...prev, blocks: previousBlocks }));
      showToast('Marcações anteriores restauradas.');
    });
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(appState, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cadencia-rotina-${appState.dateKey}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Arquivo JSON da rotina exportado.');
  };

  const handleImportJsonText = (raw: string): boolean => {
    const sanitized = parseAndSanitizeState(raw);
    if (!sanitized) return false;
    setAppState(sanitized);
    showToast('Rotina importada com sucesso.');
    return true;
  };

  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      if (isModalOpen) return;
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;

      const key = e.key.toLowerCase();
      if (key === 'n' || e.code === 'KeyN') {
        e.preventDefault();
        openCreateModal();
      } else if (key === 'r' || e.code === 'KeyR') {
        e.preventDefault();
        handleRecalibrateNow();
      } else if (key === '1' || e.code === 'Digit1') {
        e.preventDefault();
        setActiveView('hoje');
        tabRefs.current.hoje?.focus();
      } else if (key === '2' || e.code === 'Digit2') {
        e.preventDefault();
        setActiveView('planejar');
        tabRefs.current.planejar?.focus();
      } else if (key === '3' || e.code === 'Digit3') {
        e.preventDefault();
        setActiveView('ritmo');
        tabRefs.current.ritmo?.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [handleRecalibrateNow, isModalOpen, openCreateModal]);

  const orderedTabs: ActiveView[] = ['hoje', 'planejar', 'ritmo'];
  const handleTabKeyDown = (e: React.KeyboardEvent, current: ActiveView) => {
    const idx = orderedTabs.indexOf(current);
    let nextIdx = idx;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % orderedTabs.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + orderedTabs.length) % orderedTabs.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = orderedTabs.length - 1;
    else return;

    e.preventDefault();
    const nextTab = orderedTabs[nextIdx];
    setActiveView(nextTab);
    tabRefs.current[nextTab]?.focus();
  };

  const isNative = typeof window !== 'undefined' && Boolean(window.cadencia?.isNative);

  return (
    <div className="app-shell">
      {isNative ? (
        <div className="native-titlebar" aria-hidden="true">
          <svg
            className="native-titlebar-mark"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12 2L22 12L12 22L2 12L12 2Z" stroke="#ffb224" strokeWidth="2" />
            <path d="M12 6L18 12L12 18L6 12L12 6Z" fill="#ffb224" />
          </svg>
          <span className="native-titlebar-name">Cadência</span>
          <span className="native-titlebar-status">
            <span className="native-titlebar-dot" />
            Offline · dados neste computador
          </span>
        </div>
      ) : null}

      <a href="#conteudo-principal" className="skip-link">
        Pular para a orientação principal
      </a>

      <HeaderBar
        formattedTime={effectiveTimeHHMM}
        greeting={greeting}
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        customTimeOverride={customTimeOverride}
        onChangeTimeOverride={setCustomTimeOverride}
      />

      {/* Faixa de Intenção do Dia e Nível de Energia */}
      <section className="context-strip" aria-label="Intenção e energia do dia">
        <div className="intention-box">
          <label htmlFor="intencao-diaria" className="field-label">
            Intenção norteadora de hoje
          </label>
          <textarea
            id="intencao-diaria"
            rows={1}
            className="intention-input intention-textarea"
            value={appState.dailyIntention}
            placeholder="Qual entrega ou cuidado daria sentido ao dia de hoje?"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
              }
            }}
            onChange={(e) =>
              setAppState((prev) => ({
                ...prev,
                dailyIntention: e.target.value.replace(/\r?\n/g, ' '),
              }))
            }
          />
        </div>

        <div className="energy-selector-group" role="group" aria-labelledby="energia-label">
          <span id="energia-label" className="field-label">
            Nível de energia disponível hoje
          </span>
          <div className="energy-buttons">
            {(
              [
                {
                  id: 'plena',
                  name: 'Energia Plena',
                  desc: '100% da duração',
                },
                {
                  id: 'sustentavel',
                  name: 'Sustentável',
                  desc: 'Ritmo 80% calmo',
                },
                {
                  id: 'essencial',
                  name: 'Modo Essencial',
                  desc: 'Piso mínimo ativo',
                },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                className="energy-btn"
                aria-pressed={appState.energy === opt.id}
                onClick={() => handleSetEnergy(opt.id)}
              >
                <span className="energy-btn-name">{opt.name}</span>{' '}
                <span className="energy-btn-desc">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Abas de Navegação e Barra de Progresso do Dia */}
      <div className="view-nav">
        <div className="view-tabs" role="tablist" aria-label="Seções do Cadência">
          <button
            ref={(el) => {
              tabRefs.current.hoje = el;
            }}
            id="tab-hoje"
            type="button"
            role="tab"
            className="view-tab"
            aria-selected={activeView === 'hoje'}
            aria-controls="panel-hoje"
            tabIndex={activeView === 'hoje' ? 0 : -1}
            onClick={() => setActiveView('hoje')}
            onKeyDown={(e) => handleTabKeyDown(e, 'hoje')}
          >
            <Compass size={16} aria-hidden="true" />
            <span>Orientação de Hoje</span>
            {timer.isRunning && activeView !== 'hoje' ? (
              <span className="tab-timer-badge" title="Cronômetro em andamento">
                {timer.formattedTime}
              </span>
            ) : null}
          </button>

          <button
            ref={(el) => {
              tabRefs.current.planejar = el;
            }}
            id="tab-planejar"
            type="button"
            role="tab"
            className="view-tab"
            aria-selected={activeView === 'planejar'}
            aria-controls="panel-planejar"
            tabIndex={activeView === 'planejar' ? 0 : -1}
            onClick={() => setActiveView('planejar')}
            onKeyDown={(e) => handleTabKeyDown(e, 'planejar')}
          >
            <CalendarRange size={16} aria-hidden="true" />
            <span>Planejar Rotina</span>
          </button>

          <button
            ref={(el) => {
              tabRefs.current.ritmo = el;
            }}
            id="tab-ritmo"
            type="button"
            role="tab"
            className="view-tab"
            aria-selected={activeView === 'ritmo'}
            aria-controls="panel-ritmo"
            tabIndex={activeView === 'ritmo' ? 0 : -1}
            onClick={() => setActiveView('ritmo')}
            onKeyDown={(e) => handleTabKeyDown(e, 'ritmo')}
          >
            <BarChart3 size={16} aria-hidden="true" />
            <span>Ritmo & Backup</span>
          </button>
        </div>

        <div className="day-progress-summary">
          <div className="day-progress-meta">
            <span>
              {insights.completedBlocks} de {insights.totalBlocks} blocos concluídos hoje
            </span>
            <span className="day-progress-percent">{insights.completionRate}%</span>
          </div>
          <div
            className="day-progress-track"
            role="progressbar"
            aria-label="Progresso de blocos concluídos hoje"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={insights.completionRate}
            aria-valuetext={`${insights.completedBlocks} de ${insights.totalBlocks} blocos concluídos (${insights.completionRate}%)`}
          >
            <div
              className="day-progress-fill"
              style={{ width: `${insights.completionRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Banner de Orientação Inteligente */}
      <div className="guidance-banner">
        <p className="guidance-banner-text">{insights.guidanceMessage}</p>
        {insights.overduePendingCount >= 1 ? (
          <div className="guidance-banner-actions">
            <button type="button" className="btn btn-primary" onClick={handleDismissOverdue}>
              Retomar de agora (pular anteriores)
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleRecalibrateNow}>
              Recalibrar horários
            </button>
          </div>
        ) : insights.suggestedAction === 'essencial' ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleSetEnergy('essencial')}
          >
            Ativar Modo Essencial
          </button>
        ) : insights.suggestedAction === 'recalibrar' ? (
          <button type="button" className="btn btn-secondary" onClick={handleRecalibrateNow}>
            Recalibrar horários agora
          </button>
        ) : null}
      </div>

      <main id="conteudo-principal" tabIndex={-1}>
        {activeView === 'hoje' ? (
          <div id="panel-hoje" role="tabpanel" aria-labelledby="tab-hoje" className="today-grid">
            <NowCompass
              block={guidedBlock}
              energy={appState.energy}
              timer={timer}
              onToggleStep={handleToggleStep}
              onCompleteBlock={handleCompleteBlock}
              onSkipBlock={handleSkipBlock}
              onUpdateNote={handleUpdateBlockNote}
              onCreateNewBlock={openCreateModal}
              onReopenDay={handleResetTodayStatuses}
              onUnstuckFeedback={(msg) => showToast(msg)}
              hasAnyBlocks={appState.blocks.length > 0}
            />

            <DayTimeline
              blocks={appState.blocks}
              guidedBlockId={guidedBlock?.id ?? null}
              energy={appState.energy}
              nowMinutes={nowMinutes}
              conflicts={scheduleConflicts}
              onFocusBlock={handleFocusBlock}
              onCompleteBlock={(id) => handleCompleteBlock(id)}
              onReopenBlock={handleReopenBlock}
              onEditBlock={openEditModal}
              onDuplicateBlock={handleDuplicateBlock}
              onDeleteBlock={handleDeleteBlock}
              onMoveBlock={handleMoveBlock}
              onAddBlock={openCreateModal}
              onRecalibrateNow={handleRecalibrateNow}
            />
          </div>
        ) : null}

        {activeView === 'planejar' ? (
          <div id="panel-planejar" role="tabpanel" aria-labelledby="tab-planejar">
            <PresetsPlannerView
              activePresetId={appState.activePresetId}
              onApplyPreset={handleApplyPreset}
              onResetTodayStatuses={handleResetTodayStatuses}
              onSortChronologically={() => {
                setAppState((prev) => ({
                  ...prev,
                  blocks: sortBlocksChronologically(prev.blocks),
                }));
                showToast('Blocos ordenados cronologicamente.');
              }}
            />
          </div>
        ) : null}

        {activeView === 'ritmo' ? (
          <div id="panel-ritmo" role="tabpanel" aria-labelledby="tab-ritmo">
            <RhythmReviewView
              insights={insights}
              dailyReflection={appState.dailyReflection}
              onChangeReflection={(text) =>
                setAppState((prev) => ({ ...prev, dailyReflection: text }))
              }
              history={appState.history}
              onExportJson={handleExportJson}
              onImportJsonText={handleImportJsonText}
            />
          </div>
        ) : null}
      </main>

      <footer className="app-footer">
        <ul className="shortcut-list" aria-label="Atalhos de teclado disponíveis">
          <li className="shortcut-item">
            <kbd className="kbd-key">Alt</kbd>+<kbd className="kbd-key">N</kbd>{' '}
            <span>Novo bloco</span>
          </li>
          <li className="shortcut-item">
            <kbd className="kbd-key">Alt</kbd>+<kbd className="kbd-key">R</kbd>{' '}
            <span>Recalibrar horários</span>
          </li>
          <li className="shortcut-item">
            <kbd className="kbd-key">Alt</kbd>+<kbd className="kbd-key">1</kbd>/
            <kbd className="kbd-key">2</kbd>/<kbd className="kbd-key">3</kbd>{' '}
            <span>Alternar seções</span>
          </li>
        </ul>
        <span>Dados salvos apenas neste computador. Funciona sem internet.</span>
      </footer>

      {isModalOpen ? (
        <BlockFormModal
          key={editingBlock?.id ?? 'novo-bloco'}
          isOpen={isModalOpen}
          editingBlock={editingBlock}
          blocks={appState.blocks}
          energy={appState.energy}
          onClose={() => {
            setIsModalOpen(false);
            setEditingBlock(null);
          }}
          onRestoreFocus={restoreModalTriggerFocus}
          onSave={handleSaveBlockDraft}
        />
      ) : null}

      {toast ? (
        <div role="status" aria-live="polite" className="toast-status">
          <span>{toast.message}</span>
          {toast.onUndo ? (
            <button
              type="button"
              className="btn btn-soft toast-undo-btn"
              onClick={() => {
                const undoFn = toast.onUndo;
                setToast(null);
                undoFn?.();
              }}
            >
              Desfazer
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function candidateStartTimeOrFallback(mins: number): number {
  return Math.ceil(mins / 5) * 5;
}

export default App;
