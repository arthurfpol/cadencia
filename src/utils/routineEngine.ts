import type {
  BlockValidationErrors,
  DailyHistoryEntry,
  EnergyLevel,
  PeriodOfDay,
  RoutineBlock,
  RoutineBlockDraft,
  RoutinePreset,
  ScheduleConflict,
} from '../types/routine';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MINUTES_PER_DAY = 24 * 60;
const LAST_START_MINUTES = 23 * 60 + 55;

export function isValidTimeFormat(hhmm: string): boolean {
  return TIME_PATTERN.test(hhmm.trim());
}

export function parseTimeToMinutes(hhmm: string): number {
  const match = TIME_PATTERN.exec(hhmm.trim());
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatMinutesToTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(LAST_START_MINUTES, Math.round(totalMinutes)));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function inferPeriodFromTime(hhmm: string): PeriodOfDay {
  const mins = parseTimeToMinutes(hhmm);
  if (mins < 12 * 60) return 'manha';
  if (mins < 18 * 60) return 'tarde';
  return 'noite';
}

export function formatDateKeyPtBr(dateKey: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey.trim());
  if (!match) return dateKey;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function formatEnergyLabel(energy: EnergyLevel): string {
  if (energy === 'plena') return 'Energia Plena';
  if (energy === 'essencial') return 'Modo Essencial';
  return 'Sustentável';
}

export function getEffectiveDuration(block: RoutineBlock, energy: EnergyLevel): number {
  if (energy === 'essencial') {
    return Math.max(2, block.essentialDurationMinutes);
  }
  if (energy === 'sustentavel') {
    const scaled = Math.round((block.durationMinutes * 0.8) / 5) * 5;
    return Math.max(block.essentialDurationMinutes, scaled || block.essentialDurationMinutes);
  }
  return block.durationMinutes;
}

