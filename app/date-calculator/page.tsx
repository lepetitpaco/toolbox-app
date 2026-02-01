'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import styles from './date-calculator.module.css';

interface ParsedDuration {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

interface Timezone {
  name: string;
  label: string;
  tz: string;
}

const COMMON_TIMEZONES: Timezone[] = [
  { name: 'Paris', label: '🇫🇷 Paris (CET/CEST)', tz: 'Europe/Paris' },
  { name: 'London', label: '🇬🇧 London (GMT/BST)', tz: 'Europe/London' },
  { name: 'New York', label: '🇺🇸 New York (EST/EDT)', tz: 'America/New_York' },
  { name: 'Chicago', label: '🇺🇸 Chicago (CST/CDT)', tz: 'America/Chicago' },
  { name: 'Denver', label: '🇺🇸 Denver (MST/MDT)', tz: 'America/Denver' },
  { name: 'Los Angeles', label: '🇺🇸 Los Angeles (PST/PDT)', tz: 'America/Los_Angeles' },
  { name: 'Tokyo', label: '🇯🇵 Tokyo (JST)', tz: 'Asia/Tokyo' },
  { name: 'Sydney', label: '🇦🇺 Sydney (AEDT/AEST)', tz: 'Australia/Sydney' },
  { name: 'Melbourne', label: '🇦🇺 Melbourne (AEDT/AEST)', tz: 'Australia/Melbourne' },
  { name: 'UTC', label: '🌍 UTC', tz: 'UTC' },
];

export default function DateCalculatorPage() {

  // Section 1: Calcul de date (ajouter une durée)
  const [durationInput, setDurationInput] = useState<string>('');
  const [durationResult, setDurationResult] = useState<Date | null>(null);
  const [parsedDuration, setParsedDuration] = useState<ParsedDuration | null>(null);

  // Section 2: Convertisseur de timezone
  const [dateTimeInput, setDateTimeInput] = useState<string>('');
  const [timeInput, setTimeInput] = useState<string>('');
  const [fromTimezone, setFromTimezone] = useState<string>('Europe/Paris');
  const [toTimezone, setToTimezone] = useState<string>('America/New_York');
  const [convertedDate, setConvertedDate] = useState<Date | null>(null);

  // Section 3: Conversion date/heure vers timestamp et Discord
  const [dateTimeForTimestamp, setDateTimeForTimestamp] = useState<string>('');
  const [timeForTimestamp, setTimeForTimestamp] = useState<string>('');
  const [timestampResult, setTimestampResult] = useState<number | null>(null);
  const [discordFormats, setDiscordFormats] = useState<{ [key: string]: string }>({});

  // Section 4: Conversion timestamp vers date/heure
  const [timestampInput, setTimestampInput] = useState<string>('');
  const [timestampToDateResult, setTimestampToDateResult] = useState<Date | null>(null);

  // Section 5: Calcul jours ouvrés et ouvrables
  const [startDateInput, setStartDateInput] = useState<string>('');
  const [endDateInput, setEndDateInput] = useState<string>('');
  const [hoursPerDay, setHoursPerDay] = useState<number>(7);
  const [daysOff, setDaysOff] = useState<number>(0);
  const [workingDaysResult, setWorkingDaysResult] = useState<{ ouvres: number; ouvrables: number; total: number; feries: number; holidaysList: Array<{ date: Date; name: string }> } | null>(null);

  // Parse duration
  const parseDuration = useCallback((text: string): ParsedDuration | null => {
    const trimmed = text.trim();
    if (!trimmed) return null;

    const duration: ParsedDuration = {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };

    const patterns = [
      { regex: /(\d+)\s*(?:j|jours?|jour)\b/gi, unit: 'days' as const },
      { regex: /(\d+)\s*(?:h|heures?|heure)\b/gi, unit: 'hours' as const },
      { regex: /(\d+)\s*(?:m|minutes?|minute)\b/gi, unit: 'minutes' as const },
      { regex: /(\d+)\s*(?:s|secondes?|seconde)\b/gi, unit: 'seconds' as const },
    ];

    let hasMatch = false;
    patterns.forEach(({ regex, unit }) => {
      const matches = trimmed.matchAll(regex);
      for (const match of matches) {
        const value = parseInt(match[1], 10);
        if (!isNaN(value) && value >= 0) {
          duration[unit] += value;
          hasMatch = true;
        }
      }
    });

    if (!hasMatch) {
      const simplePattern = /(\d+)\s*([jJhHmMsS])/g;
      let match;
      while ((match = simplePattern.exec(trimmed)) !== null) {
        const value = parseInt(match[1], 10);
        const unit = match[2].toLowerCase();
        if (!isNaN(value) && value >= 0) {
          switch (unit) {
            case 'j':
              duration.days += value;
              hasMatch = true;
              break;
            case 'h':
              duration.hours += value;
              hasMatch = true;
              break;
            case 'm':
              duration.minutes += value;
              hasMatch = true;
              break;
            case 's':
              duration.seconds += value;
              hasMatch = true;
              break;
          }
        }
      }
    }

    return hasMatch ? duration : null;
  }, []);

  // Calculate date from duration
  const calculateDate = useCallback((duration: ParsedDuration): Date => {
    const now = new Date();
    const result = new Date(now);
    result.setDate(result.getDate() + duration.days);
    result.setHours(result.getHours() + duration.hours);
    result.setMinutes(result.getMinutes() + duration.minutes);
    result.setSeconds(result.getSeconds() + duration.seconds);
    return result;
  }, []);

  // Parse date/time input
  const parseDateTime = useCallback((input: string): Date | null => {
    if (!input.trim()) return null;
    
    // Try ISO format first
    let date = new Date(input);
    if (!isNaN(date.getTime())) {
      return date;
    }

    // Try common formats (with and without time)
    const formats = [
      /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/,
      /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/,
      /^(\d{4})-(\d{2})-(\d{2})$/,
      /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/,
      /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/,
      /^(\d{2})\/(\d{2})\/(\d{4})$/,
    ];

    for (const format of formats) {
      const match = input.match(format);
      if (match) {
        if (format === formats[0] || format === formats[1] || format === formats[2]) {
          // YYYY-MM-DD (with or without time)
          const year = parseInt(match[1], 10);
          const month = parseInt(match[2], 10) - 1;
          const day = parseInt(match[3], 10);
          const hour = parseInt(match[4] || '0', 10);
          const minute = parseInt(match[5] || '0', 10);
          const second = parseInt(match[6] || '0', 10);
          date = new Date(year, month, day, hour, minute, second);
        } else {
          // DD/MM/YYYY (with or without time)
          const day = parseInt(match[1], 10);
          const month = parseInt(match[2], 10) - 1;
          const year = parseInt(match[3], 10);
          const hour = parseInt(match[4] || '0', 10);
          const minute = parseInt(match[5] || '0', 10);
          const second = parseInt(match[6] || '0', 10);
          date = new Date(year, month, day, hour, minute, second);
        }
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    return null;
  }, []);

  // Convert timezone - the input date is interpreted as being in fromTz, we show what time it is in toTz
  // This is a simplified approach: we'll display the same moment in time in different timezones
  const convertTimezone = useCallback((date: Date, fromTz: string, toTz: string): Date => {
    // For simplicity, we'll just return the same date object
    // The actual conversion happens in the display formatting
    // This function is kept for consistency but the real work is in formatDateInTimezone
    return date;
  }, []);

  // Format date in timezone
  const formatDateInTimezone = useCallback((date: Date, tz: string): string => {
    return date.toLocaleString('fr-FR', {
      timeZone: tz,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }, []);

  // Format date short
  const formatDateShort = (date: Date, tz?: string): string => {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    };
    if (tz) {
      options.timeZone = tz;
    }
    return date.toLocaleDateString('fr-FR', options);
  };

  // Generate Discord timestamps
  const generateDiscordFormats = useCallback((timestamp: number) => {
    return {
      shortTime: `<t:${timestamp}:t>`,
      longTime: `<t:${timestamp}:T>`,
      shortDate: `<t:${timestamp}:d>`,
      longDate: `<t:${timestamp}:D>`,
      shortDateTime: `<t:${timestamp}:f>`,
      longDateTime: `<t:${timestamp}:F>`,
      relative: `<t:${timestamp}:R>`,
    };
  }, []);

  // Calculate Easter date (Gauss algorithm)
  const calculateEaster = useCallback((year: number): Date => {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }, []);

  // Get holiday name
  const getHolidayName = useCallback((date: Date, year: number): string => {
    const month = date.getMonth();
    const day = date.getDate();
    
    // Fixed holidays
    if (month === 0 && day === 1) return 'Jour de l\'An';
    if (month === 4 && day === 1) return 'Fête du Travail';
    if (month === 4 && day === 8) return 'Victoire 1945';
    if (month === 6 && day === 14) return 'Fête Nationale';
    if (month === 7 && day === 15) return 'Assomption';
    if (month === 10 && day === 1) return 'Toussaint';
    if (month === 10 && day === 11) return 'Armistice 1918';
    if (month === 11 && day === 25) return 'Noël';

    // Variable holidays (based on Easter)
    const easter = calculateEaster(year);
    const easterMonday = new Date(easter);
    easterMonday.setDate(easterMonday.getDate() + 1);
    if (date.getTime() === easterMonday.getTime()) return 'Lundi de Pâques';

    const ascension = new Date(easter);
    ascension.setDate(ascension.getDate() + 39);
    if (date.getTime() === ascension.getTime()) return 'Ascension';

    const whitMonday = new Date(easter);
    whitMonday.setDate(whitMonday.getDate() + 50);
    if (date.getTime() === whitMonday.getTime()) return 'Lundi de Pentecôte';

    return 'Jour férié';
  }, [calculateEaster]);

  // Get all French public holidays for a year
  const getFrenchHolidays = useCallback((year: number): Date[] => {
    const holidays: Date[] = [];
    
    // Fixed holidays
    holidays.push(new Date(year, 0, 1));   // Jour de l'An
    holidays.push(new Date(year, 4, 1));   // Fête du Travail
    holidays.push(new Date(year, 4, 8));   // Victoire 1945
    holidays.push(new Date(year, 6, 14));  // Fête Nationale
    holidays.push(new Date(year, 7, 15));  // Assomption
    holidays.push(new Date(year, 10, 1));  // Toussaint
    holidays.push(new Date(year, 10, 11)); // Armistice 1918
    holidays.push(new Date(year, 11, 25)); // Noël

    // Variable holidays (based on Easter)
    const easter = calculateEaster(year);
    const easterMonday = new Date(easter);
    easterMonday.setDate(easterMonday.getDate() + 1);
    holidays.push(easterMonday); // Lundi de Pâques

    const ascension = new Date(easter);
    ascension.setDate(ascension.getDate() + 39);
    holidays.push(ascension); // Ascension

    const whitMonday = new Date(easter);
    whitMonday.setDate(whitMonday.getDate() + 50);
    holidays.push(whitMonday); // Lundi de Pentecôte

    return holidays;
  }, [calculateEaster]);

  // Check if a date is a public holiday
  const isHoliday = useCallback((date: Date, holidays: Date[]): boolean => {
    const dateStr = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    return holidays.some(holiday => {
      const holidayStr = `${holiday.getFullYear()}-${holiday.getMonth()}-${holiday.getDate()}`;
      return dateStr === holidayStr;
    });
  }, []);

  // Calculate working days (jours ouvrés: Monday-Friday, excluding holidays)
  const calculateWorkingDays = useCallback((startDate: Date, endDate: Date) => {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    if (start > end) {
      return null;
    }

    // Get all holidays for the years in range
    const years = new Set<number>();
    const tempDate = new Date(start);
    while (tempDate <= end) {
      years.add(tempDate.getFullYear());
      tempDate.setDate(tempDate.getDate() + 1);
    }

    const allHolidays: Date[] = [];
    years.forEach(year => {
      allHolidays.push(...getFrenchHolidays(year));
    });

    let ouvres = 0;      // Monday-Friday, excluding holidays
    let ouvrables = 0;   // Monday-Saturday, excluding holidays
    let total = 0;       // Total days in range
    let feries = 0;      // Number of holidays in range
    const holidaysList: Array<{ date: Date; name: string }> = [];

    const current = new Date(start);
    const maxIterations = 10000; // Safety limit to prevent infinite loops
    let iterations = 0;
    
    while (current <= end && iterations < maxIterations) {
      iterations++;
      total++;
      const dayOfWeek = current.getDay(); // 0 = Sunday, 6 = Saturday
      const isHolidayDay = isHoliday(current, allHolidays);

      if (isHolidayDay) {
        feries++;
        const holidayName = getHolidayName(current, current.getFullYear());
        holidaysList.push({ date: new Date(current), name: holidayName });
      }

      // Jours ouvrables: Monday (1) to Saturday (6), excluding holidays
      if (dayOfWeek >= 1 && dayOfWeek <= 6 && !isHolidayDay) {
        ouvrables++;
      }

      // Jours ouvrés: Monday (1) to Friday (5), excluding holidays
      if (dayOfWeek >= 1 && dayOfWeek <= 5 && !isHolidayDay) {
        ouvres++;
      }

      const nextDate = new Date(current);
      nextDate.setDate(nextDate.getDate() + 1);
      
      // Safety check: ensure date is progressing
      if (nextDate.getTime() <= current.getTime()) {
        console.error('[Date Calculator] Erreur: Date not progressing, breaking loop');
        break;
      }
      
      current.setTime(nextDate.getTime());
    }
    
    if (iterations >= maxIterations) {
      console.error('[Date Calculator] Erreur: Max iterations reached, possible infinite loop');
      return null;
    }

    // Sort holidays by date
    holidaysList.sort((a, b) => a.date.getTime() - b.date.getTime());

    return { ouvres, ouvrables, total, feries, holidaysList };
  }, [getFrenchHolidays, isHoliday, getHolidayName]);

  // Section 1: Calculate date from duration
  useEffect(() => {
    if (!durationInput.trim()) {
      setDurationResult(null);
      setParsedDuration(null);
      return;
    }

    const parsed = parseDuration(durationInput);
    if (parsed) {
      setParsedDuration(parsed);
      const calculated = calculateDate(parsed);
      setDurationResult(calculated);
    } else {
      setDurationResult(null);
      setParsedDuration(null);
    }
  }, [durationInput, parseDuration, calculateDate]);

  // Section 2: Convert timezone
  useEffect(() => {
    if (!dateTimeInput) {
      setConvertedDate(null);
      return;
    }
    
    // Combine date and time inputs
    const dateTimeString = timeInput ? `${dateTimeInput}T${timeInput}` : `${dateTimeInput}T00:00`;
    const date = new Date(dateTimeString);
    
    if (!isNaN(date.getTime())) {
      setConvertedDate(date);
    } else {
      setConvertedDate(null);
    }
  }, [dateTimeInput, timeInput]);

  // Section 3: Convert date to timestamp
  useEffect(() => {
    if (!dateTimeForTimestamp) {
      setTimestampResult(null);
      setDiscordFormats({});
      return;
    }
    
    // Combine date and time inputs
    const dateTimeString = timeForTimestamp ? `${dateTimeForTimestamp}T${timeForTimestamp}` : `${dateTimeForTimestamp}T00:00`;
    const date = new Date(dateTimeString);
    
    if (!isNaN(date.getTime())) {
      const timestamp = Math.floor(date.getTime() / 1000);
      setTimestampResult(timestamp);
      setDiscordFormats(generateDiscordFormats(timestamp));
    } else {
      setTimestampResult(null);
      setDiscordFormats({});
    }
  }, [dateTimeForTimestamp, timeForTimestamp, generateDiscordFormats]);

  // Section 4: Convert timestamp to date
  useEffect(() => {
    if (!timestampInput.trim()) {
      setTimestampToDateResult(null);
      return;
    }

    const timestamp = parseInt(timestampInput, 10);
    if (!isNaN(timestamp) && timestamp > 0) {
      // Support both seconds and milliseconds
      const date = timestamp < 10000000000 
        ? new Date(timestamp * 1000) 
        : new Date(timestamp);
      if (!isNaN(date.getTime())) {
        setTimestampToDateResult(date);
      } else {
        setTimestampToDateResult(null);
      }
    } else {
      setTimestampToDateResult(null);
    }
  }, [timestampInput]);

  // Section 5: Calculate working days
  useEffect(() => {
    if (!startDateInput || !endDateInput) {
      setWorkingDaysResult(null);
      return;
    }

    const startDate = new Date(startDateInput);
    const endDate = new Date(endDateInput);

    if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
      // Reset time to start of day
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);

      const result = calculateWorkingDays(startDate, endDate);
      setWorkingDaysResult(result);
    } else {
      setWorkingDaysResult(null);
    }
  }, [startDateInput, endDateInput, calculateWorkingDays]);

  const formatDuration = (duration: ParsedDuration): string => {
    const parts: string[] = [];
    if (duration.days > 0) parts.push(`${duration.days} jour${duration.days > 1 ? 's' : ''}`);
    if (duration.hours > 0) parts.push(`${duration.hours} heure${duration.hours > 1 ? 's' : ''}`);
    if (duration.minutes > 0) parts.push(`${duration.minutes} minute${duration.minutes > 1 ? 's' : ''}`);
    if (duration.seconds > 0) parts.push(`${duration.seconds} seconde${duration.seconds > 1 ? 's' : ''}`);
    return parts.length > 0 ? parts.join(', ') : '0';
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      console.log(`[Date Calculator] ${label} copié avec succès`);
    }).catch((error) => {
      console.error(`[Date Calculator] Erreur lors de la copie:`, error);
    });
  };

