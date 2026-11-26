import { Clock, Compass, Moon, Sun } from 'lucide-react';

interface HeaderBarProps {
  formattedTime: string;
  greeting: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  customTimeOverride: string | null;
  onChangeTimeOverride: (hhmm: string | null) => void;
}

export function HeaderBar({
  formattedTime,
  greeting,
  theme,
  onToggleTheme,
  customTimeOverride,
  onChangeTimeOverride,
}: HeaderBarProps) {
  return (
    <header className="top-header">
      <div className="brand-cluster">
        <div className="brand-mark" aria-hidden="true">
          <Compass size={22} />
        </div>
        <div>
          <h1 className="brand-title">Cadência</h1>
          <p className="brand-subtitle">{greeting} — Orientação de rotina sem rigidez</p>
        </div>
      </div>

      <div className="header-controls">
        <div className="clock-pill" aria-live="off">
          <Clock size={16} aria-hidden="true" />
          <span>{customTimeOverride ? `Simulando ${formattedTime}` : `Agora ${formattedTime}`}</span>
        </div>

        <div className="time-simulator-group">
          <label htmlFor="simular-horario" className="field-label time-simulator-label">
            Simular horário:
          </label>
          <input
            id="simular-horario"
            type="time"
            className="form-input time-simulator-input"
            value={customTimeOverride ?? ''}
            onChange={(e) => onChangeTimeOverride(e.target.value ? e.target.value : null)}
          />
          {customTimeOverride ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => onChangeTimeOverride(null)}
            >
              Usar hora real
            </button>
          ) : null}
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={onToggleTheme}
          aria-label={
            theme === 'dark' ? 'Ativar tema Neblina (claro)' : 'Ativar tema Noturno (escuro)'
          }
        >
          {theme === 'dark' ? (
            <Sun size={16} aria-hidden="true" />
          ) : (
            <Moon size={16} aria-hidden="true" />
          )}
          <span>{theme === 'dark' ? 'Neblina' : 'Noturno'}</span>
        </button>
      </div>
    </header>
  );
}
