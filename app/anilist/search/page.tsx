'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { searchMedia, fetchMediaById, fetchMediaWithScores, Media, getFollowedUsersScores, UserMediaScore, fetchUserMediaListActivities, ActivityStatus } from '@/lib/anilist';
import { useApiRequest } from '../contexts/ApiRequestContext';
import styles from './search.module.css';

const AUTH_TOKEN_KEY = 'anilist_access_token';

function SearchContent() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState<string>('');
  const [mediaType, setMediaType] = useState<'ALL' | 'ANIME' | 'MANGA'>('ALL');
  const [results, setResults] = useState<Media[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [followedScores, setFollowedScores] = useState<UserMediaScore[]>([]);
  const [loadingScores, setLoadingScores] = useState<boolean>(false);
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [expandedUserActivities, setExpandedUserActivities] = useState<Record<number, ActivityStatus[]>>({});
  const [loadingUserActivities, setLoadingUserActivities] = useState<Record<number, boolean>>({});
  const { incrementRequestCount } = useApiRequest();
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  /**
   * Check if user is authenticated and monitor token changes.
   * 
   * This effect:
   * - Checks for authentication token on mount
   * - Listens for storage changes (token set in another tab/component)
   * - Periodically re-checks token (in case it was set after mount)
   * - Updates hasToken state to show/hide the scores section
   */
  useEffect(() => {
    const checkToken = () => {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem(AUTH_TOKEN_KEY);
        setHasToken(!!token);
      }
    };

    // Check immediately on mount
    checkToken();

    // Listen for storage changes (e.g., token set in another tab or after login)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === AUTH_TOKEN_KEY) {
        checkToken();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Re-check periodically (in case token was set after component mount)
    // This ensures the scores section appears even if login happens after page load
    const interval = setInterval(checkToken, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // Load media by ID from URL parameter and scores in a single request
  useEffect(() => {
    console.log('[SearchPage] 🔄 useEffect triggered - searchParams changed');
    const mediaIdParam = searchParams.get('mediaId');
    if (mediaIdParam) {
      const mediaId = parseInt(mediaIdParam, 10);
      if (!isNaN(mediaId)) {
        console.log(`[SearchPage] 📋 Loading media from URL - mediaId: ${mediaId}`);
        setLoading(true);
        setLoadingScores(true);
        setError(null);
        setTokenError(null);
        
        const token = typeof window !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null;
        console.log(`[SearchPage] 🔑 Token status: ${token ? 'present' : 'missing'}`);
        
        // Fetch media and scores in a single request
        console.log(`[SearchPage] 🚀 Calling fetchMediaWithScores for mediaId: ${mediaId}`);
        // Note: fetchMediaWithScores will increment the counter internally
        fetchMediaWithScores(mediaId, token || undefined)
          .then((result) => {
            console.log(`[SearchPage] ✅ fetchMediaWithScores completed`, result);
            if (result) {
              console.log(`[SearchPage] 📝 Setting media: ${result.media.title?.userPreferred}, scores: ${result.scores.length}`);
              setSelectedMedia(result.media);
              setQuery(result.media.title?.userPreferred || result.media.title?.romaji || result.media.title?.english || '');
              setMediaType(result.media.type || 'ALL');
              setFollowedScores(result.scores);
            } else {
              console.log('[SearchPage] ⚠️ Media not found');
              setError('Media not found');
            }
          })
          .catch((err: any) => {
            const errorMessage = err?.message || 'An error occurred';
            if (errorMessage.startsWith('RATE_LIMIT:') || 
                errorMessage.includes('Too many requests') ||
                errorMessage.includes('rate limit') ||
                errorMessage.toLowerCase().includes('429')) {
              setError('⏱️ Rate limit exceeded. Please wait 30-60 seconds before trying again.');
            } else if (errorMessage.includes('UNAUTHORIZED') || errorMessage.includes('401')) {
              // Handle token expiration/invalidation
              if (token) {
                localStorage.removeItem(AUTH_TOKEN_KEY);
                localStorage.removeItem('anilist_user');
                setHasToken(false);
                setTokenError('Your session has expired. Please log in again.');
              }
              setError(errorMessage);
            } else {
              setError(errorMessage);
            }
            setFollowedScores([]);
          })
          .finally(() => {
            setLoading(false);
            setLoadingScores(false);
          });
      }
    } else {
      // No mediaId in URL, clear everything
      setSelectedMedia(null);
      setFollowedScores([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Handle search with debounce for auto-completion
  const performSearch = useCallback(async (searchQuery: string, type: 'ALL' | 'ANIME' | 'MANGA') => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setResults([]);
      setShowSuggestions(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await searchMedia(searchQuery.trim(), type, 1, 10);
      if (data) {
        setResults(data.media);
        setShowSuggestions(true);
      } else {
        setResults([]);
        setShowSuggestions(false);
      }
    } catch (err: any) {
      const errorMessage = err?.message || 'An error occurred';
      
      if (errorMessage.startsWith('RATE_LIMIT:') || 
          errorMessage.includes('Too many requests') ||
          errorMessage.includes('rate limit') ||
          errorMessage.toLowerCase().includes('429')) {
        setError('⏱️ Rate limit exceeded. Please wait 30-60 seconds before trying again.');
      } else {
        setError(errorMessage);
      }
      setResults([]);
      setShowSuggestions(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search for auto-completion
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }

    if (query.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(query, mediaType);
      }, 500); // 500ms debounce to reduce API calls
    } else {
      setResults([]);
      setShowSuggestions(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }
    };
  }, [query, mediaType, performSearch]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if ref exists and is still in the DOM
      if (suggestionsRef.current && document.contains(suggestionsRef.current)) {
        const target = event.target as Node;
        if (target && !suggestionsRef.current.contains(target)) {
          setShowSuggestions(false);
        }
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        if (typeof document !== 'undefined') {
          document.removeEventListener('mousedown', handleClickOutside);
        }
      };
    }
  }, []);

  const handleMediaSelect = async (media: Media) => {
    console.log(`[SearchPage] 🎯 handleMediaSelect called - media: ${media.title.userPreferred || media.id}`);
    setSelectedMedia(media);
    setShowSuggestions(false);
    setQuery(media.title.userPreferred || media.title.romaji || media.title.english || '');
    
    // Load scores in a single request with media info
    const token = typeof window !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null;
    console.log(`[SearchPage] 🔑 Token status for scores: ${token ? 'present' : 'missing'}`);
    
    if (token) {
      setLoadingScores(true);
      setTokenError(null);
      
      console.log(`[SearchPage] 🚀 Calling fetchMediaWithScores for mediaId: ${media.id}`);
      // Note: fetchMediaWithScores will increment the counter internally
      try {
        const result = await fetchMediaWithScores(media.id, token);
        console.log(`[SearchPage] ✅ fetchMediaWithScores completed`, result);
        if (result) {
          console.log(`[SearchPage] 📝 Setting scores: ${result.scores.length}`);
          setFollowedScores(result.scores);
        }
      } catch (err: any) {
        console.error('[SearchPage] ❌ Error in handleMediaSelect:', err);
        const errorMessage = err?.message || '';
        
        // Handle token expiration/invalidation
        if (errorMessage.includes('UNAUTHORIZED') || errorMessage.includes('401')) {
          localStorage.removeItem(AUTH_TOKEN_KEY);
          localStorage.removeItem('anilist_user');
          setHasToken(false);
          setTokenError('Your session has expired. Please log in again.');
        } else {
          setTokenError(`Error loading scores: ${errorMessage}`);
        }
        
        setFollowedScores([]);
      } finally {
        setLoadingScores(false);
      }
    } else {
      setFollowedScores([]);
    }
  };

  const formatDate = (date?: { year?: number; month?: number; day?: number }) => {
    if (!date || !date.year) return 'Unknown';
    const parts = [date.year];
    if (date.month) parts.push(String(date.month).padStart(2, '0'));
    if (date.day) parts.push(String(date.day).padStart(2, '0'));
    return parts.join('-');
  };

  const getMediaTypeLabel = (type: string) => {
    return type === 'ANIME' ? 'Anime' : 'Manga';
  };

  const getStatusLabel = (status?: string) => {
    if (!status) return 'Unknown';
    return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatActivityDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleViewActivities = async (userId: number, userName: string) => {
    if (!selectedMedia) return;
    
    // Toggle: if already expanded, collapse it
    if (expandedUserActivities[userId]) {
      setExpandedUserActivities(prev => {
        const newState = { ...prev };
        delete newState[userId];
        return newState;
      });
      return;
    }

    // Set loading state
    setLoadingUserActivities(prev => ({ ...prev, [userId]: true }));

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null;
      if (!token) {
        alert('Please log in to view activities');
        return;
      }

      const activities = await fetchUserMediaListActivities(userId, selectedMedia.id, token);
      
      setExpandedUserActivities(prev => ({ ...prev, [userId]: activities }));
    } catch (error: any) {
      console.error('Error loading activities:', error);
      alert(`Failed to load activities: ${error.message || 'Unknown error'}`);
    } finally {
      setLoadingUserActivities(prev => {
        const newState = { ...prev };
        delete newState[userId];
        return newState;
      });
    }
  };

  return (
    <div>
      <div className={styles.searchSection}>
        <div className={styles.searchBox}>
          <div className={styles.searchInputWrapper} ref={suggestionsRef}>
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedMedia(null);
              }}
              onFocus={() => {
                if (results.length > 0) {
                  setShowSuggestions(true);
                }
              }}
              placeholder="Search for anime or manga..."
              className={styles.searchInput}
            />
            {loading && (
              <div className={styles.loadingIndicator}>⏳</div>
            )}
            
            {showSuggestions && results.length > 0 && (
              <div className={styles.suggestions}>
                {results.map((media) => (
                  <button
                    key={media.id}
                    onClick={() => handleMediaSelect(media)}
                    className={styles.suggestionItem}
                  >
                    {media.coverImage?.medium && (
                      <img 
                        src={media.coverImage.medium} 
                        alt={media.title.userPreferred || ''}
                        className={styles.suggestionImage}
                        loading="lazy"
                      />
                    )}
                    <div className={styles.suggestionInfo}>
                      <div className={styles.suggestionTitle}>
                        {media.title.userPreferred || media.title.romaji || media.title.english}
                      </div>
                      <div className={styles.suggestionMeta}>
                        {getMediaTypeLabel(media.type)} • {getStatusLabel(media.status)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <select
            value={mediaType}
            onChange={(e) => setMediaType(e.target.value as 'ALL' | 'ANIME' | 'MANGA')}
            className={styles.typeSelect}
          >
            <option value="ALL">All</option>
            <option value="ANIME">Anime</option>
            <option value="MANGA">Manga</option>
          </select>
        </div>

        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}
      </div>

      <main className={styles.main}>
        {selectedMedia ? (
          <div className={styles.mediaDetail}>
            {selectedMedia.bannerImage && (
              <div 
                className={styles.banner}
                style={{ backgroundImage: `url(${selectedMedia.bannerImage})` }}
              />
            )}
            
            <div className={styles.mediaContent}>
              <div className={styles.mediaHeader}>
                {selectedMedia.coverImage?.large && (
                  <img 
                    src={selectedMedia.coverImage.large} 
                    alt={selectedMedia.title.userPreferred || ''}
                    loading="lazy"
                    className={styles.coverImage}
                  />
                )}
                <div className={styles.mediaInfo}>
                  <h2 className={styles.mediaTitle}>
                    {selectedMedia.title.userPreferred || selectedMedia.title.romaji || selectedMedia.title.english}
                  </h2>
                  {selectedMedia.title.native && selectedMedia.title.native !== selectedMedia.title.userPreferred && (
                    <p className={styles.mediaNativeTitle}>{selectedMedia.title.native}</p>
                  )}
                  
                  <div className={styles.mediaMeta}>
                    <span className={styles.mediaTypeBadge} data-type={selectedMedia.type.toLowerCase()}>
                      {getMediaTypeLabel(selectedMedia.type)}
                    </span>
                    {selectedMedia.format && (
                      <span className={styles.metaItem}>{selectedMedia.format}</span>
                    )}
                    {selectedMedia.status && (
                      <span className={styles.metaItem}>{getStatusLabel(selectedMedia.status)}</span>
                    )}
                  </div>

                  <div className={styles.mediaStats}>
                    {selectedMedia.averageScore && (
                      <div className={styles.stat}>
                        <span className={styles.statLabel}>Score:</span>
                        <span className={styles.statValue}>{selectedMedia.averageScore}%</span>
                      </div>
                    )}
                    {selectedMedia.popularity && (
                      <div className={styles.stat}>
                        <span className={styles.statLabel}>Popularity:</span>
                        <span className={styles.statValue}>#{selectedMedia.popularity}</span>
                      </div>
                    )}
                    {selectedMedia.episodes && (
                      <div className={styles.stat}>
                        <span className={styles.statLabel}>Episodes:</span>
                        <span className={styles.statValue}>{selectedMedia.episodes}</span>
                      </div>
                    )}
                    {selectedMedia.chapters && (
                      <div className={styles.stat}>
                        <span className={styles.statLabel}>Chapters:</span>
                        <span className={styles.statValue}>{selectedMedia.chapters}</span>
                      </div>
                    )}
                    {selectedMedia.volumes && (
                      <div className={styles.stat}>
                        <span className={styles.statLabel}>Volumes:</span>
                        <span className={styles.statValue}>{selectedMedia.volumes}</span>
                      </div>
                    )}
                  </div>

                  <div className={styles.mediaDates}>
                    {selectedMedia.startDate && (
                      <div className={styles.dateItem}>
                        <span className={styles.dateLabel}>Start:</span>
                        <span>{formatDate(selectedMedia.startDate)}</span>
                      </div>
                    )}
                    {selectedMedia.endDate && (
                      <div className={styles.dateItem}>
                        <span className={styles.dateLabel}>End:</span>
                        <span>{formatDate(selectedMedia.endDate)}</span>
                      </div>
                    )}
                  </div>

                  {selectedMedia.genres && selectedMedia.genres.length > 0 && (
                    <div className={styles.genres}>
                      {selectedMedia.genres.map((genre, index) => (
                        <span key={index} className={styles.genreTag}>{genre}</span>
                      ))}
                    </div>
                  )}

                  {selectedMedia.description && (
                    <div className={styles.description}>
                      <h3>Description</h3>
                      <p>{selectedMedia.description.replace(/<[^>]*>/g, '')}</p>
                    </div>
                  )}

                  {selectedMedia.siteUrl && (
                    <a 
                      href={selectedMedia.siteUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className={styles.externalLink}
                    >
                      View on AniList →
                    </a>
                  )}

                  {/* 
                    Followed Users Scores Section
                    Displays scores, status, and progress from users that the authenticated user follows.
                    Similar to AniList's "Social" section on media pages.
                  */}
                  {hasToken && (
                    <div className={styles.followedScoresSection}>
                      <h3 className={styles.followedScoresTitle}>Followed Users Scores</h3>
                      
                      {/* Error message (e.g., expired token) */}
                      {tokenError ? (
                        <div className={styles.tokenError}>
                          {tokenError}
                          {tokenError.includes('expired') && (
                            <button 
                              onClick={() => window.location.href = '/api/anilist/auth/authorize'}
                              className={styles.loginButton}
                              style={{ marginTop: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                            >
                              Login Again
                            </button>
                          )}
                        </div>
                      ) : loadingScores ? (
                        // Loading state
                        <div className={styles.loadingScores}>Loading scores...</div>
                      ) : followedScores.length > 0 ? (
                        // Display scores list
                        <div className={styles.scoresList}>
                          {Array.from(
                            new Map(followedScores.map(score => [score.userId, score])).values()
                          ).map((score) => (
                            <div key={score.userId}>
                              <div className={styles.scoreItem}>
                                {/* User avatar */}
                                {score.userAvatar && (
                                  <img 
                                    src={score.userAvatar} 
                                    alt={score.userName}
                                    className={styles.scoreAvatar}
                                    loading="lazy"
                                  />
                                )}
                                {/* User info and score details */}
                                <div className={styles.scoreInfo}>
                                  <span className={styles.scoreUserName}>{score.userName}</span>
                                  <div className={styles.scoreDetails}>
                                    {/* Score out of 100 */}
                                    {score.score !== null && score.score !== undefined && (
                                      <span className={styles.scoreValue}>Score: {score.score}/100</span>
                                    )}
                                    {/* Status (CURRENT, PLANNING, COMPLETED, etc.) */}
                                    {score.status && (
                                      <span className={styles.scoreStatus}>{score.status}</span>
                                    )}
                                    {/* Progress (episode/chapter number) */}
                                    {score.progress !== null && score.progress !== undefined && (
                                      <span className={styles.scoreProgress}>Progress: {score.progress}</span>
                                    )}
                                  </div>
                                </div>
                                {/* View activities button */}
                                <button
                                  onClick={() => handleViewActivities(score.userId, score.userName)}
                                  className={styles.viewActivitiesButton}
                                  disabled={loadingUserActivities[score.userId]}
                                >
                                  {loadingUserActivities[score.userId] 
                                    ? 'Loading...' 
                                    : expandedUserActivities[score.userId] 
                                      ? 'Hide Activities' 
                                      : 'View Activities'}
                                </button>
                              </div>
                              {/* Expanded activities section */}
                              {expandedUserActivities[score.userId] && (
                                <div className={styles.userActivitiesSection}>
                                  {expandedUserActivities[score.userId].length > 0 ? (
                                    <div className={styles.activitiesList}>
                                      {expandedUserActivities[score.userId].map((activity) => (
                                        <div key={activity.id} className={styles.activityItem}>
                                          <div className={styles.activityHeader}>
                                            <span className={styles.activityDate}>
                                              {formatActivityDate(activity.createdAt)}
                                            </span>
                                            {activity.status && (
                                              <span className={styles.activityStatus}>
                                                {getStatusLabel(activity.status)}
                                              </span>
                                            )}
                                            {activity.progress !== null && activity.progress !== undefined && (
                                              <span className={styles.activityProgress}>
                                                Progress: {activity.progress}
                                              </span>
                                            )}
                                          </div>
                                          {activity.media?.coverImage?.medium && (
                                            <img 
                                              src={activity.media.coverImage.medium} 
                                              alt={activity.media.title?.romaji || ''}
                                              className={styles.activityMediaImage}
                                              loading="lazy"
                                            />
                                          )}
                                          <a 
                                            href={`https://anilist.co/activity/${activity.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={styles.activityLink}
                                          >
                                            View on AniList →
                                          </a>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className={styles.noActivities}>
                                      No list activities found for this media.
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        // No scores found
                        <div className={styles.noScores}>
                          {hasToken 
                            ? 'No followed users have rated this media yet.' 
                            : 'Please log in to see followed users scores.'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.empty}>
            <p>Search for anime or manga to see details</p>
            {query.length > 0 && query.length < 2 && (
              <p className={styles.hint}>Type at least 2 characters to search</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className={styles.loading}>Loading...</div>}>
      <SearchContent />
    </Suspense>
  );
}
