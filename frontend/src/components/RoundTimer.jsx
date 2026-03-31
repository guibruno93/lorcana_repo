import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import './RoundTimer.css';

function playAlarmBeeps() {
  const beep = (delay) => {
    setTimeout(() => {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const audioContext = new Ctx();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.35);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.35);
      } catch {
        /* ignore */
      }
    }, delay);
  };
  beep(0);
  beep(400);
  beep(800);
}

export default function RoundTimer({ durationMinutes, onTimeUp, roundNumber }) {
  const { t } = useTranslation();
  const initial = Math.max(60, (durationMinutes || 50) * 60);
  const [timeLeft, setTimeLeft] = useState(initial);
  const [isPaused, setIsPaused] = useState(false);
  const alarmFired = useRef(false);

  useEffect(() => {
    alarmFired.current = false;
    setTimeLeft(Math.max(60, (durationMinutes || 50) * 60));
    setIsPaused(false);
  }, [durationMinutes, roundNumber]);

  useEffect(() => {
    if (isPaused) return undefined;
    const id = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (!alarmFired.current) {
            alarmFired.current = true;
            playAlarmBeeps();
            onTimeUp?.();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isPaused, onTimeUp]);

  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, []);

  const addMinutes = (mins) => {
    setTimeLeft((prev) => prev + mins * 60);
    alarmFired.current = false;
  };

  const reset = () => {
    setTimeLeft(Math.max(60, (durationMinutes || 50) * 60));
    setIsPaused(false);
    alarmFired.current = false;
  };

  const isLowTime = timeLeft <= 300 && timeLeft > 60;
  const isCritical = timeLeft <= 60 && timeLeft > 0;

  const wrapClass = [
    'round-timer',
    isCritical ? 'critical' : '',
    isLowTime ? 'warning' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapClass}>
      <div className="timer-label">
        {t('tournamentsOrg.roundLabel', { n: roundNumber })}
      </div>
      <div className="timer-display" aria-live="polite">
        {formatTime(timeLeft)}
      </div>
      <div className="timer-controls">
        <button
          type="button"
          className="btn-timer"
          onClick={() => setIsPaused((p) => !p)}
          aria-label={isPaused ? t('tournamentsOrg.timerResume') : t('tournamentsOrg.timerPause')}
        >
          {isPaused ? '▶️' : '⏸️'}
        </button>
        <button type="button" className="btn-timer" onClick={reset} aria-label={t('tournamentsOrg.timerReset')}>
          🔄
        </button>
        <button type="button" className="btn-timer" onClick={() => addMinutes(5)}>
          +5 {t('tournamentsOrg.min')}
        </button>
      </div>
      {timeLeft === 0 && (
        <div className="time-up-alert" role="alert">
          {t('tournamentsOrg.timeUp')}
        </div>
      )}
    </div>
  );
}
