'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { searchMedia, fetchMediaById, Media } from '@/lib/anilist';
import styles from './media-search.module.css';

function MediaSearchContent() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState<string>('');
  const [mediaType, setMediaType] = useState<'ALL' | 'ANIME' | 'MANGA'>('ALL');
  const [results, setResults] = useState<Media[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Load media by ID from URL parameter
  useEffect(() => {
    const mediaIdParam = searchParams.get('mediaId');
    if (mediaIdParam) {
      const mediaId = parseInt(mediaIdParam, 10);
      if (!isNaN(mediaId)) {
        setLoading(true);
        setError(null);
        fetchMediaById(mediaId)
          .then((media) => {
            if (media) {
              setSelectedMedia(media);
              setQuery(media.title?.userPreferred || media.title?.romaji || media.title?.english || '');
              setMediaType(media.type || 'ALL');
            } else {
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
            } else {
              setError(errorMessage);
            }
          })
          .finally(() => {
            setLoading(false);
          });
      }
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
      }, 300); // 300ms debounce
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
      if (suggestionsRef.current && suggestionsRef.current.parentNode && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
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

  const handleMediaSelect = (media: Media) => {
    setSelectedMedia(media);
    setShowSuggestions(false);
    setQuery(media.title.userPreferred || media.title.romaji || media.title.english || '');
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

export default function MediaSearchPage() {
  return (
    <Suspense fallback={<div className={styles.loading}>Loading...</div>}>
      <MediaSearchContent />
    </Suspense>
  );
}
