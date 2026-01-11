'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fetchUserId, fetchUserActivities, fetchActivityReplies, toggleActivityLike, toggleActivityReplyLike, ActivityStatus, ActivityComment, AniListUser } from '@/lib/anilist';
import styles from '../anilist.module.css';

const STORAGE_KEY = 'anilist_username';
const THEME_KEY = 'anilist_theme';
const SAVED_USERS_KEY = 'anilist_saved_users';

interface SavedUser {
  username: string;
  id: number;
  name: string;
  avatar?: string;
  lastSearched: number; // timestamp
}

export default function HomePage() {
  const router = useRouter();
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
  const [expandedComments, setExpandedComments] = useState<{
    [key: number]: { replies: ActivityComment[], loading: boolean }
  }>({});
  const [savedUsers, setSavedUsers] = useState<SavedUser[]>([]);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [likingActivityId, setLikingActivityId] = useState<number | null>(null);
  const [likingReplyId, setLikingReplyId] = useState<number | null>(null);

  // Load saved username, theme, and saved users from localStorage
  useEffect(() => {
    const savedUsername = localStorage.getItem(STORAGE_KEY);
    if (savedUsername) {
      setUsername(savedUsername);
    }

    // Load saved users
    const savedUsersData = localStorage.getItem(SAVED_USERS_KEY);
    if (savedUsersData) {
      try {
        const users = JSON.parse(savedUsersData);
        setSavedUsers(users);
      } catch (e) {
        console.error('Error parsing saved users:', e);
      }
    }

    // Load access token for like functionality
    const token = localStorage.getItem('anilist_access_token');
    if (token) {
      setAccessToken(token);
    }
  }, []);

  // Save username to localStorage
  const saveUsername = useCallback((newUsername: string) => {
    localStorage.setItem(STORAGE_KEY, newUsername);
  }, []);

  // Save user to saved users list
  const saveUserToHistory = useCallback((userData: AniListUser, username: string) => {
    const savedUser: SavedUser = {
      username: username.toLowerCase(),
      id: userData.id,
      name: userData.name,
      avatar: userData.avatar?.medium || userData.avatar?.large,
      lastSearched: Date.now()
    };

    setSavedUsers(prev => {
      // Remove if already exists
      const filtered = prev.filter(u => u.id !== userData.id);
      // Add to beginning and limit to 10 users
      const updated = [savedUser, ...filtered].slice(0, 10);
      localStorage.setItem(SAVED_USERS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Remove user from saved users list
  const removeSavedUser = useCallback((userId: number) => {
    setSavedUsers(prev => {
      const updated = prev.filter(u => u.id !== userId);
      localStorage.setItem(SAVED_USERS_KEY, JSON.stringify(updated));
      return updated;
    });
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
      const userData = await fetchUserId(targetUsername);
      if (!userData) {
        // Don't set error here if it was already set by the catch block
        if (!error) {
          setError(`User "${targetUsername}" not found. Please check the username.`);
        }
        setLoading(false);
        return;
      }

      setUser(userData);
      
      // Save user to history on successful search
      saveUserToHistory(userData, targetUsername);

      // Step 2: Fetch activities with filters
      const typeToFetch = activityType || filter;
      const mediaTypeToFetch = mediaTypeFilter || mediaType;
      const statusToFetch = statusFilter || status;
      // Pass access token if available to get isLiked status
      const token = typeof window !== 'undefined' ? localStorage.getItem('anilist_access_token') : null;
      const activitiesData = await fetchUserActivities(userData.id, pageNum, 50, typeToFetch, mediaTypeToFetch, statusToFetch, token || undefined);
      if (!activitiesData) {
        setError('Error loading activities. Check the console for more details.');
        setLoading(false);
        return;
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
  }, [saveUserToHistory, filter, mediaType, status, error]);

  // Load user from saved users list
  const loadSavedUser = useCallback((savedUser: SavedUser) => {
    setUsername(savedUser.username);
    saveUsername(savedUser.username);
    loadUserActivities(savedUser.username, 1);
  }, [loadUserActivities, saveUsername]);

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

  // Auto-load if username is saved (only once on mount)
  useEffect(() => {
    const savedUsername = localStorage.getItem(STORAGE_KEY);
    if (savedUsername && savedUsername.trim() && !user) {
      setUsername(savedUsername);
      loadUserActivities(savedUsername);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Reload activities when filters change (but only if user is already loaded)
  useEffect(() => {
    if (user && username) {
      // Reset to page 1 when filters change
      setPage(1);
      setActivities([]);
      loadUserActivities(username, 1, filter, mediaType, status);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, mediaType, status]); // Reload when filters change

  // Normalize API status values to dropdown enum values
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
  const filteredAndSortedActivities = activities
    .filter(activity => {
      // Filter by activity type if specified
      if (filter !== 'all') {
        const activityTypeUpper = activity.type?.toUpperCase() || '';
        
        if (filter === 'list') {
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
      const isListActivity = activity.type?.toUpperCase().includes('LIST') || false;
      
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
            return false;
          }
          
          const normalizedActivityStatus = normalizeStatus(activity.status, activity.media?.type);
          const filterStatus = String(status).toUpperCase().trim();
          
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

  const handleLike = useCallback(async (activityId: number) => {
    if (!accessToken) {
      alert('Please log in to like activities');
      return;
    }

    if (likingActivityId === activityId) {
      return; // Prevent double-click
    }

    setLikingActivityId(activityId);
    try {
      // Find the activity to get its type
      const activity = activities.find(a => a.id === activityId);
      const result = await toggleActivityLike(accessToken, activityId, activity?.type);
      if (result) {
        // Update the activity in the list
        setActivities(prev => prev.map(activity => 
          activity.id === activityId 
            ? { ...activity, isLiked: result.isLiked, likeCount: result.likeCount }
            : activity
        ));
      }
    } catch (error: any) {
      console.error('Error toggling like:', error);
      if (error.message?.includes('UNAUTHORIZED')) {
        alert('Your session has expired. Please log in again.');
        localStorage.removeItem('anilist_access_token');
        localStorage.removeItem('anilist_user');
        setAccessToken(null);
      } else {
        alert('Failed to like activity. Please try again.');
      }
    } finally {
      setLikingActivityId(null);
    }
  }, [accessToken, likingActivityId, activities]);

  const handleReplyLike = useCallback(async (replyId: number, activityId: number) => {
    if (!accessToken) {
      alert('Please log in to like comments');
      return;
    }

    if (likingReplyId === replyId) {
      return; // Prevent double-click
    }

    setLikingReplyId(replyId);
    try {
      const result = await toggleActivityReplyLike(accessToken, replyId);
      if (result) {
        // Update the reply in the expanded comments
        setExpandedComments(prev => {
          const activityComments = prev[activityId];
          if (!activityComments) return prev;
          
          return {
            ...prev,
            [activityId]: {
              ...activityComments,
              replies: activityComments.replies.map(reply =>
                reply.id === replyId
                  ? { ...reply, isLiked: result.isLiked, likeCount: result.likeCount }
                  : reply
              )
            }
          };
        });
      }
    } catch (error: any) {
      console.error('Error toggling reply like:', error);
      if (error.message?.includes('UNAUTHORIZED')) {
        alert('Your session has expired. Please log in again.');
        localStorage.removeItem('anilist_access_token');
        localStorage.removeItem('anilist_user');
        setAccessToken(null);
      } else {
        alert('Failed to like comment. Please try again.');
      }
    } finally {
      setLikingReplyId(null);
    }
  }, [accessToken, likingReplyId]);

  const loadComments = useCallback(async (activityId: number) => {
    if (expandedComments[activityId]?.replies && expandedComments[activityId].replies.length > 0) {
      setExpandedComments(prev => {
        const newState = { ...prev };
        delete newState[activityId];
        return newState;
      });
      return;
    }
    
    if (expandedComments[activityId]?.loading) {
      return;
    }
    
    setExpandedComments(prev => ({ ...prev, [activityId]: { replies: [], loading: true } }));
    
    try {
      // Pass access token if available to get isLiked status for replies
      const token = typeof window !== 'undefined' ? localStorage.getItem('anilist_access_token') : null;
      const replies = await fetchActivityReplies(activityId, token || undefined);
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
    <>
      <div className={styles.searchSection}>
        <div className={styles.searchBox}>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="AniList username"
            className={styles.searchInput}
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            data-bwignore="true"
            data-form-type="other"
          />
          <button 
            onClick={handleSearch} 
            disabled={loading}
            className={styles.searchButton}
          >
            {loading ? 'Loading...' : 'Search'}
          </button>
        </div>
        
        {savedUsers.length > 0 && (
          <div className={styles.savedUsersSection}>
            <div className={styles.savedUsersHeader}>
              <span className={styles.savedUsersTitle}>Recent Users</span>
            </div>
            <div className={styles.savedUsersList}>
              {savedUsers.map((savedUser) => (
                <div key={savedUser.id} className={styles.savedUserItem}>
                  <button
                    onClick={() => loadSavedUser(savedUser)}
                    className={styles.savedUserButton}
                    title={`Load ${savedUser.name}`}
                  >
                    {savedUser.avatar && (
                      <img 
                        src={savedUser.avatar} 
                        alt={savedUser.name}
                        className={styles.savedUserAvatar}
                      />
                    )}
                    <span className={styles.savedUserName}>{savedUser.name}</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSavedUser(savedUser.id);
                    }}
                    className={styles.removeUserButton}
                    title={`Remove ${savedUser.name}`}
                    aria-label={`Remove ${savedUser.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className={styles.error}>
          <strong>Error:</strong> {error}
          <br />
          <small>Check the browser console (F12) for more details.</small>
        </div>
      )}

      {user && (
        <div className={styles.userInfoPage}>
          <div className={styles.userInfoMain}>
            {user.avatar?.medium && (
              <img 
                src={user.avatar.medium} 
                alt={user.name}
                className={styles.userAvatar}
              />
            )}
            <span className={styles.userName}>{user.name}</span>
          </div>
          
          {user.statistics && (
            <div className={styles.userStats}>
              {user.statistics.anime && (
                <>
                  {user.statistics.anime.count !== undefined && (
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>Anime</span>
                      <span className={styles.statValue}>{user.statistics.anime.count}</span>
                    </div>
                  )}
                  {user.statistics.anime.episodesWatched !== undefined && (
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>Episodes</span>
                      <span className={styles.statValue}>{user.statistics.anime.episodesWatched.toLocaleString()}</span>
                    </div>
                  )}
                  {user.statistics.anime.meanScore !== undefined && (
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>Avg Score</span>
                      <span className={styles.statValue}>{(user.statistics.anime.meanScore / 10).toFixed(1)}</span>
                    </div>
                  )}
                </>
              )}
              {user.statistics.manga && (
                <>
                  {user.statistics.manga.count !== undefined && (
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>Manga</span>
                      <span className={styles.statValue}>{user.statistics.manga.count}</span>
                    </div>
                  )}
                  {user.statistics.manga.chaptersRead !== undefined && (
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>Chapters</span>
                      <span className={styles.statValue}>{user.statistics.manga.chaptersRead.toLocaleString()}</span>
                    </div>
                  )}
                  {user.statistics.manga.meanScore !== undefined && (
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>Avg Score</span>
                      <span className={styles.statValue}>{(user.statistics.manga.meanScore / 10).toFixed(1)}</span>
                    </div>
                  )}
                </>
              )}
              {(user.statistics.followers !== undefined || user.statistics.following !== undefined) && (
                <>
                  {user.statistics.followers !== undefined && (
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>Followers</span>
                      <span className={styles.statValue}>{user.statistics.followers.toLocaleString()}</span>
                    </div>
                  )}
                  {user.statistics.following !== undefined && (
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>Following</span>
                      <span className={styles.statValue}>{user.statistics.following.toLocaleString()}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
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
                if (newFilter !== 'list') {
                  setMediaType('all');
                  setStatus('all');
                }
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
                  <div className={styles.statGroup}>
                    {accessToken && (
                      <button
                        onClick={() => handleLike(activity.id)}
                        disabled={likingActivityId === activity.id}
                        className={`${styles.likeButton} ${activity.isLiked ? styles.liked : ''}`}
                        title={activity.isLiked ? 'Unlike' : 'Like'}
                      >
                        {activity.isLiked ? '❤️' : '🤍'} {activity.likeCount || 0}
                      </button>
                    )}
                    {!accessToken && activity.likeCount !== undefined && activity.likeCount > 0 && (
                      <span className={styles.stat}>❤️ {activity.likeCount}</span>
                    )}
                    {activity.replyCount !== undefined && activity.replyCount > 0 && (
                      <span className={styles.stat}>💬 {activity.replyCount}</span>
                    )}
                  </div>
                  <a
                    href={`https://anilist.co/activity/${activity.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.viewOnAnilist}
                    title="View on AniList"
                  >
                    🔗
                  </a>
                </div>
              </div>

              {(activity.text || activity.message) && (
                <div 
                  className={styles.activityText}
                  dangerouslySetInnerHTML={{ 
                    __html: activity.text || activity.message || '' 
                  }}
                />
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
                    <div 
                      className={styles.mediaTitle}
                      onClick={() => {
                        if (activity.media?.id) {
                          router.push(`/anilist/search?mediaId=${activity.media.id}`);
                        }
                      }}
                      style={{ cursor: activity.media?.id ? 'pointer' : 'default' }}
                      title={activity.media?.id ? 'Click to view media details' : ''}
                    >
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
                            <div className={styles.commentStats}>
                              {accessToken && (
                                <button
                                  onClick={() => handleReplyLike(reply.id, activity.id)}
                                  disabled={likingReplyId === reply.id}
                                  className={`${styles.commentLikeButton} ${reply.isLiked ? styles.liked : ''}`}
                                  title={reply.isLiked ? 'Unlike' : 'Like'}
                                >
                                  {reply.isLiked ? '❤️' : '🤍'} {reply.likeCount || 0}
                                </button>
                              )}
                              {!accessToken && reply.likeCount !== undefined && reply.likeCount > 0 && (
                                <span className={styles.commentLikes}>
                                  ❤️ {reply.likeCount}
                                </span>
                              )}
                            </div>
                          </div>
                          {(reply.text || reply.comment) && (
                            <div 
                              className={styles.commentText}
                              dangerouslySetInnerHTML={{ 
                                __html: reply.text || reply.comment || '' 
                              }}
                            />
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
    </>
  );
}
