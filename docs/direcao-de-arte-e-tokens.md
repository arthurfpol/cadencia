# Direção de Arte, Tokens e Contrato de Conteúdo — Cadência

## 1. Briefing do Produto
- **Produto**: **Cadência** — Aplicativo de Orientação de Rotina Diária.
- **Público**: Estudantes, profissionais em trabalho remoto/híbrido e pessoas que buscam estruturar o dia sem rigidez punitiva, especialmente em momentos de oscilação de energia ou dificuldade de transição entre atividades.
- **Trabalho principal da interface**: Responder imediatamente *"Qual é meu próximo gesto agora?"*, guiar a execução passo a passo com cronômetro gentil e adaptar toda a rotina ao nível real de energia do dia (*Energia Plena*, *Ritmo Sustentável* ou *Modo Essencial*).
- **Ação principal**: Iniciar ou avançar o bloco atual na **Bússola do Agora**, ou recalibrar os horários restantes a partir do momento presente sem sensação de atraso.

## 2. Comparação de Direções Visuais
1. **Direção A — Carta Costeira & Papel Mineral (Escolhida)**: Inspirada em cadernos náuticos de navegação e agendas suíças funcionais. Superfície mineral fria (`#F3F6F8`), cartões estruturados com hierarquia real (painel-guia principal destacado com indicador lateral âmbar-solar e trilho cronológico limpo ao lado), azul-petróleo oceânico (`#0B5D6B`) para ações primárias e tipografia humanista com algarismos tabulares (`Bricolage Grotesque` + `Source Sans 3`). Transmite calma, orientação espacial no tempo e precisão acolhedora.
2. **Direção B — Painel Cronométrico Industrial Escuro (Descartada)**: Visual de laboratório/terminal com alto contraste ácido e contadores densos. Descartada por reforçar ansiedade de desempenho e urgência mecânica, contrariando a proposta de orientação sustentável de rotina.

## 3. Tabela de Pares de Cor e Contraste Medido (MCP `web-design-toolbox/wcag_contrast`)
| Papel Semântico | Tema Claro (Texto / Fundo) | Contraste Claro | Tema Escuro (Texto / Fundo) | Contraste Escuro | Critério WCAG 2 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Texto primário sobre fundo | `#102330` / `#F3F6F8` | **14,83:1** (AAA) | `#EBF2F7` / `#0C1720` | **16,03:1** (AAA) | >= 4,5:1 |
| Texto secundário sobre superfície | `#3E5566` / `#F3F6F8` | **7,18:1** (AAA) | `#A9C0D1` / `#132330` | **8,51:1** (AAA) | >= 4,5:1 |
| Ação primária (botão) | `#FFFFFF` / `#0B5D6B` | **7,52:1** (AAA) | `#072029` / `#4CC3D6` | **8,08:1** (AAA) | >= 4,5:1 |
| Destaque de bloco em foco (âmbar) | `#8A4300` / `#FFF5E6` | **6,75:1** (AA) | `#FFD18A` / `#31200C` | **10,98:1** (AAA) | >= 4,5:1 |
| Status concluído (verde-pinho) | `#145938` / `#E8F6EE` | **7,49:1** (AAA) | `#8CE6B6` / `#112D21` | **9,80+:1** (AAA) | >= 4,5:1 |
| Status de erro / atenção | `#A11B1B` / `#FDF0F0` | **7,03:1** (AAA) | `#FFADB3` / `#321417` | **9,52:1** (AAA) | >= 4,5:1 |

*Nota*: Todos os estados comunicam função por rótulo textual e ícone semântico além da cor.

## 4. Escala Tipográfica Modular (MCP `web-design-toolbox/type_scale`, base 16px, razão 1,22)
- `--font-display`: `'Bricolage Grotesque', system-ui, -apple-system, 'Segoe UI', sans-serif` (títulos, saudação temporal, relógio e marcador de cronômetro com `tabular-nums`).
- `--font-body`: `'Source Sans 3', system-ui, -apple-system, 'Segoe UI', sans-serif` (corpo, passos acionáveis, formulários e notas).
- Escala aplicada:
  - `--type-xs`: `0.82rem` (~13.1px) — metadados curtos, contadores auxiliares.
  - `--type-sm`: `0.92rem` (~14.7px) — controles compactos, ajuda contextual.
  - `--type-base`: `1rem` (16px) — leitura principal, inputs (evita zoom forçado no iOS), passos.
  - `--type-md`: `1.22rem` (~19.5px) — títulos de blocos da rotina.
  - `--type-lg`: `1.49rem` (~23.8px) — cabeçalhos de seção.
  - `--type-xl`: `1.82rem` (~29.1px) — título do bloco ativo na Bússola do Agora.
  - `--type-2xl`: `2.22rem` (~35.5px) — mostrador do cronômetro guiado e saudação principal.

