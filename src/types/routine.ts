export type EnergyLevel = 'plena' | 'sustentavel' | 'essencial';

export type PeriodOfDay = 'manha' | 'tarde' | 'noite';

export type BlockCategory = 'ancora' | 'foco' | 'cuidado' | 'transicao' | 'descanso';

export type BlockStatus = 'pendente' | 'em_andamento' | 'concluido' | 'pulado';

export type ActiveView = 'hoje' | 'planejar' | 'ritmo';

export interface RoutineMicroStep {
  id: string;
  text: string;
  done: boolean;
}

export interface RoutineBlock {
  id: string;
  title: string;
  period: PeriodOfDay;
  category: BlockCategory;
  startTime: string; // Formato HH:MM
  durationMinutes: number;
  essentialDurationMinutes: number;
  triggerCue: string;
  essentialFloor: string;
  steps: RoutineMicroStep[];
  status: BlockStatus;
  completedMode?: 'completo' | 'essencial';
  note?: string;
}

export interface RoutineBlockDraft {
  title: string;
  startTime: string;
  durationMinutes: string;
  essentialDurationMinutes: string;
  category: BlockCategory;
  triggerCue: string;
  essentialFloor: string;
  stepsText: string;
}

export interface DailyHistoryEntry {
  dateKey: string; // YYYY-MM-DD
  energy: EnergyLevel;
  intention: string;
  totalBlocks: number;
  completedFull: number;
  completedEssential: number;
  skipped: number;
  reflection?: string;
}

export interface RoutinePreset {
  id: string;
  name: string;
  subtitle: string;
  recommendedFor: string;
  blocks: Omit<RoutineBlock, 'status' | 'completedMode' | 'note'>[];
}

export interface RoutineAppState {
  schemaVersion: 1;
  dateKey: string;
  activePresetId: string;
  energy: EnergyLevel;
  dailyIntention: string;
  dailyReflection: string;
  blocks: RoutineBlock[];
  history: DailyHistoryEntry[];
}

export interface BlockValidationErrors {
  title?: string;
  startTime?: string;
  durationMinutes?: string;
  essentialDurationMinutes?: string;
  triggerCue?: string;
  essentialFloor?: string;
}

export interface ScheduleConflict {
  blockId: string;
  overlapsWithIds: string[];
  overlapsWithTitles: string[];
}

export type TimerPresetKind = 'padrao' | 'micro_2m' | 'respiracao_1m' | 'piso_minimo';

