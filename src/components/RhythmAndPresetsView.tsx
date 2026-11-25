import { Check, Download, RotateCcw, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { ROUTINE_PRESETS } from '../data/presets';
import type { DailyHistoryEntry, RoutinePreset } from '../types/routine';
import {
  formatDateKeyPtBr,
  formatEnergyLabel,
  type RoutineInsights,
} from '../utils/routineEngine';

interface PresetsViewProps {
  activePresetId: string;
  onApplyPreset: (preset: RoutinePreset) => void;
  onResetTodayStatuses: () => void;
  onSortChronologically: () => void;
}

export function PresetsPlannerView({
  activePresetId,
  onApplyPreset,
  onResetTodayStatuses,
  onSortChronologically,
}: PresetsViewProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  return (
    <div className="section-stack">
      <section className="timeline-panel" aria-labelledby="presets-heading">
        <div className="timeline-header">
          <div>
            <h2 id="presets-heading" className="section-heading">
              Modelos de orientação de rotina
            </h2>
            <p className="section-subtitle">
              Escolha uma estrutura inicial como ponto de partida e adapte os blocos conforme sua
              realidade.
            </p>
          </div>
          <div className="header-action-row">
            <button type="button" className="btn btn-secondary" onClick={onSortChronologically}>
              Ordenar por horário
            </button>
            <button type="button" className="btn btn-ghost" onClick={onResetTodayStatuses}>
              <RotateCcw size={15} aria-hidden="true" />
              <span>Reiniciar marcações de hoje</span>
            </button>
          </div>
        </div>

        <div className="presets-grid">
          {ROUTINE_PRESETS.map((preset) => {
            const isCurrent = preset.id === activePresetId;
            const isConfirming = confirmingId === preset.id;

            return (
              <article
                key={preset.id}
                className={`preset-card ${isCurrent ? 'preset-card-active' : ''}`}
              >
                <div>
                  <div className="preset-card-header">
                    <h3 className="preset-card-title">{preset.name}</h3>
                    {isCurrent ? (
                      <span className="badge badge-done">
                        <Check size={12} aria-hidden="true" />
                        <span>Base atual</span>
                      </span>
                    ) : null}
                  </div>
                  <p className="preset-card-subtitle">{preset.subtitle}</p>
                  <p className="preset-card-meta">
                    Indicado para: {preset.recommendedFor} ({preset.blocks.length} blocos)
                  </p>
                </div>

                {isConfirming ? (
                  <div className="preset-confirm-box">
                    <span className="preset-confirm-title">
                      Substituir os blocos atuais por &ldquo;{preset.name}&rdquo;?
                    </span>
                    <div className="preset-confirm-actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                          onApplyPreset(preset);
                          setConfirmingId(null);
                        }}
                      >
                        Confirmar troca
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setConfirmingId(null)}
                      >
                        Manter atual
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={isCurrent ? 'btn btn-secondary' : 'btn btn-primary'}
                    onClick={() => setConfirmingId(preset.id)}
                  >
                    {isCurrent ? 'Restaurar este modelo' : 'Aplicar modelo'}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

interface RhythmViewProps {
  insights: RoutineInsights;
  dailyReflection: string;
  onChangeReflection: (text: string) => void;
  history: DailyHistoryEntry[];
  onExportJson: () => void;
  onImportJsonText: (raw: string) => boolean;
}

const PERIOD_NAMES = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
};

export function RhythmReviewView({
  insights,
  dailyReflection,
  onChangeReflection,
  history,
  onExportJson,
  onImportJsonText,
}: RhythmViewProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const ok = onImportJsonText(text);
      if (!ok) {
        setImportError(
          'O arquivo selecionado não contém uma rotina válida do Cadência. Seus dados atuais foram preservados.',
        );
      } else {
        setImportError(null);
      }
    } catch {
      setImportError(
        'Não foi possível ler o arquivo selecionado. Seus dados atuais continuam salvos.',
      );
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="section-stack">
      <section aria-labelledby="metrics-heading">
        <h2 id="metrics-heading" className="section-heading-spaced">
          Leitura honesta do ritmo de hoje
        </h2>

        <div className="metrics-strip">
          <div className="metric-box">
            <div className="metric-value">
              {insights.completedBlocks}/{insights.totalBlocks}
            </div>
            <div className="metric-label">
              Blocos concluídos hoje ({insights.completionRate}%)
            </div>
          </div>

          <div className="metric-box">
            <div className="metric-value">{insights.completedEssentialBlocks}</div>
            <div className="metric-label">Concluídos pelo piso mínimo</div>
          </div>

          <div className="metric-box">
            <div className="metric-value">{insights.remainingMinutes} min</div>
            <div className="metric-label">Carga estimada restante hoje</div>
          </div>

          <div className="metric-box">
            <div className="metric-value">
              {insights.frictionPeriod ? PERIOD_NAMES[insights.frictionPeriod] : 'Sem atrito'}
            </div>
            <div className="metric-label">
              {insights.frictionPeriod
                ? 'Turno com mais blocos pulados hoje'
                : 'Nenhum turno com pulos acumulados'}
            </div>
          </div>
        </div>
      </section>

      <section className="timeline-panel" aria-labelledby="reflection-heading">
        <h2 id="reflection-heading" className="section-heading">
          Registro de fechamento do dia
        </h2>
        <p className="section-subtitle">
          Anote em uma ou duas frases o que ajudou seu ritmo hoje ou qual bloco merece ficar mais
          simples amanhã.
        </p>

        <div className="reflection-field">
          <label htmlFor="campo-reflexao-diaria" className="field-label">
            Observação de hoje (salva localmente neste navegador)
          </label>
          <textarea
            id="campo-reflexao-diaria"
            rows={3}
            className="form-textarea"
            placeholder="Ex.: O bloco de foco funcionou melhor após deixar o celular longe; à tarde precisei do piso mínimo."
            value={dailyReflection}
            onChange={(e) => onChangeReflection(e.target.value)}
          />
        </div>
      </section>

      <section className="timeline-panel" aria-labelledby="history-heading">
        <h2 id="history-heading" className="section-heading">
          Histórico recente guardado neste dispositivo
        </h2>
        {history.length === 0 ? (
          <p className="history-empty">
            Os dias anteriores aparecem automaticamente aqui na virada de data quando houver blocos
            registrados.
          </p>
        ) : (
          <ul className="timeline-list">
            {history.map((item) => (
              <li key={item.dateKey} className="timeline-item">
                <div className="timeline-item-top">
                  <span className="timeline-time">{formatDateKeyPtBr(item.dateKey)}</span>
                  <span className="badge badge-neutral">
                    Energia: {formatEnergyLabel(item.energy)}
                  </span>
                </div>
                <p className="history-summary">
                  {item.completedFull + item.completedEssential} de {item.totalBlocks} concluídos (
                  {item.completedEssential} pelo piso mínimo, {item.skipped} pulados)
                </p>
                {item.reflection ? (
                  <p className="history-reflection">&ldquo;{item.reflection}&rdquo;</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="timeline-panel" aria-labelledby="backup-heading">
        <h2 id="backup-heading" className="section-heading">
          Portabilidade e cópia de segurança (JSON)
        </h2>
        <p className="section-subtitle">
          Seus dados ficam somente no armazenamento local do navegador. Exporte um arquivo JSON para
          guardar cópia ou transferir sua rotina.
        </p>

        {importError ? (
          <div role="alert" className="error-summary">
            {importError}
          </div>
        ) : null}

        <div className="backup-actions">
          <button type="button" className="btn btn-secondary" onClick={onExportJson}>
            <Download size={16} aria-hidden="true" />
            <span>Exportar rotina (.json)</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={16} aria-hidden="true" />
            <span>Importar arquivo (.json)</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={handleFileChange}
          />
        </div>
      </section>
    </div>
  );
}
