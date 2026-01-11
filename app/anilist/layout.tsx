'use client';

import { useState, useEffect, Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import styles from './anilist.module.css';

const THEME_KEY = 'anilist_theme';
const AUTH_TOKEN_KEY = 'anilist_access_token';
const AUTH_USER_KEY = 'anilist_user';

interface AuthUser {
  id: number;
  name: string;
  avatar?: {
    large?: string;
    medium?: string;
  };
}

export default function AniListLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<'home' | 'search'>('home');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  // Load theme and auth token from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const savedTheme = localStorage.getItem(THEME_KEY);
      if (savedTheme === 'dark') {
        setIsDarkMode(true);
        document.documentElement.classList.add('dark-mode');
      }

      const savedToken = localStorage.getItem(AUTH_TOKEN_KEY);
      const savedUser = localStorage.getItem(AUTH_USER_KEY);
      if (savedToken) {
        setAccessToken(savedToken);
      }
      if (savedUser) {
        try {
          setAuthUser(JSON.parse(savedUser));
        } catch (e) {
          console.error('Error parsing saved user:', e);
        }
      }
    }
  }, []);

  // Sync active tab with URL
  useEffect(() => {
    if (pathname === '/anilist/search') {
      setActiveTab('search');
    } else {
      setActiveTab('home');
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

  const handleTabChange = (tab: 'home' | 'search') => {
    setActiveTab(tab);
    if (tab === 'search') {
      router.push('/anilist/search');
    } else {
      router.push('/anilist/home');
    }
  };

  const handleLogin = () => {
    window.location.href = '/api/anilist/auth/authorize';
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    setAccessToken(null);
    setAuthUser(null);
  };

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AniListLayoutContent
        activeTab={activeTab}
        isDarkMode={isDarkMode}
        authUser={authUser}
        accessToken={accessToken}
        onTabChange={handleTabChange}
        onToggleDarkMode={toggleDarkMode}
        onLogin={handleLogin}
        onLogout={handleLogout}
      >
        {children}
      </AniListLayoutContent>
    </Suspense>
  );
}

function AniListLayoutContent({
  activeTab,
  isDarkMode,
  authUser,
  accessToken,
  onTabChange,
  onToggleDarkMode,
  onLogin,
  onLogout,
  children,
}: {
  activeTab: 'home' | 'search';
  isDarkMode: boolean;
  authUser: AuthUser | null;
  accessToken: string | null;
  onTabChange: (tab: 'home' | 'search') => void;
  onToggleDarkMode: () => void;
  onLogin: () => void;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Handle OAuth callback
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const authSuccess = searchParams.get('auth_success');
      const token = searchParams.get('token');
      
      if (authSuccess === 'true' && token) {
        // Store token
        localStorage.setItem(AUTH_TOKEN_KEY, token);
        
        // Fetch user info
        fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            query: `
              query {
                Viewer {
                  id
                  name
                  avatar {
                    large
                    medium
                  }
                }
              }
            `,
          }),
        })
          .then(res => res.json())
          .then(data => {
            if (data.data?.Viewer) {
              const user = data.data.Viewer;
              localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
              window.location.reload(); // Reload to update state
            }
          })
          .catch(err => console.error('Error fetching user info:', err));
        
        // Clean URL
        router.replace('/anilist/home');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <h1 className={styles.title}>AniList</h1>
          <div className={styles.headerActions}>
            {authUser ? (
              <div className={styles.userInfo}>
                {authUser.avatar?.medium && (
                  <img 
                    src={authUser.avatar.medium} 
                    alt={authUser.name}
                    className={styles.userAvatarSmall}
                  />
                )}
                <span className={styles.userNameSmall}>{authUser.name}</span>
                <button 
                  onClick={onLogout}
                  className={styles.logoutButton}
                  title="Logout"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button 
                onClick={onLogin}
                className={styles.loginButton}
              >
                Login with AniList
              </button>
            )}
            <button 
              onClick={onToggleDarkMode}
              className={styles.themeToggle}
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>

        <nav className={styles.navTabs}>
          <button
            onClick={() => onTabChange('home')}
            className={`${styles.tab} ${activeTab === 'home' ? styles.tabActive : ''}`}
          >
            Home
          </button>
          <button
            onClick={() => onTabChange('search')}
            className={`${styles.tab} ${activeTab === 'search' ? styles.tabActive : ''}`}
          >
            Search
          </button>
        </nav>
      </header>

      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}
