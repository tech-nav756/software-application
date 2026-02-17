import React from 'react';
import HeroContent from './HeroContent/HeroContent';
import AvailabilityForm from './AvailabilityForm/AvailabilityForm';
import DecorativeSVG from './DecorativeSVG/DecorativeSVG';
import styles from './Hero.module.css';

const Hero = () => {
  return (
    <section className={styles.hero}>
      <DecorativeSVG />
      <div className={styles.container}>
        <HeroContent />
        <AvailabilityForm />
      </div>
    </section>
  );
};

export default Hero;