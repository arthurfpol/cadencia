import { beforeEach, describe, expect, it } from 'vitest';
import { ROUTINE_PRESETS } from '../data/presets';
import type { RoutineAppState, RoutineBlock } from '../types/routine';
import {
  computeRoutineInsights,
  detectScheduleConflicts,
  dismissOverdueBlocks,
  findDraftConflicts,
  findGuidedBlock,
  formatDateKeyPtBr,
  formatEndTime,
  formatEnergyLabel,
  getEffectiveDuration,
  instantiatePresetBlocks,
  parseTimeToMinutes,
  recalibrateScheduleFromNow,
  validateBlockDraft,
} from '../utils/routineEngine';
import {
  createDefaultState,
  loadRoutineState,
  parseAndSanitizeState,
  rollOverDayIfNeeded,
  saveRoutineState,
} from '../utils/storage';

describe('routineEngine — cálculos temporais, conflitos e orientação contextual', () => {
  it('adapta durações corretamente conforme nível de energia', () => {
    const blocks = instantiatePresetBlocks(ROUTINE_PRESETS[0]);
    const focusBlock = blocks[2]; // 75 min completo, 25 min essencial

    expect(getEffectiveDuration(focusBlock, 'plena')).toBe(75);
    expect(getEffectiveDuration(focusBlock, 'sustentavel')).toBe(60);
    expect(getEffectiveDuration(focusBlock, 'essencial')).toBe(25);
  });

  it('formata horário de término cruzando meia-noite sem travar em 23:59 ([REV-04])', () => {
    expect(formatEndTime('23:30', 45)).toBe('00:15');
    expect(formatEndTime('23:45', 15)).toBe('00:00');
    expect(formatEndTime('08:15', 30)).toBe('08:45');
  });

  it('seleciona o bloco guiado avaliando pendentes em ordem cronológica ([REV-04])', () => {
    const base = instantiatePresetBlocks(ROUTINE_PRESETS[0]);
    const reversed: RoutineBlock[] = [
      { ...base[5], id: 'tarde-1', startTime: '16:00' },
      { ...base[1], id: 'manha-1', startTime: '10:00' },
    ];

    const guided = findGuidedBlock(reversed, parseTimeToMinutes('09:50'), 'plena');
    expect(guided?.id).toBe('manha-1');

    // Se houver bloco explicitamente em andamento, ele tem prioridade
    reversed[0].status = 'em_andamento';
    const activeGuided = findGuidedBlock(reversed, parseTimeToMinutes('09:50'), 'plena');
    expect(activeGuided?.id).toBe('tarde-1');
  });

  it('recalibra sem sobrescrever bloco em_andamento e sem empilhar excedentes em 23:55 ([REV-04])', () => {
    const blocks = instantiatePresetBlocks(ROUTINE_PRESETS[0]).slice(0, 4);
    blocks[0].status = 'concluido';
    blocks[1].status = 'em_andamento';
    blocks[1].startTime = '10:00'; // 20 min em plena -> termina 10:20

    const midDayResult = recalibrateScheduleFromNow(
      blocks,
      parseTimeToMinutes('10:05'),
      'plena',
      5,
    );

    expect(midDayResult.blocks[0].startTime).toBe('07:30');
    expect(midDayResult.blocks[1].startTime).toBe('10:00'); // preservado!
    expect(midDayResult.blocks[2].startTime).toBe('10:25'); // agendado após o bloco ativo
    expect(midDayResult.adjustedCount).toBe(2);
    expect(midDayResult.overflowedDayEnd).toBe(false);

    // No fim da noite (23:10), apenas o primeiro bloco de 30 min cabe antes de 24:00
    const lateBlocks: RoutineBlock[] = [
      { ...blocks[2], id: 'b1', status: 'pendente', startTime: '09:00', durationMinutes: 30 },
      { ...blocks[2], id: 'b2', status: 'pendente', startTime: '11:00', durationMinutes: 30 },
      { ...blocks[2], id: 'b3', status: 'pendente', startTime: '14:00', durationMinutes: 30 },
    ];

    const lateResult = recalibrateScheduleFromNow(
      lateBlocks,
      parseTimeToMinutes('23:10'),
      'plena',
      5,
    );

    expect(lateResult.adjustedCount).toBe(1);
    expect(lateResult.overflowedDayEnd).toBe(true);
    expect(lateResult.overflowCount).toBe(2);
    expect(lateResult.blocks[0].startTime).toBe('23:10');
    // Não empilha os excedentes em 23:55
    expect(lateResult.blocks[1].startTime).toBe('11:00');
    expect(lateResult.blocks[2].startTime).toBe('14:00');
  });

  it('prioriza alerta de blocos anteriores em aberto e permite pulá-los com dismissOverdueBlocks ([REV-04])', () => {
    const blocks = instantiatePresetBlocks(ROUTINE_PRESETS[0]);
    const insightsAt19h = computeRoutineInsights(
      blocks,
      [],
      'sustentavel',
      parseTimeToMinutes('19:00'),
    );

    expect(insightsAt19h.overduePendingCount).toBe(6);
    expect(insightsAt19h.suggestedAction).toBe('recalibrar');
    expect(insightsAt19h.guidanceMessage).toMatch(/6 blocos pendentes de horários anteriores/i);

    const dismissed = dismissOverdueBlocks(blocks, parseTimeToMinutes('19:00'), 'sustentavel');
    expect(dismissed.dismissedCount).toBe(6);
    expect(dismissed.blocks.filter((b) => b.status === 'pulado')).toHaveLength(6);
    expect(dismissed.blocks.filter((b) => b.status === 'pendente')).toHaveLength(2);
  });

  it('detecta conflitos de horário na trilha e no rascunho considerando o nível de energia ([REV-09])', () => {
    const base = instantiatePresetBlocks(ROUTINE_PRESETS[0]).slice(0, 2);
    const overlapping: RoutineBlock[] = [
      {
        ...base[0],
        id: 'c1',
        title: 'Leitura profunda',
        startTime: '09:00',
        durationMinutes: 60,
        essentialDurationMinutes: 15,
      },
      {
        ...base[1],
        id: 'c2',
        title: 'Reunião de alinhamento',
        startTime: '09:30',
        durationMinutes: 30,
        essentialDurationMinutes: 15,
      },
    ];

    const conflictsPlena = detectScheduleConflicts(overlapping, 'plena');
    expect(conflictsPlena.get('c1')?.overlapsWithTitles).toEqual(['Reunião de alinhamento']);
    expect(conflictsPlena.get('c2')?.overlapsWithTitles).toEqual(['Leitura profunda']);

    // Em Modo Essencial (09:00-09:15 e 09:30-09:45), não há mais sobreposição!
    const conflictsEssencial = detectScheduleConflicts(overlapping, 'essencial');
    expect(conflictsEssencial.size).toBe(0);

    const draftConflicts = findDraftConflicts(
      {
        title: 'Novo bloco sobreposto',
        startTime: '09:15',
        durationMinutes: '30',
        essentialDurationMinutes: '10',
        category: 'foco',
        triggerCue: 'Abrir nota',
        essentialFloor: 'Ler 5 min',
        stepsText: '',
      },
      overlapping,
      'plena',
    );
    expect(draftConflicts).toHaveLength(2);
  });

  it('valida rascunho e formata datas/energia para PT-BR ([REV-07])', () => {
    const errors = validateBlockDraft({
      title: 'Bloco teste',
      startTime: '09:00',
      durationMinutes: '20',
      essentialDurationMinutes: '35',
      category: 'foco',
      triggerCue: 'Abrir caderno',
      essentialFloor: 'Ler 1 página',
      stepsText: '',
    });
    expect(errors.essentialDurationMinutes).toBeDefined();

    expect(formatDateKeyPtBr('2026-11-25')).toBe('25/11/2026');
    expect(formatEnergyLabel('plena')).toBe('Energia Plena');
    expect(formatEnergyLabel('sustentavel')).toBe('Sustentável');
    expect(formatEnergyLabel('essencial')).toBe('Modo Essencial');
  });
});

