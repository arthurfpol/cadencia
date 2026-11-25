import { ROUTINE_PRESETS } from '../data/presets';
import type {
  BlockCategory,
  BlockStatus,
  EnergyLevel,
  PeriodOfDay,
  RoutineAppState,
  RoutineBlock,
} from '../types/routine';
import { inferPeriodFromTime, instantiatePresetBlocks } from './routineEngine';

const STORAGE_KEY = 'cadencia:app-state:v1';

const VALID_ENERGY = new Set<EnergyLevel>(['plena', 'sustentavel', 'essencial']);
const VALID_PERIOD = new Set<PeriodOfDay>(['manha', 'tarde', 'noite']);
const VALID_CATEGORY = new Set<BlockCategory>(['ancora', 'foco', 'cuidado', 'transicao', 'descanso']);
const VALID_STATUS = new Set<BlockStatus>(['pendente', 'em_andamento', 'concluido', 'pulado']);

export function getLocalTodayKey(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createDefaultState(todayKey = getLocalTodayKey()): RoutineAppState {
  const defaultPreset = ROUTINE_PRESETS[0];
  return {
    schemaVersion: 1,
    dateKey: todayKey,
    activePresetId: defaultPreset.id,
    energy: 'sustentavel',
    dailyIntention: 'Manter um ritmo calmo e concluir uma entrega importante com clareza.',
    dailyReflection: '',
    blocks: instantiatePresetBlocks(defaultPreset),
    history: [],
  };
}

function isSafeString(val: unknown, maxLength = 500): val is string {
  return typeof val === 'string' && val.length <= maxLength;
}

function ensureUniqueId(candidate: string, usedIds: Set<string>, fallbackPrefix: string): string {
  let finalId = candidate;
  let counter = 1;
  while (usedIds.has(finalId)) {
    finalId = `${fallbackPrefix}-${counter}`;
    counter += 1;
  }
  usedIds.add(finalId);
  return finalId;
}

function sanitizeBlock(
  raw: unknown,
  fallbackIndex: number,
  usedBlockIds: Set<string>,
  usedStepIds: Set<string>,
): RoutineBlock | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;

  if (!isSafeString(item.title, 140) || !item.title.trim()) return null;
  if (!isSafeString(item.startTime, 10) || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(item.startTime)) {
    return null;
  }

  const rawBlockId =
    isSafeString(item.id, 80) && item.id.trim() ? item.id.trim() : `block-${fallbackIndex}`;
  const blockId = ensureUniqueId(rawBlockId, usedBlockIds, `${rawBlockId}-dup-${fallbackIndex}`);

  const period = VALID_PERIOD.has(item.period as PeriodOfDay)
    ? (item.period as PeriodOfDay)
    : inferPeriodFromTime(item.startTime);
  const category = VALID_CATEGORY.has(item.category as BlockCategory)
    ? (item.category as BlockCategory)
    : 'foco';
  const status = VALID_STATUS.has(item.status as BlockStatus)
    ? (item.status as BlockStatus)
    : 'pendente';

  const durationMinutes = Number(item.durationMinutes);
  const essentialDurationMinutes = Number(item.essentialDurationMinutes);
  if (!Number.isFinite(durationMinutes) || durationMinutes < 2 || durationMinutes > 360) {
    return null;
  }
  if (
    !Number.isFinite(essentialDurationMinutes) ||
    essentialDurationMinutes < 1 ||
    essentialDurationMinutes > 240
  ) {
    return null;
  }

  const stepsRaw = Array.isArray(item.steps) ? item.steps : [];
  const steps = stepsRaw
    .slice(0, 20)
    .map((step, sIdx) => {
      if (!step || typeof step !== 'object') return null;
      const s = step as Record<string, unknown>;
      if (!isSafeString(s.text, 240) || !s.text.trim()) return null;
      const rawStepId =
        isSafeString(s.id, 80) && s.id.trim() ? s.id.trim() : `${blockId}-step-${sIdx}`;
      const stepId = ensureUniqueId(rawStepId, usedStepIds, `${blockId}-step-${sIdx}`);
      return {
        id: stepId,
        text: s.text.trim(),
        done: Boolean(s.done),
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  return {
    id: blockId,
    title: item.title.trim(),
    period,
    category,
    startTime: item.startTime,
    durationMinutes: Math.round(durationMinutes),
    essentialDurationMinutes: Math.min(
      Math.round(durationMinutes),
      Math.round(essentialDurationMinutes),
    ),
    triggerCue:
      isSafeString(item.triggerCue, 300) && item.triggerCue.trim()
        ? item.triggerCue.trim()
        : 'Iniciar pelo primeiro gesto simples.',
    essentialFloor:
      isSafeString(item.essentialFloor, 300) && item.essentialFloor.trim()
        ? item.essentialFloor.trim()
        : 'Executar 5 minutos essenciais.',
    steps,
    status,
    completedMode:
      item.completedMode === 'completo' || item.completedMode === 'essencial'
        ? item.completedMode
        : undefined,
    note: isSafeString(item.note, 500) ? item.note : undefined,
  };
}

export function parseAndSanitizeState(rawJson: string): RoutineAppState | null {
  try {
    const parsed = JSON.parse(rawJson) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.blocks)) return null;

    const usedBlockIds = new Set<string>();
    const usedStepIds = new Set<string>();
    let hasActiveBlock = false;

    const blocks = parsed.blocks
      .slice(0, 50)
      .map((b, idx) => sanitizeBlock(b, idx, usedBlockIds, usedStepIds))
      .filter((b): b is RoutineBlock => b !== null)
      .map((block): RoutineBlock => {
        if (block.status === 'em_andamento') {
          if (!hasActiveBlock) {
            hasActiveBlock = true;
            return block;
          }
          return { ...block, status: 'pendente' };
        }
        return block;
      });

    if (blocks.length === 0 && parsed.blocks.length > 0) {
      return null;
    }

    const energy = VALID_ENERGY.has(parsed.energy as EnergyLevel)
      ? (parsed.energy as EnergyLevel)
      : 'sustentavel';

    const historyRaw = Array.isArray(parsed.history) ? parsed.history : [];
    const seenHistoryDates = new Set<string>();
    const history = historyRaw
      .slice(0, 30)
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const e = entry as Record<string, unknown>;
        if (!isSafeString(e.dateKey, 20) || !e.dateKey.trim()) return null;
        const cleanDate = e.dateKey.trim();
        if (seenHistoryDates.has(cleanDate)) return null;
        seenHistoryDates.add(cleanDate);
        return {
          dateKey: cleanDate,
          energy: VALID_ENERGY.has(e.energy as EnergyLevel)
            ? (e.energy as EnergyLevel)
            : 'sustentavel',
          intention: isSafeString(e.intention, 240) ? e.intention : '',
          totalBlocks: Math.max(0, Number(e.totalBlocks) || 0),
          completedFull: Math.max(0, Number(e.completedFull) || 0),
          completedEssential: Math.max(0, Number(e.completedEssential) || 0),
          skipped: Math.max(0, Number(e.skipped) || 0),
          reflection: isSafeString(e.reflection, 500) ? e.reflection : undefined,
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);

    return {
      schemaVersion: 1,
      dateKey:
        isSafeString(parsed.dateKey, 20) && parsed.dateKey.trim()
          ? parsed.dateKey.trim()
          : getLocalTodayKey(),
      activePresetId:
        isSafeString(parsed.activePresetId, 80) && parsed.activePresetId.trim()
          ? parsed.activePresetId.trim()
          : ROUTINE_PRESETS[0].id,
      energy,
      dailyIntention: isSafeString(parsed.dailyIntention, 240) ? parsed.dailyIntention : '',
      dailyReflection: isSafeString(parsed.dailyReflection, 500) ? parsed.dailyReflection : '',
      blocks,
      history,
    };
  } catch {
    return null;
  }
}

export function rollOverDayIfNeeded(
  state: RoutineAppState,
  todayKey = getLocalTodayKey(),
): RoutineAppState {
  if (state.dateKey === todayKey) {
    return state;
  }

  const completedFull = state.blocks.filter(
    (b) => b.status === 'concluido' && b.completedMode !== 'essencial',
  ).length;
  const completedEssential = state.blocks.filter(
    (b) => b.status === 'concluido' && b.completedMode === 'essencial',
  ).length;
  const skipped = state.blocks.filter((b) => b.status === 'pulado').length;

  const shouldRecordHistory = completedFull + completedEssential + skipped > 0;
  const updatedHistory = shouldRecordHistory
    ? [
        {
          dateKey: state.dateKey,
          energy: state.energy,
          intention: state.dailyIntention,
          totalBlocks: state.blocks.length,
          completedFull,
          completedEssential,
          skipped,
          reflection: state.dailyReflection || undefined,
        },
        ...state.history.filter((h) => h.dateKey !== state.dateKey),
      ].slice(0, 14)
    : state.history;

  return {
    ...state,
    dateKey: todayKey,
    dailyReflection: '',
    blocks: state.blocks.map((b) => ({
      ...b,
      status: 'pendente',
      completedMode: undefined,
      note: undefined,
      steps: b.steps.map((s) => ({ ...s, done: false })),
    })),
    history: updatedHistory,
  };
}

export function loadRoutineState(todayKey = getLocalTodayKey()): RoutineAppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState(todayKey);

    const parsed = parseAndSanitizeState(raw);
    if (!parsed) return createDefaultState(todayKey);

    return rollOverDayIfNeeded(parsed, todayKey);
  } catch {
    return createDefaultState(todayKey);
  }
}

export function saveRoutineState(state: RoutineAppState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
