import React from 'react';
import { Outlet } from 'react-router-dom';
import NavBar from '../components/layout/NavBar';
import Footer from '../components/layout/Footer';
import styles from './styles/PublicLayout.module.css';

const PublicLayout = () => {
  return (
    <div className={styles.layoutWrapper}>
      <NavBar />
      <main className={styles.mainContent}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default PublicLayout;