'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ApiRequestProvider, useApiRequest } from './contexts/ApiRequestContext';
import styles from './anilist.module.css';

const THEME_KEY = 'anilist_theme';
const COLOR_THEME_KEY = 'anilist_color_theme';
const BACKGROUND_IMAGE_KEY = 'anilist_background_image';
const AUTH_TOKEN_KEY = 'anilist_access_token';
const AUTH_USER_KEY = 'anilist_user';

export type ColorTheme = 'magical-blue' | 'forest-green' | 'twilight-purple' | 'ice-blue' | 'sunset-orange' | 'default';

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
  const [activeTab, setActiveTab] = useState<'home' | 'search' | 'compare'>('home');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [colorTheme, setColorTheme] = useState<ColorTheme>('default');
  const [backgroundImage, setBackgroundImage] = useState<string>('');
  const [showThemeSelector, setShowThemeSelector] = useState<boolean>(false);
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

      const savedColorTheme = localStorage.getItem(COLOR_THEME_KEY) as ColorTheme;
      if (savedColorTheme) {
        setColorTheme(savedColorTheme);
        document.documentElement.setAttribute('data-color-theme', savedColorTheme);
      } else {
        document.documentElement.setAttribute('data-color-theme', 'default');
      }

      const savedBackgroundImage = localStorage.getItem(BACKGROUND_IMAGE_KEY);
      if (savedBackgroundImage && savedBackgroundImage.trim()) {
        const trimmedUrl = savedBackgroundImage.trim();
        setBackgroundImage(trimmedUrl);
        // Format URL properly for CSS - escape quotes
        const escapedUrl = trimmedUrl.replace(/'/g, "\\'").replace(/"/g, '\\"');
        // Use double quotes in CSS to avoid issues with single quotes in URLs
        document.documentElement.style.setProperty('--background-image', `url("${escapedUrl}")`);
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
    } else if (pathname === '/anilist/compare') {
      setActiveTab('compare');
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

  const handleColorThemeChange = (theme: ColorTheme) => {
    setColorTheme(theme);
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      localStorage.setItem(COLOR_THEME_KEY, theme);
      document.documentElement.setAttribute('data-color-theme', theme);
    }
    setShowThemeSelector(false);
  };

  const handleBackgroundImageChange = (imageUrl: string) => {
    setBackgroundImage(imageUrl);
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      if (imageUrl && imageUrl.trim()) {
        const trimmedUrl = imageUrl.trim();
        localStorage.setItem(BACKGROUND_IMAGE_KEY, trimmedUrl);
        // Format URL properly for CSS - escape quotes and special characters
        const escapedUrl = trimmedUrl.replace(/'/g, "\\'").replace(/"/g, '\\"');
        // Use double quotes in CSS to avoid issues with single quotes in URLs
        document.documentElement.style.setProperty('--background-image', `url("${escapedUrl}")`);
        
        // Test if image loads - if it fails, try using a CORS proxy or show a warning
        const img = new Image();
        img.crossOrigin = 'anonymous'; // Try to enable CORS
        img.onerror = () => {
          console.warn('Background image failed to load (possibly CORS issue):', trimmedUrl);
          // Try to apply anyway - sometimes CSS background works even if Image() fails
          // The user will see if it works or not
        };
        img.onload = () => {
          console.log('Background image loaded successfully');
        };
        img.src = trimmedUrl;
      } else {
        localStorage.removeItem(BACKGROUND_IMAGE_KEY);
        // Reset to default from globals.css
        const defaultImage = "url('https://images.unsplash.com/photo-1590796583326-afd3bb20d22d?q=80&w=774&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')";
        document.documentElement.style.setProperty('--background-image', defaultImage);
      }
    }
  };

  const handleTabChange = (tab: 'home' | 'search' | 'compare') => {
    setActiveTab(tab);
    if (tab === 'search') {
      router.push('/anilist/search');
    } else if (tab === 'compare') {
      router.push('/anilist/compare');
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
    <ApiRequestProvider>
      <Suspense fallback={<div>Loading...</div>}>
        <AniListLayoutContent
          activeTab={activeTab}
          isDarkMode={isDarkMode}
          colorTheme={colorTheme}
          backgroundImage={backgroundImage}
          showThemeSelector={showThemeSelector}
          authUser={authUser}
          accessToken={accessToken}
          onTabChange={handleTabChange}
          onToggleDarkMode={toggleDarkMode}
          onColorThemeChange={handleColorThemeChange}
          onBackgroundImageChange={handleBackgroundImageChange}
          onToggleThemeSelector={() => setShowThemeSelector(!showThemeSelector)}
          onLogin={handleLogin}
          onLogout={handleLogout}
        >
          {children}
        </AniListLayoutContent>
      </Suspense>
    </ApiRequestProvider>
  );
}

