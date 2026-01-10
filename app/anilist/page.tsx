'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchUserId, fetchUserActivities, fetchActivityReplies, ActivityStatus, ActivityComment, AniListUser } from '@/lib/anilist';
import styles from './anilist.module.css';

const STORAGE_KEY = 'anilist_username';
const THEME_KEY = 'anilist_theme';

export default function AniListPage() {
  const [username, setUsername] = useState<string>('');
  const [user, setUser] = useState<AniListUser | null>(null);
  const [activities, setActivities] = useState<ActivityStatus[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'list' | 'text' | 'message'>('all');
  const [mediaType, setMediaType] = useState<'all' | 'anime' | 'manga'>('all');
  const [status, setStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'likes' | 'replies'>('date');
  const [page, setPage] = useState<number>(1);
  const [hasNextPage, setHasNextPage] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [expandedComments, setExpandedComments] = useState<{
    [key: number]: { replies: ActivityComment[], loading: boolean }
  }>({});

  // Load saved username and theme from localStorage
  useEffect(() => {
    const savedUsername = localStorage.getItem(STORAGE_KEY);
    if (savedUsername) {
      setUsername(savedUsername);
    }
    
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark-mode');
    }
  }, []);

  // Save username to localStorage
  const saveUsername = useCallback((newUsername: string) => {
    localStorage.setItem(STORAGE_KEY, newUsername);
  }, []);

  // Fetch user data and activities
  const loadUserActivities = useCallback(async (
    targetUsername: string, 
    pageNum: number = 1, 
    activityType?: 'all' | 'text' | 'list' | 'message',
    mediaTypeFilter?: 'all' | 'anime' | 'manga',
    statusFilter?: string
  ) => {
    if (!targetUsername.trim()) {
      setError('Please enter a username');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Step 1: Get user ID
      console.log('Fetching user:', targetUsername);
      const userData = await fetchUserId(targetUsername);
      if (!userData) {
        // Don't set error here if it was already set by the catch block
        if (!error) {
          setError(`User "${targetUsername}" not found. Please check the username.`);
        }
        setLoading(false);
        return;
      }

      console.log('User found:', userData.name, 'ID:', userData.id);
      setUser(userData);

      // Step 2: Fetch activities with filters
      const typeToFetch = activityType || filter;
      const mediaTypeToFetch = mediaTypeFilter || mediaType;
      const statusToFetch = statusFilter || status;
      console.log('Fetching activities for user:', userData.id, 'type:', typeToFetch, 'mediaType:', mediaTypeToFetch, 'status:', statusToFetch);
      const activitiesData = await fetchUserActivities(userData.id, pageNum, 50, typeToFetch, mediaTypeToFetch, statusToFetch);
      if (!activitiesData) {
        setError('Error loading activities. Check the console for more details.');
        setLoading(false);
        return;
      }

      console.log('Activities loaded:', activitiesData.activities.length);
      
      // Debug: log activity types and statuses to see what we're getting
      if (activitiesData.activities.length > 0) {
        const types = activitiesData.activities.map(a => a.type).filter((v, i, a) => a.indexOf(v) === i);
        console.log('Activity types found:', types);
        
        // Log statuses for list activities
        const listActivities = activitiesData.activities.filter(a => a.type?.toUpperCase().includes('LIST'));
        if (listActivities.length > 0) {
          const statuses = listActivities.map(a => a.status).filter((v, i, a) => a.indexOf(v) === i);
          console.log('Statuses found in list activities:', statuses);
          console.log('Sample list activity:', listActivities[0]);
        }
      }

      if (pageNum === 1) {
        setActivities(activitiesData.activities);
      } else {
        setActivities(prev => [...prev, ...activitiesData.activities]);
      }

      setHasNextPage(activitiesData.pageInfo.hasNextPage);
      setPage(pageNum);
    } catch (err: any) {
      const errorMessage = err?.message || 'An error occurred';
      
      // Check for rate limiting errors (check for RATE_LIMIT prefix first)
      if (errorMessage.startsWith('RATE_LIMIT:') || 
          errorMessage.includes('Too many requests') || 
          errorMessage.includes('Trop de requêtes') ||
          errorMessage.includes('rate limit') ||
          errorMessage.toLowerCase().includes('429')) {
        const cleanMessage = errorMessage.replace('RATE_LIMIT: ', '');
        setError('⏱️ Rate limit exceeded. The AniList API limits the number of requests. Please wait 30-60 seconds before trying again.');
      } else if (errorMessage.includes('not found') || errorMessage.includes('non trouvé')) {
        setError(`User "${targetUsername}" not found. Please check the username.`);
      } else {
        setError(errorMessage);
      }
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle search
  const handleSearch = useCallback(() => {
    setPage(1);
    saveUsername(username);
    loadUserActivities(username, 1);
  }, [username, loadUserActivities, saveUsername]);

  // Load more activities
  const loadMore = useCallback(() => {
    if (!loading && hasNextPage && user) {
      loadUserActivities(username, page + 1);
    }
  }, [loading, hasNextPage, user, username, page, loadUserActivities]);

  // Auto-load if username is saved
  useEffect(() => {
    const savedUsername = localStorage.getItem(STORAGE_KEY);
    if (savedUsername && savedUsername.trim()) {
      setUsername(savedUsername);
      loadUserActivities(savedUsername);
    }
  }, [loadUserActivities]);

  // Note: We don't reload activities when filters change anymore
  // All filtering is done client-side for better performance
  // The activities are loaded once and then filtered locally

  // Normalize API status values to dropdown enum values
  // API returns: "watched episode", "read chapter", "plans to watch", "plans to read", "completed", "dropped", etc.
  // Dropdown uses: "CURRENT", "PLANNING", "COMPLETED", "DROPPED", "PAUSED", "REPEATING"
  const normalizeStatus = (status: string, mediaType?: string): string => {
    if (!status) return status;
    
    const statusLower = status.toLowerCase().trim();
    
    // Map API status values to enum values
    if (statusLower === 'watched episode' || statusLower === 'read chapter') {
      return 'CURRENT';
    }
    if (statusLower === 'plans to watch' || statusLower === 'plans to read') {
      return 'PLANNING';
    }
    if (statusLower === 'completed') {
      return 'COMPLETED';
    }
    if (statusLower === 'dropped') {
      return 'DROPPED';
    }
    if (statusLower === 'paused') {
      return 'PAUSED';
    }
    if (statusLower === 'repeating') {
      return 'REPEATING';
    }
    
    // If already in enum format, return as-is
    const statusUpper = status.toUpperCase();
    if (['CURRENT', 'PLANNING', 'COMPLETED', 'DROPPED', 'PAUSED', 'REPEATING'].includes(statusUpper)) {
      return statusUpper;
    }
    
    // Default: return uppercase version
    return statusUpper;
  };

  // Filter and sort activities
  // Note: All filtering is done client-side as the GraphQL API
  // doesn't support ActivityType enum filtering directly
  const filteredAndSortedActivities = activities
    .filter(activity => {
      // Filter by activity type if specified
      if (filter !== 'all') {
        // Check the activity type - it might be "ANIME_LIST", "MANGA_LIST", "TEXT", or "MESSAGE"
        const activityTypeUpper = activity.type?.toUpperCase() || '';
        
        if (filter === 'list') {
          // For list activities, the type is usually "ANIME_LIST" or "MANGA_LIST"
          if (!activityTypeUpper.includes('LIST')) {
            return false;
          }
        } else if (filter === 'text') {
          if (activityTypeUpper !== 'TEXT') {
            return false;
          }
        } else if (filter === 'message') {
          if (activityTypeUpper !== 'MESSAGE') {
            return false;
          }
        }
      }
      
      // Filter by mediaType and status if specified (only for ListActivity)
      // Only apply these filters if the main filter is 'list' or 'all'
      const isListActivity = activity.type?.toUpperCase().includes('LIST') || false;
      
      // Only apply mediaType and status filters if:
      // 1. The activity is a ListActivity, AND
      // 2. The main filter is 'list' or 'all' (not 'text' or 'message')
      if (isListActivity && (filter === 'list' || filter === 'all')) {
        // Filter by mediaType if specified
        if (mediaType !== 'all' && activity.media?.type) {
          const activityMediaType = activity.media.type.toLowerCase();
          if (mediaType === 'anime' && activityMediaType !== 'anime') return false;
          if (mediaType === 'manga' && activityMediaType !== 'manga') return false;
        }
        
        // Filter by status if specified
        if (status !== 'all') {
          if (!activity.status) {
            // If activity has no status, exclude it when filtering by status
            return false;
          }
          
          // Normalize API status to enum value for comparison
          const normalizedActivityStatus = normalizeStatus(activity.status, activity.media?.type);
          const filterStatus = String(status).toUpperCase().trim();
          
          // Compare normalized values
          if (normalizedActivityStatus !== filterStatus) {
            return false;
          }
        }
      }
      
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'likes':
          return (b.likeCount || 0) - (a.likeCount || 0);
        case 'replies':
          return (b.replyCount || 0) - (a.replyCount || 0);
        case 'date':
        default:
          return b.createdAt - a.createdAt;
      }
    });

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getActivityTypeLabel = (type: string, mediaType?: string) => {
    switch (type) {
      case 'TEXT':
        return 'Text';
      case 'LIST':
      case 'ANIME_LIST':
        return 'Anime';
      case 'MANGA_LIST':
        return 'Manga';
      case 'MESSAGE':
        return 'Message';
      default:
        return type;
    }
  };

  const getStatusLabel = (status: string, mediaType?: string) => {
    const normalizedStatus = normalizeStatus(status, mediaType);
    const isAnime = mediaType?.toLowerCase() === 'anime';
    const isManga = mediaType?.toLowerCase() === 'manga';
    
    switch (normalizedStatus) {
      case 'CURRENT':
        return isAnime ? 'Watching' : isManga ? 'Reading' : 'Current';
      case 'PLANNING':
        return 'Planning';
      case 'COMPLETED':
        return 'Completed';
      case 'DROPPED':
        return 'Dropped';
      case 'PAUSED':
        return 'Paused';
      case 'REPEATING':
        return 'Repeating';
      default:
        return status;
    }
  };

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem(THEME_KEY, newMode ? 'dark' : 'light');
    if (newMode) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
  };

  const loadComments = useCallback(async (activityId: number) => {
    // Si déjà chargé, toggle (fermer)
    if (expandedComments[activityId]?.replies && expandedComments[activityId].replies.length > 0) {
      setExpandedComments(prev => {
        const newState = { ...prev };
        delete newState[activityId];
        return newState;
      });
      return;
    }
    
    // Si déjà en chargement, ne rien faire
    if (expandedComments[activityId]?.loading) {
      return;
    }
    
    // Charger via API
    setExpandedComments(prev => ({ ...prev, [activityId]: { replies: [], loading: true } }));
    
    try {
      console.log(`Loading comments for activity ${activityId} via API...`);
      const replies = await fetchActivityReplies(activityId);
      console.log(`Received replies for activity ${activityId}:`, replies, `(type: ${typeof replies}, isArray: ${Array.isArray(replies)}, length: ${Array.isArray(replies) ? replies.length : 'N/A'})`);
      setExpandedComments(prev => ({ 
        ...prev, 
        [activityId]: { 
          replies: Array.isArray(replies) ? replies : [], 
          loading: false 
        } 
      }));
    } catch (error) {
      console.error(`Error loading comments for activity ${activityId}:`, error);
      setExpandedComments(prev => ({ 
        ...prev, 
        [activityId]: { 
          replies: [], 
          loading: false 
        } 
      }));
    }
  }, [expandedComments, activities]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <h1 className={styles.title}>AniList - Activities</h1>
          <button 
            onClick={toggleDarkMode}
            className={styles.themeToggle}
            aria-label="Toggle dark mode"
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
        </div>
        
        <div className={styles.searchSection}>
          <div className={styles.searchBox}>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="AniList username"
              className={styles.searchInput}
            />
            <button 
              onClick={handleSearch} 
              disabled={loading}
              className={styles.searchButton}
            >
              {loading ? 'Loading...' : 'Search'}
            </button>
          </div>
        </div>

        {user && (
          <div className={styles.userInfo}>
            {user.avatar?.medium && (
              <img 
                src={user.avatar.medium} 
                alt={user.name}
                className={styles.userAvatar}
              />
            )}
            <span className={styles.userName}>{user.name}</span>
          </div>
        )}

        {activities.length > 0 && (
          <div className={styles.filters}>
            <div className={styles.filterGroup}>
              <label>Type:</label>
              <select 
                value={filter} 
                onChange={(e) => {
                  const newFilter = e.target.value as 'all' | 'list' | 'text' | 'message';
                  setFilter(newFilter);
                  // Reset mediaType and status when filter changes away from 'list'
                  if (newFilter !== 'list') {
                    setMediaType('all');
                    setStatus('all');
                    console.log(`[Filter] Changed filter to "${newFilter}", resetting mediaType and status to "all"`);
                  }
                  // Activities will be reloaded by the useEffect above
                }}
                className={styles.filterSelect}
              >
                <option value="all">All</option>
                <option value="list">List</option>
                <option value="text">Text</option>
                <option value="message">Message</option>
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label>Media:</label>
              <select 
                value={mediaType} 
                onChange={(e) => {
                  const newMediaType = e.target.value as 'all' | 'anime' | 'manga';
                  setMediaType(newMediaType);
                  // Activities will be reloaded by the useEffect above
                }}
                className={styles.filterSelect}
                disabled={filter !== 'list'}
                style={{ 
                  cursor: filter !== 'list' ? 'not-allowed' : 'pointer',
                  pointerEvents: filter !== 'list' ? 'none' : 'auto'
                }}
              >
                <option value="all">All</option>
                <option value="anime">Anime</option>
                <option value="manga">Manga</option>
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label>Status:</label>
              <select 
                value={status} 
                onChange={(e) => {
                  setStatus(e.target.value);
                  // Activities will be reloaded by the useEffect above
                }}
                className={styles.filterSelect}
                disabled={filter !== 'list'}
                style={{ 
                  cursor: filter !== 'list' ? 'not-allowed' : 'pointer',
                  pointerEvents: filter !== 'list' ? 'none' : 'auto'
                }}
              >
                <option value="all">All</option>
                {mediaType === 'all' ? (
                  <>
                    <option value="CURRENT">In Progress</option>
                    <option value="PLANNING">Planning</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="DROPPED">Dropped</option>
                    <option value="PAUSED">Paused</option>
                    <option value="REPEATING">Repeating</option>
                  </>
                ) : mediaType === 'anime' ? (
                  <>
                    <option value="CURRENT">Watching</option>
                    <option value="PLANNING">Planning</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="DROPPED">Dropped</option>
                    <option value="PAUSED">Paused</option>
                    <option value="REPEATING">Repeating</option>
                  </>
                ) : (
                  <>
                    <option value="CURRENT">Reading</option>
                    <option value="PLANNING">Planning</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="DROPPED">Dropped</option>
                    <option value="PAUSED">Paused</option>
                    <option value="REPEATING">Repeating</option>
                  </>
                )}
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label>Sort by:</label>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value as any)}
                className={styles.filterSelect}
              >
                <option value="date">Date</option>
                <option value="likes">Likes</option>
                <option value="replies">Comments</option>
              </select>
            </div>

            <div className={styles.stats}>
              {filteredAndSortedActivities.length} activity(ies)
            </div>
          </div>
        )}
      </header>

      {error && (
        <div className={styles.error}>
          <strong>Error:</strong> {error}
          <br />
          <small>Check the browser console (F12) for more details.</small>
        </div>
      )}

      <main className={styles.main}>
        {loading && activities.length === 0 && (
          <div className={styles.loading}>Loading...</div>
        )}

        {!loading && activities.length === 0 && !error && user && (
          <div className={styles.empty}>
            No activities found for this user.
          </div>
        )}

        <div className={styles.activitiesList}>
          {filteredAndSortedActivities.map((activity) => (
            <div key={activity.id} className={styles.activityCard}>
              <div className={styles.activityHeader}>
                <div className={styles.activityUser}>
                  {activity.user?.avatar?.medium && (
                    <img 
                      src={activity.user.avatar.medium} 
                      alt={activity.user.name}
                      className={styles.activityAvatar}
                    />
                  )}
                  <div>
                    <div className={styles.activityUserName}>
                      {activity.user?.name || (activity.userId ? `User ${activity.userId}` : 'AniList')}
                    </div>
                    <div className={styles.activityMeta}>
                      <span 
                        className={styles.activityType}
                        data-media-type={activity.type === 'ANIME_LIST' ? 'anime' : activity.type === 'MANGA_LIST' ? 'manga' : ''}
                      >
                        {getActivityTypeLabel(activity.type, activity.media?.type)}
                      </span>
                      <span className={styles.activityDate}>
                        {formatDate(activity.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className={styles.activityStats}>
                  {activity.likeCount !== undefined && activity.likeCount > 0 && (
                    <span className={styles.stat}>❤️ {activity.likeCount}</span>
                  )}
                  {activity.replyCount !== undefined && activity.replyCount > 0 && (
                    <span className={styles.stat}>💬 {activity.replyCount}</span>
                  )}
                </div>
              </div>

              {(activity.text || activity.message) && (
                <div className={styles.activityText}>
                  {activity.text || activity.message}
                </div>
              )}

              {activity.media && (
                <div className={styles.mediaInfo}>
                  {activity.media.coverImage?.medium && (
                    <img 
                      src={activity.media.coverImage.medium} 
                      alt={activity.media.title?.romaji || 'Media'}
                      className={styles.mediaCover}
                    />
                  )}
                  <div className={styles.mediaDetails}>
                    <div className={styles.mediaTitle}>
                      {activity.media.title?.romaji || activity.media.title?.english || 'Untitled'}
                    </div>
                    {activity.status && (
                      <div className={styles.activityStatus}>
                        Status: {getStatusLabel(activity.status, activity.media?.type)}
                      </div>
                    )}
                    {activity.progress && (
                      <div className={styles.activityProgress}>
                        Progress: {activity.progress}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Comments section */}
              {activity.replyCount !== undefined && activity.replyCount > 0 && (
                <div className={styles.commentsSection}>
                  <div 
                    className={styles.commentsHeader}
                    onClick={() => loadComments(activity.id)}
                  >
                    💬 {activity.replyCount} comment(s)
                    {expandedComments[activity.id]?.loading && ' - Loading...'}
                    {expandedComments[activity.id]?.replies && expandedComments[activity.id].replies.length > 0 && ' ▼'}
                    {!expandedComments[activity.id] && ' ▶'}
                  </div>
                  
                  {expandedComments[activity.id]?.loading && (
                    <div className={styles.commentsLoading}>
                      Loading comments...
                    </div>
                  )}
                  
                  {expandedComments[activity.id]?.replies && expandedComments[activity.id].replies.length > 0 && (
                    <div className={styles.commentsList}>
                      {expandedComments[activity.id].replies.map((reply) => (
                        <div key={reply.id} className={styles.comment}>
                          <div className={styles.commentHeader}>
                            {reply.user?.avatar?.medium && (
                              <img 
                                src={reply.user.avatar.medium} 
                                alt={reply.user.name}
                                className={styles.commentAvatar}
                              />
                            )}
                            <div className={styles.commentUserInfo}>
                              <span className={styles.commentUserName}>
                                {reply.user?.name || 'User'}
                              </span>
                              <span className={styles.commentDate}>
                                {formatDate(reply.createdAt)}
                              </span>
                            </div>
                            {reply.likeCount !== undefined && reply.likeCount > 0 && (
                              <span className={styles.commentLikes}>
                                ❤️ {reply.likeCount}
                              </span>
                            )}
                          </div>
                          {(reply.text || reply.comment) && (
                            <div className={styles.commentText}>
                              {reply.text || reply.comment}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {expandedComments[activity.id] && !expandedComments[activity.id].loading && expandedComments[activity.id].replies.length === 0 && (
                    <div className={styles.commentsEmpty}>
                      No comments available or error loading. Check the console (F12) for more details.
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {hasNextPage && (
          <div className={styles.loadMoreSection}>
            <button 
              onClick={loadMore} 
              disabled={loading}
              className={styles.loadMoreButton}
            >
              {loading ? 'Loading...' : 'Load more'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
