import React, { useState, useEffect, useRef } from 'react';
import styles from './CustomCalendar.module.css';

const CustomCalendar = ({ 
  onDateSelect, 
  selectedCheckIn, 
  selectedCheckOut, 
  minDate,
  onClose 
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [hoveredDate, setHoveredDate] = useState(null);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  // ESC key handler
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && onClose) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const isSameDay = (date1, date2) => {
    if (!date1 || !date2) return false;
    return date1.toDateString() === date2.toDateString();
  };

  const isInRange = (date) => {
    if (!selectedCheckIn || !selectedCheckOut || !date) return false;
    return date > selectedCheckIn && date < selectedCheckOut;
  };

  const isHoverInRange = (date) => {
    if (!selectedCheckIn || selectedCheckOut || !hoveredDate || !date) return false;
    const start = selectedCheckIn < hoveredDate ? selectedCheckIn : hoveredDate;
    const end = selectedCheckIn < hoveredDate ? hoveredDate : selectedCheckIn;
    return date > start && date < end;
  };

  const isPastDate = (date) => {
    if (!date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const isBeforeMinDate = (date) => {
    if (!date || !minDate) return false;
    return date < minDate;
  };

  const handleDateClick = (date) => {
    if (isPastDate(date) || isBeforeMinDate(date)) return;
    onDateSelect(date);
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const handleClose = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onClose) {
      onClose();
    }
  };

  const getNextMonth = () => {
    return new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1);
  };

  const renderMonth = (monthDate) => {
    const days = getDaysInMonth(monthDate);
    
    return (
      <div className={styles.monthContainer}>
        <div className={styles.monthHeader}>
          <span className={styles.monthName}>
            {monthNames[monthDate.getMonth()]}
          </span>
          <span className={styles.monthYear}>
            {monthDate.getFullYear()}
          </span>
        </div>
        
        <div className={styles.weekDays}>
          {weekDays.map((day) => (
            <div key={day} className={styles.weekDay}>
              {day}
            </div>
          ))}
        </div>
        
        <div className={styles.daysGrid}>
          {days.map((date, index) => {
            if (!date) {
              return <div key={`empty-${index}`} className={styles.emptyDay} />;
            }
            
            const isDisabled = isPastDate(date) || isBeforeMinDate(date);
            const isCheckIn = isSameDay(date, selectedCheckIn);
            const isCheckOut = isSameDay(date, selectedCheckOut);
            const inRange = isInRange(date);
            const hoverRange = isHoverInRange(date);
            
            return (
              <button
                key={date.toISOString()}
                type="button"
                className={`
                  ${styles.day}
                  ${isDisabled ? styles.dayDisabled : ''}
                  ${isCheckIn ? styles.dayCheckIn : ''}
                  ${isCheckOut ? styles.dayCheckOut : ''}
                  ${inRange ? styles.dayInRange : ''}
                  ${hoverRange ? styles.dayHoverRange : ''}
                `}
                onClick={() => handleDateClick(date)}
                onMouseEnter={() => !isDisabled && setHoveredDate(date)}
                onMouseLeave={() => setHoveredDate(null)}
                disabled={isDisabled}
                aria-label={date.toLocaleDateString()}
              >
                <span className={styles.dayNumber}>{date.getDate()}</span>
                {isCheckIn && <span className={styles.dayLabel}>Check-in</span>}
                {isCheckOut && <span className={styles.dayLabel}>Check-out</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.calendar}>
      <div className={styles.calendarHeader}>
        <button
          type="button"
          className={styles.navButton}
          onClick={handlePrevMonth}
          aria-label="Previous month"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <button
          type="button"
          className={styles.closeButton}
          onClick={handleClose}
          aria-label="Close calendar"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        
        <button
          type="button"
          className={styles.navButton}
          onClick={handleNextMonth}
          aria-label="Next month"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
      
      <div className={styles.monthsContainer}>
        {renderMonth(currentMonth)}
        {renderMonth(getNextMonth())}
      </div>
      
      <div className={styles.calendarFooter}>
        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: '#d4af37' }}></span>
            <span>Selected</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: 'rgba(212, 175, 55, 0.2)' }}></span>
            <span>In Range</span>
          </div>
        </div>
        
        <div className={styles.footerActions}>
          <button
            type="button"
            className={styles.textButton}
            onClick={handleClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomCalendar;