'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import styles from './anilist.module.css';

const THEME_KEY = 'anilist_theme';

export default function AniListLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<'activities' | 'media-search'>('activities');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const pathname = usePathname();
  const router = useRouter();

  // Load theme from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const savedTheme = localStorage.getItem(THEME_KEY);
      if (savedTheme === 'dark') {
        setIsDarkMode(true);
        document.documentElement.classList.add('dark-mode');
      }
    }
  }, []);

  // Sync active tab with URL
  useEffect(() => {
    if (pathname === '/anilist/media-search') {
      setActiveTab('media-search');
    } else {
      setActiveTab('activities');
    }
  }, [pathname]);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      localStorage.setItem(THEME_KEY, newMode ? 'dark' : 'light');
      if (newMode) {
        document.documentElement.classList.add('dark-mode');
      } else {
        document.documentElement.classList.remove('dark-mode');
      }
    }
  };

  const handleTabChange = (tab: 'activities' | 'media-search') => {
    setActiveTab(tab);
    if (tab === 'media-search') {
      router.push('/anilist/media-search');
    } else {
      router.push('/anilist');
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <h1 className={styles.title}>AniList</h1>
          <button 
            onClick={toggleDarkMode}
            className={styles.themeToggle}
            aria-label="Toggle dark mode"
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
        </div>

        <nav className={styles.navTabs}>
          <button
            onClick={() => handleTabChange('activities')}
            className={`${styles.tab} ${activeTab === 'activities' ? styles.tabActive : ''}`}
          >
            Activities
          </button>
          <button
            onClick={() => handleTabChange('media-search')}
            className={`${styles.tab} ${activeTab === 'media-search' ? styles.tabActive : ''}`}
          >
            Media Search
          </button>
        </nav>
      </header>

      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}
