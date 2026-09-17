import {
  calculateSalary,
  loadSalaryValuesVisible,
  saveSalaryValuesVisible,
  SALARY_VALUES_VISIBLE_KEY,
} from './salaryCalculator';

test('matches the spreadsheet formulas for the March/April sample', () => {
  const results = calculateSalary({
    salario: '4004',
    horasMensais: '220',
    he50: '12:14',
    he100: '12:29',
    horasFaltas: '0:59',
    he50Noturna: '0',
    he100Noturna: '0',
    diasUteis: '21',
    dsr: '5',
  });

  expect(results.valorHora).toBeCloseTo(18.2, 6);
  expect(results.totalHorasFaltas).toBeCloseTo(17.8966666666667, 6);
  expect(results.totalHe50).toBeCloseTo(333.97, 2);
  expect(results.totalHe100).toBeCloseTo(454.393333333333, 6);
  expect(results.totalHe50Noturna).toBe(0);
  expect(results.totalHe100Noturna).toBe(0);
  expect(results.dsrSobreHe).toBeCloseTo(187.705555555555, 6);
  expect(results.heMaisDsr).toBeCloseTo(976.068888888888, 6);
  expect(results.totalGeral).toBeCloseTo(958.172222222222, 6);
  expect(results.salarioBruto).toBeCloseTo(4962.17222222222, 6);
});

test('persists salary values visibility in localStorage as true or false', () => {
  localStorage.removeItem(SALARY_VALUES_VISIBLE_KEY);
  expect(loadSalaryValuesVisible()).toBe(true);

  saveSalaryValuesVisible(false);
  expect(localStorage.getItem(SALARY_VALUES_VISIBLE_KEY)).toBe('false');
  expect(loadSalaryValuesVisible()).toBe(false);

  saveSalaryValuesVisible(true);
  expect(localStorage.getItem(SALARY_VALUES_VISIBLE_KEY)).toBe('true');
  expect(loadSalaryValuesVisible()).toBe(true);
});
