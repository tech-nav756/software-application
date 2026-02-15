import React, { useState, useEffect } from 'react';
import styles from './styles/NavBar.module.css';

const NavBar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navigation = [
    { name: 'Works', url: '#works' },
    { name: 'Services', url: '#services' },
    { name: 'Studio', url: '#studio' },
    { name: 'Connect', url: '#connect' }
  ];

  return (
    <>
      <header className={`${styles.header} ${scrolled ? styles.headerScrolled : ''}`}>
        <div className={styles.wrapper}>
          <div className={styles.logo}>
            <span className={styles.logoSquare}></span>
            <span className={styles.logoText}>MERIDIAN</span>
          </div>

          <nav className={styles.nav}>
            {navigation.map((item, idx) => (
              <a key={idx} href={item.url} className={styles.navLink}>
                <span className={styles.linkNumber}>[0{idx + 1}]</span>
                <span className={styles.linkLabel}>{item.name}</span>
              </a>
            ))}
          </nav>

          <button className={styles.cta}>
            <span className={styles.ctaText}>Get Started</span>
            <span className={styles.ctaIcon}>→</span>
          </button>

          <button 
            className={`${styles.burger} ${mobileOpen ? styles.burgerActive : ''}`}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </header>

      <div className={`${styles.overlay} ${mobileOpen ? styles.overlayActive : ''}`}>
        <div className={styles.overlayContent}>
          <nav className={styles.overlayNav}>
            {navigation.map((item, idx) => (
              <a 
                key={idx} 
                href={item.url} 
                className={styles.overlayLink}
                onClick={() => setMobileOpen(false)}
              >
                <span className={styles.overlayNumber}>[0{idx + 1}]</span>
                <span className={styles.overlayLabel}>{item.name}</span>
              </a>
            ))}
          </nav>
          <button className={styles.overlayCta} onClick={() => setMobileOpen(false)}>
            <span>Get Started</span>
            <span className={styles.overlayArrow}>→</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default NavBar;