## 5. Arquitetura de Layout (Wireframe Estrutural)
```text
+-------------------------------------------------------------------------+
| Cabeçalho: Marca Cadência | Relógio Local | Energia do Dia | Tema       |
+-------------------------------------------------------------------------+
| Navegação de Vistas: [ Orientação de Hoje ] [ Planejar Rotina ] [ Ritmo ]|
+------------------------------------+------------------------------------+
| Coluna Principal (Bússola do Agora)| Coluna Lateral (Trilha do Dia)     |
| - Bloco atual ou próximo sugerido  | - Resumo de progresso + Recalibrar |
| - Gatilho de início (2 minutos)    | - Filtro: Todos / Manhã / Tarde /  |
| - Piso Mínimo vs. Versão Completa  |   Noite                            |
| - Passos interativos (checklist)   | - Linha do tempo ordenada com      |
| - Cronômetro calmo (+5m / Pausar)  |   estados claros e ação direta     |
| - Registro rápido de transição     |                                    |
+------------------------------------+------------------------------------+
```
Alinhamento predominantemente à esquerda para leitura rápida de sequências temporais, largura de linha limitada a 68ch nos textos descritivos e adaptação limpa em coluna única abaixo de `960px` (incluindo `390x844` e `320px`).

## 6. Glossário Mínimo de UX Writing (PT-BR)
- **Bloco de rotina**: unidade de tempo com intenção clara (nunca "tarefa avulsa").
- **Gatilho de início**: primeira ação física simples (até 2 min) que destrava o começo do bloco.
- **Piso mínimo**: versão essencial reduzida do bloco para dias de baixa energia, preservando a continuidade.
- **Recalibrar horários**: ajustar os blocos pendentes a partir do horário atual sem mensagens punitivas.

---

## 7. v3 — Letreiro de Sódio (Cyberpunk Tátil, 100% Offline)

Na v3, o **Cadência** foi portado para aplicativo desktop nativo Windows (Electron) 100% offline com fontes embarcadas via `@fontsource` (`Chakra Petch`, `IBM Plex Sans` e `JetBrains Mono`) e direção visual **Letreiro de Sódio**:
- **Temas**: **Noturno** (padrão, base violeta-tinta `#130f22` em vez de preto puro, âmbar de sódio `#ffb224` para ação/foco atual, ciano `#52e0ff` para dados e cronômetro LCD, magenta `#ff5c93` para alertas/conflitos) e **Neblina** (variação diurna sobre `#ece8f4` / `#f6f3fb`).
- **Geometria e detalhes táteis**: painéis chanfrados (`clip-path`), trilha do dia com nós em losango, barra de progresso segmentada em blocos discretos, mostrador LCD com dígitos fantasma (`88:88`) e barra de título nativa integrada (`titleBarOverlay`).

### Tabela de Contraste Medido (v3, MCP `web-design-toolbox/wcag_contrast`)

| Papel Semântico | Noturno (Texto / Fundo) | Contraste Noturno | Neblina (Texto / Fundo) | Contraste Neblina |
| :--- | :--- | :--- | :--- | :--- |
| Texto primário | `#EEE8FF` / `#130F22` | **15,75:1** (AAA) | `#1A1530` / `#F6F3FB` | **16,1:1** (AAA) |
| Texto secundário em painel | `#A89BC9` / `#1B1630` | **6,81:1** (AA) | `#4A4166` / `#F6F3FB` | **8,54:1** (AAA) |
| Botão primário (âmbar sódio) | `#1A1206` / `#FFB224` | **10,28:1** (AAA) | `#1A1206` / `#FFB224` | **10,28:1** (AAA) |
| Alerta / conflito (magenta) | `#FF5C93` / `#1B1630` | **5,98:1** (AA) | `#B0145A` / `#F6F3FB` | **6,18:1** (AA) |
| Tempo e dados (ciano) | `#52E0FF` / `#1B1630` | **11,18:1** (AAA) | `#006A84` / `#F6F3FB` | **5,64:1** (AA) |
| Destaque âmbar suave | `#FFC964` / `#2A1E05` | **10,72:1** (AAA) | `#7A4A00` / `#FFF1D6` | **6,70:1** (AA) |
