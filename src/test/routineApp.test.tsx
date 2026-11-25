import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { createDefaultState, saveRoutineState } from '../utils/storage';

describe('Cadência v2 — Fluxos integrados, acessibilidade, foco e cronômetro', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('cumpre semântica ARIA no cronômetro, simulador de horário e main landmark ([REV-01], [REV-02])', () => {
    const state = createDefaultState('2026-11-25');
    saveRoutineState(state);

    render(<App />);

    // .timer-module usa role="group" nomeado por #timer-group-label sem aria-label proibido em div
    const timerGroup = screen.getByRole('group', { name: /Tempo restante sugerido/i });
    expect(timerGroup).toHaveClass('timer-module');
    expect(timerGroup).not.toHaveAttribute('aria-label');

    // Simulador de horário tem rótulo único "Simular horário:" sem aria-label redundante
    const simulatorInput = screen.getByLabelText(/Simular horário:/i);
    expect(simulatorInput).toHaveAttribute('id', 'simular-horario');
    expect(simulatorInput).not.toHaveAttribute('aria-label');

    // Main possui tabIndex={-1} para suporte ao skip-link
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'conteudo-principal');
    expect(main).toHaveAttribute('tabIndex', '-1');

    // Barra de progresso do dia visível e acessível
    const progressbar = screen.getByRole('progressbar', {
      name: /Progresso de blocos concluídos hoje/i,
    });
    expect(progressbar).toHaveAttribute('aria-valuenow', '0');
  });

  it('mantém cronômetro baseado em Date.now() sem drift, preserva entre abas, ajusta -5 min e anuncia 00:00 ([REV-01], [REV-03], [REV-08])', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-25T07:35:00'));

    render(<App />);

    // Bloco inicial (07:30, 30 min completo -> 25 min em Sustentável -> 25:00)
    const timerDisplay = screen.getByRole('timer');
    expect(timerDisplay).toHaveTextContent('25:00');

    // Mudar energia enquanto idle atualiza o cronômetro automaticamente (Essencial = 10 min)
    fireEvent.click(screen.getByRole('button', { name: /Modo Essencial Piso mínimo ativo/i }));
    expect(timerDisplay).toHaveTextContent('10:00');

    // Iniciar cronômetro
    fireEvent.click(screen.getByRole('button', { name: /Iniciar cronômetro/i }));
    expect(screen.getByRole('button', { name: /Pausar cronômetro/i })).toBeInTheDocument();

    // Avança 3 minutos (simula passagem real de Date.now()) -> 07:00
    act(() => {
      vi.advanceTimersByTime(3 * 60 * 1000);
    });
    expect(timerDisplay).toHaveTextContent('07:00');

    // Mudar energia enquanto rodando NÃO destrói nem sobrescreve a contagem em andamento
    fireEvent.click(screen.getByRole('button', { name: /Energia Plena 100% da duração/i }));
    expect(timerDisplay).toHaveTextContent('07:00');

    // Trocar de aba preserva o cronômetro e exibe badge compacto na aba Orientação de Hoje
    fireEvent.click(screen.getByRole('tab', { name: /Planejar Rotina/i }));
    const todayTab = screen.getByRole('tab', { name: /Orientação de Hoje/i });
    expect(within(todayTab).getByText('07:00')).toBeInTheDocument();

    // Avança mais 1 minuto em outra aba -> badge atualiza para 06:00
    act(() => {
      vi.advanceTimersByTime(60 * 1000);
    });
    expect(within(todayTab).getByText('06:00')).toBeInTheDocument();

    // Volta para Orientação de Hoje -> cronômetro segue em 06:00
    fireEvent.click(todayTab);
    expect(screen.getByRole('timer')).toHaveTextContent('06:00');

    // Botão "- 5 min" reduz de 06:00 para 01:00 (mínimo seguro) e desabilita em <= 01:00
    const minusFiveBtn = screen.getByRole('button', { name: /- 5 min/i });
    fireEvent.click(minusFiveBtn);
    expect(screen.getByRole('timer')).toHaveTextContent('01:00');
    expect(minusFiveBtn).toBeDisabled();

    // Avança 60s restantes até 00:00 -> anuncia término em role="status"
    act(() => {
      vi.advanceTimersByTime(60 * 1000);
    });
    expect(screen.getByRole('timer')).toHaveTextContent('00:00');
    expect(screen.getByRole('status')).toHaveTextContent(/Tempo sugerido concluído/i);
  });

  it('aciona assistente "Travei / Difícil começar" com micro-início de 2 min, respiração de 1 min e piso mínimo ([REV-08])', async () => {
    const user = userEvent.setup();
    render(<App />);

    const unstuckBtn = screen.getByRole('button', { name: /Travei \/ Difícil começar/i });
    expect(unstuckBtn).toHaveAttribute('aria-expanded', 'false');

    await user.click(unstuckBtn);
    expect(unstuckBtn).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getByRole('button', { name: /Começar só por 2 min/i }));
    expect(screen.getByRole('timer')).toHaveTextContent('02:00');
    expect(screen.getByText(/Micro-início \(2 min\)/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Ponte de respiração \(1 min\)/i }));
    expect(screen.getByRole('timer')).toHaveTextContent('01:00');
    expect(screen.getByRole('status')).toHaveTextContent(/Ponte de respiração \(1 min\) iniciada/i);

    await user.click(screen.getByRole('button', { name: /Usar piso mínimo neste bloco/i }));
    expect(screen.getByText(/Meta de piso mínimo/i)).toBeInTheDocument();
  });

  it('gerencia foco no modal (<dialog>), links de erro, conclusão na Bússola e exclusão na Trilha ([REV-02])', async () => {
    const user = userEvent.setup();
    render(<App />);

    const newBlockBtn = screen.getByRole('button', { name: /Novo bloco/i });
    await user.click(newBlockBtn);

    // Ao abrir o modal, foco automático em #campo-titulo
    const titleInput = screen.getByLabelText(/Nome do bloco/i);
    expect(titleInput).toHaveFocus();

    // Tentar salvar vazio foca o resumo de erros; clicar no link de erro foca o campo correspondente
    await user.click(screen.getByRole('button', { name: /Adicionar à trilha/i }));
    const errorAlert = screen.getByRole('alert');
    expect(errorAlert).toHaveFocus();

    const triggerErrorLink = screen.getByRole('link', {
      name: /Descreva um gatilho simples de início/i,
    });
    await user.click(triggerErrorLink);
    expect(screen.getByLabelText(/Gatilho de início/i)).toHaveFocus();

    // Fechar restaura o foco ao botão acionador ("Novo bloco")
    await user.click(screen.getByRole('button', { name: /Cancelar/i }));
    expect(newBlockBtn).toHaveFocus();

    // Concluir bloco na Bússola move o foco para o título <h2> da Bússola
    const completeCompassBtn = screen.getByRole('button', { name: /^Concluir bloco$/i });
    await user.click(completeCompassBtn);
    const compassHeading = document.getElementById('compass-current-title');
    expect(compassHeading).toHaveFocus();

    // Excluir bloco na Trilha move o foco para uma ação do bloco vizinho
    const deleteFirstBtn = screen.getByRole('button', {
      name: /Excluir bloco Abertura da manhã sem telas/i,
    });
    await user.click(deleteFirstBtn);
    expect(document.activeElement?.tagName).toBe('BUTTON');
    expect(document.activeElement).not.toBe(document.body);
  });

  it('suporta Desfazer (Undo) para exclusão, duplicação e retomada de blocos anteriores ([REV-04], [REV-05], [REV-09])', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Simula 19:00 -> blocos da manhã e tarde ficam vencidos ("Horário anterior")
    const simulatorInput = screen.getByLabelText(/Simular horário:/i);
    fireEvent.change(simulatorInput, { target: { value: '19:00' } });

    // Banner exibe ação gentil "Retomar de agora (pular anteriores)"
    const resumeBtn = screen.getByRole('button', {
      name: /Retomar de agora \(pular anteriores\)/i,
    });
    await user.click(resumeBtn);
    expect(screen.getByRole('status')).toHaveTextContent(/blocos anteriores pulados/i);

    // Desfaz retomada
    await user.click(screen.getByRole('button', { name: /Desfazer/i }));
    expect(screen.getByRole('status')).toHaveTextContent(/Blocos anteriores restaurados/i);

    // Duplicar bloco e desfazer
    const duplicateBtn = screen.getByRole('button', {
      name: /Duplicar bloco Abertura da manhã sem telas/i,
    });
    await user.click(duplicateBtn);
    expect(
      screen.getByRole('heading', { level: 3, name: /Abertura da manhã sem telas \(cópia\)/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Desfazer/i }));
    expect(
      screen.queryByRole('heading', { level: 3, name: /Abertura da manhã sem telas \(cópia\)/i }),
    ).not.toBeInTheDocument();

    // Excluir bloco e desfazer
    const deleteBtn = screen.getByRole('button', {
      name: /Excluir bloco Abertura da manhã sem telas/i,
    });
    await user.click(deleteBtn);
    expect(screen.queryByText('Abertura da manhã sem telas')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Desfazer/i }));
    expect(screen.getByText('Abertura da manhã sem telas')).toBeInTheDocument();
  });

  it('exibe aviso preventivo de sobreposição no modal, badge de conflito na trilha e reordena ao editar horário ([REV-06], [REV-09])', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Abre modal para criar bloco às 07:40 (conflita com Abertura da manhã 07:30-07:55)
    await user.click(screen.getByRole('button', { name: /Novo bloco/i }));
    await user.type(screen.getByLabelText(/Nome do bloco/i), 'Bloco conflitante matinal');
    fireEvent.change(screen.getByLabelText(/Horário sugerido/i), { target: { value: '07:40' } });
    await user.type(screen.getByLabelText(/Gatilho de início/i), 'Abrir caderno');
    await user.type(screen.getByLabelText(/Descrição do piso mínimo/i), 'Ler 2 páginas');

    // Aviso preventivo aparece sem bloquear o salvamento
    expect(screen.getByText(/Aviso preventivo de sobreposição/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Adicionar à trilha/i }));

    // Na trilha, ambos exibem badge "Conflito de horário"
    const conflictBadges = screen.getAllByText(/Conflito de horário/i);
    expect(conflictBadges.length).toBeGreaterThanOrEqual(2);

    // Edita o horário do bloco criado para 22:40 -> deve ir para o final da lista e eliminar o conflito
    await user.click(
      screen.getByRole('button', { name: /Editar bloco Bloco conflitante matinal/i }),
    );
    fireEvent.change(screen.getByLabelText(/Horário sugerido/i), { target: { value: '22:40' } });
    await user.click(screen.getByRole('button', { name: /Salvar alterações/i }));

    expect(screen.queryByText(/Conflito de horário/i)).not.toBeInTheDocument();
    const timelineHeadings = screen
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
    expect(timelineHeadings[timelineHeadings.length - 1]).toBe('Bloco conflitante matinal');
  });

  it('suporta navegação por setas nas abas, atalhos Alt+1/2/3/N e sincroniza virada de data em visibilitychange ([REV-06], [REV-07], [REV-09])', async () => {
    // Prepara estado salvo do dia anterior com 1 bloco concluído
    const oldState = createDefaultState('2020-05-10');
    oldState.blocks[0].status = 'concluido';
    oldState.blocks[0].completedMode = 'essencial';
    localStorage.setItem('cadencia:app-state:v1', JSON.stringify(oldState));

    const user = userEvent.setup();
    render(<App />);

    // Navegação por setas nas abas
    const todayTab = screen.getByRole('tab', { name: /Orientação de Hoje/i });
    todayTab.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /Planejar Rotina/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    // Atalho Alt+3 abre Ritmo & Backup e exibe histórico formatado em PT-BR (10/05/2020 e Sustentável)
    fireEvent.keyDown(window, { key: '3', code: 'Digit3', altKey: true });
    expect(screen.getByRole('tab', { name: /Ritmo & Backup/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('10/05/2020')).toBeInTheDocument();
    expect(screen.getByText('Energia: Sustentável')).toBeInTheDocument();

    // Atalho Alt+1 retorna para Orientação de Hoje e Alt+N abre modal de Novo Bloco
    fireEvent.keyDown(window, { key: '1', code: 'Digit1', altKey: true });
    expect(todayTab).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(window, { key: 'n', code: 'KeyN', altKey: true });
    expect(screen.getByRole('heading', { name: /Novo bloco de rotina/i })).toBeInTheDocument();

    // Fechar clicando no backdrop externo do <dialog>
    const dialog = document.querySelector('dialog.routine-dialog')!;
    fireEvent.click(dialog);
    expect(
      screen.queryByRole('heading', { name: /Novo bloco de rotina/i }),
    ).not.toBeInTheDocument();
  });

  it('recupera imediatamente o tempo real do cronômetro e virada de data ao retornar de aba congelada (visibilitychange) ([REV-03], [REV-06])', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-25T07:35:00'));

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Iniciar cronômetro/i }));
    expect(screen.getByRole('timer')).toHaveTextContent('25:00');

    // Simula congelamento de segundo plano: Date.now() salta 10 min sem nenhum tick de setInterval
    vi.setSystemTime(new Date('2026-11-25T07:45:00'));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(screen.getByRole('timer')).toHaveTextContent('15:00');

    // Conclui o bloco atual hoje e simula virada de meia-noite com a aba aberta
    fireEvent.click(screen.getByRole('button', { name: /^Concluir bloco$/i }));
    vi.setSystemTime(new Date('2026-11-26T07:30:00'));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // No novo dia, o progresso volta a 0% e o dia 25/11/2026 foi arquivado no histórico
    expect(
      screen.getByRole('progressbar', { name: /Progresso de blocos concluídos hoje/i }),
    ).toHaveAttribute('aria-valuenow', '0');

    fireEvent.click(screen.getByRole('tab', { name: /Ritmo & Backup/i }));
    expect(screen.getByText('25/11/2026')).toBeInTheDocument();
  });

  it('aciona recalibração por Alt+R com Desfazer e move foco para "Novo bloco" ao excluir o único bloco ([REV-02], [REV-05], [REV-09])', async () => {
    const singleBlockState = createDefaultState('2026-11-25');
    singleBlockState.blocks = [singleBlockState.blocks[0]];
    saveRoutineState(singleBlockState);

    const user = userEvent.setup();
    render(<App />);

    // Simula 11:00 e aciona Alt+R para recalibrar o único bloco
    fireEvent.change(screen.getByLabelText(/Simular horário:/i), { target: { value: '11:00' } });
    fireEvent.keyDown(window, { key: 'r', code: 'KeyR', altKey: true });
    expect(screen.getByRole('status')).toHaveTextContent(/Horários recalibrados/i);

    // Desfaz recalibração voltando ao horário original (07:30)
    await user.click(screen.getByRole('button', { name: /Desfazer/i }));
    expect(screen.getByRole('status')).toHaveTextContent(/Horários anteriores restaurados/i);

    // Excluir o único bloco move o foco para o botão "Novo bloco"
    const newBlockBtn = screen.getByRole('button', { name: /Novo bloco/i });
    const deleteOnlyBtn = screen.getByRole('button', {
      name: /Excluir bloco Abertura da manhã sem telas/i,
    });
    await user.click(deleteOnlyBtn);
    expect(newBlockBtn).toHaveFocus();
  });
});

