# Relatório de Auditoria Independente e Especificação de Evolução — Cadência (v1 → v2)

> Emitido pelo **Agente Revisor (`agente-revisor`)** após inspeção integral do código-fonte v1, `qa/v1/audit.json` e capturas em `390x844`, `768x1024` e `1440x900`.

## 1. Resumo Executivo

A versão 1 do **Cadência — Orientação de Rotina Diária** apresenta uma fundação arquitetural e estética consistente:
- **Pontos fortes comprovados**: direção de arte *Carta Costeira & Papel Mineral* serena e autoral (`src/styles/tokens.css`, `docs/direcao-de-arte-e-tokens.md`), contrastes medidos em nível AA/AAA nos temas claro e escuro, zero violações diretas no `axe` em `390px`, `768px` e `1440px` (`qa/v1/audit.json`), zero overflow horizontal nas três capturas iniciais, vocabulário acolhedor em PT-BR (*gatilho de início*, *piso mínimo*, *recalibrar*) e separação clara entre motor puro (`routineEngine.ts`) e persistência (`storage.ts`).
- **Principais lacunas identificadas para evolução na v2**:
  1. **Semântica WAI-ARIA e gestão de foco (`[REV-01]`, `[REV-02]`)**: atributo proibido `aria-label` em `<div className="timer-module">` sem `role` (`aria-prohibited-attr` reportado no `audit.json`), ausência de anúncio acessível quando o cronômetro chega a `00:00`, conflito `label` vs `aria-label` no simulador de horário, e perda de foco ao fechar o `<dialog>`, concluir/pular blocos ou excluir itens da trilha.
  2. **Cronômetro vulnerável a throttling e perda de estado (`[REV-03]`)**: contagem baseada em decremento relativo `setInterval(..., 1000)` sofre drift quando a aba fica em segundo plano; desmontar `NowCompass` ao trocar de aba (`Planejar` / `Ritmo`) ou mudar o nível de energia destrói o cronômetro em execução.
  3. **Caso de borda real na orientação temporal (`[REV-04]`)**: quando há blocos pendentes de turnos anteriores já encerrados, `computeRoutineInsights` soma todos os minutos passados mascarando o alerta de blocos anteriores em aberto, e `recalibrateScheduleFromNow` reagenda rituais matinais para a noite e empilha múltiplos blocos excedentes às `23:55`.
  4. **Acabamento visual, exclusão sem desfazer e estilos inline (`[REV-05]`, `[REV-06]`, `[REV-07]`)**: nos cards de `desktop.png`, o botão de lixeira cai sozinho para uma segunda linha órfã; em `320px` o grupo inline do simulador de horário precisa quebrar linha suavemente; em `mobile.png` o campo de intenção diária trunca a frase; faltam `color-scheme` em `tokens.css`, proteção contra exclusão acidental (*Desfazer* no toast) e sanitização adicional em `storage.ts`.
  5. **Evoluções de orientação de rotina e cobertura de testes (`[REV-08]`, `[REV-09]`, `[REV-10]`)**: assistente *"Travei / Difícil começar"*, botão `-5 min`, detecção de conflitos de horário, barra visual de progresso do dia, duplicação rápida de bloco, atalhos `Alt` acessíveis e ampliação robusta dos testes Vitest.

---

## 2. Achados Priorizados para o Agente Editor

### `[REV-01]` — Semântica ARIA em `.timer-module`, anúncio em `00:00` e rótulo único no simulador
- **Severidade**: Alta
- **Especificação**:
  1. Em `src/components/NowCompass.tsx`, trocar `.timer-module` para `<div className="timer-module" role="group" aria-labelledby="timer-group-label">` e adicionar `id="timer-group-label"` ao rótulo `Tempo restante sugerido`.
  2. Anunciar término do cronômetro via região `role="status" aria-live="polite"` e toast informativo quando a contagem atingir `00:00`.
  3. Em `src/components/HeaderBar.tsx`, remover o `aria-label` redundante de `#simular-horario` preservando apenas o `<label htmlFor="simular-horario">Simular horário:</label>`.

### `[REV-02]` — Contrato completo de foco em `<dialog>`, Bússola, Trilha e `skip-link`
- **Severidade**: Alta
- **Especificação**:
  1. Guardar `modalTriggerRef` em `src/App.tsx` antes de abrir `BlockFormModal` e restaurar o foco ao elemento acionador ao fechar ou salvar.
  2. Em `src/components/BlockFormModal.tsx`, focar `#campo-titulo` ao abrir, fazer os links de `.error-summary` focarem deterministicamente o campo alvo no clique e permitir fechar ao clicar no backdrop externo.
  3. Mover o foco para o título `<h2>` (`tabIndex={-1}`) da `NowCompass` ao concluir/pular um bloco por ela, e mover o foco para o bloco vizinho ou botão `Novo bloco` ao excluir um item em `DayTimeline`.
  4. Adicionar `tabIndex={-1}` em `<main id="conteudo-principal">`.

### `[REV-03]` — Cronômetro baseado em `Date.now()` imune a throttling e preservado entre abas
- **Severidade**: Alta
- **Especificação**:
  1. Criar hook `src/utils/useBlockTimer.ts` consumido em `src/App.tsx` com cálculo real por `endTimestampMs = Date.now() + remainingSeconds * 1000`, sincronizado também em `visibilitychange` e `focus`.
  2. Preservar o cronômetro ativo ao alternar entre `Orientação de Hoje`, `Planejar Rotina` e `Ritmo & Backup`, exibindo badge compacto na aba `Orientação de Hoje` quando estiver rodando em outra vista.
  3. Atualizar `remainingSeconds` automaticamente ao mudar o nível de energia somente se o cronômetro ainda não tiver sido iniciado/pausado no meio.

