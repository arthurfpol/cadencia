import {
  CheckCircle2,
  Compass,
  Feather,
  LifeBuoy,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Sparkles,
  Wind,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { EnergyLevel, RoutineBlock, TimerPresetKind } from '../types/routine';
import { formatEndTime, getEffectiveDuration } from '../utils/routineEngine';
import type { BlockTimerController } from '../utils/useBlockTimer';

interface NowCompassProps {
  block: RoutineBlock | null;
  energy: EnergyLevel;
  timer: BlockTimerController;
  onToggleStep: (blockId: string, stepId: string) => void;
  onCompleteBlock: (blockId: string, mode: 'completo' | 'essencial') => void;
  onSkipBlock: (blockId: string) => void;
  onUpdateNote: (blockId: string, note: string) => void;
  onCreateNewBlock: (triggerEl?: HTMLElement | null) => void;
  onReopenDay: () => void;
  onUnstuckFeedback: (message: string) => void;
  hasAnyBlocks: boolean;
}

const CATEGORY_LABELS: Record<RoutineBlock['category'], string> = {
  ancora: 'Âncora de ritmo',
  foco: 'Bloco de foco',
  cuidado: 'Cuidado pessoal',
  transicao: 'Ponte de transição',
  descanso: 'Desaceleração',
};

const PRESET_BADGE_LABELS: Record<Exclude<TimerPresetKind, 'padrao'>, string> = {
  micro_2m: 'Micro-início (2 min)',
  respiracao_1m: 'Ponte de respiração (1 min)',
  piso_minimo: 'Meta de piso mínimo',
};

export function NowCompass({
  block,
  energy,
  timer,
  onToggleStep,
  onCompleteBlock,
  onSkipBlock,
  onUpdateNote,
  onCreateNewBlock,
  onReopenDay,
  onUnstuckFeedback,
  hasAnyBlocks,
}: NowCompassProps) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const [unstuckOpenBlockId, setUnstuckOpenBlockId] = useState<string | null>(null);

  const focusCompassHeading = () => {
    queueMicrotask(() => {
      headingRef.current?.focus();
    });
  };

  if (!hasAnyBlocks) {
    return (
      <section className="compass-panel" aria-labelledby="compass-empty-title">
        <h2 id="compass-empty-title" ref={headingRef} tabIndex={-1} className="compass-title">
          Sua rotina ainda não tem blocos cadastrados
        </h2>
        <p className="compass-empty-copy">
          Adicione o primeiro bloco com um gatilho simples de início ou escolha um modelo pronto na
          aba Planejar Rotina.
        </p>
        <div className="compass-empty-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={(e) => onCreateNewBlock(e.currentTarget)}
          >
            <Plus size={16} aria-hidden="true" />
            <span>Criar primeiro bloco</span>
          </button>
        </div>
      </section>
    );
  }

  if (!block) {
    return (
      <section className="compass-panel" aria-labelledby="compass-done-title">
        <span className="badge badge-done">
          <CheckCircle2 size={14} aria-hidden="true" />
          <span>Ciclo de hoje encerrado</span>
        </span>
        <h2 id="compass-done-title" ref={headingRef} tabIndex={-1} className="compass-title">
          Todos os blocos de hoje já foram conduzidos
        </h2>
        <p className="compass-empty-copy">
          Não há mais atividades pendentes na sua trilha de hoje. Você pode registrar uma nota na
          aba Ritmo & Backup ou reabrir as marcações se quiser revisar o dia.
        </p>
        <div className="compass-empty-actions">
          <button type="button" className="btn btn-secondary" onClick={onReopenDay}>
            <RotateCcw size={16} aria-hidden="true" />
            <span>Reiniciar marcações de hoje</span>
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={(e) => onCreateNewBlock(e.currentTarget)}
          >
            <Plus size={16} aria-hidden="true" />
            <span>Adicionar bloco extra</span>
          </button>
        </div>
      </section>
    );
  }

  const targetMinutes = getEffectiveDuration(block, energy);
  const endTime = formatEndTime(block.startTime, targetMinutes);
  const completedStepsCount = block.steps.filter((s) => s.done).length;
  const isUnstuckOpen = unstuckOpenBlockId === block.id;
  const essentialMinutes = Math.max(2, block.essentialDurationMinutes);

  const timerStatusLabel =
    timer.secondsLeft === 0
      ? 'Tempo concluído — decida se encerra ou soma 5 min'
      : timer.isRunning
        ? 'Contagem ativa'
        : timer.status === 'paused'
          ? 'Contagem pausada'
          : 'Pronto para iniciar';

  return (
    <section className="compass-panel" aria-labelledby="compass-current-title">
      <div className="compass-header">
        <div className="compass-header-badges">
          <span className="badge badge-active">
            <Compass size={14} aria-hidden="true" />
            <span>
              {block.status === 'em_andamento' ? 'Bloco em andamento' : 'Bússola do agora'}
            </span>
          </span>
          <span className="badge badge-neutral">{CATEGORY_LABELS[block.category]}</span>
        </div>
        <span className="compass-time-window">
          {block.startTime} – {endTime} ({targetMinutes} min)
        </span>
      </div>

      <h2 id="compass-current-title" ref={headingRef} tabIndex={-1} className="compass-title">
        {block.title}
      </h2>

      <div className="cue-callout">
        <div className="cue-callout-title">
          <Sparkles size={16} aria-hidden="true" />
          <span>Gatilho de início (primeiros 2 minutos)</span>
        </div>
        <p className="cue-callout-body">{block.triggerCue}</p>
      </div>

      <div className="floor-box">
        <div className="floor-box-title">
          {energy === 'essencial'
            ? 'Piso mínimo ativo para hoje (Modo Essencial)'
            : 'Alternativa de piso mínimo (se a energia cair)'}
        </div>
        <p className="floor-box-body">
          {block.essentialFloor} ({essentialMinutes} min)
        </p>
      </div>

      {/* Assistente Gentil para Destravar o Início */}
      <div className="unstuck-box">
        <div className="unstuck-header">
          <button
            type="button"
            className="btn btn-soft"
            aria-expanded={isUnstuckOpen}
            aria-controls="painel-destravar"
            onClick={() =>
              setUnstuckOpenBlockId((prev) => (prev === block.id ? null : block.id))
            }
          >
            <LifeBuoy size={16} aria-hidden="true" />
            <span>Travei / Difícil começar</span>
          </button>
          {timer.presetKind !== 'padrao' ? (
            <span className="badge badge-active">{PRESET_BADGE_LABELS[timer.presetKind]}</span>
          ) : null}
        </div>

        {isUnstuckOpen ? (
          <div id="painel-destravar" className="unstuck-panel">
            <p className="unstuck-helper-text">
              Reduza o atrito agora: escolha um passo minúsculo sem compromisso com o bloco inteiro.
            </p>
            <div className="unstuck-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  timer.startPreset(120, 'micro_2m', true);
                  onUnstuckFeedback(
                    `Micro-início de 2 min iniciado em "${block.title}". Foque só no primeiro gesto.`,
                  );
                }}
              >
                <Sparkles size={15} aria-hidden="true" />
                <span>Começar só por 2 min</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  timer.startPreset(60, 'respiracao_1m', false);
                  onUnstuckFeedback(
                    'Ponte de respiração (1 min) iniciada — inspire devagar e solte os ombros antes de agir.',
                  );
                }}
              >
                <Wind size={15} aria-hidden="true" />
                <span>Ponte de respiração (1 min)</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  timer.startPreset(essentialMinutes * 60, 'piso_minimo', true);
                  onUnstuckFeedback(
                    `Cronômetro ajustado ao piso mínimo deste bloco (${essentialMinutes} min).`,
                  );
                }}
              >
                <Feather size={15} aria-hidden="true" />
                <span>Usar piso mínimo neste bloco ({essentialMinutes} min)</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Cronômetro Guiado */}
      <div className="timer-module" role="group" aria-labelledby="timer-group-label">
        <div className="timer-top">
          <div>
            <div className="timer-label-row">
              <span id="timer-group-label" className="field-label">
                Tempo restante sugerido
              </span>
            </div>
            <div className="timer-digits" role="timer" aria-live="off">
              {timer.formattedTime}
            </div>
          </div>
          <span className="timer-status-text" aria-live="polite">
            {timerStatusLabel}
          </span>
        </div>

        <div className="timer-progress-track" aria-hidden="true">
          <div className="timer-progress-fill" style={{ width: `${timer.elapsedRatio}%` }} />
        </div>

        <div className="timer-actions">
          <button type="button" className="btn btn-primary" onClick={timer.toggle}>
            {timer.isRunning ? (
              <Pause size={16} aria-hidden="true" />
            ) : (
              <Play size={16} aria-hidden="true" />
            )}
            <span>{timer.isRunning ? 'Pausar cronômetro' : 'Iniciar cronômetro'}</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            disabled={timer.secondsLeft <= 60}
            onClick={() => timer.adjustMinutes(-5)}
          >
            <Minus size={15} aria-hidden="true" />
            <span>- 5 min</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => timer.adjustMinutes(5)}
          >
            <Plus size={15} aria-hidden="true" />
            <span>Somar 5 min</span>
          </button>

          <button type="button" className="btn btn-ghost" onClick={timer.reset}>
            <RotateCcw size={15} aria-hidden="true" />
            <span>Reiniciar tempo</span>
          </button>
        </div>
      </div>

      {/* Micro-passos */}
      {block.steps.length > 0 ? (
        <div className="steps-section">
          <h3 className="steps-heading">
            Passos de condução ({completedStepsCount}/{block.steps.length})
          </h3>
          <ul className="steps-list">
            {block.steps.map((step) => (
              <li key={step.id}>
                <label className="step-item-label">
                  <input
                    type="checkbox"
                    className="step-checkbox"
                    checked={step.done}
                    onChange={() => onToggleStep(block.id, step.id)}
                  />
                  <span className={step.done ? 'step-text-done' : undefined}>{step.text}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Anotação de contexto do bloco */}
      <div className="block-note-area">
        <label htmlFor={`nota-${block.id}`} className="field-label">
          Nota rápida de contexto (ex.: onde parei ou ajuste necessário)
        </label>
        <input
          id={`nota-${block.id}`}
          type="text"
          className="intention-input"
          placeholder="Opcional — fica salva neste bloco hoje"
          value={block.note ?? ''}
          onChange={(e) => onUpdateNote(block.id, e.target.value)}
        />
      </div>

      {/* Desfechos do Bloco */}
      <div className="compass-outcome-bar">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            onCompleteBlock(block.id, energy === 'essencial' ? 'essencial' : 'completo');
            focusCompassHeading();
          }}
        >
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>{energy === 'essencial' ? 'Concluir piso mínimo' : 'Concluir bloco'}</span>
        </button>

        {energy !== 'essencial' ? (
          <button
            type="button"
            className="btn btn-soft"
            onClick={() => {
              onCompleteBlock(block.id, 'essencial');
              focusCompassHeading();
            }}
          >
            <span>Concluir pelo piso mínimo</span>
          </button>
        ) : null}

        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            onSkipBlock(block.id);
            focusCompassHeading();
          }}
        >
          <SkipForward size={16} aria-hidden="true" />
          <span>Pular hoje</span>
        </button>
      </div>
    </section>
  );
}
