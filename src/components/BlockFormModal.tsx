import { AlertTriangle, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  BlockCategory,
  BlockValidationErrors,
  EnergyLevel,
  RoutineBlock,
  RoutineBlockDraft,
} from '../types/routine';
import {
  findDraftConflicts,
  formatEndTime,
  getEffectiveDuration,
  inferPeriodFromTime,
  validateBlockDraft,
} from '../utils/routineEngine';

interface BlockFormModalProps {
  isOpen: boolean;
  editingBlock: RoutineBlock | null;
  blocks: RoutineBlock[];
  energy: EnergyLevel;
  onClose: () => void;
  onRestoreFocus?: () => void;
  onSave: (draft: RoutineBlockDraft, existingId?: string) => void;
}

function createInitialDraft(block: RoutineBlock | null): RoutineBlockDraft {
  if (!block) {
    return {
      title: '',
      startTime: '09:00',
      durationMinutes: '45',
      essentialDurationMinutes: '15',
      category: 'foco',
      triggerCue: '',
      essentialFloor: '',
      stepsText: '',
    };
  }

  return {
    title: block.title,
    startTime: block.startTime,
    durationMinutes: String(block.durationMinutes),
    essentialDurationMinutes: String(block.essentialDurationMinutes),
    category: block.category,
    triggerCue: block.triggerCue,
    essentialFloor: block.essentialFloor,
    stepsText: block.steps.map((s) => s.text).join('\n'),
  };
}