  const setNow = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    const dateStr = `${year}-${month}-${day}`;
    const timeStr = `${hours}:${minutes}`;
    
    setDateTimeInput(dateStr);
    setTimeInput(timeStr);
    setDateTimeForTimestamp(dateStr);
    setTimeForTimestamp(timeStr);
  };

  return (
    <div className={styles.container}>
      <Link href="/" className={styles.backButton}>
        ← Retour
      </Link>
      <h1 className={styles.title}>🕐 Outil de Dates</h1>

      {/* Section 1: Calcul de date */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>1. Calcul de Date (Ajouter une durée)</h2>
        <div className={styles.inputGroup}>
          <label htmlFor="durationInput" className={styles.label}>
            Durée à ajouter :
          </label>
          <input
            id="durationInput"
            type="text"
            className={styles.input}
            placeholder="Ex: 7J et 4h, 7 jours 4 heures, 7j 4h 30m..."
            value={durationInput}
            onChange={(e) => setDurationInput(e.target.value)}
          />
          <div className={styles.examples}>
            <button type="button" className={styles.exampleButton} onClick={() => setDurationInput('7J et 4h')}>
              7J et 4h
            </button>
            <button type="button" className={styles.exampleButton} onClick={() => setDurationInput('2 jours 3h 30m')}>
              2 jours 3h 30m
            </button>
          </div>
        </div>

        {parsedDuration && durationResult && (
          <div className={styles.resultBox}>
            <div className={styles.resultLabel}>Durée parsée : {formatDuration(parsedDuration)}</div>
            <div className={styles.resultValue}>{formatDateShort(durationResult)}</div>
            <div className={styles.resultActions}>
              <button onClick={() => handleCopy(formatDateShort(durationResult), 'Date')} className={styles.copyButton}>
                📋 Copier
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Section 2: Convertisseur de timezone */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>2. Convertisseur de Timezone</h2>
        <div className={styles.inputGroup}>
          <label htmlFor="dateTimeInput" className={styles.label}>
            Date et heure :
          </label>
          <div className={styles.inputRow}>
            <input
              id="dateTimeInput"
              type="date"
              className={styles.input}
              value={dateTimeInput}
              onChange={(e) => setDateTimeInput(e.target.value)}
            />
            <input
              type="time"
              className={styles.input}
              value={timeInput}
              onChange={(e) => setTimeInput(e.target.value)}
            />
            <button type="button" onClick={setNow} className={styles.nowButton}>
              Maintenant
            </button>
          </div>
        </div>

        <div className={styles.timezoneRow}>
          <div className={styles.timezoneGroup}>
            <label className={styles.label}>De :</label>
            <select
              className={styles.select}
              value={fromTimezone}
              onChange={(e) => setFromTimezone(e.target.value)}
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz.tz} value={tz.tz}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.timezoneGroup}>
            <label className={styles.label}>Vers :</label>
            <select
              className={styles.select}
              value={toTimezone}
              onChange={(e) => setToTimezone(e.target.value)}
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz.tz} value={tz.tz}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {convertedDate && (
          <div className={styles.resultBox}>
            <div className={styles.resultLabel}>
              Dans {COMMON_TIMEZONES.find(tz => tz.tz === fromTimezone)?.label} : {formatDateShort(convertedDate, fromTimezone)}
            </div>
            <div className={styles.resultLabel} style={{ marginTop: '1rem' }}>
              Dans {COMMON_TIMEZONES.find(tz => tz.tz === toTimezone)?.label} :
            </div>
            <div className={styles.resultValue}>{formatDateInTimezone(convertedDate, toTimezone)}</div>
            <div className={styles.resultValueShort}>{formatDateShort(convertedDate, toTimezone)}</div>
            <div className={styles.resultActions}>
              <button onClick={() => handleCopy(formatDateShort(convertedDate, toTimezone), 'Date')} className={styles.copyButton}>
                📋 Copier
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Section 3: Date vers Timestamp et Discord */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>3. Date → Timestamp Unix & Formats Discord</h2>
        <div className={styles.inputGroup}>
          <label htmlFor="dateTimeForTimestamp" className={styles.label}>
            Date et heure :
          </label>
          <div className={styles.inputRow}>
            <input
              id="dateTimeForTimestamp"
              type="date"
              className={styles.input}
              value={dateTimeForTimestamp}
              onChange={(e) => setDateTimeForTimestamp(e.target.value)}
            />
            <input
              type="time"
              className={styles.input}
              value={timeForTimestamp}
              onChange={(e) => setTimeForTimestamp(e.target.value)}
            />
            <button type="button" onClick={setNow} className={styles.nowButton}>
              Maintenant
            </button>
          </div>
        </div>

        {timestampResult !== null && (
          <div className={styles.resultBox}>
            <div className={styles.resultRow}>
              <div className={styles.resultLabel}>Timestamp Unix (secondes) :</div>
              <div className={styles.resultValueCode}>{timestampResult}</div>
              <button onClick={() => handleCopy(timestampResult.toString(), 'Timestamp')} className={styles.copyButtonSmall}>
                📋
              </button>
            </div>

            <div className={styles.discordFormats}>
              <div className={styles.discordFormatRow}>
                <span className={styles.discordLabel}>Court (heure) :</span>
                <code className={styles.discordCode}>{discordFormats.shortTime}</code>
                <button onClick={() => handleCopy(discordFormats.shortTime, 'Format Discord')} className={styles.copyButtonSmall}>
                  📋
                </button>
              </div>
              <div className={styles.discordFormatRow}>
                <span className={styles.discordLabel}>Long (heure) :</span>
                <code className={styles.discordCode}>{discordFormats.longTime}</code>
                <button onClick={() => handleCopy(discordFormats.longTime, 'Format Discord')} className={styles.copyButtonSmall}>
                  📋
                </button>
              </div>
              <div className={styles.discordFormatRow}>
                <span className={styles.discordLabel}>Court (date) :</span>
                <code className={styles.discordCode}>{discordFormats.shortDate}</code>
                <button onClick={() => handleCopy(discordFormats.shortDate, 'Format Discord')} className={styles.copyButtonSmall}>
                  📋
                </button>
              </div>
              <div className={styles.discordFormatRow}>
                <span className={styles.discordLabel}>Long (date) :</span>
                <code className={styles.discordCode}>{discordFormats.longDate}</code>
                <button onClick={() => handleCopy(discordFormats.longDate, 'Format Discord')} className={styles.copyButtonSmall}>
                  📋
                </button>
              </div>
              <div className={styles.discordFormatRow}>
                <span className={styles.discordLabel}>Court (date+heure) :</span>
                <code className={styles.discordCode}>{discordFormats.shortDateTime}</code>
                <button onClick={() => handleCopy(discordFormats.shortDateTime, 'Format Discord')} className={styles.copyButtonSmall}>
                  📋
                </button>
              </div>
              <div className={styles.discordFormatRow}>
                <span className={styles.discordLabel}>Long (date+heure) :</span>
                <code className={styles.discordCode}>{discordFormats.longDateTime}</code>
                <button onClick={() => handleCopy(discordFormats.longDateTime, 'Format Discord')} className={styles.copyButtonSmall}>
                  📋
                </button>
              </div>
              <div className={styles.discordFormatRow}>
                <span className={styles.discordLabel}>Relatif :</span>
                <code className={styles.discordCode}>{discordFormats.relative}</code>
                <button onClick={() => handleCopy(discordFormats.relative, 'Format Discord')} className={styles.copyButtonSmall}>
                  📋
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Section 4: Timestamp vers Date */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>4. Timestamp Unix → Date</h2>
        <div className={styles.inputGroup}>
          <label htmlFor="timestampInput" className={styles.label}>
            Timestamp Unix (secondes ou millisecondes) :
          </label>
          <input
            id="timestampInput"
            type="text"
            className={styles.input}
            placeholder="Ex: 1704067200 ou 1704067200000"
            value={timestampInput}
            onChange={(e) => setTimestampInput(e.target.value)}
          />
        </div>

        {timestampToDateResult && (
          <div className={styles.resultBox}>
            <div className={styles.resultValue}>{formatDateShort(timestampToDateResult)}</div>
            <div className={styles.resultActions}>
              <button onClick={() => handleCopy(formatDateShort(timestampToDateResult), 'Date')} className={styles.copyButton}>
                📋 Copier
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Section 5: Calcul jours ouvrés et ouvrables */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>5. Calcul Jours Ouvrés & Ouvrables (France)</h2>
        <div className={styles.inputGroup}>
          <label htmlFor="startDateInput" className={styles.label}>
            Date de début :
          </label>
          <input
            id="startDateInput"
            type="date"
            className={styles.input}
            value={startDateInput}
            onChange={(e) => setStartDateInput(e.target.value)}
          />
        </div>
        <div className={styles.inputGroup}>
          <label htmlFor="endDateInput" className={styles.label}>
            Date de fin :
          </label>
          <input
            id="endDateInput"
            type="date"
            className={styles.input}
            value={endDateInput}
            onChange={(e) => setEndDateInput(e.target.value)}
          />
        </div>
        <div className={styles.inputGroup}>
          <label htmlFor="hoursPerDayInput" className={styles.label}>
            Heures travaillées par jour (contrat) :
          </label>
          <input
            id="hoursPerDayInput"
            type="number"
            min="0"
            max="24"
            step="0.5"
            className={styles.input}
            value={hoursPerDay}
            onChange={(e) => {
              const value = parseFloat(e.target.value);
              if (!isNaN(value) && value >= 0 && value <= 24) {
                setHoursPerDay(value);
              }
            }}
          />
          <div className={styles.inputHint}>Contrat 35h = 7h/jour (Lundi-Vendredi)</div>
        </div>
        <div className={styles.inputGroup}>
          <label htmlFor="daysOffInput" className={styles.label}>
            Jours de congé pris :
          </label>
          <input
            id="daysOffInput"
            type="number"
            min="0"
            step="0.5"
            className={styles.input}
            value={daysOff}
            onChange={(e) => {
              const value = parseFloat(e.target.value);
              if (!isNaN(value) && value >= 0) {
                setDaysOff(value);
              }
            }}
          />
          <div className={styles.inputHint}>Nombre de jours de congé à déduire</div>
        </div>

        {workingDaysResult && (
          <div className={styles.resultBox}>
            <div className={styles.resultLabel}>Résultats pour l'intervalle :</div>
            <div className={styles.workingDaysGrid}>
              <div className={styles.workingDayCard}>
                <div className={styles.workingDayLabel}>Jours ouvrés</div>
                <div className={styles.workingDayValue}>{workingDaysResult.ouvres}</div>
                <div className={styles.workingDayDesc}>(Lundi-Vendredi, hors jours fériés)</div>
              </div>
              <div className={styles.workingDayCard}>
                <div className={styles.workingDayLabel}>Jours ouvrables</div>
                <div className={styles.workingDayValue}>{workingDaysResult.ouvrables}</div>
                <div className={styles.workingDayDesc}>(Lundi-Samedi, hors jours fériés)</div>
              </div>
              <div className={styles.workingDayCard}>
                <div className={styles.workingDayLabel}>Total jours</div>
                <div className={styles.workingDayValue}>{workingDaysResult.total}</div>
                <div className={styles.workingDayDesc}>(Tous les jours de l'intervalle)</div>
              </div>
              <div className={styles.workingDayCard}>
                <div className={styles.workingDayLabel}>Jours fériés</div>
                <div className={styles.workingDayValue}>{workingDaysResult.feries}</div>
                <div className={styles.workingDayDesc}>(Jours fériés français inclus)</div>
              </div>
              <div className={styles.workingDayCard}>
                <div className={styles.workingDayLabel}>Heures travaillées (brut)</div>
                <div className={styles.workingDayValue}>
                  {Math.round(workingDaysResult.ouvres * hoursPerDay * 10) / 10}h
                </div>
                <div className={styles.workingDayDesc}>
                  ({workingDaysResult.ouvres} jours × {hoursPerDay}h/jour)
                </div>
              </div>
              {daysOff > 0 && (
                <div className={styles.workingDayCard}>
                  <div className={styles.workingDayLabel}>Heures déduites (congés)</div>
                  <div className={styles.workingDayValue} style={{ color: '#dc2626' }}>
                    -{Math.round(daysOff * hoursPerDay * 10) / 10}h
                  </div>
                  <div className={styles.workingDayDesc}>
                    ({daysOff} jours × {hoursPerDay}h/jour)
                  </div>
                </div>
              )}
              <div className={styles.workingDayCard}>
                <div className={styles.workingDayLabel}>Heures travaillées (net)</div>
                <div className={styles.workingDayValue} style={{ color: '#16a34a' }}>
                  {Math.round((workingDaysResult.ouvres * hoursPerDay - daysOff * hoursPerDay) * 10) / 10}h
                </div>
                <div className={styles.workingDayDesc}>
                  (Brut - congés)
                </div>
              </div>
              {(() => {
                const startDate = startDateInput ? new Date(startDateInput) : null;
                const endDate = endDateInput ? new Date(endDateInput) : null;
                if (startDate && endDate && !isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                  const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                                    (endDate.getMonth() - startDate.getMonth()) + 
                                    (endDate.getDate() >= startDate.getDate() ? 0 : -1);
                  const actualMonths = Math.max(1, monthsDiff + 1); // Au moins 1 mois
                  const hoursPerMonth = (workingDaysResult.ouvres * hoursPerDay - daysOff * hoursPerDay) / actualMonths;
                  return (
                    <div className={styles.workingDayCard}>
                      <div className={styles.workingDayLabel}>Heures par mois</div>
                      <div className={styles.workingDayValue} style={{ color: '#2563eb' }}>
                        {Math.round(hoursPerMonth * 10) / 10}h
                      </div>
                      <div className={styles.workingDayDesc}>
                        (Net ÷ {actualMonths} mois)
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
            {workingDaysResult.holidaysList.length > 0 && (
              <div className={styles.holidaysList}>
                <div className={styles.resultLabel} style={{ marginTop: '1.5rem', marginBottom: '0.75rem' }}>
                  Jours fériés dans l'intervalle :
                </div>
                <div className={styles.holidaysGrid}>
                  {workingDaysResult.holidaysList.map((holiday, index) => (
                    <div key={index} className={styles.holidayItem}>
                      <div className={styles.holidayDate}>
                        {holiday.date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                      <div className={styles.holidayName}>{holiday.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
