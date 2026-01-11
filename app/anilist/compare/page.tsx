'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchUserId, fetchMediaById, getFollowedUsersScores, UserMediaScore, AniListUser, Media } from '@/lib/anilist';
import styles from '../anilist.module.css';

export default function ComparePage() {
  const [user1Username, setUser1Username] = useState<string>('');
  const [user2Username, setUser2Username] = useState<string>('');
  const [mediaId, setMediaId] = useState<string>('');
  const [user1, setUser1] = useState<AniListUser | null>(null);
  const [user2, setUser2] = useState<AniListUser | null>(null);
  const [media, setMedia] = useState<Media | null>(null);
  const [user1Score, setUser1Score] = useState<UserMediaScore | null>(null);
  const [user2Score, setUser2Score] = useState<UserMediaScore | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadComparison = useCallback(async () => {
    if (!user1Username.trim() || !user2Username.trim() || !mediaId.trim()) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError(null);
    setUser1(null);
    setUser2(null);
    setMedia(null);
    setUser1Score(null);
    setUser2Score(null);

    try {
      // Fetch both users
      const [user1Data, user2Data, mediaData] = await Promise.all([
        fetchUserId(user1Username.trim()),
        fetchUserId(user2Username.trim()),
        fetchMediaById(parseInt(mediaId.trim(), 10))
      ]);

      if (!user1Data) {
        setError(`User "${user1Username}" not found`);
        setLoading(false);
        return;
      }
      if (!user2Data) {
        setError(`User "${user2Username}" not found`);
        setLoading(false);
        return;
      }
      if (!mediaData) {
        setError(`Media with ID "${mediaId}" not found`);
        setLoading(false);
        return;
      }

      setUser1(user1Data);
      setUser2(user2Data);
      setMedia(mediaData);

      // Fetch scores for both users
      const token = typeof window !== 'undefined' ? localStorage.getItem('anilist_access_token') : null;
      
      try {
        const scores = await getFollowedUsersScores(token || '', parseInt(mediaId.trim(), 10));
        
        const user1ScoreData = scores.find(s => s.userId === user1Data.id);
        const user2ScoreData = scores.find(s => s.userId === user2Data.id);
        
        setUser1Score(user1ScoreData || null);
        setUser2Score(user2ScoreData || null);
      } catch (scoreError: any) {
        // If not logged in or no scores, that's okay - we'll just show user info
        if (!scoreError.message?.includes('UNAUTHORIZED')) {
          console.warn('Could not fetch scores:', scoreError);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load comparison');
    } finally {
      setLoading(false);
    }
  }, [user1Username, user2Username, mediaId]);

  const formatScore = (score: number | null | undefined, scoreFormat: string = 'POINT_10') => {
    if (score === null || score === undefined) return 'N/A';
    if (scoreFormat === 'POINT_10') {
      return (score / 10).toFixed(1);
    }
    return score.toString();
  };

  const formatStatus = (status: string | null | undefined) => {
    if (!status) return 'N/A';
    const statusMap: Record<string, string> = {
      'CURRENT': 'Watching/Reading',
      'PLANNING': 'Planning',
      'COMPLETED': 'Completed',
      'DROPPED': 'Dropped',
      'PAUSED': 'Paused',
      'REPEATING': 'Repeating'
    };
    return statusMap[status] || status;
  };

  return (
    <div className={styles.compareContainer}>
      <div className={styles.compareHeader}>
        <h2>Compare Lists</h2>
        <p>Compare two users' scores and progress for a specific anime or manga</p>
      </div>

      <div className={styles.compareForm}>
        <div className={styles.compareFormGroup}>
          <label>User 1:</label>
          <input
            type="text"
            value={user1Username}
            onChange={(e) => setUser1Username(e.target.value)}
            placeholder="Username 1"
            className={styles.compareInput}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                loadComparison();
              }
            }}
          />
        </div>

        <div className={styles.compareFormGroup}>
          <label>User 2:</label>
          <input
            type="text"
            value={user2Username}
            onChange={(e) => setUser2Username(e.target.value)}
            placeholder="Username 2"
            className={styles.compareInput}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                loadComparison();
              }
            }}
          />
        </div>

        <div className={styles.compareFormGroup}>
          <label>Media ID:</label>
          <input
            type="text"
            value={mediaId}
            onChange={(e) => setMediaId(e.target.value)}
            placeholder="Anime/Manga ID"
            className={styles.compareInput}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                loadComparison();
              }
            }}
          />
        </div>

        <button
          onClick={loadComparison}
          disabled={loading || !user1Username.trim() || !user2Username.trim() || !mediaId.trim()}
          className={styles.compareButton}
        >
          {loading ? 'Loading...' : 'Compare'}
        </button>
      </div>

      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      {media && user1 && user2 && (
        <div className={styles.compareResults}>
          <div className={styles.mediaInfo}>
            {media.coverImage?.large && (
              <img src={media.coverImage.large} alt={media.title?.romaji || 'Media'} className={styles.mediaCover} loading="lazy" />
            )}
            <div>
              <h3>{media.title?.romaji || media.title?.english || 'Unknown'}</h3>
              <p className={styles.mediaType}>{media.type}</p>
            </div>
          </div>

          <div className={styles.comparisonGrid}>
            <div className={styles.userComparison}>
              <div className={styles.userHeader}>
                {user1.avatar?.medium && (
                  <img src={user1.avatar.medium} alt={user1.name} className={styles.userAvatar} loading="lazy" />
                )}
                <h4>{user1.name}</h4>
              </div>
              <div className={styles.compareUserStats}>
                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Score:</span>
                  <span className={styles.statValue}>
                    {user1Score?.score !== null && user1Score?.score !== undefined
                      ? formatScore(user1Score.score, user1Score.scoreFormat)
                      : 'N/A'}
                  </span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Status:</span>
                  <span className={styles.statValue}>{formatStatus(user1Score?.status)}</span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Progress:</span>
                  <span className={styles.statValue}>
                    {user1Score?.progress !== null && user1Score?.progress !== undefined
                      ? `${user1Score.progress} / ${media.episodes || media.chapters || '?'}`
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.userComparison}>
              <div className={styles.userHeader}>
                {user2.avatar?.medium && (
                  <img src={user2.avatar.medium} alt={user2.name} className={styles.userAvatar} loading="lazy" />
                )}
                <h4>{user2.name}</h4>
              </div>
              <div className={styles.compareUserStats}>
                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Score:</span>
                  <span className={styles.statValue}>
                    {user2Score?.score !== null && user2Score?.score !== undefined
                      ? formatScore(user2Score.score, user2Score.scoreFormat)
                      : 'N/A'}
                  </span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Status:</span>
                  <span className={styles.statValue}>{formatStatus(user2Score?.status)}</span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Progress:</span>
                  <span className={styles.statValue}>
                    {user2Score?.progress !== null && user2Score?.progress !== undefined
                      ? `${user2Score.progress} / ${media.episodes || media.chapters || '?'}`
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {user1Score && user2Score && (
            <div className={styles.comparisonSummary}>
              <h4>Comparison</h4>
              <div className={styles.summaryStats}>
                {user1Score.score !== null && user2Score.score !== null && (
                  <div className={styles.summaryStat}>
                    <span className={styles.summaryLabel}>Score Difference:</span>
                    <span className={styles.summaryValue}>
                      {Math.abs(parseFloat(formatScore(user1Score.score, user1Score.scoreFormat)) - parseFloat(formatScore(user2Score.score, user2Score.scoreFormat))).toFixed(1)}
                    </span>
                  </div>
                )}
                {user1Score.progress !== null && user2Score.progress !== null && (
                  <div className={styles.summaryStat}>
                    <span className={styles.summaryLabel}>Progress Difference:</span>
                    <span className={styles.summaryValue}>
                      {Math.abs((user1Score.progress || 0) - (user2Score.progress || 0))} episodes/chapters
                    </span>
                  </div>
                )}
                {user1Score.status && user2Score.status && (
                  <div className={styles.summaryStat}>
                    <span className={styles.summaryLabel}>Status Match:</span>
                    <span className={styles.summaryValue}>
                      {user1Score.status === user2Score.status ? '✓ Same' : '✗ Different'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
