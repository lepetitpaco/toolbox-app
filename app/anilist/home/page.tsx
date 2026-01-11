'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { fetchUserId, fetchUserActivities, fetchActivityReplies, toggleActivityLike, toggleActivityReplyLike, ActivityStatus, ActivityComment, AniListUser } from '@/lib/anilist';
import { useToast } from '../contexts/ToastContext';
import styles from '../anilist.module.css';

const STORAGE_KEY = 'anilist_username';
const THEME_KEY = 'anilist_theme';
const SAVED_USERS_KEY = 'anilist_saved_users';
const USER_FILTERS_KEY = 'anilist_user_filters';
const FILTER_PRESETS_KEY = 'anilist_filter_presets';
const COMPACT_MODE_KEY = 'anilist_compact_mode';
const LAST_VISIT_KEY = 'anilist_last_visit';

interface SavedUser {
  username: string;
  id: number;
  name: string;
  avatar?: string;
  lastSearched: number; // timestamp
}

export default function HomePage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [username, setUsername] = useState<string>('');
  const [user, setUser] = useState<AniListUser | null>(null);
  const [activities, setActivities] = useState<ActivityStatus[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [filter, setFilter] = useState<'all' | 'list' | 'list-anime' | 'list-manga' | 'text' | 'message'>('all');
  const [status, setStatus] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'>('all');
  const [customDateStart, setCustomDateStart] = useState<string>('');
  const [customDateEnd, setCustomDateEnd] = useState<string>('');
  const [compactMode, setCompactMode] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'date' | 'likes' | 'replies'>('date');
  
  // Applied filters (only these are used for client-side filtering)
  // These are updated when "Apply" is clicked, not when dropdowns change
  const [appliedFilter, setAppliedFilter] = useState<'all' | 'list' | 'list-anime' | 'list-manga' | 'text' | 'message'>('all');
  const [appliedStatus, setAppliedStatus] = useState<string>('all');
  const [appliedSortBy, setAppliedSortBy] = useState<'date' | 'likes' | 'replies'>('date');
  const [filterPresets, setFilterPresets] = useState<Array<{ id: string; name: string; filters: { filter: string; status: string; dateFilter: string; customDateStart: string; customDateEnd: string; sortBy: string } }>>([]);
  const [showPresetModal, setShowPresetModal] = useState<boolean>(false);
  const [presetName, setPresetName] = useState<string>('');
  const [newActivitiesCount, setNewActivitiesCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [hasNextPage, setHasNextPage] = useState<boolean>(false);
  const [expandedComments, setExpandedComments] = useState<{
    [key: number]: { replies: ActivityComment[], loading: boolean }
  }>({});
  const [savedUsers, setSavedUsers] = useState<SavedUser[]>([]);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [likingActivityId, setLikingActivityId] = useState<number | null>(null);
  const [likingReplyId, setLikingReplyId] = useState<number | null>(null);
  
  // Refs for debouncing and preventing duplicate requests
  const filterDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastRequestKeyRef = useRef<string>('');
  const isRequestInProgressRef = useRef<boolean>(false);
  const isLoadingFiltersRef = useRef<boolean>(false); // Flag to prevent useEffect during filter loading

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
    
    // Load compact mode preference
    const savedCompactMode = localStorage.getItem(COMPACT_MODE_KEY);
    if (savedCompactMode === 'true') {
      setCompactMode(true);
    }
    
    // Initialize last visit timestamp if not exists
    if (!localStorage.getItem(LAST_VISIT_KEY)) {
      localStorage.setItem(LAST_VISIT_KEY, Date.now().toString());
    }
  }, []);

  // Save filters for current user
  const saveUserFilters = useCallback((userId: number, filters: { filter: string; status: string; sortBy: string; dateFilter?: string; customDateStart?: string; customDateEnd?: string }) => {
    if (typeof window === 'undefined') return;
    
    const savedFilters = localStorage.getItem(USER_FILTERS_KEY);
    let allFilters: Record<number, typeof filters> = {};
    
    if (savedFilters) {
      try {
        allFilters = JSON.parse(savedFilters);
      } catch (e) {
        console.error('Error parsing saved filters:', e);
      }
    }
    
    allFilters[userId] = filters;
    localStorage.setItem(USER_FILTERS_KEY, JSON.stringify(allFilters));
  }, []);

  // Load filters for current user
  const loadUserFilters = useCallback((userId: number) => {
    if (typeof window === 'undefined') return null;
    
    const savedFilters = localStorage.getItem(USER_FILTERS_KEY);
    if (!savedFilters) return null;
    
    try {
      const allFilters: Record<number, { filter: string; status: string; sortBy: string }> = JSON.parse(savedFilters);
      const saved = allFilters[userId];
      
      // Migrate old format (with mediaType) to new format
      if (saved && 'mediaType' in saved) {
        const oldSaved = saved as any;
        if (oldSaved.filter === 'list' && oldSaved.mediaType === 'anime') {
          saved.filter = 'list-anime';
        } else if (oldSaved.filter === 'list' && oldSaved.mediaType === 'manga') {
          saved.filter = 'list-manga';
        }
        // Remove mediaType from saved filters
        delete oldSaved.mediaType;
        allFilters[userId] = { filter: saved.filter, status: saved.status, sortBy: saved.sortBy };
        localStorage.setItem(USER_FILTERS_KEY, JSON.stringify(allFilters));
      }
      
      return saved || null;
    } catch (e) {
      console.error('Error parsing saved filters:', e);
      return null;
    }
  }, []);

  // Calculate new activities count since last visit
  const getNewActivitiesCount = useCallback(() => {
    if (typeof window === 'undefined' || activities.length === 0) return 0;
    
    const lastVisit = localStorage.getItem(LAST_VISIT_KEY);
    if (!lastVisit) return 0;
    
    const lastVisitTimestamp = parseInt(lastVisit, 10);
    return activities.filter(activity => {
      if (!activity.createdAt) return false;
      return activity.createdAt * 1000 > lastVisitTimestamp;
    }).length;
  }, [activities]);
  
  // Update last visit timestamp when activities are loaded
  useEffect(() => {
    if (activities.length > 0 && user) {
      // Update last visit timestamp after a short delay to allow user to see new activities
      const timer = setTimeout(() => {
        if (typeof window !== 'undefined') {
          localStorage.setItem(LAST_VISIT_KEY, Date.now().toString());
        }
      }, 5000); // 5 seconds delay
      
      return () => clearTimeout(timer);
    }
  }, [activities, user]);
  
  // Save filter preset
  const saveFilterPreset = useCallback(() => {
    if (!presetName.trim()) {
      alert('Please enter a name for the preset');
      return;
    }
    
    const preset = {
      id: Date.now().toString(),
      name: presetName.trim(),
      filters: {
        filter,
        status,
        dateFilter,
        customDateStart,
        customDateEnd,
        sortBy
      }
    };
    
    const updatedPresets = [...filterPresets, preset];
    setFilterPresets(updatedPresets);
    if (typeof window !== 'undefined') {
      localStorage.setItem(FILTER_PRESETS_KEY, JSON.stringify(updatedPresets));
    }
    setPresetName('');
    setShowPresetModal(false);
  }, [presetName, filter, status, dateFilter, customDateStart, customDateEnd, sortBy, filterPresets]);

  // Load filter preset
  const loadFilterPreset = useCallback((preset: typeof filterPresets[0]) => {
    setFilter(preset.filters.filter as any);
    setStatus(preset.filters.status);
    setDateFilter(preset.filters.dateFilter as any);
    setCustomDateStart(preset.filters.customDateStart);
    setCustomDateEnd(preset.filters.customDateEnd);
    setSortBy(preset.filters.sortBy as any);
    
    // Save to user filters if user is loaded
    if (user) {
      saveUserFilters(user.id, {
        filter: preset.filters.filter,
        status: preset.filters.status,
        sortBy: preset.filters.sortBy,
        dateFilter: preset.filters.dateFilter,
        customDateStart: preset.filters.customDateStart,
        customDateEnd: preset.filters.customDateEnd
      });
    }
  }, [user, saveUserFilters]);

  // Delete filter preset
  const deleteFilterPreset = useCallback((presetId: string) => {
    const updatedPresets = filterPresets.filter(p => p.id !== presetId);
    setFilterPresets(updatedPresets);
    if (typeof window !== 'undefined') {
      localStorage.setItem(FILTER_PRESETS_KEY, JSON.stringify(updatedPresets));
    }
  }, [filterPresets]);

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
    statusFilter?: string,
    dateFilterParam?: 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom',
    customDateStartParam?: string,
    customDateEndParam?: string
  ) => {
    if (!targetUsername.trim()) {
      showToast('Please enter a username', 'warning');
      return;
    }

    // Create a unique key for this request to prevent duplicates
    // Note: statusFilter is NOT included as it's filtered client-side only
    const requestKey = `${targetUsername}-${pageNum}-${activityType || 'all'}-${mediaTypeFilter || 'all'}`;
    
    // Prevent duplicate requests
    if (isRequestInProgressRef.current && lastRequestKeyRef.current === requestKey) {
      return;
    }
    
    isRequestInProgressRef.current = true;
    lastRequestKeyRef.current = requestKey;
    setLoading(true);
    // Clear any previous errors (toasts auto-dismiss)

    try {
      // Step 1: Get user ID
      const userData = await fetchUserId(targetUsername);
      if (!userData) {
        showToast(`User "${targetUsername}" not found. Please check the username.`, 'error');
        isRequestInProgressRef.current = false;
        setLoading(false);
        return;
      }

      setUser(userData);
      
      // Save user to history on successful search
      saveUserToHistory(userData, targetUsername);

        // Load saved filters for this user
        isLoadingFiltersRef.current = true; // Prevent useEffect from triggering
        const savedFilters = loadUserFilters(userData.id);
        if (savedFilters) {
          setFilter(savedFilters.filter as any);
          setStatus(savedFilters.status);
          setSortBy(savedFilters.sortBy as any);
          if (savedFilters.dateFilter) {
            setDateFilter(savedFilters.dateFilter as any);
          }
          if (savedFilters.customDateStart) {
            setCustomDateStart(savedFilters.customDateStart);
          }
          if (savedFilters.customDateEnd) {
            setCustomDateEnd(savedFilters.customDateEnd);
          }
          
          // Also initialize applied filters with saved values
          setAppliedFilter(savedFilters.filter as any);
          setAppliedStatus(savedFilters.status);
          setAppliedSortBy(savedFilters.sortBy as any);
        } else {
          // Initialize applied filters to defaults if no saved filters
          setAppliedFilter('all');
          setAppliedStatus('all');
          setAppliedSortBy('date');
        }
      // Reset flag after a short delay to allow state updates to complete
      setTimeout(() => {
        isLoadingFiltersRef.current = false;
      }, 100);

      // Step 2: Fetch activities with filters
      // Note: status filtering is done client-side (AniList API doesn't support it)
      // Parse filter to extract type and mediaType
      let typeToFetch: 'all' | 'text' | 'list' | 'message' = 'all';
      let mediaTypeToFetch: 'all' | 'anime' | 'manga' = 'all';
      
      if (activityType) {
        typeToFetch = activityType;
        mediaTypeToFetch = mediaTypeFilter || 'all';
      } else if (filter === 'list-anime') {
        typeToFetch = 'list';
        mediaTypeToFetch = 'anime';
      } else if (filter === 'list-manga') {
        typeToFetch = 'list';
        mediaTypeToFetch = 'manga';
      } else if (filter === 'list') {
        typeToFetch = 'list';
        mediaTypeToFetch = 'all';
      } else {
        typeToFetch = filter;
      }
      
      // statusFilter is NOT passed to API - it's filtered client-side in filteredAndSortedActivities
      // Calculate date filters for API (Unix timestamps in seconds)
      let createdAtGreater: number | undefined;
      let createdAtLesser: number | undefined;
      
      const activeDateFilter = dateFilterParam || dateFilter;
      const activeCustomStart = customDateStartParam !== undefined ? customDateStartParam : customDateStart;
      const activeCustomEnd = customDateEndParam !== undefined ? customDateEndParam : customDateEnd;
      
      if (activeDateFilter !== 'all') {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        if (activeDateFilter === 'today') {
          createdAtGreater = Math.floor(todayStart.getTime() / 1000);
          console.log(`[loadUserActivities] 📅 Date filter: today - createdAt_greater: ${createdAtGreater} (${new Date(createdAtGreater * 1000).toISOString()})`);
        } else if (activeDateFilter === 'yesterday') {
          const yesterdayStart = new Date(todayStart);
          yesterdayStart.setDate(yesterdayStart.getDate() - 1);
          const yesterdayEnd = new Date(todayStart);
          yesterdayEnd.setMilliseconds(yesterdayEnd.getMilliseconds() - 1);
          createdAtGreater = Math.floor(yesterdayStart.getTime() / 1000);
          createdAtLesser = Math.floor(yesterdayEnd.getTime() / 1000);
          console.log(`[loadUserActivities] 📅 Date filter: yesterday - createdAt_greater: ${createdAtGreater} (${new Date(createdAtGreater * 1000).toISOString()}), createdAt_lesser: ${createdAtLesser} (${new Date(createdAtLesser * 1000).toISOString()})`);
        } else if (activeDateFilter === 'week') {
          const weekStart = new Date(todayStart);
          weekStart.setDate(weekStart.getDate() - 7);
          createdAtGreater = Math.floor(weekStart.getTime() / 1000);
          console.log(`[loadUserActivities] 📅 Date filter: week - createdAt_greater: ${createdAtGreater} (${new Date(createdAtGreater * 1000).toISOString()})`);
        } else if (activeDateFilter === 'month') {
          const monthStart = new Date(todayStart);
          monthStart.setMonth(monthStart.getMonth() - 1);
          createdAtGreater = Math.floor(monthStart.getTime() / 1000);
          console.log(`[loadUserActivities] 📅 Date filter: month - createdAt_greater: ${createdAtGreater} (${new Date(createdAtGreater * 1000).toISOString()})`);
        } else if (activeDateFilter === 'custom') {
          if (activeCustomStart) {
            const startDate = new Date(activeCustomStart);
            if (isNaN(startDate.getTime())) {
              console.error(`[loadUserActivities] ❌ Invalid custom start date: ${activeCustomStart}`);
              showToast(`Invalid start date: ${activeCustomStart}`, 'error');
              setLoading(false);
              isRequestInProgressRef.current = false;
              return;
            }
            startDate.setHours(0, 0, 0, 0);
            createdAtGreater = Math.floor(startDate.getTime() / 1000);
            console.log(`[loadUserActivities] 📅 Date filter: custom start - createdAt_greater: ${createdAtGreater} (${startDate.toISOString()})`);
          }
          if (activeCustomEnd) {
            const endDate = new Date(activeCustomEnd);
            if (isNaN(endDate.getTime())) {
              console.error(`[loadUserActivities] ❌ Invalid custom end date: ${activeCustomEnd}`);
              showToast(`Invalid end date: ${activeCustomEnd}`, 'error');
              setLoading(false);
              isRequestInProgressRef.current = false;
              return;
            }
            endDate.setHours(23, 59, 59, 999);
            createdAtLesser = Math.floor(endDate.getTime() / 1000);
            console.log(`[loadUserActivities] 📅 Date filter: custom end - createdAt_lesser: ${createdAtLesser} (${endDate.toISOString()})`);
          }
          
          // Validate custom date range
          if (createdAtGreater !== undefined && createdAtLesser !== undefined && createdAtGreater > createdAtLesser) {
            console.error(`[loadUserActivities] ❌ Invalid date range: start (${createdAtGreater}) > end (${createdAtLesser})`);
            showToast('Invalid date range: start date must be before end date', 'error');
            setLoading(false);
            isRequestInProgressRef.current = false;
            return;
          }
        }
      }
      
      // Pass access token if available to get isLiked status
      const token = typeof window !== 'undefined' ? localStorage.getItem('anilist_access_token') : null;
      const activitiesData = await fetchUserActivities(
        userData.id, 
        pageNum, 
        50, 
        typeToFetch, 
        mediaTypeToFetch, 
        undefined, 
        token || undefined,
        createdAtGreater,
        createdAtLesser
      );
      if (!activitiesData) {
        showToast('Error loading activities. Check the console for more details.', 'error');
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
        // Rate limit toast is already shown by handleHttpError in lib/anilist.ts
      } else if (errorMessage.includes('not found') || errorMessage.includes('non trouvé')) {
        showToast(`User "${targetUsername}" not found. Please check the username.`, 'error');
      } else {
        // Other errors are already shown by handleHttpError in lib/anilist.ts
      }
      console.error('Error:', err);
    } finally {
      isRequestInProgressRef.current = false;
      setLoading(false);
    }
  }, [saveUserToHistory, filter, loadUserFilters, dateFilter, customDateStart, customDateEnd]);

  // Load user from saved users list
  const loadSavedUser = useCallback((savedUser: SavedUser) => {
    setUsername(savedUser.username);
    saveUsername(savedUser.username);
    
    // Load saved filters for this user
    isLoadingFiltersRef.current = true; // Prevent useEffect from triggering
    const savedFilters = loadUserFilters(savedUser.id);
    if (savedFilters) {
      setFilter(savedFilters.filter as any);
      setStatus(savedFilters.status);
      setSortBy(savedFilters.sortBy as any);
    }
    // Reset flag after a short delay
    setTimeout(() => {
      isLoadingFiltersRef.current = false;
    }, 100);
    
    loadUserActivities(savedUser.username, 1);
  }, [loadUserActivities, saveUsername, loadUserFilters]);

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

  // Filters are now applied manually via "Apply" button - no automatic reload
  // This prevents API spam and gives user control over when to fetch

  // Apply filters manually (replaces automatic filter application)
  const handleApplyFilters = useCallback(() => {
    if (user && username) {
      // Clear debounce if active
      if (filterDebounceRef.current) {
        clearTimeout(filterDebounceRef.current);
      }
      
      // Update applied filters (these will be used for client-side filtering)
      setAppliedFilter(filter);
      setAppliedStatus(status);
      setAppliedSortBy(sortBy);
      
      // Reset to page 1 and reload
      // Note: status is filtered client-side, so we don't pass it to API
      setPage(1);
      setActivities([]);
      // Parse filter to extract type and mediaType
      let typeToFetch: 'all' | 'text' | 'list' | 'message' = 'all';
      let mediaTypeToFetch: 'all' | 'anime' | 'manga' = 'all';
      
      if (filter === 'list-anime') {
        typeToFetch = 'list';
        mediaTypeToFetch = 'anime';
      } else if (filter === 'list-manga') {
        typeToFetch = 'list';
        mediaTypeToFetch = 'manga';
      } else if (filter === 'list') {
        typeToFetch = 'list';
        mediaTypeToFetch = 'all';
      } else {
        typeToFetch = filter;
      }
      
      loadUserActivities(username, 1, typeToFetch, mediaTypeToFetch, undefined, dateFilter, customDateStart, customDateEnd);
    }
  }, [user, username, filter, status, sortBy, dateFilter, customDateStart, customDateEnd, loadUserActivities]);

  // Reset filters to default values
  const handleResetFilters = useCallback(() => {
    setFilter('all');
    setStatus('all');
    setSortBy('date');
    setDateFilter('all');
    setCustomDateStart('');
    setCustomDateEnd('');
    
    // Also reset applied filters
    setAppliedFilter('all');
    setAppliedStatus('all');
    setAppliedSortBy('date');
    
    // Save reset filters for current user
    if (user) {
      saveUserFilters(user.id, {
        filter: 'all',
        status: 'all',
        sortBy: 'date',
        dateFilter: 'all',
        customDateStart: '',
        customDateEnd: ''
      });
    }
    
    // Reload activities with default filters
    if (user && username) {
      // Clear debounce if active
      if (filterDebounceRef.current) {
        clearTimeout(filterDebounceRef.current);
      }
      setPage(1);
      setActivities([]);
      loadUserActivities(username, 1, 'all', 'all', undefined, 'all', '', '');
    }
  }, [user, username, loadUserActivities, saveUserFilters]);

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

  // Filter and sort activities using APPLIED filters (not the ones being configured)
  // This prevents immediate filtering when user changes dropdowns before clicking "Apply"
  const filteredAndSortedActivities = activities
    .filter(activity => {
      // Filter by activity type if specified (using appliedFilter, not filter)
      if (appliedFilter !== 'all') {
        const activityTypeUpper = activity.type?.toUpperCase() || '';
        
        if (appliedFilter === 'list' || appliedFilter === 'list-anime' || appliedFilter === 'list-manga') {
          if (!activityTypeUpper.includes('LIST')) {
            return false;
          }
          
          // Filter by media type if list-anime or list-manga
          if (appliedFilter === 'list-anime' && activity.media?.type?.toLowerCase() !== 'anime') {
            return false;
          }
          if (appliedFilter === 'list-manga' && activity.media?.type?.toLowerCase() !== 'manga') {
            return false;
          }
        } else if (appliedFilter === 'text') {
          if (activityTypeUpper !== 'TEXT') {
            return false;
          }
        } else if (appliedFilter === 'message') {
          if (activityTypeUpper !== 'MESSAGE') {
            return false;
          }
        }
      }
      
      // Filter by status if specified (only for ListActivity, using appliedStatus)
      const isListActivity = activity.type?.toUpperCase().includes('LIST') || false;
      
      if (isListActivity && appliedStatus !== 'all') {
        if (!activity.status) {
          return false;
        }
        
        const normalizedActivityStatus = normalizeStatus(activity.status, activity.media?.type);
        const filterStatus = String(appliedStatus).toUpperCase().trim();
        
        if (normalizedActivityStatus !== filterStatus) {
          return false;
        }
      }
      
      // Date filtering is done server-side via API, no client-side filtering needed
      
      return true;
    })
    .sort((a, b) => {
      switch (appliedSortBy) {
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
                        loading="lazy"
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


      {user && (
        <div className={styles.userInfoPage}>
          <div className={styles.userInfoMain}>
            {user.avatar?.medium && (
              <img 
                src={user.avatar.medium} 
                alt={user.name}
                loading="lazy"
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
                    <div className={styles.statCard}>
                      <span className={styles.statLabel}>Anime</span>
                      <span className={styles.statValue}>{user.statistics.anime.count}</span>
                    </div>
                  )}
                  {user.statistics.anime.episodesWatched !== undefined && (
                    <div className={styles.statCard}>
                      <span className={styles.statLabel}>Episodes</span>
                      <span className={styles.statValue}>{user.statistics.anime.episodesWatched.toLocaleString()}</span>
                    </div>
                  )}
                  {user.statistics.anime.meanScore !== undefined && (
                    <div className={styles.statCard}>
                      <span className={styles.statLabel}>Avg Score</span>
                      <span className={styles.statValue}>{(user.statistics.anime.meanScore / 10).toFixed(1)}</span>
                    </div>
                  )}
                </>
              )}
              {user.statistics.manga && (
                <>
                  {user.statistics.manga.count !== undefined && (
                    <div className={styles.statCard}>
                      <span className={styles.statLabel}>Manga</span>
                      <span className={styles.statValue}>{user.statistics.manga.count}</span>
                    </div>
                  )}
                  {user.statistics.manga.chaptersRead !== undefined && (
                    <div className={styles.statCard}>
                      <span className={styles.statLabel}>Chapters</span>
                      <span className={styles.statValue}>{user.statistics.manga.chaptersRead.toLocaleString()}</span>
                    </div>
                  )}
                  {user.statistics.manga.meanScore !== undefined && (
                    <div className={styles.statCard}>
                      <span className={styles.statLabel}>Avg Score</span>
                      <span className={styles.statValue}>{(user.statistics.manga.meanScore / 10).toFixed(1)}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {user && (
        <div className={styles.filters}>
          <div className={styles.filterGroup}>
            <label>Type:</label>
            <select 
              value={filter} 
              onChange={(e) => {
                const newFilter = e.target.value as 'all' | 'list' | 'list-anime' | 'list-manga' | 'text' | 'message';
                setFilter(newFilter);
                if (newFilter !== 'list' && newFilter !== 'list-anime' && newFilter !== 'list-manga') {
                  setStatus('all');
                }
                // Save filters when they change
                if (user) {
                  saveUserFilters(user.id, {
                    filter: newFilter,
                    status: (newFilter === 'list' || newFilter === 'list-anime' || newFilter === 'list-manga') ? status : 'all',
                    sortBy,
                    dateFilter,
                    customDateStart,
                    customDateEnd
                  });
                }
              }}
              className={styles.filterSelect}
            >
              <option value="all">All</option>
              <option value="list">List (All)</option>
              <option value="list-anime">List (Anime)</option>
              <option value="list-manga">List (Manga)</option>
              <option value="text">Text</option>
              <option value="message">Message</option>
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label>Status:</label>
            <select 
              value={status} 
              onChange={(e) => {
                setStatus(e.target.value);
                // Save filters when they change
                if (user) {
                  saveUserFilters(user.id, {
                    filter,
                    status: e.target.value,
                    sortBy,
                    dateFilter,
                    customDateStart,
                    customDateEnd
                  });
                }
              }}
              className={styles.filterSelect}
              disabled={filter !== 'list' && filter !== 'list-anime' && filter !== 'list-manga'}
              style={{ 
                cursor: (filter === 'list' || filter === 'list-anime' || filter === 'list-manga') ? 'pointer' : 'not-allowed',
                pointerEvents: (filter === 'list' || filter === 'list-anime' || filter === 'list-manga') ? 'auto' : 'none'
              }}
            >
              <option value="all">All</option>
              {(filter === 'list' || filter === 'all') ? (
                <>
                  <option value="CURRENT">In Progress</option>
                  <option value="PLANNING">Planning</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="DROPPED">Dropped</option>
                  <option value="PAUSED">Paused</option>
                  <option value="REPEATING">Repeating</option>
                </>
              ) : filter === 'list-anime' ? (
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
            <label>Date:</label>
            <select 
              value={dateFilter} 
              onChange={(e) => {
                const newDateFilter = e.target.value as 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom';
                setDateFilter(newDateFilter);
                // Save filters when they change
                if (user) {
                  saveUserFilters(user.id, {
                    filter,
                    status,
                    sortBy,
                    dateFilter: newDateFilter,
                    customDateStart,
                    customDateEnd
                  });
                }
              }}
              className={styles.filterSelect}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {dateFilter === 'custom' && (
            <div className={styles.filterGroup}>
              <label>Date Range:</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="date"
                  value={customDateStart}
                  onChange={(e) => {
                    setCustomDateStart(e.target.value);
                    // Save filters when they change
                    if (user) {
                      saveUserFilters(user.id, {
                        filter,
                        status,
                        sortBy,
                        dateFilter,
                        customDateStart: e.target.value,
                        customDateEnd
                      });
                    }
                  }}
                  className={styles.filterSelect}
                  style={{ flex: 1 }}
                />
                <span>to</span>
                <input
                  type="date"
                  value={customDateEnd}
                  onChange={(e) => {
                    setCustomDateEnd(e.target.value);
                    // Save filters when they change
                    if (user) {
                      saveUserFilters(user.id, {
                        filter,
                        status,
                        sortBy,
                        dateFilter,
                        customDateStart,
                        customDateEnd: e.target.value
                      });
                    }
                  }}
                  className={styles.filterSelect}
                  style={{ flex: 1 }}
                />
              </div>
            </div>
          )}

          <div className={styles.filterGroup}>
            <label>Sort by:</label>
            <select 
              value={sortBy} 
              onChange={(e) => {
                const newSortBy = e.target.value as any;
                setSortBy(newSortBy);
                // Save filters when they change
                if (user) {
                  saveUserFilters(user.id, {
                    filter,
                    status,
                    sortBy: newSortBy,
                    dateFilter,
                    customDateStart,
                    customDateEnd
                  });
                }
              }}
              className={styles.filterSelect}
            >
              <option value="date">Date</option>
              <option value="likes">Likes</option>
              <option value="replies">Comments</option>
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label>View:</label>
            <button
              onClick={() => {
                const newCompactMode = !compactMode;
                setCompactMode(newCompactMode);
                if (typeof window !== 'undefined') {
                  localStorage.setItem(COMPACT_MODE_KEY, newCompactMode.toString());
                }
              }}
              className={styles.compactModeToggle}
              title={compactMode ? "Switch to detailed view" : "Switch to compact view"}
            >
              {compactMode ? '📋' : '📄'} {compactMode ? 'Compact' : 'Detailed'}
            </button>
          </div>

          <div className={styles.filterActions}>
            <div className={styles.presetGroup}>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    const preset = filterPresets.find(p => p.id === e.target.value);
                    if (preset) loadFilterPreset(preset);
                    e.target.value = '';
                  }
                }}
                className={styles.presetSelect}
                title="Load a saved filter preset"
              >
                <option value="">Presets...</option>
                {filterPresets.map(preset => (
                  <option key={preset.id} value={preset.id}>{preset.name}</option>
                ))}
              </select>
              <button
                onClick={() => setShowPresetModal(true)}
                className={styles.savePresetButton}
                title="Save current filters as preset"
              >
                💾 Save
              </button>
            </div>
            <button 
              onClick={handleApplyFilters}
              className={styles.refreshFiltersButton}
              disabled={loading || !user}
              title="Apply current filters"
            >
              ✓ Apply
            </button>
            <button 
              onClick={handleResetFilters}
              className={styles.resetFiltersButton}
              disabled={loading || !user}
              title="Reset all filters to default"
            >
              ↺ Reset
            </button>
          </div>
          
          {showPresetModal && (
            <div className={styles.presetModal}>
              <div className={styles.presetModalContent}>
                <h3>Save Filter Preset</h3>
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="Preset name..."
                  className={styles.presetNameInput}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      saveFilterPreset();
                    } else if (e.key === 'Escape') {
                      setShowPresetModal(false);
                      setPresetName('');
                    }
                  }}
                  autoFocus
                />
                <div className={styles.presetModalActions}>
                  <button onClick={saveFilterPreset} className={styles.savePresetButton}>
                    Save
                  </button>
                  <button onClick={() => { setShowPresetModal(false); setPresetName(''); }} className={styles.resetFiltersButton}>
                    Cancel
                  </button>
                </div>
                {filterPresets.length > 0 && (
                  <div className={styles.presetList}>
                    <h4>Saved Presets:</h4>
                    {filterPresets.map(preset => (
                      <div key={preset.id} className={styles.presetItem}>
                        <span>{preset.name}</span>
                        <div>
                          <button onClick={() => loadFilterPreset(preset)} className={styles.loadPresetButton}>
                            Load
                          </button>
                          <button onClick={() => deleteFilterPreset(preset.id)} className={styles.deletePresetButton}>
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className={styles.stats}>
            <span>{filteredAndSortedActivities.length} activity(ies)</span>
            {getNewActivitiesCount() > 0 && (
              <span className={styles.newActivitiesBadge} title="New activities since last visit">
                🆕 {getNewActivitiesCount()} new
              </span>
            )}
          </div>
        </div>
      )}

      {loading && activities.length === 0 && (
        <div className={styles.loading}>Loading...</div>
      )}

      {!loading && activities.length === 0 && user && (
        <div className={styles.empty}>
          No activities found for this user.
        </div>
      )}

      {/* Update last visit when activities are loaded */}
      {activities.length > 0 && (
        <div style={{ display: 'none' }}>
          {(() => {
            if (typeof window !== 'undefined') {
              localStorage.setItem(LAST_VISIT_KEY, Date.now().toString());
            }
            return null;
          })()}
        </div>
      )}

      <div className={`${styles.activitiesList} ${compactMode ? styles.activitiesListCompact : ''}`}>
          {filteredAndSortedActivities.map((activity) => (
            <div key={activity.id} className={`${styles.activityCard} ${compactMode ? styles.compactMode : ''}`}>
              <div className={styles.activityHeader}>
                <div className={styles.activityUser}>
                  {activity.user?.avatar?.medium && (
                    <img 
                      src={activity.user.avatar.medium} 
                      alt={activity.user.name}
                      className={styles.activityAvatar}
                      loading="lazy"
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
                      loading="lazy"
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
                                loading="lazy"
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
