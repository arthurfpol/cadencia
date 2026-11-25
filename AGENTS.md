# Arquitetura de Agentes e Diretrizes do Projeto — Cadência

Este projeto conta com um fluxo colaborativo de melhoria contínua composto por **dois agentes especializados** em `.agents/agents/`:

1. **`agente-revisor`** ([`.agents/agents/agente-revisor.md`](./.agents/agents/agente-revisor.md)):
   - **Responsabilidade**: Auditoria independente (somente leitura) cobrindo ergonomia cognitiva de orientação de rotina, acessibilidade funcional (teclado, foco, ARIA, contraste), responsividade (`320px` a `1440px`), casos de borda de estado/tempo e qualidade de código React 19 + TypeScript.
   - **Artefato gerado**: `docs/relatorio-revisor.md`.

2. **`agente-editor`** ([`.agents/agents/agente-editor.md`](./.agents/agents/agente-editor.md)):
   - **Responsabilidade**: Implementação estruturada das melhorias e correções apontadas pelo `agente-revisor`, ampliação de testes automatizados com Vitest e verificação de `npm run lint`, `npm test` e `npm run build`.
   - **Artefato gerado**: `docs/melhorias-editor.md`.

## Fluxo Recomendado de Evolução
1. Executar `agente-revisor` sobre o estado atual do código e das capturas em `qa/`.
2. Revisar os itens priorizados em `docs/relatorio-revisor.md`.
3. Executar `agente-editor` com os arquivos-alvo e critérios de aceite definidos.
4. Rodar nova verificação do `agente-revisor` e auditoria visual em navegador antes de concluir.
