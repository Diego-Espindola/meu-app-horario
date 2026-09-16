export const SALARY_STORAGE_KEY = 'salaryCalculator';

export const DEFAULT_SALARY_INPUTS = {
  salario: '',
  horasMensais: '220',
  he50: '',
  he100: '',
  horasFaltas: '',
  he50Noturna: '',
  he100Noturna: '',
  diasUteis: '',
  dsr: '',
};

const NIGHT_ADDITIONAL = 1.2;
const NIGHT_HOUR_FACTOR = 1.142857;

export const parseHours = (rawValue) => {
  if (rawValue === null || rawValue === undefined) {
    return 0;
  }

  const value = String(rawValue).trim().replace(',', '.');
  if (!value) {
    return 0;
  }

  if (value.includes(':')) {
    const [hoursPart, minutesPart = '0'] = value.split(':');
    const hours = Number(hoursPart);
    const minutes = Number(minutesPart);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      return NaN;
    }
    return hours + minutes / 60;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : NaN;
};

export const parseNumber = (rawValue) => {
  if (rawValue === null || rawValue === undefined) {
    return 0;
  }
  const value = String(rawValue).trim().replace(',', '.');
  if (!value) {
    return 0;
  }
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : NaN;
};

export const formatDurationInput = (rawValue) => {
  let digits = String(rawValue).replace(/\D/g, '');
  if (digits.length > 4) {
    digits = digits.substring(0, 4);
  }
  if (digits.length > 2) {
    return `${digits.substring(0, digits.length - 2)}:${digits.substring(digits.length - 2)}`;
  }
  return digits;
};

export const formatCurrency = (value) => {
  if (!Number.isFinite(value)) {
    return 'R$ 0,00';
  }
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

export const calculateSalary = (inputs) => {
  const salario = parseNumber(inputs.salario);
  const horasMensais = parseNumber(inputs.horasMensais);
  const he50Hours = parseHours(inputs.he50);
  const he100Hours = parseHours(inputs.he100);
  const horasFaltas = parseHours(inputs.horasFaltas);
  const he50NoturnaHours = parseHours(inputs.he50Noturna);
  const he100NoturnaHours = parseHours(inputs.he100Noturna);
  const diasUteis = parseNumber(inputs.diasUteis);
  const dsr = parseNumber(inputs.dsr);

  const invalidField = [
    salario,
    horasMensais,
    he50Hours,
    he100Hours,
    horasFaltas,
    he50NoturnaHours,
    he100NoturnaHours,
    diasUteis,
    dsr,
  ].some((value) => !Number.isFinite(value));

  if (invalidField || horasMensais <= 0) {
    return null;
  }

  const valorHora = salario / horasMensais;
  const totalHorasFaltas = valorHora * horasFaltas;
  const totalHe50 = valorHora * 1.5 * he50Hours;
  const totalHe100 = valorHora * 2 * he100Hours;
  const totalHe50Noturna = valorHora * 1.5 * NIGHT_ADDITIONAL * NIGHT_HOUR_FACTOR * he50NoturnaHours;
  const totalHe100Noturna = valorHora * 2 * NIGHT_ADDITIONAL * NIGHT_HOUR_FACTOR * he100NoturnaHours;
  const totalExtras = totalHe50 + totalHe100 + totalHe50Noturna + totalHe100Noturna;
  const dsrSobreHe = diasUteis > 0 ? (totalExtras / diasUteis) * dsr : 0;
  const heMaisDsr = dsrSobreHe + totalExtras;
  const totalGeral = heMaisDsr - totalHorasFaltas;
  const salarioBruto = salario + totalGeral;

  return {
    valorHora,
    totalHorasFaltas,
    totalHe50,
    totalHe100,
    totalHe50Noturna,
    totalHe100Noturna,
    dsrSobreHe,
    heMaisDsr,
    totalGeral,
    salarioBruto,
  };
};

export const loadSalaryCalculatorState = () => {
  try {
    const saved = localStorage.getItem(SALARY_STORAGE_KEY);
    if (!saved) {
      return { inputs: DEFAULT_SALARY_INPUTS, results: null };
    }
    const parsed = JSON.parse(saved);
    return {
      inputs: { ...DEFAULT_SALARY_INPUTS, ...(parsed.inputs || {}) },
      results: parsed.results || null,
    };
  } catch (error) {
    console.error('Failed to parse salary calculator from localStorage', error);
    localStorage.removeItem(SALARY_STORAGE_KEY);
    return { inputs: DEFAULT_SALARY_INPUTS, results: null };
  }
};

export const saveSalaryCalculatorState = (inputs, results) => {
  localStorage.setItem(
    SALARY_STORAGE_KEY,
    JSON.stringify({ inputs, results })
  );
};
