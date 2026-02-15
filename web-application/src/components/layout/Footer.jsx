import React, { useState } from 'react';
import styles from './styles/Footer.module.css';

const Footer = () => {
  const [email, setEmail] = useState('');
  const [subscribeStatus, setSubscribeStatus] = useState('');

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (email) {
      setSubscribeStatus('subscribed');
      setTimeout(() => {
        setEmail('');
        setSubscribeStatus('');
      }, 3000);
    }
  };

  const currentYear = new Date().getFullYear();

  const footerSections = {
    platform: [
      { label: 'Features', href: '#features' },
      { label: 'Solutions', href: '#solutions' },
      { label: 'Enterprise', href: '#enterprise' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'Security', href: '#security' }
    ],
    company: [
      { label: 'About', href: '#about' },
      { label: 'Careers', href: '#careers' },
      { label: 'Press Kit', href: '#press' },
      { label: 'Partners', href: '#partners' },
      { label: 'Contact', href: '#contact' }
    ],
    resources: [
      { label: 'Documentation', href: '#docs' },
      { label: 'API Reference', href: '#api' },
      { label: 'Guides', href: '#guides' },
      { label: 'Community', href: '#community' },
      { label: 'Support', href: '#support' }
    ],
    legal: [
      { label: 'Privacy Policy', href: '#privacy' },
      { label: 'Terms of Service', href: '#terms' },
      { label: 'Cookie Policy', href: '#cookies' },
      { label: 'Compliance', href: '#compliance' }
    ]
  };

  const socialLinks = [
    { platform: 'Twitter', href: '#twitter', icon: '𝕏' },
    { platform: 'LinkedIn', href: '#linkedin', icon: 'in' },
    { platform: 'GitHub', href: '#github', icon: 'gh' },
    { platform: 'Discord', href: '#discord', icon: 'dc' }
  ];

  return (
    <footer className={styles.footer}>
      <div className={styles.footerAccent}></div>

      <div className={styles.container}>
        <div className={styles.primarySection}>
          <div className={styles.brandBlock}>
            <div className={styles.brandHeader}>
              <div className={styles.brandMark}>
                <span className={styles.markSymbol}>◆</span>
              </div>
              <h2 className={styles.brandName}>ATELIER</h2>
            </div>
            <p className={styles.brandStatement}>
              Building infrastructure for the next generation of digital experiences.
              Trusted by forward-thinking teams worldwide.
            </p>
            <div className={styles.contactInfo}>
              <a href="mailto:hello@atelier.com" className={styles.contactLink}>
                hello@atelier.com
              </a>
              <span className={styles.separator}>·</span>
              <a href="tel:+1234567890" className={styles.contactLink}>
                +1 (234) 567-890
              </a>
            </div>
          </div>

          <div className={styles.newsletterBlock}>
            <h3 className={styles.newsletterTitle}>Stay Informed</h3>
            <p className={styles.newsletterDescription}>
              Monthly insights on product updates, industry trends, and technical deep-dives.
            </p>
            <form onSubmit={handleSubscribe} className={styles.newsletterForm}>
              <div className={styles.inputWrapper}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@company.com"
                  className={styles.emailInput}
                  required
                />
                <button 
                  type="submit" 
                  className={styles.subscribeButton}
                  disabled={subscribeStatus === 'subscribed'}
                >
                  {subscribeStatus === 'subscribed' ? 'Subscribed' : 'Subscribe'}
                </button>
              </div>
              {subscribeStatus === 'subscribed' && (
                <span className={styles.successMessage}>
                  ✓ You're subscribed. Check your inbox.
                </span>
              )}
            </form>
          </div>
        </div>

        <div className={styles.navigationSection}>
          <nav className={styles.navColumn}>
            <h4 className={styles.navTitle}>Platform</h4>
            <ul className={styles.navList}>
              {footerSections.platform.map((link) => (
                <li key={link.label} className={styles.navItem}>
                  <a href={link.href} className={styles.navLink}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav className={styles.navColumn}>
            <h4 className={styles.navTitle}>Company</h4>
            <ul className={styles.navList}>
              {footerSections.company.map((link) => (
                <li key={link.label} className={styles.navItem}>
                  <a href={link.href} className={styles.navLink}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav className={styles.navColumn}>
            <h4 className={styles.navTitle}>Resources</h4>
            <ul className={styles.navList}>
              {footerSections.resources.map((link) => (
                <li key={link.label} className={styles.navItem}>
                  <a href={link.href} className={styles.navLink}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav className={styles.navColumn}>
            <h4 className={styles.navTitle}>Legal</h4>
            <ul className={styles.navList}>
              {footerSections.legal.map((link) => (
                <li key={link.label} className={styles.navItem}>
                  <a href={link.href} className={styles.navLink}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className={styles.bottomSection}>
          <div className={styles.metaInfo}>
            <p className={styles.copyright}>
              © {currentYear} Atelier Technologies, Inc. All rights reserved.
            </p>
            <p className={styles.location}>
              Headquartered in San Francisco · Globally distributed
            </p>
          </div>

          <div className={styles.socialSection}>
            <span className={styles.socialLabel}>Connect</span>
            <div className={styles.socialLinks}>
              {socialLinks.map((social) => (
                <a
                  key={social.platform}
                  href={social.href}
                  className={styles.socialLink}
                  aria-label={social.platform}
                  title={social.platform}
                >
                  <span className={styles.socialIcon}>{social.icon}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.footerBackground}>
        <div className={styles.bgPattern}></div>
      </div>
    </footer>
  );
};

export default Footer;