### `[REV-04]` — Tratamento inteligente de blocos de horários anteriores, `recalibrateScheduleFromNow` sem empilhamento em `23:55` e `formatEndTime` real
- **Severidade**: Alta
- **Especificação**:
  1. `formatEndTime` deve calcular `((rawEnd % 1440) + 1440) % 1440` para exibir corretamente viradas após meia-noite (ex.: `23:30` + `45 min` → `00:15`).
  2. `findGuidedBlock` deve inspecionar blocos pendentes em ordem cronológica.
  3. `recalibrateScheduleFromNow` não deve sobrescrever o `startTime` de um bloco já `'em_andamento'` iniciado, nem colapsar múltiplos blocos excedentes em `23:55`: só reagenda blocos que caibam antes do fim do dia e informa `overflowCount` / `overflowedDayEnd` para orientar ativação do Modo Essencial ou pulo de anteriores.
  4. `computeRoutineInsights` deve expor `overduePendingCount` e oferecer no `.guidance-banner` a ação gentil **Retomar de agora (pular anteriores)** (`dismissOverdueBlocks`) ao lado de **Recalibrar horários**.

### `[REV-05]` — Desfazer (`Undo`) no Toast para exclusão, recalibração, retomada e reinício
- **Severidade**: Média
- **Especificação**:
  1. Suportar `undoAction` no toast de `App.tsx` (7 segundos de visibilidade quando houver ação de desfazer).
  2. Oferecer botão **Desfazer** ao excluir bloco, duplicar bloco, recalibrar horários, pular blocos anteriores (`Retomar de agora`) e reiniciar marcações de hoje.

### `[REV-06]` — Sincronização em `visibilitychange`, reordenação ao editar horário e sanitização reforçada
- **Severidade**: Média
- **Especificação**:
  1. Em `src/utils/storage.ts`, usar `inferPeriodFromTime` como fallback de `period`, deduplicar IDs de blocos e passos com `Set<string>`, e garantir no máximo 1 bloco `'em_andamento'`. Extrair função pura de virada de dia reutilizável.
  2. Em `src/App.tsx`, reordenar cronologicamente se o `startTime` de um bloco editado mudar, e sincronizar relógio + eventual virada de data em `visibilitychange` / `focus`.

### `[REV-07]` — Refinamento visual, `color-scheme`, layout sem órfãos em `1440px`, reflow em `320px`/`390px` e zero estilos inline estáticos
- **Severidade**: Média
- **Especificação**:
  1. Adicionar `color-scheme: light` e `color-scheme: dark` em `src/styles/tokens.css`; deixar `.compass-panel` `sticky` no desktop (`min-width: 961px`).
  2. Reorganizar `.timeline-item-actions` em `DayTimeline.tsx` (ações primárias à esquerda e ícones utilitários `.btn-icon` `34x34px` à direita com variante `.btn-icon-danger` no hover), eliminando o ícone de lixeira órfão; ocultar `Guiar agora` quando o card já está na Bússola (`Na bússola` vs `Em andamento`) e sinalizar `Horário anterior` nos pendentes vencidos.
  3. Garantir `flex-wrap` limpo em `.time-simulator-group` até `320px` e leitura completa de `#intencao-diaria` em telas móveis (`textarea` autoajustável de frase única).
  4. Formatar datas `DD/MM/AAAA` e rótulos legíveis de energia no histórico em `RhythmAndPresetsView.tsx`.
  5. Migrar estilos inline estáticos para classes semânticas em `src/styles/app.css` e padronizar `.compass-outcome-bar` + `.sr-only`.

### `[REV-08]` — Assistente "Travei / Difícil começar" e ajuste `-5 min` no cronômetro
- **Severidade**: Evolução de Produto
- **Especificação**:
  1. Adicionar botão expansível `"Travei / Difícil começar"` na `NowCompass` com 3 ações imediatas: **Começar só por 2 min**, **Ponte de respiração (1 min)** e **Usar piso mínimo neste bloco**.
  2. Adicionar botão `- 5 min` nos controles do cronômetro com mínimo seguro de `01:00`.

### `[REV-09]` — Detecção de conflitos de horário, Barra de Progresso do Dia, Duplicação de Bloco e Atalhos `Alt`
- **Severidade**: Evolução de Produto
- **Especificação**:
  1. `detectScheduleConflicts` em `routineEngine.ts`, exibindo alerta de sobreposição na `DayTimeline` e aviso preventivo não bloqueante no `BlockFormModal`.
  2. Barra visual `.day-progress-summary` com `role="progressbar"` na navegação principal.
  3. Ação `Duplicar bloco` (`Copy`) na `DayTimeline`.
  4. Atalhos seguros `Alt+N` (Novo bloco), `Alt+R` (Recalibrar), `Alt+1/2/3` (Abas), documentados em `<footer className="app-footer">`.

### `[REV-10]` — Suíte Abrangente de Testes Automatizados
- **Severidade**: Alta
- **Especificação**:
  Cobrir com Vitest + Testing Library todos os fluxos novos e críticos: cronômetro sem drift por `Date.now()` + persistência entre abas + anúncio em `00:00`, conflitos de horário, `formatEndTime` cruzando meia-noite, `recalibrateScheduleFromNow` e `dismissOverdueBlocks`, modal `<dialog>` + validação + retorno de foco, `Desfazer` (Undo) e duplicação, assistente `"Travei / Difícil começar"`, navegação por setas/atalhos `Alt` e sanitização/virada de data em `storage.ts`.
