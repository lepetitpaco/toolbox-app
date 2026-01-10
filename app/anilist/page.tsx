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
  const loadUserActivities = useCallback(async (targetUsername: string, pageNum: number = 1) => {
    if (!targetUsername.trim()) {
      setError('Veuillez entrer un nom d\'utilisateur');
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
          setError(`Utilisateur "${targetUsername}" non trouvé. Vérifiez le nom d'utilisateur.`);
        }
        setLoading(false);
        return;
      }

      console.log('User found:', userData.name, 'ID:', userData.id);
      setUser(userData);

      // Step 2: Fetch all activities
      console.log('Fetching activities for user:', userData.id);
      const activitiesData = await fetchUserActivities(userData.id, pageNum, 50);
      if (!activitiesData) {
        setError('Erreur lors du chargement des activités. Vérifiez la console pour plus de détails.');
        setLoading(false);
        return;
      }

      console.log('Activities loaded:', activitiesData.activities.length);

      if (pageNum === 1) {
        setActivities(activitiesData.activities);
      } else {
        setActivities(prev => [...prev, ...activitiesData.activities]);
      }

      setHasNextPage(activitiesData.pageInfo.hasNextPage);
      setPage(pageNum);
    } catch (err: any) {
      const errorMessage = err?.message || 'Une erreur est survenue';
      
      // Check for rate limiting errors (check for RATE_LIMIT prefix first)
      if (errorMessage.startsWith('RATE_LIMIT:') || 
          errorMessage.includes('Too many requests') || 
          errorMessage.includes('Trop de requêtes') ||
          errorMessage.includes('rate limit') ||
          errorMessage.toLowerCase().includes('429')) {
        const cleanMessage = errorMessage.replace('RATE_LIMIT: ', '');
        setError('⏱️ Limite de requêtes atteinte. L\'API AniList limite le nombre de requêtes. Veuillez attendre 30-60 secondes avant de réessayer.');
      } else if (errorMessage.includes('not found') || errorMessage.includes('non trouvé')) {
        setError(`Utilisateur "${targetUsername}" non trouvé. Vérifiez le nom d'utilisateur.`);
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

  // Filter and sort activities
  const filteredAndSortedActivities = activities
    .filter(activity => {
      if (filter === 'all') return true;
      // Map filter values to activity types
      const typeMap: Record<string, string> = {
        'list': 'LIST',
        'text': 'TEXT',
        'message': 'MESSAGE'
      };
      return activity.type === typeMap[filter] || activity.type === filter.toUpperCase();
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
    return new Intl.DateTimeFormat('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getActivityTypeLabel = (type: string) => {
    switch (type) {
      case 'TEXT':
        return 'Texte';
      case 'LIST':
        return 'Liste';
      case 'MESSAGE':
        return 'Message';
      default:
        return type;
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
          <h1 className={styles.title}>AniList - Activités</h1>
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
              placeholder="Nom d'utilisateur AniList"
              className={styles.searchInput}
            />
            <button 
              onClick={handleSearch} 
              disabled={loading}
              className={styles.searchButton}
            >
              {loading ? 'Chargement...' : 'Rechercher'}
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
                onChange={(e) => setFilter(e.target.value as any)}
                className={styles.filterSelect}
              >
                <option value="all">Tous</option>
                <option value="list">Liste</option>
                <option value="text">Texte</option>
                <option value="message">Message</option>
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label>Trier par:</label>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value as any)}
                className={styles.filterSelect}
              >
                <option value="date">Date</option>
                <option value="likes">Likes</option>
                <option value="replies">Commentaires</option>
              </select>
            </div>

            <div className={styles.stats}>
              {filteredAndSortedActivities.length} activité(s)
            </div>
          </div>
        )}
      </header>

      {error && (
        <div className={styles.error}>
          <strong>Erreur :</strong> {error}
          <br />
          <small>Vérifiez la console du navigateur (F12) pour plus de détails.</small>
        </div>
      )}

      <main className={styles.main}>
        {loading && activities.length === 0 && (
          <div className={styles.loading}>Chargement...</div>
        )}

        {!loading && activities.length === 0 && !error && user && (
          <div className={styles.empty}>
            Aucune activité trouvée pour cet utilisateur.
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
                      <span className={styles.activityType}>
                        {getActivityTypeLabel(activity.type)}
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
                      {activity.media.title?.romaji || activity.media.title?.english || 'Sans titre'}
                    </div>
                    {activity.status && (
                      <div className={styles.activityStatus}>
                        Statut: {activity.status}
                      </div>
                    )}
                    {activity.progress && (
                      <div className={styles.activityProgress}>
                        Progression: {activity.progress}
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
                    💬 {activity.replyCount} commentaire(s)
                    {expandedComments[activity.id]?.loading && ' - Chargement...'}
                    {expandedComments[activity.id]?.replies && expandedComments[activity.id].replies.length > 0 && ' ▼'}
                    {!expandedComments[activity.id] && ' ▶'}
                  </div>
                  
                  {expandedComments[activity.id]?.loading && (
                    <div className={styles.commentsLoading}>
                      Chargement des commentaires...
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
                                {reply.user?.name || 'Utilisateur'}
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
                      Aucun commentaire disponible ou erreur lors du chargement. Vérifiez la console (F12) pour plus de détails.
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
              {loading ? 'Chargement...' : 'Charger plus'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
