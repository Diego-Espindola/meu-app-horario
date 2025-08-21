import { useState, useEffect } from 'react';
import './App.css';

const luxonScript = document.createElement('script');
luxonScript.src = 'https://cdn.jsdelivr.net/npm/luxon@3.4.4/build/global/luxon.min.js';
document.head.appendChild(luxonScript);

function App() {
  const [entries, setEntries] = useState([]);
  const [newEntryTime, setNewEntryTime] = useState('');
  const [departureTime, setDepartureTime] = useState(null);
  const [message, setMessage] = useState('');
  const [workSchedule, setWorkSchedule] = useState({
    monday: 9,
    tuesday: 9,
    wednesday: 9,
    thursday: 9,
    friday: 8,
    saturday: 0,
    sunday: 0,
  });
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState({});
  const [isScheduleVisible, setIsScheduleVisible] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [editingEntryValue, setEditingEntryValue] = useState('');
  const [currentDayInfo, setCurrentDayInfo] = useState({
    dayName: '',
    date: '',
    workHours: 0,
  });

  // Efeito para carregar as informações do dia atual e as entradas do localStorage
  useEffect(() => {
    const handleLuxonLoad = () => {
      if (window.luxon) {
        window.luxon.Settings.defaultLocale = 'pt-BR';
        
        const today = window.luxon.DateTime.now();
        const dayOfWeek = today.setLocale('en').toFormat('EEEE').toLowerCase();
        setCurrentDayInfo({
          dayName: getDayName(dayOfWeek),
          date: today.toFormat('dd/MM/yyyy'),
          workHours: workSchedule[dayOfWeek],
        });
        calculateDepartureTime();

        // Carregar as entradas do localStorage
        const savedEntries = localStorage.getItem('workEntries');
        if (savedEntries) {
          try {
            const parsedEntries = JSON.parse(savedEntries).map(entry => ({
              ...entry,
              // Converte a string ISO de volta para um objeto Luxon
              datetime: window.luxon.DateTime.fromISO(entry.datetime),
            }));
            setEntries(parsedEntries);
          } catch (e) {
            console.error("Failed to parse entries from localStorage", e);
            localStorage.removeItem('workEntries');
          }
        }
      }
    };
    luxonScript.onload = handleLuxonLoad;
    // Tenta carregar as informações caso o script já tenha sido carregado.
    if (window.luxon) {
      handleLuxonLoad();
    }
  }, [workSchedule]);

  // Efeito para recalcular o horário de saída
  useEffect(() => {
    if (window.luxon) {
      calculateDepartureTime();
    }
  }, [entries, workSchedule]);

  // Efeito para salvar as entradas no localStorage sempre que elas mudam
  useEffect(() => {
    // Converte os objetos Luxon para strings ISO antes de salvar
    const entriesToSave = entries.map(entry => ({
      ...entry,
      datetime: entry.datetime.toISO(),
    }));
    localStorage.setItem('workEntries', JSON.stringify(entriesToSave));
  }, [entries]);

  // Função para lidar com a entrada de horário, adicionando o ":" automaticamente.
  const handleTimeInputChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 4) {
      value = value.substring(0, 4);// Limita a 4 dígitos para HHmm.
    }

    if (value.length > 2) {
      value = value.substring(0, 2) + ':' + value.substring(2);
    }
    setNewEntryTime(value);
  };
  
  const handleEditingTimeInputChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 4) {
      value = value.substring(0, 4);
    }
    
    if (value.length > 2) {
      value = value.substring(0, 2) + ':' + value.substring(2);
    }
    setEditingEntryValue(value);
  };

  const addEntry = (e) => {
    e.preventDefault();
    if (!newEntryTime || !/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/.test(newEntryTime)) {
      setMessage('Por favor, insira um horário válido no formato HH:mm.');
      return;
    }

    const now = window.luxon.DateTime.now();
    const [hours, minutes] = newEntryTime.split(':');
    const newEntry = {
      id: crypto.randomUUID(),
      datetime: now.set({ hour: Number(hours), minute: Number(minutes), second: 0, millisecond: 0 }),
    };

    setEntries(prevEntries => {
      const updatedEntries = [...prevEntries, newEntry].sort((a, b) => a.datetime.toMillis() - b.datetime.toMillis());
      setMessage('Marcação adicionada com sucesso!');
      return updatedEntries;
    });

    setNewEntryTime('');
  };

  const calculateDepartureTime = () => {
    setMessage('');
    if (entries.length < 3) {
      setDepartureTime(null);
      return;
    }

    const today = window.luxon.DateTime.now();
    const dayOfWeek = today.setLocale('en').toFormat('EEEE').toLowerCase();
    const targetWorkHours = workSchedule[dayOfWeek];

    if (targetWorkHours === 0) {
      setDepartureTime('Não há jornada de trabalho prevista para hoje.');
      return;
    }

    let totalWorkedMinutes = 0;
    const numPairs = Math.floor(entries.length / 2);
    for (let i = 0; i < numPairs * 2; i += 2) {
      const entry = entries[i];
      const exit = entries[i + 1];

      // Garante que as datas são válidas e calcula a duração
      if (entry.datetime.isValid && exit.datetime.isValid) {
        const duration = exit.datetime.diff(entry.datetime, 'minutes');
        totalWorkedMinutes += duration.minutes;
      } else {
        setDepartureTime('Erro: Verifique as marcações de horário.');
        return;
      }
    }

    // Calcula os minutos restantes com base na jornada de trabalho
    const targetMinutes = targetWorkHours * 60;
    const remainingMinutes = targetMinutes - totalWorkedMinutes;
   
    // Garante que o valor de minutos restantes é um número válido antes de usá-lo.
    if (isNaN(remainingMinutes) || !Number.isFinite(remainingMinutes)) {
      setDepartureTime('Erro: Cálculo de tempo inválido.');
      return;
    }

    if (remainingMinutes <= 0) {
      setDepartureTime('Jornada de trabalho completa!');
    } else {
      const lastEntryTime = entries[entries.length - 1].datetime;
      // Garante que a última entrada é válida antes de somar os minutos restantes.
      if (!lastEntryTime.isValid) {
        setDepartureTime('Erro: Última marcação inválida.');
        return;
      }
      const departure = lastEntryTime.plus({ minutes: remainingMinutes });
      setDepartureTime(departure.toFormat('HH:mm'));
    }
  };

  // Função para remover uma entrada.
  const removeEntry = (id) => {
    setEntries(entries.filter(entry => entry.id !== id));
    setMessage('Marcação removida.');
  };

  // Nova função para apagar todas as entradas
  const clearAllEntries = () => {
    setEntries([]);
    setMessage('Todas as marcações foram removidas.');
  };

  const startEditingEntry = (entry) => {
    setEditingEntryId(entry.id);
    setEditingEntryValue(entry.datetime.toFormat('HH:mm'));
  };

  const saveEditedEntry = (id) => {
    if (!editingEntryValue || !/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/.test(editingEntryValue)) {
      setMessage('Por favor, insira um horário válido no formato HH:mm.');
      return;
    }

    const updatedEntries = entries.map(entry => {
      if (entry.id === id) {
        const [hours, minutes] = editingEntryValue.split(':');
        const newDatetime = entry.datetime.set({ hour: Number(hours), minute: Number(minutes) });
        return { ...entry, datetime: newDatetime };
      }
      return entry;
    }).sort((a, b) => a.datetime.toMillis() - b.datetime.toMillis());
    setEntries(updatedEntries);
    setEditingEntryId(null);
    setMessage('Marcação atualizada com sucesso!');
  };

  const cancelEditingEntry = () => {
    setEditingEntryId(null);
  };

  const saveSchedule = () => {
    setWorkSchedule(editingSchedule);
    setIsEditingSchedule(false);
    setMessage('Jornada de trabalho atualizada!');
  };

  const getDayName = (day) => {
    const days = {
      monday: 'Segunda-feira',
      tuesday: 'Terça-feira',
      wednesday: 'Quarta-feira',
      thursday: 'Quinta-feira',
      friday: 'Sexta-feira',
      saturday: 'Sábado',
      sunday: 'Domingo',
    };
    return days[day] || day;
  };

  return (
    <div className="app-container">
      <div className="card">
        <h1 className="main-title">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-clock"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Calculadora de Saída
        </h1>

        <div className="daily-info-card">
            <div className="daily-info-item">
                <p className="daily-info-day">{currentDayInfo.dayName}</p>
                <p className="daily-info-date">{currentDayInfo.date}</p>
            </div>
            <div className="daily-info-item">
                <p className="daily-info-label">Jornada de Trabalho</p>
                <p className="daily-info-hours">{currentDayInfo.workHours} horas</p>
            </div>
        </div>

        <div className="schedule-section">
          <div className="schedule-header" onClick={() => setIsScheduleVisible(!isScheduleVisible)}>
            <h2 className="section-title">Jornada de Trabalho</h2>
            <div className="schedule-actions">
                {!isEditingSchedule && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditingSchedule(true);
                      setEditingSchedule(workSchedule);
                      setIsScheduleVisible(true);
                    }}
                    className="edit-button"
                    aria-label="Editar jornada de trabalho"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-pencil"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                  </button>
                )}
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`icon-chevron-down ${isScheduleVisible ? 'icon-rotated' : ''}`}><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>
          {isScheduleVisible && (
            <div className="schedule-list">
              {Object.keys(workSchedule).map(day => (
                <p
                  key={day}
                  className={`schedule-item ${day === currentDayInfo.dayName.toLowerCase() ? 'schedule-item-highlight' : ''}`}
                >
                  <span>{getDayName(day)}:</span>
                  {isEditingSchedule ? (
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={editingSchedule[day]}
                      onChange={(e) => setEditingSchedule({ ...editingSchedule, [day]: Number(e.target.value) })}
                      className="schedule-input"
                    />
                  ) : (
                    <span className="schedule-value">{workSchedule[day]} horas</span>
                  )}
                </p>
              ))}
              {isEditingSchedule && (
                <div className="schedule-buttons-container">
                  <button
                    onClick={saveSchedule}
                    className="save-button"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-check"><path d="M20 6 9 17l-5-5"/></svg>
                    Salvar
                  </button>
                  <button
                    onClick={() => setIsEditingSchedule(false)}
                    className="cancel-button"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

          <form onSubmit={addEntry} className="entry-form">
            <div className="form-group">
              <div className="input-group">
                <label htmlFor="new-entry" className="sr-only">Horário</label>
                <input
            id="new-entry"
            type="text"
            pattern="([01]?[0-9]|2[0-3]):[0-5][0-9]"
            placeholder="HH:mm"
            maxLength="5"
            value={newEntryTime}
            onChange={handleTimeInputChange}
            className="entry-input"
            required
            style={{ width: '60px' }}
                />
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-calendar"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="M12 21v-4"/><path d="M12 17v-4"/><path d="M8 17v-4"/><path d="M16 17v-4"/></svg>
              </div>
              <div className="button-group">
                <button
            type="submit"
            className="add-button"
                >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-plus"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            Adicionar Marcação
                </button>
              </div>
            </div>
          </form>

          {message && (
            <div className="message success">
              {message}
            </div>
          )}

          <div className="entries-section">
            <div className="entries-header">
              <h2 className="section-title">Marcações Registradas ({entries.length})</h2>
              {entries.length > 0 && (
                <button
                  onClick={clearAllEntries}
                  className="clear-all-button"
                  aria-label="Limpar todas as marcações"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-trash-clear"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  Limpar Tudo
                </button>
              )}
            </div>
            {entries.length === 0 ? (
              <p className="no-entries">Nenhuma marcação adicionada ainda.</p>
            ) : (
              <div className="entries-list">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="entry-item"
                  >
                    {editingEntryId === entry.id ? (
                      <div className="entry-edit-mode">
                        <input
                          type="text"
                          pattern="([01]?[0-9]|2[0-3]):[0-5][0-9]"
                          placeholder="HH:mm"
                          maxLength="5"
                          value={editingEntryValue}
                          onChange={handleEditingTimeInputChange}
                          className="edit-input"
                        />
                        <button onClick={() => saveEditedEntry(entry.id)} className="edit-save-button" aria-label="Salvar"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-check"><path d="M20 6 9 17l-5-5"/></svg></button>
                        <button onClick={cancelEditingEntry} className="edit-cancel-button" aria-label="Cancelar"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
                      </div>
                    ) : (
                      <>
                        <div className="entry-details">
                          <span className="entry-date">
                            {entry.datetime.toFormat('dd/MM/yyyy')}
                          </span>
                          <span className="entry-time">
                            {entry.datetime.toFormat('HH:mm')}
                          </span>
                        </div>
                        <div className="entry-actions">
                          <button
                            onClick={() => startEditingEntry(entry)}
                            className="edit-button"
                            aria-label="Editar marcação"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-pencil"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                          </button>
                          <button
                            onClick={() => removeEntry(entry.id)}
                            className="remove-button"
                            aria-label="Remover marcação"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-trash"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        <div className="departure-section">
          <h2 className="departure-title">
            Horário de Saída
          </h2>
          {departureTime ? (
            <div className="departure-card animated-pulse">
              <p className="departure-label">Seu horário de saída é:</p>
              <p className="departure-time">
                {departureTime}
              </p>
            </div>
          ) : (
            <div className="departure-placeholder">
              <p className="departure-waiting-message">
                {/* Ícone de brilho em SVG */}
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-sparkles"><path d="M9.914 15.014c.3-.3.654-.515 1.05-.623.395-.107.818-.112 1.215-.013.398.1.758.33 1.037.643.278.314.475.698.572 1.11.097.412.112.846.04 1.267-.07.42-.266.81-.564 1.114"/><path d="M11 20.25a.75.75 0 0 1-.75.75H8.25a.75.75 0 0 1-.75-.75V18.5a.75.75 0 0 1 .75-.75H10.25a.75.75 0 0 1 .75.75v1.75z"/><path d="M12 11a1 1 0 0 1-1-1V3a1 1 0 0 1 2 0v7a1 1 0 0 1-1 1z"/><path d="m15.54 13.36 1.77-1.77a1 1 0 0 0 0-1.41L14.15 7.05a1 1 0 0 0-1.41 0L10.97 8.5a1 1 0 0 0 0 1.41l1.77 1.77a1 1 0 0 0 1.41 0z"/><path d="M7 11a1 1 0 0 1-1-1V3a1 1 0 0 1 2 0v7a1 1 0 0 1-1 1z"/><path d="m12.35 15.65-1.77 1.77a1 1 0 0 0 0 1.41l3.18 3.18a1 1 0 0 0 1.41 0l1.77-1.77a1 1 0 0 0 0-1.41l-3.18-3.18a1 1 0 0 0-1.41 0z"/></svg>
                Aguardando 3 ou mais marcações para calcular...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;