function AniListLayoutContent({
  activeTab,
  isDarkMode,
  colorTheme,
  backgroundImage,
  showThemeSelector,
  authUser,
  accessToken,
  onTabChange,
  onToggleDarkMode,
  onColorThemeChange,
  onBackgroundImageChange,
  onToggleThemeSelector,
  onLogin,
  onLogout,
  children,
}: {
  activeTab: 'home' | 'search';
  isDarkMode: boolean;
  colorTheme: ColorTheme;
  backgroundImage: string;
  showThemeSelector: boolean;
  authUser: AuthUser | null;
  accessToken: string | null;
  onTabChange: (tab: 'home' | 'search' | 'compare') => void;
  onToggleDarkMode: () => void;
  onColorThemeChange: (theme: ColorTheme) => void;
  onBackgroundImageChange: (imageUrl: string) => void;
  onToggleThemeSelector: () => void;
  onLogin: () => void;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const themeSelectorRef = useRef<HTMLDivElement>(null);
  const { requestCount, resetRequestCount } = useApiRequest();

  // Close theme selector when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (themeSelectorRef.current && !themeSelectorRef.current.contains(event.target as Node)) {
        onToggleThemeSelector();
      }
    };

    if (showThemeSelector) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showThemeSelector, onToggleThemeSelector]);

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
          <h1 className={styles.title}>AniList Tools</h1>
          <div className={styles.headerActions}>
            {authUser ? (
              <>
                <div className={styles.userInfo}>
                  {authUser.avatar?.medium && (
                    <img 
                      src={authUser.avatar.medium} 
                      alt={authUser.name}
                      className={styles.userAvatarSmall}
                      loading="lazy"
                    />
                  )}
                  <span className={styles.userNameSmall}>{authUser.name}</span>
                </div>
                <button 
                  onClick={onLogout}
                  className={styles.logoutButton}
                  title="Logout"
                >
                  Logout
                </button>
              </>
            ) : (
              <button 
                onClick={onLogin}
                className={styles.loginButton}
              >
                Login
              </button>
            )}
            <div className={styles.themeControls} ref={themeSelectorRef}>
              <button 
                onClick={onToggleThemeSelector}
                className={styles.themeSelectorButton}
                aria-label="Select color theme"
                title="Select color theme"
              >
                🎨
              </button>
              {showThemeSelector && (
                <div className={styles.themeSelectorDropdown}>
                  <div className={styles.themeSelectorTitle}>Color Theme</div>
                  <button
                    onClick={() => onColorThemeChange('default')}
                    className={`${styles.themeOption} ${colorTheme === 'default' ? styles.themeOptionActive : ''}`}
                  >
                    <span className={styles.themeOptionColor} style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}></span>
                    <span>Default Purple</span>
                  </button>
                  <button
                    onClick={() => onColorThemeChange('magical-blue')}
                    className={`${styles.themeOption} ${colorTheme === 'magical-blue' ? styles.themeOptionActive : ''}`}
                  >
                    <span className={styles.themeOptionColor} style={{ background: 'linear-gradient(135deg, #4A90E2 0%, #5BA3F5 100%)' }}></span>
                    <span>Magical Blue</span>
                  </button>
                  <button
                    onClick={() => onColorThemeChange('forest-green')}
                    className={`${styles.themeOption} ${colorTheme === 'forest-green' ? styles.themeOptionActive : ''}`}
                  >
                    <span className={styles.themeOptionColor} style={{ background: 'linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%)' }}></span>
                    <span>Forest Green</span>
                  </button>
                  <button
                    onClick={() => onColorThemeChange('twilight-purple')}
                    className={`${styles.themeOption} ${colorTheme === 'twilight-purple' ? styles.themeOptionActive : ''}`}
                  >
                    <span className={styles.themeOptionColor} style={{ background: 'linear-gradient(135deg, #6B5B95 0%, #8B7BAE 100%)' }}></span>
                    <span>Twilight Purple</span>
                  </button>
                  <button
                    onClick={() => onColorThemeChange('ice-blue')}
                    className={`${styles.themeOption} ${colorTheme === 'ice-blue' ? styles.themeOptionActive : ''}`}
                  >
                    <span className={styles.themeOptionColor} style={{ background: 'linear-gradient(135deg, #74B9FF 0%, #0984E3 100%)' }}></span>
                    <span>Ice Blue</span>
                  </button>
                  <button
                    onClick={() => onColorThemeChange('sunset-orange')}
                    className={`${styles.themeOption} ${colorTheme === 'sunset-orange' ? styles.themeOptionActive : ''}`}
                  >
                    <span className={styles.themeOptionColor} style={{ background: 'linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)' }}></span>
                    <span>Sunset Orange</span>
                  </button>
                  
                  <div className={styles.themeSelectorDivider}></div>
                  
                  <div className={styles.themeSelectorTitle}>Background Image</div>
                  <div className={styles.backgroundImageInput}>
                    <input
                      type="text"
                      placeholder="Image URL (e.g., Frieren wallpaper)"
                      value={backgroundImage}
                      onChange={(e) => onBackgroundImageChange(e.target.value)}
                      className={styles.backgroundImageUrlInput}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur();
                        }
                      }}
                    />
                    <button
                      onClick={() => onBackgroundImageChange('')}
                      className={styles.clearImageButton}
                      title="Reset to default"
                    >
                      ✕
                    </button>
                  </div>
                  <div className={styles.imageUrlHint}>
                    💡 Tip: Some images may be blocked by CORS. Try images from imgur, imgbb, or upload to a CDN.
                  </div>
                  <div className={styles.presetImages}>
                    <div className={styles.presetImagesLabel}>Presets:</div>
                    <button
                      onClick={() => onBackgroundImageChange('https://images.unsplash.com/photo-1590796583326-afd3bb20d22d?q=80&w=774&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')}
                      className={styles.presetImageButton}
                      title="Default landscape"
                    >
                      Default
                    </button>
                    <button
                      onClick={() => onBackgroundImageChange('https://wallpapercave.com/wp/wp13020764.jpg')}
                      className={styles.presetImageButton}
                      title="Frieren wallpaper"
                    >
                      Frieren 1
                    </button>
                    <button
                      onClick={() => onBackgroundImageChange('https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=1000&auto=format&fit=crop')}
                      className={styles.presetImageButton}
                      title="Anime landscape"
                    >
                      Anime
                    </button>
                  </div>
                </div>
              )}
              <button 
                onClick={onToggleDarkMode}
                className={styles.themeToggle}
                aria-label="Toggle dark mode"
                title="Toggle dark mode"
              >
                {isDarkMode ? '☀️' : '🌙'}
              </button>
            </div>
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
          <button
            onClick={() => onTabChange('compare')}
            className={`${styles.tab} ${activeTab === 'compare' ? styles.tabActive : ''}`}
          >
            Compare
          </button>
        </nav>
      </header>

      <main className={styles.main}>
        {children}
      </main>
      
      {/* API Request Counter - Fixed bottom right, visible everywhere */}
      <div className={styles.apiRequestCounter}>
        <div className={styles.counterLabel}>API Requests</div>
        <div className={styles.counterValue}>{requestCount}</div>
        <button 
          onClick={resetRequestCount}
          className={styles.resetButton}
          title="Reset counter"
        >
          ↻
        </button>
      </div>
    </div>
  );
}
