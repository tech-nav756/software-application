import React from 'react';
import styles from './CTAButton.module.css';

const CTAButton = () => {
  const handleExplore = () => {
    const availabilityForm = document.querySelector('[data-availability-form]');
    if (availabilityForm) {
      availabilityForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <button 
      className={styles.ctaButton}
      onClick={handleExplore}
      type="button"
      aria-label="Explore our accommodations"
    >
      <span className={styles.buttonText}>Explore Accommodations</span>
      <span className={styles.buttonIcon} aria-hidden="true">→</span>
    </button>
  );
};

export default CTAButton;