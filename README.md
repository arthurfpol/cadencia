# Cadência — Orientação de Rotina Diária

Aplicativo nativo Windows e web 100% offline de orientação de rotina diária construído com **Electron + React 19 + TypeScript 7 + Vite 8 + Vitest**, projetado para guiar transições, destravar o início de atividades e adaptar o ritmo do dia conforme o nível real de energia.

## Principais Recursos
- **Bússola do Agora**: painel protagonista que destaca o bloco atual ou próximo, exibe o **Gatilho de Início (2 minutos)**, oferece **Alternativa de Piso Mínimo**, checklist de micro-passos e notas rápidas de contexto.
- **Assistente "Travei / Difícil começar"**: destravamento imediato com *Começar só por 2 min*, *Ponte de respiração (1 min)* ou *Usar piso mínimo neste bloco*.
- **Cronômetro Guiado sem Drift (`Date.now()`)**: mantém precisão mesmo com aba em segundo plano, preserva a contagem ao navegar entre seções (com indicador ao vivo na aba), anuncia término de forma acessível (`aria-live="polite"`) e permite ajustes `- 5 min` / `+ 5 min`.
- **Adaptação por Energia do Dia**: alterna entre *Energia Plena (100%)*, *Ritmo Sustentável (80%)* e *Modo Essencial (Piso Mínimo)*.
- **Retomada Gentil e Recalibração**: identifica blocos pendentes de horários anteriores oferecendo **Retomar de agora (pular anteriores)** ou **Recalibrar horários**, com suporte a **Desfazer** no toast.
- **Trilha do Dia & Detecção de Conflitos**: filtros por turno (*Manhã*, *Tarde*, *Noite*), alerta de sobreposição de horários, duplicação rápida, reordenação acessível por teclado e edição em modal `<dialog>` nativo.
- **Modelos, Leitura de Ritmo & Portabilidade JSON**: quatro modelos iniciais em português brasileiro, diagnóstico honesto de carga e atrito por turno, histórico local automático na virada de dia e exportação/importação JSON sanitizada.
- **Direção Visual "Letreiro de Sódio" (Noturno & Neblina)**: estética cyberpunk tátil em base violeta-tinta (`#130f22`), painéis chanfrados, mostrador de cronômetro LCD com dígitos fantasma, trilha com nós em losango, fontes embarcadas localmente (`Chakra Petch`, `IBM Plex Sans`, `JetBrains Mono`), contrastes WCAG AA/AAA e respeito a `prefers-reduced-motion`.

## Arquitetura de Agentes Especializados
O projeto inclui dois agentes em [`.agents/agents/`](./.agents/agents/) documentados em [`AGENTS.md`](./AGENTS.md):
- **Agente Revisor** ([`.agents/agents/agente-revisor.md`](./.agents/agents/agente-revisor.md)) → Relatório em [`docs/relatorio-revisor.md`](./docs/relatorio-revisor.md).
- **Agente Editor** ([`.agents/agents/agente-editor.md`](./.agents/agents/agente-editor.md)) → Registro de melhorias em [`docs/melhorias-editor.md`](./docs/melhorias-editor.md).

## App nativo (Windows, offline)

O **Cadência** roda nativamente no Windows via Electron, sem acesso externo à rede (todas as fontes e ativos são embarcados no pacote e o `localStorage` persiste localmente no diretório de dados do aplicativo).

```powershell
# Executar o app nativo em modo desenvolvimento (hot reload local)
npm run desktop:dev

# Compilar e abrir a janela nativa em produção local
npm run desktop

# Gerar executável portátil e instalador Windows (saída em release/)
npm run dist:win
```

Após `npm run dist:win`, os binários são gravados em `release/`:
- Portátil / instalador NSIS: `release/Cadencia-1.0.0-x64.exe` (e pacote desempacotado em `release/win-unpacked/Cadência.exe`).

## Comandos do Projeto

```powershell
# Instalar dependências
npm install

# Iniciar servidor local de desenvolvimento (web)
npm run dev

# Executar verificação estática (oxlint)
npm run lint

# Executar suíte de testes automatizados (Vitest + Testing Library)
npm test

# Gerar build de produção com checagem estrita TypeScript
npm run build
```
