import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Compass,
  Copy,
  Edit3,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { EnergyLevel, PeriodOfDay, RoutineBlock, ScheduleConflict } from '../types/routine';
import { formatEndTime, getEffectiveDuration, isBlockOverdue } from '../utils/routineEngine';

interface DayTimelineProps {
  blocks: RoutineBlock[];
  guidedBlockId: string | null;
  energy: EnergyLevel;
  nowMinutes: number;
  conflicts: Map<string, ScheduleConflict>;
  onFocusBlock: (blockId: string) => void;
  onCompleteBlock: (blockId: string) => void;
  onReopenBlock: (blockId: string) => void;
  onEditBlock: (block: RoutineBlock, triggerEl?: HTMLElement | null) => void;
  onDuplicateBlock: (blockId: string) => void;
  onDeleteBlock: (blockId: string) => void;
  onMoveBlock: (blockId: string, direction: 'up' | 'down') => void;
  onAddBlock: (triggerEl?: HTMLElement | null) => void;
  onRecalibrateNow: () => void;
}

type FilterOption = 'todos' | PeriodOfDay;

const PERIOD_LABELS: Record<PeriodOfDay, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
};

export function DayTimeline({
  blocks,
  guidedBlockId,
  energy,
  nowMinutes,
  conflicts,
  onFocusBlock,
  onCompleteBlock,
  onReopenBlock,
  onEditBlock,
  onDuplicateBlock,
  onDeleteBlock,
  onMoveBlock,
  onAddBlock,
  onRecalibrateNow,
}: DayTimelineProps) {
  const [filter, setFilter] = useState<FilterOption>('todos');
  const itemRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  const addBlockBtnRef = useRef<HTMLButtonElement | null>(null);

  const filteredBlocks =
    filter === 'todos' ? blocks : blocks.filter((block) => block.period === filter);

  const renderStatusBadge = (block: RoutineBlock, isGuided: boolean, overdue: boolean) => {
    if (block.status === 'concluido') {
      return (
        <span className="badge badge-done">
          <Check size={12} aria-hidden="true" />
          <span>
            {block.completedMode === 'essencial' ? 'Concluído (essencial)' : 'Concluído'}
          </span>
        </span>
      );
    }
    if (block.status === 'pulado') {
      return <span className="badge badge-neutral">Pulado hoje</span>;
    }
    if (block.status === 'em_andamento') {
      return <span className="badge badge-active">Em andamento</span>;
    }
    if (isGuided) {
      return <span className="badge badge-active">Na bússola</span>;
    }
    if (overdue) {
      return <span className="badge badge-overdue">Horário anterior</span>;
    }
    return <span className="badge badge-neutral">{PERIOD_LABELS[block.period]}</span>;
  };

  const handleDeleteWithFocus = (blockId: string, indexInFiltered: number) => {
    const neighborBlock =
      filteredBlocks[indexInFiltered + 1] ?? filteredBlocks[indexInFiltered - 1] ?? null;
    const neighborId = neighborBlock?.id ?? null;

    onDeleteBlock(blockId);

    queueMicrotask(() => {
      if (neighborId) {
        const neighborEl = itemRefs.current.get(neighborId);
        if (neighborEl && neighborEl.isConnected) {
          const firstActionBtn = neighborEl.querySelector<HTMLButtonElement>(
            'button:not(:disabled)',
          );
          if (firstActionBtn) {
            firstActionBtn.focus();
            return;
          }
          neighborEl.focus();
          return;
        }
      }
      addBlockBtnRef.current?.focus();
    });
  };

  return (
    <section className="timeline-panel" aria-labelledby="timeline-heading">
      <div className="timeline-header">
        <div>
          <h2 id="timeline-heading" className="section-heading">
            Trilha do dia
          </h2>
          <p className="section-subtitle">
            Sequência adaptada para{' '}
            {energy === 'essencial'
              ? 'Modo Essencial'
              : energy === 'sustentavel'
                ? 'Ritmo Sustentável'
                : 'Energia Plena'}
          </p>
        </div>

        <div className="header-action-row">
          <button type="button" className="btn btn-secondary" onClick={onRecalibrateNow}>
            <RefreshCw size={15} aria-hidden="true" />
            <span>Recalibrar horários</span>
          </button>
          <button
            ref={addBlockBtnRef}
            type="button"
            className="btn btn-primary"
            onClick={(e) => onAddBlock(e.currentTarget)}
          >
            <Plus size={15} aria-hidden="true" />
            <span>Novo bloco</span>
          </button>
        </div>
      </div>

      <div className="period-filters" role="group" aria-label="Filtrar trilha por período do dia">
        {(
          [
            { id: 'todos', label: `Todos (${blocks.length})` },
            {
              id: 'manha',
              label: `Manhã (${blocks.filter((b) => b.period === 'manha').length})`,
            },
            {
              id: 'tarde',
              label: `Tarde (${blocks.filter((b) => b.period === 'tarde').length})`,
            },
            {
              id: 'noite',
              label: `Noite (${blocks.filter((b) => b.period === 'noite').length})`,
            },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            className="filter-chip"
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {filteredBlocks.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-title">Nenhum bloco neste período.</p>
          <p className="empty-state-copy">
            Altere o filtro acima ou adicione um novo bloco para este turno.
          </p>
        </div>
      ) : (
        <ol className="timeline-list">
          {filteredBlocks.map((block, filteredIndex) => {
            const globalIndex = blocks.findIndex((b) => b.id === block.id);
            const duration = getEffectiveDuration(block, energy);
            const endTime = formatEndTime(block.startTime, duration);
            const isGuided = block.id === guidedBlockId;
            const overdue = isBlockOverdue(block, nowMinutes, energy);
            const conflict = conflicts.get(block.id);

            const itemClasses = [
              'timeline-item',
              isGuided ? 'timeline-item-guided' : '',
              block.status === 'concluido' ? 'timeline-item-done' : '',
              block.status === 'pulado' ? 'timeline-item-skipped' : '',
              conflict ? 'timeline-item-conflict' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <li
                key={block.id}
                ref={(el) => {
                  if (el) {
                    itemRefs.current.set(block.id, el);
                  } else {
                    itemRefs.current.delete(block.id);
                  }
                }}
                tabIndex={-1}
                className={itemClasses}
              >
                <div className="timeline-item-top">
                  <span className="timeline-time">
                    {block.startTime} – {endTime} ({duration} min)
                  </span>
                  <div className="timeline-badges">
                    {conflict ? (
                      <span className="badge badge-alert">
                        <AlertTriangle size={12} aria-hidden="true" />
                        <span>Conflito de horário</span>
                      </span>
                    ) : null}
                    {renderStatusBadge(block, isGuided, overdue)}
                  </div>
                </div>

                <h3 className="timeline-title">{block.title}</h3>
                <p className="timeline-cue">
                  {energy === 'essencial' ? block.essentialFloor : block.triggerCue}
                </p>

                {conflict ? (
                  <p className="timeline-conflict-detail">
                    Sobrepõe-se a: {conflict.overlapsWithTitles.join(', ')}
                  </p>
                ) : null}

                {block.note ? <p className="timeline-note">Nota: {block.note}</p> : null}

                <div className="timeline-item-actions">
                  <div className="timeline-primary-actions">
                    {block.status === 'pendente' || block.status === 'em_andamento' ? (
                      <>
                        {!isGuided ? (
                          <button
                            type="button"
                            className="btn btn-soft"
                            onClick={() => onFocusBlock(block.id)}
                            aria-label={`Guiar agora o bloco ${block.title}`}
                          >
                            <Compass size={14} aria-hidden="true" />
                            <span>Guiar agora</span>
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => onCompleteBlock(block.id)}
                          aria-label={`Marcar como concluído: ${block.title}`}
                        >
                          <Check size={14} aria-hidden="true" />
                          <span>Concluir</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => onReopenBlock(block.id)}
                        aria-label={`Reabrir bloco ${block.title}`}
                      >
                        <RotateCcw size={14} aria-hidden="true" />
                        <span>Reabrir</span>
                      </button>
                    )}

                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={(e) => onEditBlock(block, e.currentTarget)}
                      aria-label={`Editar bloco ${block.title}`}
                    >
                      <Edit3 size={14} aria-hidden="true" />
                      <span>Editar</span>
                    </button>
                  </div>

                  <div className="timeline-utility-actions">
                    <button
                      type="button"
                      className="btn btn-icon"
                      onClick={() => onDuplicateBlock(block.id)}
                      aria-label={`Duplicar bloco ${block.title}`}
                      title="Duplicar bloco"
                    >
                      <Copy size={15} aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      className="btn btn-icon"
                      disabled={globalIndex <= 0}
                      onClick={() => onMoveBlock(block.id, 'up')}
                      aria-label={`Mover bloco ${block.title} para cima`}
                      title="Mover para cima"
                    >
                      <ArrowUp size={15} aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      className="btn btn-icon"
                      disabled={globalIndex >= blocks.length - 1}
                      onClick={() => onMoveBlock(block.id, 'down')}
                      aria-label={`Mover bloco ${block.title} para baixo`}
                      title="Mover para baixo"
                    >
                      <ArrowDown size={15} aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      className="btn btn-icon btn-icon-danger"
                      onClick={() => handleDeleteWithFocus(block.id, filteredIndex)}
                      aria-label={`Excluir bloco ${block.title}`}
                      title="Excluir bloco"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
