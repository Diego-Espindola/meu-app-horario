import { useState, useEffect, useRef } from 'react';
import './App.css';

const luxonScript = document.createElement('script');
luxonScript.src = 'https://cdn.jsdelivr.net/npm/luxon@3.4.4/build/global/luxon.min.js';
document.head.appendChild(luxonScript);

const WORK_ENTRIES_KEY = 'workEntries';
const WORK_SCHEDULE_KEY = 'workSchedule';
const TIME_PATTERN = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;
const CLOCK_RESULT_PATTERN = /^\d{2}:\d{2}$/;

const DEFAULT_WORK_SCHEDULE = {
  monday: 9,
  tuesday: 9,
  wednesday: 9,
  thursday: 9,
  friday: 8,
  saturday: 0,
  sunday: 0,
};

const DAY_NAMES = {
  monday: 'Segunda-feira',
  tuesday: 'Terça-feira',
  wednesday: 'Quarta-feira',
  thursday: 'Quinta-feira',
  friday: 'Sexta-feira',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

const getDayName = (day) => DAY_NAMES[day] || day;

const formatDurationSeconds = (totalSeconds) => {
  const absoluteSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(absoluteSeconds / 3600);
  const minutes = Math.floor((absoluteSeconds % 3600) / 60);
  const seconds = absoluteSeconds % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}min ${String(seconds).padStart(2, '0')}s`;
};

const getTodayEntries = (entries, today) =>
  entries.filter((entry) => entry.datetime?.isValid && entry.datetime.hasSame(today, 'day'));

const getCompletedPairSeconds = (todayEntries) => {
  let totalWorkedSeconds = 0;
  const numPairs = Math.floor(todayEntries.length / 2);
  for (let i = 0; i < numPairs * 2; i += 2) {
    const entry = todayEntries[i];
    const exit = todayEntries[i + 1];
    if (!entry.datetime.isValid || !exit.datetime.isValid) {
      return null;
    }
    totalWorkedSeconds += exit.datetime.diff(entry.datetime, 'seconds').seconds;
  }
  return totalWorkedSeconds;
};

const computeRemainingSeconds = (todayEntries, workSchedule, earlyExitOption, now) => {
  const completedPairSeconds = getCompletedPairSeconds(todayEntries);
  if (completedPairSeconds === null) {
    return null;
  }

  let workedSeconds = completedPairSeconds;
  if (todayEntries.length % 2 === 1) {
    const lastEntryTime = todayEntries[todayEntries.length - 1].datetime;
    if (!lastEntryTime.isValid) {
      return null;
    }
    workedSeconds += now.diff(lastEntryTime, 'seconds').seconds;
  }

  const dayOfWeek = now.setLocale('en').toFormat('EEEE').toLowerCase();
  const targetWorkHours = Number(workSchedule[dayOfWeek]);
  const safeTargetHours = Number.isFinite(targetWorkHours) ? targetWorkHours : 0;
  const earlyExitMinutes = earlyExitOption === 'rule' ? 10 : earlyExitOption === 'hourEarly' ? 59 : 0;
  const remainingSeconds = safeTargetHours * 3600 - workedSeconds - earlyExitMinutes * 60;
  if (!Number.isFinite(remainingSeconds)) {
    return null;
  }
  return Math.floor(remainingSeconds);
};

const getCompletedPairMinutes = (todayEntries) => {
  let totalWorkedMinutes = 0;
  const numPairs = Math.floor(todayEntries.length / 2);
  for (let i = 0; i < numPairs * 2; i += 2) {
    const entry = todayEntries[i];
    const exit = todayEntries[i + 1];
    if (!entry.datetime.isValid || !exit.datetime.isValid) {
      return null;
    }
    totalWorkedMinutes += exit.datetime.diff(entry.datetime, 'minutes').minutes;
  }
  return totalWorkedMinutes;
};

const formatTimeInput = (rawValue) => {
  let value = rawValue.replace(/\D/g, '');
  if (value.length > 4) {
    value = value.substring(0, 4);
  }
  if (value.length > 2) {
    value = value.substring(0, 2) + ':' + value.substring(2);
  }
  return value;
};

const sanitizeWorkSchedule = (schedule) => {
  const sanitized = { ...DEFAULT_WORK_SCHEDULE };
  if (!schedule || typeof schedule !== 'object') {
    return sanitized;
  }
  Object.keys(DEFAULT_WORK_SCHEDULE).forEach((day) => {
    const hours = Number(schedule[day]);
    if (Number.isFinite(hours) && hours >= 0) {
      sanitized[day] = hours;
    }
  });
  return sanitized;
};

const loadWorkSchedule = () => {
  try {
    const savedSchedule = localStorage.getItem(WORK_SCHEDULE_KEY);
    if (!savedSchedule) {
      return DEFAULT_WORK_SCHEDULE;
    }
    return sanitizeWorkSchedule(JSON.parse(savedSchedule));
  } catch (e) {
    console.error('Failed to parse work schedule from localStorage', e);
    localStorage.removeItem(WORK_SCHEDULE_KEY);
    return DEFAULT_WORK_SCHEDULE;
  }
};

function App() {
  const [entries, setEntries] = useState([]);
  const [newEntryTime, setNewEntryTime] = useState('');
  const [departureTime, setDepartureTime] = useState(null);
  const [message, setMessage] = useState('');
  const [workSchedule, setWorkSchedule] = useState(loadWorkSchedule);
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState({});
  const [isScheduleVisible, setIsScheduleVisible] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [editingEntryValue, setEditingEntryValue] = useState('');
  const [currentDayInfo, setCurrentDayInfo] = useState({
    weekdayKey: '',
    dayName: '',
    date: '',
    workHours: 0,
  });
  const [earlyExitOption, setEarlyExitOption] = useState(null);
  const [isRemainingModalOpen, setIsRemainingModalOpen] = useState(false);
  const [remainingDeadlineMs, setRemainingDeadlineMs] = useState(null);
  const [remainingSecondsLeft, setRemainingSecondsLeft] = useState(null);
  const [areEntriesHydrated, setAreEntriesHydrated] = useState(false);
  const [isLuxonReady, setIsLuxonReady] = useState(false);
  const [nowTick, setNowTick] = useState(0);
  const remainingTimerRef = useRef(null);

  useEffect(() => {
    const handleLuxonLoad = () => {
      if (!window.luxon) {
        return;
      }
      window.luxon.Settings.defaultLocale = 'pt-BR';

      const savedEntries = localStorage.getItem(WORK_ENTRIES_KEY);
      if (savedEntries) {
        try {
          const parsedEntries = JSON.parse(savedEntries)
            .map((entry) => ({
              ...entry,
              datetime: window.luxon.DateTime.fromISO(entry.datetime),
            }))
            .filter((entry) => entry.datetime.isValid);
          setEntries(parsedEntries);
        } catch (e) {
          console.error('Failed to parse entries from localStorage', e);
          localStorage.removeItem(WORK_ENTRIES_KEY);
          setEntries([]);
        }
      }
      setAreEntriesHydrated(true);
      setIsLuxonReady(true);
    };

    luxonScript.onload = handleLuxonLoad;
    if (window.luxon) {
      handleLuxonLoad();
    }
  }, []);

  useEffect(() => {
    if (!isLuxonReady) {
      return;
    }
    const today = window.luxon.DateTime.now();
    const dayOfWeek = today.setLocale('en').toFormat('EEEE').toLowerCase();
    setCurrentDayInfo({
      weekdayKey: dayOfWeek,
      dayName: getDayName(dayOfWeek),
      date: today.toFormat('dd/MM/yyyy'),
      workHours: workSchedule[dayOfWeek] ?? 0,
    });
  }, [workSchedule, isLuxonReady, nowTick]);

  useEffect(() => {
    if (!isLuxonReady || !window.luxon) {
      return undefined;
    }

    const now = window.luxon.DateTime.now();
    const msUntilMidnight = Math.max(
      1000,
      now.plus({ days: 1 }).startOf('day').toMillis() - now.toMillis()
    );
    const timeoutId = window.setTimeout(() => {
      setNowTick((tick) => tick + 1);
    }, msUntilMidnight);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setNowTick((tick) => tick + 1);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [isLuxonReady, nowTick]);

  const calculateDepartureTime = () => {
    if (!window.luxon) {
      return;
    }

    const today = window.luxon.DateTime.now();
    const hasStaleEntries = entries.some(
      (entry) => entry.datetime?.isValid && !entry.datetime.hasSame(today, 'day')
    );
    if (hasStaleEntries) {
      setDepartureTime(null);
      return;
    }
    const todayEntries = entries.filter(
      (entry) => entry.datetime?.isValid && entry.datetime.hasSame(today, 'day')
    );

    if (todayEntries.length < 3) {
      setDepartureTime(null);
      return;
    }

    const dayOfWeek = today.setLocale('en').toFormat('EEEE').toLowerCase();
    const targetWorkHours = Number(workSchedule[dayOfWeek]);
    const safeTargetHours = Number.isFinite(targetWorkHours) ? targetWorkHours : 0;

    const totalWorkedMinutes = getCompletedPairMinutes(todayEntries);
    if (totalWorkedMinutes === null) {
      setDepartureTime('Erro: Verifique as marcações de horário.');
      return;
    }

    const targetMinutes = safeTargetHours * 60;
    const earlyExitMinutes = earlyExitOption === 'rule' ? 10 : earlyExitOption === 'hourEarly' ? 59 : 0;
    const remainingMinutes = targetMinutes - totalWorkedMinutes - earlyExitMinutes;
    const isCurrentlyClockedIn = todayEntries.length % 2 === 1;

    if (isNaN(remainingMinutes) || !Number.isFinite(remainingMinutes)) {
      setDepartureTime('Erro: Cálculo de tempo inválido.');
      return;
    }

    if (remainingMinutes <= 0) {
      setDepartureTime('Jornada de trabalho completa!');
      return;
    }

    if (!isCurrentlyClockedIn) {
      const remainingHours = Math.floor(remainingMinutes / 60);
      const remainingMins = Math.round(remainingMinutes % 60);
      setDepartureTime(
        `Saída já registrada. Ainda faltam ${remainingHours}h ${String(remainingMins).padStart(2, '0')}min.`
      );
      return;
    }

    const lastEntryTime = todayEntries[todayEntries.length - 1].datetime;
    if (!lastEntryTime.isValid) {
      setDepartureTime('Erro: Última marcação inválida.');
      return;
    }
    const departure = lastEntryTime.plus({ minutes: remainingMinutes });
    setDepartureTime(departure.toFormat('HH:mm'));
  };

  useEffect(() => {
    if (!isLuxonReady || !areEntriesHydrated) {
      return;
    }
    calculateDepartureTime();
  }, [entries, workSchedule, earlyExitOption, isLuxonReady, areEntriesHydrated]);

  useEffect(() => {
    if (!areEntriesHydrated) {
      return;
    }
    const entriesToSave = entries.map((entry) => ({
      ...entry,
      datetime: entry.datetime.toISO(),
    }));
    localStorage.setItem(WORK_ENTRIES_KEY, JSON.stringify(entriesToSave));
  }, [entries, areEntriesHydrated]);

  useEffect(() => {
    localStorage.setItem(WORK_SCHEDULE_KEY, JSON.stringify(workSchedule));
  }, [workSchedule]);

  useEffect(() => {
    if (!isLuxonReady || !window.luxon) {
      return undefined;
    }
    const today = window.luxon.DateTime.now();
    const hasStaleEntries = entries.some(
      (entry) => entry.datetime?.isValid && !entry.datetime.hasSame(today, 'day')
    );
    if (!hasStaleEntries) {
      return undefined;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [entries, isLuxonReady, nowTick]);

  const stopRemainingTimer = () => {
    if (remainingTimerRef.current !== null) {
      window.clearInterval(remainingTimerRef.current);
      remainingTimerRef.current = null;
    }
  };

  const closeRemainingModal = () => {
    stopRemainingTimer();
    setIsRemainingModalOpen(false);
    setRemainingDeadlineMs(null);
    setRemainingSecondsLeft(null);
  };

  useEffect(() => {
    stopRemainingTimer();
    if (!isRemainingModalOpen || remainingDeadlineMs == null) {
      return undefined;
    }

    const tick = () => {
      const remainingMs = remainingDeadlineMs - Date.now();
      if (remainingMs <= 0) {
        setRemainingSecondsLeft(0);
        stopRemainingTimer();
        return;
      }
      setRemainingSecondsLeft(Math.ceil(remainingMs / 1000));
    };

    tick();
    if (remainingDeadlineMs - Date.now() > 0) {
      remainingTimerRef.current = window.setInterval(tick, 1000);
    }
    return stopRemainingTimer;
  }, [isRemainingModalOpen, remainingDeadlineMs]);

  useEffect(() => {
    if (!isRemainingModalOpen) {
      return undefined;
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeRemainingModal();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isRemainingModalOpen]);

  useEffect(() => {
    if (!isRemainingModalOpen || !window.luxon) {
      return;
    }
    const today = window.luxon.DateTime.now();
    const todayEntries = getTodayEntries(entries, today);
    const hasStaleEntries = entries.some(
      (entry) => entry.datetime?.isValid && !entry.datetime.hasSame(today, 'day')
    );
    if (todayEntries.length < 3 || hasStaleEntries) {
      closeRemainingModal();
    }
  }, [entries, isRemainingModalOpen, nowTick]);

  const handleTimeInputChange = (e) => {
    setNewEntryTime(formatTimeInput(e.target.value));
  };

  const handleEditingTimeInputChange = (e) => {
    setEditingEntryValue(formatTimeInput(e.target.value));
  };

  const addEntry = (e) => {
    e.preventDefault();
    if (!window.luxon) {
      setMessage('Aguarde o carregamento e tente novamente.');
      return;
    }
    const today = window.luxon.DateTime.now();
    const hasStaleEntries = entries.some(
      (entry) => entry.datetime?.isValid && !entry.datetime.hasSame(today, 'day')
    );
    if (hasStaleEntries) {
      return;
    }
    if (!newEntryTime || !TIME_PATTERN.test(newEntryTime)) {
      setMessage('Por favor, insira um horário válido no formato HH:mm.');
      return;
    }

    const now = window.luxon.DateTime.now();
    const [hours, minutes] = newEntryTime.split(':');
    const datetime = now.set({
      hour: Number(hours),
      minute: Number(minutes),
      second: 0,
      millisecond: 0,
    });
    if (!datetime.isValid) {
      setMessage('Por favor, insira um horário válido no formato HH:mm.');
      return;
    }

    const newEntry = {
      id: crypto.randomUUID(),
      datetime,
    };

    setEntries((prevEntries) => {
      const updatedEntries = [...prevEntries, newEntry].sort(
        (a, b) => a.datetime.toMillis() - b.datetime.toMillis()
      );
      return updatedEntries;
    });
    setMessage('Marcação adicionada com sucesso!');
    setNewEntryTime('');
  };

  const removeEntry = (id) => {
    setEntries(entries.filter((entry) => entry.id !== id));
    setMessage('Marcação removida.');
  };

  const clearAllEntries = () => {
    closeRemainingModal();
    setEntries([]);
    setEditingEntryId(null);
    setMessage('Todas as marcações foram removidas.');
  };

  const startEditingEntry = (entry) => {
    setEditingEntryId(entry.id);
    setEditingEntryValue(entry.datetime.toFormat('HH:mm'));
  };

  const saveEditedEntry = (id) => {
    if (!editingEntryValue || !TIME_PATTERN.test(editingEntryValue)) {
      setMessage('Por favor, insira um horário válido no formato HH:mm.');
      return;
    }

    const updatedEntries = entries
      .map((entry) => {
        if (entry.id === id) {
          const [hours, minutes] = editingEntryValue.split(':');
          const newDatetime = entry.datetime.set({
            hour: Number(hours),
            minute: Number(minutes),
          });
          return { ...entry, datetime: newDatetime };
        }
        return entry;
      })
      .sort((a, b) => a.datetime.toMillis() - b.datetime.toMillis());
    setEntries(updatedEntries);
    setEditingEntryId(null);
    setMessage('Marcação atualizada com sucesso!');
  };

  const cancelEditingEntry = () => {
    setEditingEntryId(null);
  };

  const toggleEarlyExitOption = (option) => {
    setEarlyExitOption((current) => (current === option ? null : option));
  };

  const openRemainingModal = () => {
    if (!window.luxon) {
      return;
    }

    const today = window.luxon.DateTime.now();
    const todayEntries = getTodayEntries(entries, today);
    if (todayEntries.length < 3) {
      return;
    }

    const remainingSeconds = computeRemainingSeconds(
      todayEntries,
      workSchedule,
      earlyExitOption,
      today
    );
    if (remainingSeconds === null) {
      return;
    }

    const safeRemainingSeconds = Math.max(0, remainingSeconds);
    setRemainingSecondsLeft(safeRemainingSeconds);
    setRemainingDeadlineMs(Date.now() + safeRemainingSeconds * 1000);
    setIsRemainingModalOpen(true);
  };

  const saveSchedule = () => {
    setWorkSchedule(sanitizeWorkSchedule(editingSchedule));
    setIsEditingSchedule(false);
    setMessage('Jornada de trabalho atualizada!');
  };

  const isClockResult = CLOCK_RESULT_PATTERN.test(departureTime);
  const todayForUi = isLuxonReady && window.luxon ? window.luxon.DateTime.now() : null;
  const previousDayEntries = todayForUi
    ? entries.filter(
        (entry) => entry.datetime?.isValid && !entry.datetime.hasSame(todayForUi, 'day')
      )
    : [];
  const hasPreviousDayEntries = previousDayEntries.length > 0;
  const previousDayLabel = previousDayEntries[0]?.datetime.toFormat('dd/MM/yyyy') ?? '';
  const todayEntriesCount = todayForUi ? getTodayEntries(entries, todayForUi).length : 0;
  const canShowRemainingButton = todayEntriesCount >= 3 && !hasPreviousDayEntries;

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
                  className={`schedule-item ${day === currentDayInfo.weekdayKey ? 'schedule-item-highlight' : ''}`}
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
            <div className={`message ${message.startsWith('Por favor') || message.startsWith('Aguarde') ? 'error' : 'success'}`}>
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
          <div className="early-exit-options" role="group" aria-label="Ajustes de saída">
            <label className={`early-exit-option ${earlyExitOption === 'rule' ? 'is-selected' : ''}`}>
              <input
                type="checkbox"
                checked={earlyExitOption === 'rule'}
                onChange={() => toggleEarlyExitOption('rule')}
              />
              <span>
                <strong>Jogar na regra</strong>
                <small>Retira 10 minutos do horário de saída</small>
              </span>
            </label>
            <label className={`early-exit-option ${earlyExitOption === 'hourEarly' ? 'is-selected' : ''}`}>
              <input
                type="checkbox"
                checked={earlyExitOption === 'hourEarly'}
                onChange={() => toggleEarlyExitOption('hourEarly')}
              />
              <span>
                <strong>Sair uma hora mais cedo</strong>
                <small>Retira 59 minutos do horário de saída</small>
              </span>
            </label>
          </div>
          <div className="departure-header">
            <h2 className="departure-title">
              Horário de Saída
            </h2>
            {canShowRemainingButton && (
              <button
                type="button"
                className="remaining-check-button"
                onClick={openRemainingModal}
              >
                Ver tempo restante
              </button>
            )}
          </div>
          {departureTime ? (
            <div className="departure-card animated-pulse">
              {isClockResult && (
                <p className="departure-label">Seu horário de saída é:</p>
              )}
              <p className={`departure-time ${isClockResult ? '' : 'departure-status'}`}>
                {departureTime}
              </p>
            </div>
          ) : (
            <div className="departure-placeholder">
              <p className="departure-waiting-message">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-sparkles"><path d="M9.914 15.014c.3-.3.654-.515 1.05-.623.395-.107.818-.112 1.215-.013.398.1.758.33 1.037.643.278.314.475.698.572 1.11.097.412.112.846.04 1.267-.07.42-.266.81-.564 1.114"/><path d="M11 20.25a.75.75 0 0 1-.75.75H8.25a.75.75 0 0 1-.75-.75V18.5a.75.75 0 0 1 .75-.75H10.25a.75.75 0 0 1 .75.75v1.75z"/><path d="M12 11a1 1 0 0 1-1-1V3a1 1 0 0 1 2 0v7a1 1 0 0 1-1 1z"/><path d="m15.54 13.36 1.77-1.77a1 1 0 0 0 0-1.41L14.15 7.05a1 1 0 0 0-1.41 0L10.97 8.5a1 1 0 0 0 0 1.41l1.77 1.77a1 1 0 0 0 1.41 0z"/><path d="M7 11a1 1 0 0 1-1-1V3a1 1 0 0 1 2 0v7a1 1 0 0 1-1 1z"/><path d="m12.35 15.65-1.77 1.77a1 1 0 0 0 0 1.41l3.18 3.18a1 1 0 0 0 1.41 0l1.77-1.77a1 1 0 0 0 0-1.41l-3.18-3.18a1 1 0 0 0-1.41 0z"/></svg>
                Aguardando 3 ou mais marcações para calcular...
              </p>
            </div>
          )}
        </div>
      </div>
      {isRemainingModalOpen && !hasPreviousDayEntries && (
        <div className="new-day-modal-overlay" role="presentation" onClick={closeRemainingModal}>
          <div
            className="new-day-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remaining-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="remaining-modal-title">Tempo restante</h2>
            <p className="remaining-timer-value">
              {remainingSecondsLeft > 0
                ? formatDurationSeconds(remainingSecondsLeft)
                : 'Jornada completa!'}
            </p>
            <button
              type="button"
              className="remaining-check-button remaining-modal-close"
              onClick={closeRemainingModal}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
      {hasPreviousDayEntries && (
        <div className="new-day-modal-overlay" role="presentation">
          <div
            className="new-day-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-day-modal-title"
            aria-describedby="new-day-modal-description"
          >
            <h2 id="new-day-modal-title">Novo dia</h2>
            <p id="new-day-modal-description">
              As marcações salvas são do dia {previousDayLabel}. Para começar o dia de hoje
              ({currentDayInfo.date || 'atual'}), é preciso limpar as marcações anteriores.
            </p>
            <button
              type="button"
              className="clear-all-button new-day-modal-button"
              onClick={clearAllEntries}
              autoFocus
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-trash-clear"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              Limpar Tudo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