describe('storage — sanitização reforçada e virada de data ([REV-06])', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('usa inferPeriodFromTime como fallback, deduplica IDs e garante no máximo 1 bloco em_andamento', () => {
    const rawPayload = JSON.stringify({
      schemaVersion: 1,
      dateKey: '2026-11-25',
      activePresetId: 'cadencia-equilibrada',
      energy: 'plena',
      dailyIntention: 'Foco tranquilo',
      dailyReflection: '',
      blocks: [
        {
          id: 'dup-id',
          title: 'Bloco Tarde Sem Period',
          period: 'invalido',
          category: 'foco',
          startTime: '14:30',
          durationMinutes: 45,
          essentialDurationMinutes: 15,
          triggerCue: 'Começar',
          essentialFloor: '5 min',
          status: 'em_andamento',
          steps: [
            { id: 's-dup', text: 'Passo 1', done: false },
            { id: 's-dup', text: 'Passo 2', done: true },
          ],
        },
        {
          id: 'dup-id',
          title: 'Bloco Noite Duplicado',
          period: 'desconhecido',
          category: 'descanso',
          startTime: '20:15',
          durationMinutes: 30,
          essentialDurationMinutes: 10,
          triggerCue: 'Desligar luz',
          essentialFloor: 'Deitar',
          status: 'em_andamento',
          steps: [],
        },
      ],
      history: [],
    });

    const sanitized = parseAndSanitizeState(rawPayload);
    expect(sanitized).not.toBeNull();
    expect(sanitized!.blocks).toHaveLength(2);

    // Fallback de período pelo horário
    expect(sanitized!.blocks[0].period).toBe('tarde');
    expect(sanitized!.blocks[1].period).toBe('noite');

    // IDs de blocos e passos deduplicados
    expect(sanitized!.blocks[0].id).not.toBe(sanitized!.blocks[1].id);
    expect(sanitized!.blocks[0].steps[0].id).not.toBe(sanitized!.blocks[0].steps[1].id);

    // Apenas o primeiro permanece em_andamento
    expect(sanitized!.blocks[0].status).toBe('em_andamento');
    expect(sanitized!.blocks[1].status).toBe('pendente');
  });

  it('arquiva dia anterior e reinicia blocos na virada de data via rollOverDayIfNeeded', () => {
    const yesterdayState: RoutineAppState = {
      ...createDefaultState('2026-11-24'),
      dailyReflection: 'Dia produtivo com pausas respeitadas.',
    };
    yesterdayState.blocks[0].status = 'concluido';
    yesterdayState.blocks[0].completedMode = 'completo';
    yesterdayState.blocks[0].note = 'Nota temporária';
    yesterdayState.blocks[1].status = 'concluido';
    yesterdayState.blocks[1].completedMode = 'essencial';
    yesterdayState.blocks[2].status = 'pulado';

    // Mesma data retorna exatamente a mesma referência
    expect(rollOverDayIfNeeded(yesterdayState, '2026-11-24')).toBe(yesterdayState);

    saveRoutineState(yesterdayState);
    const rolled = loadRoutineState('2026-11-25');

    expect(rolled.dateKey).toBe('2026-11-25');
    expect(rolled.dailyReflection).toBe('');
    expect(rolled.blocks.every((b) => b.status === 'pendente' && b.note === undefined)).toBe(true);
    expect(rolled.history).toHaveLength(1);
    expect(rolled.history[0]).toMatchObject({
      dateKey: '2026-11-24',
      completedFull: 1,
      completedEssential: 1,
      skipped: 1,
      reflection: 'Dia produtivo com pausas respeitadas.',
    });
  });
});
