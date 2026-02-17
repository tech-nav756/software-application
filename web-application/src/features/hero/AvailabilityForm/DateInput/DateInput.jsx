import React from 'react';
import styles from './DateInput.module.css';

const DateInput = ({ label, value, onClick, id, isOpen }) => {
  const formatDate = (dateString) => {
    if (!dateString) return 'Select date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  return (
    <div className={styles.inputGroup}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <button
        type="button"
        id={id}
        className={`${styles.dateButton} ${isOpen ? styles.dateButtonOpen : ''} ${value ? styles.dateButtonFilled : ''}`}
        onClick={onClick}
        aria-label={`${label}: ${formatDate(value)}`}
        aria-expanded={isOpen}
      >
        <span className={styles.dateText}>
          {formatDate(value)}
        </span>
        <svg 
          className={styles.calendarIcon}
          width="20" 
          height="20" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>
    </div>
  );
};

export default DateInput;