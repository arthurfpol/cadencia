# Registro de Melhorias Implementadas — Cadência (v1 → v2)

> Documentação emitida pelo **Agente Editor** consolidando a resolução integral dos 10 itens (`[REV-01]` a `[REV-10]`) especificados em `docs/relatorio-revisor.md`, mantendo a direção de arte **Carta Costeira & Papel Mineral**, compatibilidade estrita com React 19 + TypeScript 7 (`verbatimModuleSyntax`, `erasableSyntaxOnly`) e zero avisos/erros no `oxlint`.

---

## 1. Rastreabilidade por Item do Revisor

### `[REV-01]` — Semântica ARIA em `.timer-module`, anúncio em `00:00` e rótulo único no simulador
- **Arquivos alterados**: `src/components/NowCompass.tsx`, `src/components/HeaderBar.tsx`, `src/App.tsx`
- **O que foi implementado**:
  1. Substituído `aria-label` em `<div className="timer-module">` por `<div className="timer-module" role="group" aria-labelledby="timer-group-label">`, vinculando ao `<span id="timer-group-label" className="field-label">Tempo restante sugerido</span>` e eliminando `aria-prohibited-attr` do `axe`.
  2. Quando o cronômetro chega a `00:00`, o callback `onTimerComplete` em `App.tsx` anuncia o término via região `role="status" aria-live="polite"` (`.toast-status`) e atualiza o texto de estado `aria-live="polite"` dentro do módulo do cronômetro.
  3. Removido o `aria-label` redundante/conflitante de `#simular-horario` em `HeaderBar.tsx`, mantendo exclusivamente `<label htmlFor="simular-horario">Simular horário:</label>`.

### `[REV-02]` — Contrato completo de foco em `<dialog>`, Bússola, Trilha e `skip-link`
- **Arquivos alterados**: `src/App.tsx`, `src/components/BlockFormModal.tsx`, `src/components/NowCompass.tsx`, `src/components/DayTimeline.tsx`, `src/styles/app.css`
- **O que foi implementado**:
  1. `modalTriggerRef` registrado em `App.tsx` ao abrir o modal de criação/edição e restaurado automaticamente no fechamento ou salvamento de `BlockFormModal.tsx`.
  2. Em `BlockFormModal.tsx`, foco inicial automático em `#campo-titulo` ao abrir; foco determinístico ao clicar nos links de `.error-summary` (`document.getElementById(fieldIdMap[key])?.focus()`); fechamento ao clicar no backdrop externo (`e.target === dialogRef.current`).
  3. Na `NowCompass.tsx`, concluir ou pular um bloco move o foco para o título `<h2>` (`tabIndex={-1}`) do próximo bloco guiado ou da tela de ciclo encerrado. Na `DayTimeline.tsx`, excluir um item move o foco para o primeiro botão interativo do bloco vizinho ou para o botão `Novo bloco` quando a lista fica vazia.
  4. Adicionado `tabIndex={-1}` em `<main id="conteudo-principal">`.

### `[REV-03]` — Cronômetro baseado em `Date.now()` imune a throttling e preservado entre abas
- **Arquivos alterados**: `src/utils/useBlockTimer.ts` (novo), `src/App.tsx`, `src/components/NowCompass.tsx`, `src/styles/app.css`
- **O que foi implementado**:
  1. Criado hook `useBlockTimer` calculando tempo restante real por `endTimestampMs = Date.now() + secondsToRun * 1000`, sincronizado por `setInterval(250ms)` e listeners de `visibilitychange` e `focus`, sem qualquer `setState` síncrono em `useEffect` (derivação pura durante o render).
  2. Estado do cronômetro elevado para `App.tsx`, preservando a contagem ao alternar entre `Orientação de Hoje`, `Planejar Rotina` e `Ritmo & Backup`, com badge compacto `.tab-timer-badge` na aba `Orientação de Hoje` quando o cronômetro roda em segundo plano.
  3. Mudanças no nível de energia atualizam automaticamente o tempo sugerido apenas quando o cronômetro está `idle` (não iniciado nem pausado/ajustado manualmente).

### `[REV-04]` — Tratamento inteligente de horários anteriores, `recalibrateScheduleFromNow` sem empilhamento em `23:55` e `formatEndTime` real
- **Arquivos alterados**: `src/utils/routineEngine.ts`, `src/App.tsx`, `src/styles/app.css`
- **O que foi implementado**:
  1. `formatEndTime` agora aplica aritmética modular `((rawEnd % 1440) + 1440) % 1440`, exibindo corretamente janelas que cruzam a meia-noite (ex.: `23:30` + `45 min` → `00:15`).
  2. `findGuidedBlock` ordena cronologicamente os blocos pendentes antes de selecionar a atividade atual/próxima.
  3. `recalibrateScheduleFromNow` preserva intacto o `startTime` de qualquer bloco já `'em_andamento'` (posicionando os pendentes seguintes após o término dele + buffer) e não empilha excedentes em `23:55`, reagendando apenas blocos que caibam antes de `24:00` e reportando `overflowedDayEnd` + `overflowCount`.
  4. `computeRoutineInsights` expõe `overduePendingCount` com prioridade sobre a soma bruta de minutos passados, e `.guidance-banner` oferece **Retomar de agora (pular anteriores)** (`dismissOverdueBlocks`) ao lado de **Recalibrar horários**.

### `[REV-05]` — Desfazer (`Undo`) no Toast para ações sensíveis
- **Arquivos alterados**: `src/App.tsx`, `src/styles/app.css`
- **O que foi implementado**:
  1. Toast enriquecido com suporte a `onUndo` e janela de visibilidade estendida para `7000ms` quando há ação reversível (`4200ms` para avisos informativos).
  2. Botão **Desfazer** disponível ao excluir bloco, duplicar bloco, recalibrar horários, pular blocos anteriores (*Retomar de agora*) e reiniciar marcações de hoje.

### `[REV-06]` — Sincronização em `visibilitychange`, reordenação ao editar horário e sanitização reforçada
- **Arquivos alterados**: `src/utils/storage.ts`, `src/App.tsx`
- **O que foi implementado**:
  1. Em `storage.ts`: `inferPeriodFromTime(item.startTime)` como fallback de `period`, deduplicação de IDs de blocos e micro-passos com `Set<string>`, invariante de no máximo 1 bloco `'em_andamento'`, deduplicação de datas no histórico e extração da função pura `rollOverDayIfNeeded`.
  2. Em `App.tsx`: listeners de `visibilitychange` e `focus` atualizam o relógio e executam `rollOverDayIfNeeded` ao retornar à aba após virada de data; edição de `startTime` em um bloco existente reordena cronologicamente a trilha.

### `[REV-07]` — Refinamento visual, `color-scheme`, layout sem órfãos, reflow móvel e zero estilos inline estáticos
- **Arquivos alterados**: `src/styles/tokens.css`, `src/styles/app.css`, `src/App.tsx`, `src/components/HeaderBar.tsx`, `src/components/NowCompass.tsx`, `src/components/DayTimeline.tsx`, `src/components/BlockFormModal.tsx`, `src/components/RhythmAndPresetsView.tsx`, `src/utils/routineEngine.ts`
- **O que foi implementado**:
  1. `color-scheme: light` e `color-scheme: dark` declarados em `src/styles/tokens.css`; `.compass-panel` configurado como `position: sticky` no desktop (`min-width: 961px`).
  2. `.timeline-item-actions` reorganizado em `.timeline-primary-actions` e `.timeline-utility-actions` (com botões de ícone `.btn-icon` `34x34px` e variante `.btn-icon-danger`), eliminando o ícone de lixeira órfão em `1440px`, ocultando `Guiar agora` quando o card já está na Bússola (`Na bússola` vs `Em andamento`) e sinalizando `Horário anterior` (`.badge-overdue`) nos pendentes vencidos.
  3. `.time-simulator-group` com `flex-wrap: wrap` fluido até `320px` e `#intencao-diaria` convertido para `<textarea>` autoajustável de frase única sem truncamento em telas móveis (`390px`/`320px`).
  4. Datas no formato `DD/MM/AAAA` (`formatDateKeyPtBr`) e rótulos legíveis de energia (`formatEnergyLabel`) no histórico em `RhythmAndPresetsView.tsx`.
  5. Removidos todos os estilos inline estáticos de todos os componentes `.tsx` em favor de classes semânticas em `src/styles/app.css`, padronizando `.compass-outcome-bar` e `.sr-only`.

### `[REV-08]` — Assistente "Travei / Difícil começar" e ajuste `- 5 min` no cronômetro
- **Arquivos alterados**: `src/components/NowCompass.tsx`, `src/utils/useBlockTimer.ts`, `src/types/routine.ts`, `src/styles/app.css`
- **O que foi implementado**:
  1. Assistente expansível `"Travei / Difícil começar"` (`aria-expanded`, `aria-controls="painel-destravar"`) na `NowCompass` com 3 ações imediatas de baixo atrito: **Começar só por 2 min**, **Ponte de respiração (1 min)** e **Usar piso mínimo neste bloco**, acompanhadas de badge contextual e feedback acolhedor.
  2. Adicionado controle `- 5 min` no cronômetro com piso seguro de `01:00` (`disabled` quando `secondsLeft <= 60`).

### `[REV-09]` — Detecção de conflitos de horário, Barra de Progresso do Dia, Duplicação de Bloco e Atalhos `Alt`
- **Arquivos alterados**: `src/utils/routineEngine.ts`, `src/components/DayTimeline.tsx`, `src/components/BlockFormModal.tsx`, `src/App.tsx`, `src/styles/app.css`
- **O que foi implementado**:
  1. `detectScheduleConflicts` e `findDraftConflicts` em `routineEngine.ts`, exibindo `.badge-alert` (`Conflito de horário`) + detalhe de sobreposição na `DayTimeline` e aviso preventivo não bloqueante `.conflict-warning` no `BlockFormModal`.
  2. Barra visual `.day-progress-summary` com `role="progressbar"` (`aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext`) na navegação principal.
  3. Botão `Duplicar bloco` (`Copy`) em cada item da `DayTimeline` com sugestão inteligente de encaixe após o bloco original e suporte a `Desfazer`.
  4. Atalhos seguros `Alt+N` (Novo bloco), `Alt+R` (Recalibrar horários) e `Alt+1/2/3` (Alternar abas), documentados em `<footer className="app-footer">`.

### `[REV-10]` — Suíte Abrangente de Testes Automatizados
- **Arquivos alterados**: `src/test/engineAndStorage.test.ts` (novo), `src/test/routineApp.test.tsx`
- **O que foi implementado**:
  - **18 testes automatizados** distribuídos em 2 suítes (`9` testes unitários de motor/armazenamento + `9` testes integrados de interface/acessibilidade/foco/timers), cobrindo integralmente todos os requisitos de `[REV-01]` a `[REV-09]`.

---

## 2. Verificações Executadas

| Comando | Resultado | Detalhes |
| --- | --- | --- |
| `npm run lint` | Código `0` | `oxlint`: **0 warnings e 0 errors** em 16 arquivos (116 regras) |
| `npm test` | Código `0` | `vitest run`: **2 suítes aprovadas, 18 testes aprovados** |
| `npm run build` | Código `0` | `tsc -b && vite build`: compilação TypeScript 7 e bundle de produção gerados sem erros |
