import React from 'react';
import CTAButton from '../CTAButton/CTAButton';
import styles from './HeroContent.module.css';

const HeroContent = () => {
  return (
    <div className={styles.content}>
      <h1 className={styles.title}>
        <span className={styles.titleAccent}>Elevated</span>
        <span className={styles.titleMain}>Hospitality</span>
      </h1>
      <p className={styles.subtitle}>
        Experience refined comfort where architectural elegance meets 
        personalized service. Every detail curated for the discerning traveler.
      </p>
      <CTAButton />
    </div>
  );
};

export default HeroContent;