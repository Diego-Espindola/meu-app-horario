import { useEffect, useState } from 'react';
import {
  calculateSalary,
  formatCurrency,
  formatDurationInput,
  loadSalaryCalculatorState,
  saveSalaryCalculatorState,
} from './salaryCalculator';

const DURATION_FIELDS = new Set([
  'he50',
  'he100',
  'horasFaltas',
  'he50Noturna',
  'he100Noturna',
]);

function SalaryCalculatorModal({ isOpen, onClose }) {
  const [inputs, setInputs] = useState(loadSalaryCalculatorState().inputs);
  const [results, setResults] = useState(loadSalaryCalculatorState().results);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const saved = loadSalaryCalculatorState();
    setInputs(saved.inputs);
    setResults(saved.results);
    setError('');

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleChange = (field) => (event) => {
    const value = DURATION_FIELDS.has(field)
      ? formatDurationInput(event.target.value)
      : event.target.value;
    setInputs((current) => ({ ...current, [field]: value }));
  };

  const handleCalculate = (event) => {
    event.preventDefault();
    const nextResults = calculateSalary(inputs);
    if (!nextResults) {
      setError('Preencha os valores numéricos corretamente. Horas mensais deve ser maior que zero.');
      setResults(null);
      return;
    }
    setError('');
    setResults(nextResults);
    saveSalaryCalculatorState(inputs, nextResults);
  };

  const resultItems = results
    ? [
        ['Valor da hora', results.valorHora],
        ['Total Horas Faltas', results.totalHorasFaltas],
        ['Total HE 50%', results.totalHe50],
        ['Total HE 100%', results.totalHe100],
        ['HE 50% Noturna', results.totalHe50Noturna],
        ['HE 100% Noturna', results.totalHe100Noturna],
        ['DSR sobre HE', results.dsrSobreHe],
        ['HE + DSR', results.heMaisDsr],
        ['Total geral (HE + DSR – HF)', results.totalGeral],
      ]
    : [];

  return (
    <div className="new-day-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="salary-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="salary-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="salary-modal-header">
          <h2 id="salary-modal-title">Cálculo de salário</h2>
          <button type="button" className="salary-modal-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        <form onSubmit={handleCalculate} className="salary-form">
          <div className="salary-fields">
            <label>
              Salário
              <input
                type="text"
                inputMode="decimal"
                value={inputs.salario}
                onChange={handleChange('salario')}
                placeholder="4004"
              />
            </label>
            <label>
              Horas mensais (220)
              <input
                type="text"
                inputMode="decimal"
                value={inputs.horasMensais}
                onChange={handleChange('horasMensais')}
                placeholder="220"
              />
            </label>
            <label>
              Horas extra 50%
              <input
                type="text"
                inputMode="numeric"
                maxLength="5"
                value={inputs.he50}
                onChange={handleChange('he50')}
                placeholder="5:25"
              />
            </label>
            <label>
              Horas extra 100%
              <input
                type="text"
                inputMode="numeric"
                maxLength="5"
                value={inputs.he100}
                onChange={handleChange('he100')}
                placeholder="0:00"
              />
            </label>
            <label>
              Horas faltas
              <input
                type="text"
                inputMode="numeric"
                maxLength="5"
                value={inputs.horasFaltas}
                onChange={handleChange('horasFaltas')}
                placeholder="0:00"
              />
            </label>
            <label>
              HE 50% Noturna
              <input
                type="text"
                inputMode="numeric"
                maxLength="5"
                value={inputs.he50Noturna}
                onChange={handleChange('he50Noturna')}
                placeholder="0:00"
              />
            </label>
            <label>
              HE 100% Noturna
              <input
                type="text"
                inputMode="numeric"
                maxLength="5"
                value={inputs.he100Noturna}
                onChange={handleChange('he100Noturna')}
                placeholder="0:00"
              />
            </label>
            <label>
              Dias úteis (ex: 22)
              <input
                type="text"
                inputMode="numeric"
                value={inputs.diasUteis}
                onChange={handleChange('diasUteis')}
                placeholder="22"
              />
            </label>
            <label>
              DSR (domingos/feriados, ex: 4)
              <input
                type="text"
                inputMode="numeric"
                value={inputs.dsr}
                onChange={handleChange('dsr')}
                placeholder="4"
              />
            </label>
          </div>

          {error && <p className="salary-error">{error}</p>}

          <button type="submit" className="salary-calculate-button">
            Calcular
          </button>
        </form>

        <div className="salary-gross">
          <p className="salary-gross-label">Salário Bruto</p>
          <p className="salary-gross-value">
            {results ? formatCurrency(results.salarioBruto) : '—'}
          </p>
        </div>

        {results && (
          <dl className="salary-results">
            {resultItems.map(([label, value]) => (
              <div key={label} className="salary-result-item">
                <dt>{label}</dt>
                <dd>{formatCurrency(value)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}

export default SalaryCalculatorModal;
