'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './countdown.module.css';

export default function CountdownPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [countdownName, setCountdownName] = useState<string>('');
  const [userTime, setUserTime] = useState<string>('');
  const [hours, setHours] = useState<string>('00');
  const [minutes, setMinutes] = useState<string>('00');
  const [seconds, setSeconds] = useState<string>('00');
  const [isActive, setIsActive] = useState<boolean>(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Check URL params on mount
  useEffect(() => {
    const name = searchParams.get('name');
    const time = searchParams.get('time');

    if (time && name) {
      setUserTime(time);
      setCountdownName(name);
      startCountdown(time, name);
    }
  }, [searchParams]);

  // Update document title when countdown name changes
  useEffect(() => {
    if (countdownName && isActive) {
      document.title = countdownName;
    } else {
      document.title = 'Countdown - Toolbox';
    }
  }, [countdownName, isActive]);

  const startCountdown = (time: string, name: string) => {
    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    setIsActive(true);

    const updateCountdown = () => {
      const currentTime = new Date();
      const targetTime = new Date(currentTime);
      const [targetHours, targetMinutes] = time.split(':').map(num => parseInt(num, 10));

      targetTime.setHours(targetHours, targetMinutes, 0, 0);

      // If target time has passed today, set it for tomorrow
      if (currentTime > targetTime) {
        targetTime.setDate(targetTime.getDate() + 1);
      }

      const diff = targetTime.getTime() - currentTime.getTime();

      if (diff <= 0) {
        // Countdown finished
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setIsActive(false);
        setHours('00');
        setMinutes('00');
        setSeconds('00');

        // Show notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('DRING DRING !!!', {
            body: `It is ${name}`,
            icon: '/favicon.ico',
          });
        } else {
          alert(`It is ${name}`);
        }
        return;
      }

      const h = Math.floor(diff / (1000 * 60 * 60)).toString().padStart(2, '0');
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
      const s = Math.floor((diff % (1000 * 60)) / 1000).toString().padStart(2, '0');

      setHours(h);
      setMinutes(m);
      setSeconds(s);
    };

    // Update immediately
    updateCountdown();

    // Update every second
    intervalRef.current = setInterval(updateCountdown, 1000);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!countdownName.trim() || !userTime) {
      return;
    }

    startCountdown(userTime, countdownName);

    // Update URL with parameters for persistence
    const newUrl = `/countdown?name=${encodeURIComponent(countdownName)}&time=${encodeURIComponent(userTime)}`;
    router.push(newUrl);
  };

  const handleReset = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsActive(false);
    setCountdownName('');
    setUserTime('');
    setHours('00');
    setMinutes('00');
    setSeconds('00');
    router.push('/countdown');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return (
    <div className={styles.container}>
      <Link href="/" className={styles.backButton}>
        ← Retour
      </Link>
      <div className={styles.countdownContainer}>
        <h1 className={styles.title}>Countdown</h1>
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="text"
            id="countdownName"
            className={styles.input}
            placeholder="Countdown Name"
            value={countdownName}
            onChange={(e) => setCountdownName(e.target.value)}
            required
            disabled={isActive}
          />
          <input
            type="time"
            id="userTime"
            className={styles.input}
            value={userTime}
            onChange={(e) => setUserTime(e.target.value)}
            required
            disabled={isActive}
          />
          <div className={styles.buttonGroup}>
            <button type="submit" className={styles.startButton} disabled={isActive}>
              Start
            </button>
            {isActive && (
              <button type="button" onClick={handleReset} className={styles.resetButton}>
                Reset
              </button>
            )}
          </div>
        </form>

        <div className={styles.countdown}>
          <div className={styles.timeSection}>
            <span className={styles.time}>{hours}</span>
            <div className={styles.label}>Hours</div>
          </div>
          <div className={styles.timeSection}>
            <span className={styles.time}>{minutes}</span>
            <div className={styles.label}>Minutes</div>
          </div>
          <div className={styles.timeSection}>
            <span className={styles.time}>{seconds}</span>
            <div className={styles.label}>Seconds</div>
          </div>
        </div>
      </div>
    </div>
  );
}