export function formatEndTime(startTime: string, durationMinutes: number): string {
  const rawEnd = parseTimeToMinutes(startTime) + Math.max(0, Math.round(durationMinutes));
  const wrappedEnd = ((rawEnd % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(wrappedEnd / 60);
  const minutes = wrappedEnd % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function instantiatePresetBlocks(preset: RoutinePreset): RoutineBlock[] {
  return preset.blocks.map((block) => ({
    ...block,
    steps: block.steps.map((step) => ({ ...step, done: false })),
    status: 'pendente',
  }));
}

export function sortBlocksChronologically(blocks: RoutineBlock[]): RoutineBlock[] {
  return [...blocks].sort(
    (a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime),
  );
}

export function isBlockOverdue(
  block: RoutineBlock,
  nowMinutes: number,
  energy: EnergyLevel,
): boolean {
  if (block.status !== 'pendente') return false;
  const duration = getEffectiveDuration(block, energy);
  return parseTimeToMinutes(block.startTime) + duration < nowMinutes;
}

export function findGuidedBlock(
  blocks: RoutineBlock[],
  currentMinutes: number,
  energy: EnergyLevel,
): RoutineBlock | null {
  if (blocks.length === 0) return null;

  const active = blocks.find((b) => b.status === 'em_andamento');
  if (active) return active;

  const pendingChronological = sortBlocksChronologically(
    blocks.filter((b) => b.status === 'pendente'),
  );
  if (pendingChronological.length === 0) return null;

  // Prioriza bloco cuja janela inclui o horário atual ou começa logo a seguir em ordem cronológica
  const currentOrUpcoming = pendingChronological.find((block) => {
    const start = parseTimeToMinutes(block.startTime);
    const end = start + getEffectiveDuration(block, energy);
    return end >= currentMinutes;
  });

  return currentOrUpcoming ?? pendingChronological[0];
}

export interface RecalibrationResult {
  blocks: RoutineBlock[];
  adjustedCount: number;
  overflowedDayEnd: boolean;
  overflowCount: number;
}

export function recalibrateScheduleFromNow(
  blocks: RoutineBlock[],
  nowMinutes: number,
  energy: EnergyLevel,
  bufferMinutes = 5,
): RecalibrationResult {
  const safeNow = Math.max(0, Math.min(MINUTES_PER_DAY - 1, nowMinutes));
  const roundedStart = Math.ceil(safeNow / 5) * 5;
  const activeBlock = blocks.find((b) => b.status === 'em_andamento');

  let cursor = roundedStart;
  if (activeBlock) {
    const activeEnd =
      parseTimeToMinutes(activeBlock.startTime) + getEffectiveDuration(activeBlock, energy);
    const afterActive = Math.ceil((activeEnd + bufferMinutes) / 5) * 5;
    cursor = Math.max(cursor, afterActive);
  }

  let adjustedCount = 0;
  let overflowedDayEnd = false;
  let overflowCount = 0;

  const updated = blocks.map((block) => {
    if (
      block.status === 'concluido' ||
      block.status === 'pulado' ||
      block.status === 'em_andamento'
    ) {
      return block;
    }

    const duration = getEffectiveDuration(block, energy);
    if (cursor > LAST_START_MINUTES || cursor + duration > MINUTES_PER_DAY) {
      overflowedDayEnd = true;
      overflowCount += 1;
      return block;
    }

    const newStartTime = formatMinutesToTime(cursor);
    const newPeriod = inferPeriodFromTime(newStartTime);
    cursor = cursor + duration + bufferMinutes;
    adjustedCount += 1;

    return {
      ...block,
      startTime: newStartTime,
      period: newPeriod,
    };
  });

  return {
    blocks: updated,
    adjustedCount,
    overflowedDayEnd,
    overflowCount,
  };
}

export interface DismissOverdueResult {
  blocks: RoutineBlock[];
  dismissedCount: number;
}

export function dismissOverdueBlocks(
  blocks: RoutineBlock[],
  nowMinutes: number,
  energy: EnergyLevel,
): DismissOverdueResult {
  let dismissedCount = 0;

  const updated = blocks.map((block) => {
    if (!isBlockOverdue(block, nowMinutes, energy)) {
      return block;
    }
    dismissedCount += 1;
    return {
      ...block,
      status: 'pulado' as const,
      completedMode: undefined,
    };
  });

  return {
    blocks: updated,
    dismissedCount,
  };
}

export function detectScheduleConflicts(
  blocks: RoutineBlock[],
  energy: EnergyLevel,
): Map<string, ScheduleConflict> {
  const conflicts = new Map<string, ScheduleConflict>();
  const activeCandidates = blocks.filter(
    (b) => b.status === 'pendente' || b.status === 'em_andamento',
  );

  for (let i = 0; i < activeCandidates.length; i += 1) {
    const current = activeCandidates[i];
    const startA = parseTimeToMinutes(current.startTime);
    const endA = startA + getEffectiveDuration(current, energy);
    const overlapsWithIds: string[] = [];
    const overlapsWithTitles: string[] = [];

    for (let j = 0; j < activeCandidates.length; j += 1) {
      if (i === j) continue;
      const other = activeCandidates[j];
      const startB = parseTimeToMinutes(other.startTime);
      const endB = startB + getEffectiveDuration(other, energy);

      if (startA < endB && startB < endA) {
        overlapsWithIds.push(other.id);
        overlapsWithTitles.push(other.title);
      }
    }

    if (overlapsWithIds.length > 0) {
      conflicts.set(current.id, {
        blockId: current.id,
        overlapsWithIds,
        overlapsWithTitles,
      });
    }
  }

  return conflicts;
}

export function findDraftConflicts(
  draft: RoutineBlockDraft,
  blocks: RoutineBlock[],
  energy: EnergyLevel,
  editingBlockId?: string,
): RoutineBlock[] {
  if (!TIME_PATTERN.test(draft.startTime.trim())) return [];
  const durationFull = Number(draft.durationMinutes);
  const essentialDuration = Number(draft.essentialDurationMinutes);
  if (!Number.isFinite(durationFull) || durationFull < 2) return [];

  const simulatedBlock: RoutineBlock = {
    id: editingBlockId ?? '__draft__',
    title: draft.title.trim() || 'Novo bloco',
    period: inferPeriodFromTime(draft.startTime),
    category: draft.category,
    startTime: draft.startTime.trim(),
    durationMinutes: durationFull,
    essentialDurationMinutes:
      Number.isFinite(essentialDuration) && essentialDuration >= 1
        ? Math.min(durationFull, essentialDuration)
        : Math.min(durationFull, 10),
    triggerCue: draft.triggerCue,
    essentialFloor: draft.essentialFloor,
    steps: [],
    status: 'pendente',
  };

  const startA = parseTimeToMinutes(simulatedBlock.startTime);
  const endA = startA + getEffectiveDuration(simulatedBlock, energy);

  return blocks.filter((other) => {
    if (other.id === editingBlockId) return false;
    if (other.status !== 'pendente' && other.status !== 'em_andamento') return false;
    const startB = parseTimeToMinutes(other.startTime);
    const endB = startB + getEffectiveDuration(other, energy);
    return startA < endB && startB < endA;
  });
}

export function validateBlockDraft(draft: RoutineBlockDraft): BlockValidationErrors {
  const errors: BlockValidationErrors = {};

  if (!draft.title.trim()) {
    errors.title = 'Informe um nome claro para o bloco (ex.: Leitura técnica da manhã).';
  } else if (draft.title.trim().length < 3) {
    errors.title = 'Use pelo menos 3 caracteres no nome do bloco.';
  }

  if (!TIME_PATTERN.test(draft.startTime.trim())) {
    errors.startTime = 'Informe um horário válido no formato HH:MM (ex.: 08:30).';
  }

  const duration = Number(draft.durationMinutes);
  if (!Number.isFinite(duration) || duration < 5 || duration > 240) {
    errors.durationMinutes = 'Defina uma duração completa entre 5 e 240 minutos.';
  }

  const essentialDuration = Number(draft.essentialDurationMinutes);
  if (!Number.isFinite(essentialDuration) || essentialDuration < 2 || essentialDuration > 120) {
    errors.essentialDurationMinutes = 'Defina um piso mínimo entre 2 e 120 minutos.';
  } else if (Number.isFinite(duration) && essentialDuration > duration) {
    errors.essentialDurationMinutes =
      'O tempo do piso mínimo deve ser menor ou igual à duração completa do bloco.';
  }

  if (!draft.triggerCue.trim()) {
    errors.triggerCue = 'Descreva um gatilho simples de início (a primeira ação de 2 minutos).';
  }

  if (!draft.essentialFloor.trim()) {
    errors.essentialFloor = 'Descreva o piso mínimo para dias de baixa energia.';
  }

  return errors;
}

export interface RoutineInsights {
  totalBlocks: number;
  completedBlocks: number;
  completedEssentialBlocks: number;
  skippedBlocks: number;
  pendingBlocks: number;
  overduePendingCount: number;
  remainingMinutes: number;
  completionRate: number;
  frictionPeriod: PeriodOfDay | null;
  guidanceMessage: string;
  suggestedAction: 'essencial' | 'recalibrar' | 'manter' | 'celebrar';
}

export function computeRoutineInsights(
  blocks: RoutineBlock[],
  _history: DailyHistoryEntry[],
  energy: EnergyLevel,
  nowMinutes: number,
): RoutineInsights {
  const totalBlocks = blocks.length;
  let completedBlocks = 0;
  let completedEssentialBlocks = 0;
  let skippedBlocks = 0;
  let pendingBlocks = 0;
  let remainingMinutes = 0;
  let overduePendingCount = 0;

  const skippedByPeriod: Record<PeriodOfDay, number> = {
    manha: 0,
    tarde: 0,
    noite: 0,
  };

  for (const block of blocks) {
    if (block.status === 'concluido') {
      completedBlocks += 1;
      if (block.completedMode === 'essencial') {
        completedEssentialBlocks += 1;
      }
    } else if (block.status === 'pulado') {
      skippedBlocks += 1;
      skippedByPeriod[block.period] += 1;
    } else {
      pendingBlocks += 1;
      const duration = getEffectiveDuration(block, energy);
      remainingMinutes += duration;
      if (isBlockOverdue(block, nowMinutes, energy)) {
        overduePendingCount += 1;
      }
    }
  }

  const completionRate = totalBlocks > 0 ? Math.round((completedBlocks / totalBlocks) * 100) : 0;

  let frictionPeriod: PeriodOfDay | null = null;
  let maxSkipped = 0;
  for (const period of ['manha', 'tarde', 'noite'] as const) {
    if (skippedByPeriod[period] > maxSkipped) {
      maxSkipped = skippedByPeriod[period];
      frictionPeriod = period;
    }
  }

  if (totalBlocks > 0 && pendingBlocks === 0) {
    return {
      totalBlocks,
      completedBlocks,
      completedEssentialBlocks,
      skippedBlocks,
      pendingBlocks,
      overduePendingCount,
      remainingMinutes,
      completionRate,
      frictionPeriod,
      guidanceMessage:
        'Todos os blocos previstos para hoje receberam um desfecho. Aproveite o descanso sem pendências abertas.',
      suggestedAction: 'celebrar',
    };
  }

  if (overduePendingCount >= 1) {
    return {
      totalBlocks,
      completedBlocks,
      completedEssentialBlocks,
      skippedBlocks,
      pendingBlocks,
      overduePendingCount,
      remainingMinutes,
      completionRate,
      frictionPeriod,
      guidanceMessage: `Há ${overduePendingCount} ${
        overduePendingCount === 1
          ? 'bloco pendente de horário anterior'
          : 'blocos pendentes de horários anteriores'
      }. Você pode retomar de agora pulando os anteriores ou recalibrar os horários.`,
      suggestedAction: 'recalibrar',
    };
  }

  const minutesUntilNightRest = Math.max(0, 22 * 60 + 30 - nowMinutes);
  if (remainingMinutes > minutesUntilNightRest && energy !== 'essencial' && pendingBlocks > 0) {
    return {
      totalBlocks,
      completedBlocks,
      completedEssentialBlocks,
      skippedBlocks,
      pendingBlocks,
      overduePendingCount,
      remainingMinutes,
      completionRate,
      frictionPeriod,
      guidanceMessage: `Restam ${remainingMinutes} min planejados para o tempo disponível até 22:30. Ativar o Modo Essencial reduz a carga preservando a continuidade.`,
      suggestedAction: 'essencial',
    };
  }

  return {
    totalBlocks,
    completedBlocks,
    completedEssentialBlocks,
    skippedBlocks,
    pendingBlocks,
    overduePendingCount,
    remainingMinutes,
    completionRate,
    frictionPeriod,
    guidanceMessage:
      'Sua trilha está alinhada ao horário atual. Concentre-se apenas no gatilho de início do bloco em foco.',
    suggestedAction: 'manter',
  };
}
