import { useEffect, useState } from 'react';
import {
  calculateSalary,
  formatCurrency,
  formatDurationInput,
  loadSalaryCalculatorState,
  loadSalaryValuesVisible,
  saveSalaryCalculatorState,
  saveSalaryValuesVisible,
} from './salaryCalculator';

const MASKED_VALUE = '••••••';

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
  const [valuesVisible, setValuesVisible] = useState(loadSalaryValuesVisible);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const saved = loadSalaryCalculatorState();
    setInputs(saved.inputs);
    setResults(saved.results);
    setValuesVisible(loadSalaryValuesVisible());
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

  const toggleValuesVisible = () => {
    setValuesVisible((current) => {
      const nextVisible = !current;
      saveSalaryValuesVisible(nextVisible);
      return nextVisible;
    });
  };

  const displayCurrency = (value) => (valuesVisible ? formatCurrency(value) : MASKED_VALUE);

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
          <button
            type="button"
            className="salary-visibility-toggle"
            onClick={toggleValuesVisible}
            aria-pressed={valuesVisible}
            aria-label={valuesVisible ? 'Ocultar valores' : 'Mostrar valores'}
            title={valuesVisible ? 'Ocultar valores' : 'Mostrar valores'}
          >
            {valuesVisible ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 11 7 11 7a13.16 13.16 0 0 1-1.67 2.68" />
                <path d="M6.61 6.61A13.526 13.526 0 0 0 1 12s4 7 11 7a9.74 9.74 0 0 0 5.39-1.61" />
                <line x1="2" x2="22" y1="2" y2="22" />
              </svg>
            )}
          </button>
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
                type={valuesVisible ? 'text' : 'password'}
                inputMode="decimal"
                autoComplete="off"
                value={inputs.salario}
                onChange={handleChange('salario')}
                placeholder="ex: 4004"
                className={valuesVisible ? undefined : 'salary-value-hidden'}
              />
            </label>
            <label>
              Horas mensais (220)
              <input
                type="text"
                inputMode="decimal"
                value={inputs.horasMensais}
                onChange={handleChange('horasMensais')}
                placeholder="ex: 220"
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
                placeholder="ex: 5:25"
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
                placeholder="ex: 0:00"
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
                placeholder="ex: 0:00"
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
                placeholder="ex: 0:00"
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
                placeholder="ex: 0:00"
              />
            </label>
            <label>
              Dias úteis (ex: 22)
              <input
                type="text"
                inputMode="numeric"
                value={inputs.diasUteis}
                onChange={handleChange('diasUteis')}
                placeholder="ex: 22"
              />
            </label>
            <label>
              DSR (domingos/feriados, ex: 4)
              <input
                type="text"
                inputMode="numeric"
                value={inputs.dsr}
                onChange={handleChange('dsr')}
                placeholder="ex: 4"
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
          <p className={`salary-gross-value${valuesVisible ? '' : ' salary-value-masked'}`}>
            {results ? displayCurrency(results.salarioBruto) : '—'}
          </p>
        </div>

        {results && (
          <dl className="salary-results">
            {resultItems.map(([label, value]) => (
              <div key={label} className="salary-result-item">
                <dt>{label}</dt>
                <dd className={valuesVisible ? undefined : 'salary-value-masked'}>
                  {displayCurrency(value)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}

export default SalaryCalculatorModal;
