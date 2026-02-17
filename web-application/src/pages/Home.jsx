import React, { useState, useEffect } from 'react';
import Hero from '../features/hero/Hero';
import styles from './styles/Home.module.css';

const Home = () => {
  const [activeRoom, setActiveRoom] = useState(0);

  const rooms = [
    {
      title: 'Signature Suite',
      size: '85m²',
      view: 'Ocean Panorama',
      price: '$850',
      features: ['King Bed', 'Private Terrace', 'Soaking Tub', 'Butler Service']
    },
    {
      title: 'Garden Villa',
      size: '120m²',
      view: 'Private Garden',
      price: '$1,200',
      features: ['Separate Living', 'Outdoor Shower', 'Pool Access', 'Concierge']
    },
    {
      title: 'Penthouse',
      size: '200m²',
      view: '360° City Views',
      price: '$2,400',
      features: ['Two Bedrooms', 'Full Kitchen', 'Private Spa', 'Chauffeur']
    }
  ];

  const experiences = [
    {
      title: 'Culinary Journey',
      description: 'Three Michelin-starred dining with locally sourced ingredients and wine pairings curated by our sommelier.',
      icon: '✦'
    },
    {
      title: 'Spa Sanctuary',
      description: 'Holistic wellness treatments inspired by ancient traditions, featuring organic botanicals and thermal waters.',
      icon: '✧'
    },
    {
      title: 'Cultural Immersion',
      description: 'Private guided tours, artisan workshops, and exclusive access to hidden local treasures.',
      icon: '✹'
    }
  ];

  const testimonials = [
    {
      quote: 'An extraordinary escape that redefines luxury. Every detail was perfection.',
      author: 'Sophie Laurent',
      location: 'Paris, France'
    },
    {
      quote: 'The most memorable stay of our lives. Impeccable service and breathtaking views.',
      author: 'James & Emma Chen',
      location: 'Singapore'
    }
  ];

  return (
    <div className={styles.home}>
      {/* New Hero Component */}
      <Hero />

      {/* Introduction Section */}
      <section className={styles.introduction}>
        <div className={styles.introContainer}>
          <div className={styles.introContent}>
            <span className={styles.sectionLabel}>Our Story</span>
            <h2 className={styles.sectionTitle}>
              A Century of 
              <span className={styles.titleBreak}>Refined Hospitality</span>
            </h2>
            <div className={styles.introDivider}></div>
            <p className={styles.introText}>
              Nestled between mountains and sea, The Grand Meridian has been a sanctuary 
              for discerning travelers since 1924. Our heritage of exceptional service 
              combines with modern sensibilities to create experiences that transcend 
              the ordinary.
            </p>
            <p className={styles.introText}>
              Each guest is welcomed into a world where tradition and innovation harmonize, 
              where every moment is crafted with intention, and where memories are woven 
              into the fabric of an unforgettable journey.
            </p>
          </div>
          <div className={styles.introStats}>
            <div className={styles.statItem}>
              <span className={styles.statNumber}>100</span>
              <span className={styles.statLabel}>Years of Excellence</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNumber}>48</span>
              <span className={styles.statLabel}>Exclusive Suites</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNumber}>3★</span>
              <span className={styles.statLabel}>Michelin Stars</span>
            </div>
          </div>
        </div>
      </section>

      {/* Accommodations Section */}
      <section className={styles.accommodations}>
        <div className={styles.accomHeader}>
          <span className={styles.sectionLabel}>Accommodations</span>
          <h2 className={styles.sectionTitle}>
            Your Private
            <span className={styles.titleBreak}>Sanctuary</span>
          </h2>
        </div>

        <div className={styles.roomsContainer}>
          {rooms.map((room, index) => (
            <div 
              key={index}
              className={`${styles.roomCard} ${activeRoom === index ? styles.roomCardActive : ''}`}
              onMouseEnter={() => setActiveRoom(index)}
            >
              <div className={styles.roomImage}>
                <div className={styles.roomImageOverlay}></div>
                <span className={styles.roomNumber}>0{index + 1}</span>
              </div>
              <div className={styles.roomContent}>
                <div className={styles.roomHeader}>
                  <h3 className={styles.roomTitle}>{room.title}</h3>
                  <span className={styles.roomPrice}>{room.price}<span className={styles.priceUnit}>/night</span></span>
                </div>
                <div className={styles.roomMeta}>
                  <span className={styles.roomMetaItem}>{room.size}</span>
                  <span className={styles.roomMetaDivider}>·</span>
                  <span className={styles.roomMetaItem}>{room.view}</span>
                </div>
                <ul className={styles.roomFeatures}>
                  {room.features.map((feature, i) => (
                    <li key={i} className={styles.roomFeature}>{feature}</li>
                  ))}
                </ul>
                <button className={styles.roomBtn}>View Details</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Experiences Section */}
      <section className={styles.experiences}>
        <div className={styles.expContainer}>
          <div className={styles.expHeader}>
            <span className={styles.sectionLabel}>Experiences</span>
            <h2 className={styles.sectionTitle}>
              Curated for
              <span className={styles.titleBreak}>Extraordinary Moments</span>
            </h2>
          </div>

          <div className={styles.expGrid}>
            {experiences.map((exp, index) => (
              <div key={index} className={styles.expCard}>
                <span className={styles.expIcon}>{exp.icon}</span>
                <h3 className={styles.expTitle}>{exp.title}</h3>
                <p className={styles.expDescription}>{exp.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section className={styles.gallery}>
        <div className={styles.galleryGrid}>
          <div className={`${styles.galleryItem} ${styles.galleryLarge}`}>
            <div className={styles.galleryOverlay}>
              <span className={styles.galleryLabel}>Architecture</span>
            </div>
          </div>
          <div className={styles.galleryItem}>
            <div className={styles.galleryOverlay}>
              <span className={styles.galleryLabel}>Interiors</span>
            </div>
          </div>
          <div className={styles.galleryItem}>
            <div className={styles.galleryOverlay}>
              <span className={styles.galleryLabel}>Gardens</span>
            </div>
          </div>
          <div className={`${styles.galleryItem} ${styles.galleryWide}`}>
            <div className={styles.galleryOverlay}>
              <span className={styles.galleryLabel}>Dining</span>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className={styles.testimonials}>
        <div className={styles.testimonialsContainer}>
          <span className={styles.sectionLabel}>Guest Voices</span>
          <div className={styles.testimonialsGrid}>
            {testimonials.map((testimonial, index) => (
              <div key={index} className={styles.testimonialCard}>
                <span className={styles.quoteIcon}>"</span>
                <p className={styles.testimonialQuote}>{testimonial.quote}</p>
                <div className={styles.testimonialAuthor}>
                  <span className={styles.authorName}>{testimonial.author}</span>
                  <span className={styles.authorLocation}>{testimonial.location}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reservation Section */}
      <section className={styles.reservation}>
        <div className={styles.reservationContent}>
          <span className={styles.reservationLabel}>Begin Your Journey</span>
          <h2 className={styles.reservationTitle}>
            Reserve Your Experience
          </h2>
          <p className={styles.reservationText}>
            Our concierge team is available 24/7 to craft your perfect stay
          </p>
          <div className={styles.reservationActions}>
            <button className={styles.reservationBtn}>Book Direct</button>
            <a href="tel:+1234567890" className={styles.reservationContact}>
              +1 (234) 567-890
            </a>
          </div>
        </div>
        <div className={styles.reservationBg}></div>
      </section>
    </div>
  );
};

export default Home;