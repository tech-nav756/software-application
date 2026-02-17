import React, { useState, useRef, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import CustomCalendar from './CustomCalendar/CustomCalendar';
import DateInput from './DateInput/DateInput';
import styles from './AvailabilityForm.module.css';

const AvailabilityForm = () => {
  const [checkIn, setCheckIn] = useState(null);
  const [checkOut, setCheckOut] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [activeInput, setActiveInput] = useState(null);
  const formRef = useRef(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (formRef.current && !formRef.current.contains(event.target)) {
        closeCalendar();
      }
    };

    if (showCalendar) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCalendar]);

  const closeCalendar = () => {
    setShowCalendar(false);
    setActiveInput(null);
  };

  const handleInputClick = (inputType) => {
    setActiveInput(inputType);
    setShowCalendar(true);
  };

  const handleDateSelect = (date) => {
    if (!checkIn || (checkIn && checkOut) || activeInput === 'checkIn') {
      setCheckIn(date);
      setCheckOut(null);
      setActiveInput('checkOut');
    } else if (checkIn && !checkOut) {
      if (date > checkIn) {
        setCheckOut(date);
        setTimeout(() => {
          closeCalendar();
        }, 300);
      } else {
        setCheckIn(date);
        setCheckOut(null);
      }
    }
  };

  const handleClearDates = () => {
    setCheckIn(null);
    setCheckOut(null);
    setActiveInput(null);
  };

  const getMinDate = () => {
    if (activeInput === 'checkOut' && checkIn) {
      const minCheckOut = new Date(checkIn);
      minCheckOut.setDate(minCheckOut.getDate() + 1);
      return minCheckOut;
    }
    return today;
  };

  const isFormValid = checkIn && checkOut;

  return (
    <div className={styles.formWrapper} data-availability-form ref={formRef}>
      <div className={styles.formHeader}>
        <h2 className={styles.formTitle}>Check Availability</h2>
        <p className={styles.formDescription}>
          Discover your perfect stay
        </p>
      </div>
      
      <div className={styles.form}>
        <DateInput
          label="Check-in"
          value={checkIn}
          onClick={() => handleInputClick('checkIn')}
          id="checkIn"
          isOpen={showCalendar && activeInput === 'checkIn'}
        />

        <DateInput
          label="Check-out"
          value={checkOut}
          onClick={() => handleInputClick('checkOut')}
          id="checkOut"
          isOpen={showCalendar && activeInput === 'checkOut'}
        />

        {showCalendar && (
          <CustomCalendar
            onDateSelect={handleDateSelect}
            selectedCheckIn={checkIn}
            selectedCheckOut={checkOut}
            minDate={getMinDate()}
            onClose={closeCalendar}
          />
        )}

        {(checkIn || checkOut) && (
          <button
            type="button"
            className={styles.clearButton}
            onClick={handleClearDates}
            aria-label="Clear selected dates"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Clear
          </button>
        )}

        <NavLink
          to="/reservations"
          className={`${styles.searchButton} ${!isFormValid ? styles.searchButtonDisabled : ''}`}
          aria-label="Search available rooms"
          onClick={(e) => {
            if (!isFormValid) {
              e.preventDefault();
            }
          }}
        >
          <span>Search Rooms</span>
          <svg 
            className={styles.searchIcon}
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </NavLink>
      </div>
    </div>
  );
};

export default AvailabilityForm;