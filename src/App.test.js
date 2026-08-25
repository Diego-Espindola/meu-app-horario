import { render, screen } from '@testing-library/react';
import App from './App';

test('renders departure calculator title', () => {
  render(<App />);
  const titleElement = screen.getByText(/Calculadora de Saída/i);
  expect(titleElement).toBeInTheDocument();
});