export function BlockFormModal({
  isOpen,
  editingBlock,
  blocks,
  energy,
  onClose,
  onRestoreFocus,
  onSave,
}: BlockFormModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement | null>(null);
  const onRestoreFocusRef = useRef(onRestoreFocus);

  const [draft, setDraft] = useState<RoutineBlockDraft>(() => createInitialDraft(editingBlock));
  const [errors, setErrors] = useState<BlockValidationErrors>({});

  useEffect(() => {
    onRestoreFocusRef.current = onRestoreFocus;
  }, [onRestoreFocus]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !isOpen) return;

    if (!dialog.open) {
      dialog.showModal();
    }
    titleInputRef.current?.focus();

    return () => {
      if (dialog.open) {
        dialog.close();
      }
      onRestoreFocusRef.current?.();
    };
  }, [isOpen]);

  const overlappingBlocks = useMemo(
    () => findDraftConflicts(draft, blocks, energy, editingBlock?.id),
    [draft, blocks, energy, editingBlock?.id],
  );

  if (!isOpen) return null;

  const errorEntries = Object.entries(errors) as [keyof BlockValidationErrors, string][];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateBlockDraft(draft);
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      queueMicrotask(() => {
        errorSummaryRef.current?.focus();
      });
      return;
    }
    onSave(draft, editingBlock?.id);
  };

  const inferredPeriod = inferPeriodFromTime(draft.startTime);
  const periodLabel =
    inferredPeriod === 'manha' ? 'Manhã' : inferredPeriod === 'tarde' ? 'Tarde' : 'Noite';

  const fieldIdMap: Record<keyof BlockValidationErrors, string> = {
    title: 'campo-titulo',
    startTime: 'campo-horario',
    durationMinutes: 'campo-duracao',
    essentialDurationMinutes: 'campo-piso-tempo',
    triggerCue: 'campo-gatilho',
    essentialFloor: 'campo-piso-texto',
  };

  return (
    <dialog
      ref={dialogRef}
      className="routine-dialog"
      aria-labelledby="dialog-block-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          onClose();
        }
      }}
    >
      <div className="dialog-inner">
        <div className="dialog-header">
          <h2 id="dialog-block-title" className="dialog-title">
            {editingBlock ? 'Editar bloco de rotina' : 'Novo bloco de rotina'}
          </h2>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            aria-label="Fechar janela de edição"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <p className="dialog-subtitle">
          Defina um gatilho simples para destravar o início e um piso mínimo para dias corridos.
        </p>

        {errorEntries.length > 0 ? (
          <div ref={errorSummaryRef} tabIndex={-1} role="alert" className="error-summary">
            <strong>Confira os campos antes de salvar:</strong>
            <ul>
              {errorEntries.map(([key, msg]) => (
                <li key={key}>
                  <a
                    href={`#${fieldIdMap[key]}`}
                    onClick={(e) => {
                      e.preventDefault();
                      const targetEl = document.getElementById(fieldIdMap[key]);
                      if (targetEl instanceof HTMLElement) {
                        targetEl.focus();
                        targetEl.scrollIntoView?.({ block: 'nearest' });
                      }
                    }}
                  >
                    {msg}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {overlappingBlocks.length > 0 ? (
          <div role="note" aria-live="polite" className="conflict-warning">
            <strong>
              <AlertTriangle size={14} aria-hidden="true" /> Aviso preventivo de sobreposição:{' '}
            </strong>
            <span>
              Este horário coincide com{' '}
              {overlappingBlocks
                .map((b) => {
                  const dur = getEffectiveDuration(b, energy);
                  return `"${b.title}" (${b.startTime}–${formatEndTime(b.startTime, dur)})`;
                })
                .join(', ')}
              . Você ainda pode salvar se quiser recalibrar depois.
            </span>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-grid">
            <div className="form-field form-field-full">
              <label htmlFor="campo-titulo" className="field-label">
                Nome do bloco
              </label>
              <input
                ref={titleInputRef}
                id="campo-titulo"
                type="text"
                className="form-input"
                placeholder="Ex.: Leitura profunda ou Caminhada no quarteirão"
                value={draft.title}
                aria-invalid={Boolean(errors.title)}
                aria-describedby={errors.title ? 'erro-titulo' : undefined}
                onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
              />
              {errors.title ? (
                <span id="erro-titulo" className="field-error">
                  {errors.title}
                </span>
              ) : null}
            </div>

            <div className="form-field">
              <label htmlFor="campo-horario" className="field-label">
                Horário sugerido ({periodLabel})
              </label>
              <input
                id="campo-horario"
                type="time"
                className="form-input"
                value={draft.startTime}
                aria-invalid={Boolean(errors.startTime)}
                aria-describedby={errors.startTime ? 'erro-horario' : undefined}
                onChange={(e) => setDraft((prev) => ({ ...prev, startTime: e.target.value }))}
              />
              {errors.startTime ? (
                <span id="erro-horario" className="field-error">
                  {errors.startTime}
                </span>
              ) : null}
            </div>

            <div className="form-field">
              <label htmlFor="campo-categoria" className="field-label">
                Papel na rotina
              </label>
              <select
                id="campo-categoria"
                className="form-select"
                value={draft.category}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, category: e.target.value as BlockCategory }))
                }
              >
                <option value="ancora">Âncora de ritmo</option>
                <option value="foco">Bloco de foco</option>
                <option value="transicao">Ponte de transição</option>
                <option value="cuidado">Cuidado pessoal</option>
                <option value="descanso">Desaceleração</option>
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="campo-duracao" className="field-label">
                Duração completa (min)
              </label>
              <input
                id="campo-duracao"
                type="number"
                min={5}
                max={240}
                className="form-input"
                value={draft.durationMinutes}
                aria-invalid={Boolean(errors.durationMinutes)}
                aria-describedby={errors.durationMinutes ? 'erro-duracao' : undefined}
                onChange={(e) => setDraft((prev) => ({ ...prev, durationMinutes: e.target.value }))}
              />
              {errors.durationMinutes ? (
                <span id="erro-duracao" className="field-error">
                  {errors.durationMinutes}
                </span>
              ) : null}
            </div>

            <div className="form-field">
              <label htmlFor="campo-piso-tempo" className="field-label">
                Tempo no Modo Essencial (min)
              </label>
              <input
                id="campo-piso-tempo"
                type="number"
                min={2}
                max={120}
                className="form-input"
                value={draft.essentialDurationMinutes}
                aria-invalid={Boolean(errors.essentialDurationMinutes)}
                aria-describedby={errors.essentialDurationMinutes ? 'erro-piso-tempo' : undefined}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, essentialDurationMinutes: e.target.value }))
                }
              />
              {errors.essentialDurationMinutes ? (
                <span id="erro-piso-tempo" className="field-error">
                  {errors.essentialDurationMinutes}
                </span>
              ) : null}
            </div>

            <div className="form-field form-field-full">
              <label htmlFor="campo-gatilho" className="field-label">
                Gatilho de início (ação concreta de até 2 minutos)
              </label>
              <input
                id="campo-gatilho"
                type="text"
                className="form-input"
                placeholder="Ex.: Sentar à mesa apenas com o caderno aberto e beber água"
                value={draft.triggerCue}
                aria-invalid={Boolean(errors.triggerCue)}
                aria-describedby={errors.triggerCue ? 'erro-gatilho' : undefined}
                onChange={(e) => setDraft((prev) => ({ ...prev, triggerCue: e.target.value }))}
              />
              {errors.triggerCue ? (
                <span id="erro-gatilho" className="field-error">
                  {errors.triggerCue}
                </span>
              ) : null}
            </div>

            <div className="form-field form-field-full">
              <label htmlFor="campo-piso-texto" className="field-label">
                Descrição do piso mínimo (para dias de baixa energia)
              </label>
              <input
                id="campo-piso-texto"
                type="text"
                className="form-input"
                placeholder="Ex.: Ler apenas 2 páginas ou revisar anotações por 5 minutos"
                value={draft.essentialFloor}
                aria-invalid={Boolean(errors.essentialFloor)}
                aria-describedby={errors.essentialFloor ? 'erro-piso-texto' : undefined}
                onChange={(e) => setDraft((prev) => ({ ...prev, essentialFloor: e.target.value }))}
              />
              {errors.essentialFloor ? (
                <span id="erro-piso-texto" className="field-error">
                  {errors.essentialFloor}
                </span>
              ) : null}
            </div>

            <div className="form-field form-field-full">
              <label htmlFor="campo-passos" className="field-label">
                Passos de condução (opcional — um passo por linha)
              </label>
              <textarea
                id="campo-passos"
                rows={4}
                className="form-textarea"
                placeholder={
                  'Separar material principal\nSilenciar alertas por 30 minutos\nRegistrar onde parou'
                }
                value={draft.stepsText}
                onChange={(e) => setDraft((prev) => ({ ...prev, stepsText: e.target.value }))}
              />
            </div>
          </div>

          <div className="dialog-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              {editingBlock ? 'Salvar alterações' : 'Adicionar à trilha'}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
