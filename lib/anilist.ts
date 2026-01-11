// AniList GraphQL API utility

const ANILIST_API_URL = 'https://graphql.anilist.co';

// Import increment function (will be available in browser context)
declare global {
  interface Window {
    incrementApiRequestCount?: () => void;
    resetApiRequestCount?: () => void;
    __apiRequestCount?: number;
  }
}

// Helper function to increment API request count
function incrementRequestCount() {
  if (typeof window !== 'undefined') {
    if (window.incrementApiRequestCount) {
      window.incrementApiRequestCount();
    } else {
      // Fallback: dispatch custom event
      window.dispatchEvent(new CustomEvent('increment-api-request'));
    }
  }
}

// Helper function to show toast notifications
function showToastNotification(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'error', duration: number = 5000) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('show-toast', { 
      detail: { message, type, duration } 
    }));
  }
}

// Helper function to handle HTTP errors and show appropriate toasts
function handleHttpError(response: Response, errorData: any, context: string = 'API'): never {
  const status = response.status;
  let message = '';
  let toastType: 'error' | 'warning' = 'error';
  
  if (status === 429) {
    message = '⏱️ Rate limit exceeded. Please wait 30-60 seconds before trying again.';
    toastType = 'warning';
  } else if (status === 400) {
    message = errorData?.error || errorData?.details || 'Bad request. Please check your input.';
    toastType = 'error';
  } else if (status === 401) {
    message = 'Unauthorized. Your session may have expired. Please log in again.';
    toastType = 'warning';
  } else if (status === 403) {
    message = 'Forbidden. You don\'t have permission to access this resource.';
    toastType = 'error';
  } else if (status === 404) {
    message = 'Resource not found.';
    toastType = 'warning';
  } else if (status === 500) {
    message = 'Server error. Please try again later.';
    toastType = 'error';
  } else {
    message = errorData?.error || `HTTP Error ${status}. Please try again.`;
    toastType = 'error';
  }
  
  console.error(`[${context}] HTTP Error ${status}:`, errorData);
  showToastNotification(message, toastType, status === 429 ? 8000 : 5000);
  
  if (status === 429) {
    throw new Error('RATE_LIMIT: ' + message);
  }
  
  throw new Error(message);
}

export interface UserStatistics {
  anime?: {
    count?: number;
    episodesWatched?: number;
    meanScore?: number;
    minutesWatched?: number;
  };
  manga?: {
    count?: number;
    chaptersRead?: number;
    volumesRead?: number;
    meanScore?: number;
  };
  // Note: followers and following are not available in the public AniList API
  followers?: number;
  following?: number;
}

export interface AniListUser {
  id: number;
  name: string;
  avatar?: {
    large?: string;
    medium?: string;
  };
  statistics?: UserStatistics;
}

export interface ActivityComment {
  id: number;
  userId: number;
  user?: AniListUser;
  text?: string;
  comment?: string; // Keep for backward compatibility
  createdAt: number;
  isLiked?: boolean;
  likeCount?: number;
}

export interface ActivityStatus {
  id: number;
  userId: number;
  user?: AniListUser;
  type: string;
  status?: string;
  progress?: string;
  text?: string;
  message?: string;
  replyCount?: number;
  likeCount?: number;
  isLiked?: boolean;
  createdAt: number;
  media?: {
    id: number;
    title?: {
      romaji?: string;
      english?: string;
      native?: string;
    };
    coverImage?: {
      large?: string;
      medium?: string;
    };
    type?: string;
  };
  replies?: ActivityComment[];
}

export interface ActivityPage {
  activities: ActivityStatus[];
  pageInfo: {
    currentPage: number;
    hasNextPage: boolean;
  };
}

export interface Media {
  id: number;
  title: {
    romaji?: string;
    english?: string;
    native?: string;
    userPreferred?: string;
  };
  type: 'ANIME' | 'MANGA';
  format?: string;
  status?: string;
  description?: string;
  startDate?: {
    year?: number;
    month?: number;
    day?: number;
  };
  endDate?: {
    year?: number;
    month?: number;
    day?: number;
  };
  episodes?: number;
  chapters?: number;
  volumes?: number;
  coverImage?: {
    large?: string;
    medium?: string;
  };
  bannerImage?: string;
  genres?: string[];
  averageScore?: number;
  popularity?: number;
  siteUrl?: string;
}

export interface MediaSearchResult {
  media: Media[];
  pageInfo: {
    currentPage: number;
    hasNextPage: boolean;
    lastPage: number;
    perPage: number;
    total: number;
  };
}

// GraphQL query to fetch user activities with comments
const GET_USER_ACTIVITIES = `
  query GetUserActivities($userId: Int!, $page: Int, $perPage: Int, $type: ActivityType) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        currentPage
        hasNextPage
      }
      activities(userId: $userId, sort: ID_DESC, type: $type) {
        ... on TextActivity {
          id
          userId
          type
          replyCount
          likeCount
          isLiked
          createdAt
          text(asHtml: true)
          user {
            id
            name
            avatar {
              large
              medium
            }
          }
        }
        ... on ListActivity {
          id
          userId
          type
          status
          progress
          replyCount
          likeCount
          isLiked
          createdAt
          user {
            id
            name
            avatar {
              large
              medium
            }
          }
          media {
            id
            title {
              romaji
              english
              native
            }
            coverImage {
              large
              medium
            }
            type
          }
        }
        ... on MessageActivity {
          id
          type
          replyCount
          likeCount
          isLiked
          createdAt
          message
        }
      }
    }
  }
`;

const GET_USER_ID = `
  query GetUserId($username: String!) {
    User(search: $username) {
      id
      name
      avatar {
        large
        medium
      }
    }
  }
`;

const GET_ACTIVITY_REPLIES = `
  query GetActivityReplies($activityId: Int!) {
    Activity(id: $activityId) {
      ... on TextActivity {
        replies {
          id
          userId
          text(asHtml: true)
          createdAt
          isLiked
          likeCount
          user {
            id
            name
            avatar {
              large
              medium
            }
          }
        }
      }
      ... on ListActivity {
        replies {
          id
          userId
          text(asHtml: true)
          createdAt
          isLiked
          likeCount
          user {
            id
            name
            avatar {
              large
              medium
            }
          }
        }
      }
      ... on MessageActivity {
        replies {
          id
          text(asHtml: true)
          createdAt
          isLiked
          likeCount
          user {
            id
            name
            avatar {
              large
              medium
            }
          }
        }
      }
    }
  }
`;

export async function fetchActivityReplies(activityId: number, accessToken?: string): Promise<ActivityComment[] | null> {
  console.log(`[fetchActivityReplies] 🔵 Starting - activityId: ${activityId}, hasToken: ${!!accessToken}`);
  try {
    // Build headers with optional authentication (needed for isLiked field)
    const headers: HeadersInit = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    incrementRequestCount();
    console.log(`[fetchActivityReplies] 📡 Making API request to /api/anilist/replies?activityId=${activityId}`);
    
    // Use Next.js API route to avoid CORS issues
    const response = await fetch(`/api/anilist/replies?activityId=${activityId}`, { headers });
    
    console.log(`[fetchActivityReplies] 📥 Response received - status: ${response.status}`);

    if (!response.ok) {
      let errorData: any = {};
      try {
        const errorText = await response.text();
        console.error(`[fetchActivityReplies] HTTP Error ${response.status} for activity ${activityId}, raw response:`, errorText);
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { raw: errorText };
        }
      } catch (e) {
        console.error(`[fetchActivityReplies] Error reading error response:`, e);
      }
      
      // For 400 errors, log and return empty array (don't show toast for individual activity errors)
      if (response.status === 400) {
        console.warn(`Activity ${activityId} returned 400 error. Details:`, errorData);
        return [];
      }
      
      // For other errors, show toast and throw
      handleHttpError(response, errorData, 'fetchActivityReplies');
    }

    const repliesData = await response.json();
    
    // Check if it's an error response
    if (repliesData.error) {
      console.error(`[fetchActivityReplies] Error from API route for activity ${activityId}:`, repliesData.error, repliesData.details);
      return [];
    }
    
    // Check if it's an array of replies
    if (Array.isArray(repliesData)) {
      return repliesData.length > 0 ? repliesData : [];
    }

    console.warn(`[fetchActivityReplies] Unexpected response format for activity ${activityId}`);
    return [];
  } catch (error) {
    console.error(`[fetchActivityReplies] Exception fetching activity replies for ${activityId}:`, error);
    if (error instanceof Error && error.message.includes('RATE_LIMIT')) {
      throw error;
    }
    return [];
  }
}

/**
 * Fetch list activities for a specific user and media.
 * Returns only ListActivity entries that match the given media ID.
 */
export async function fetchUserMediaListActivities(
  userId: number,
  mediaId: number,
  accessToken?: string
): Promise<ActivityStatus[]> {
  console.log(`[fetchUserMediaListActivities] 🔵 Starting - userId: ${userId}, mediaId: ${mediaId}, hasToken: ${!!accessToken}`);
  try {
    // Determine media type from mediaId (we'll need to fetch it or pass it)
    // For now, we'll fetch both ANIME_LIST and MANGA_LIST and filter
    const token = typeof window !== 'undefined' ? localStorage.getItem('anilist_access_token') : null;
    const authToken = accessToken || token || undefined;
    
    // Fetch list activities (both anime and manga)
    // We'll fetch a reasonable number of pages to find activities for this media
    const allActivities: ActivityStatus[] = [];
    let page = 1;
    let hasNextPage = true;
    const maxPages = 5; // Limit to 5 pages to avoid too many requests
    
    while (hasNextPage && page <= maxPages) {
      const activitiesData = await fetchUserActivities(
        userId,
        page,
        50,
        'list',
        'all',
        undefined,
        authToken
      );
      
      if (!activitiesData || activitiesData.activities.length === 0) {
        break;
      }
      
      // Filter activities that match the media ID
      const matchingActivities = activitiesData.activities.filter(
        activity => activity.media?.id === mediaId
      );
      
      allActivities.push(...matchingActivities);
      
      // If we found matching activities and there are no more pages, we can stop
      // Otherwise, continue to next page
      hasNextPage = activitiesData.pageInfo.hasNextPage;
      page++;
      
      // If we've found enough activities (e.g., 20), we can stop early
      if (allActivities.length >= 20) {
        break;
      }
    }
    
    return allActivities;
  } catch (error) {
    console.error('Error fetching user media list activities:', error);
    return [];
  }
}

export async function fetchUserId(username: string): Promise<AniListUser | null> {
  console.log(`[fetchUserId] 🔵 Starting - username: ${username}`);
  try {
    incrementRequestCount();
    console.log(`[fetchUserId] 📡 Making API request to /api/anilist/user?username=${encodeURIComponent(username)}`);
    
    // Use Next.js API route to avoid CORS issues
    const response = await fetch(`/api/anilist/user?username=${encodeURIComponent(username)}`);
    
    console.log(`[fetchUserId] 📥 Response received - status: ${response.status}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      handleHttpError(response, errorData, 'fetchUserId');
    }

    const userData = await response.json();
    
    if (userData.error) {
      console.error('[fetchUserId] ❌ API Error:', userData.error);
      // Check if it's a rate limit error in the error message
      if (userData.error.includes('Too many requests') || userData.error.includes('rate limit') || userData.error.includes('429')) {
        throw new Error('RATE_LIMIT: ' + userData.error);
      }
      throw new Error(userData.error);
    }

    console.log(`[fetchUserId] ✅ Success - user: ${userData.name || userData.id}`);
    return userData;
  } catch (error) {
    console.error('[fetchUserId] ❌ Error:', error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('[fetchUserId] 🌐 Network error - check your internet connection');
    }
    return null;
  }
}

export async function fetchUserActivities(
  userId: number,
  page: number = 1,
  perPage: number = 50,
  type?: 'all' | 'text' | 'list' | 'message',
  mediaType?: 'all' | 'anime' | 'manga',
  status?: string,
  accessToken?: string,
  createdAtGreater?: number,
  createdAtLesser?: number
): Promise<ActivityPage | null> {
  console.log(`[fetchUserActivities] 🔵 Starting - userId: ${userId}, page: ${page}, perPage: ${perPage}, type: ${type || 'all'}, mediaType: ${mediaType || 'all'}, hasToken: ${!!accessToken}`);
  if (createdAtGreater || createdAtLesser) {
    console.log(`[fetchUserActivities] 📅 Date filters - greater: ${createdAtGreater}, lesser: ${createdAtLesser}`);
  }
  try {
    // Build query string
    // Note: status is filtered client-side, but mediaType can be used to filter by ANIME_LIST/MANGA_LIST
    let queryString = `userId=${userId}&page=${page}&perPage=${perPage}`;
    if (type && type !== 'all') {
      queryString += `&type=${type}`;
    }
    // Pass mediaType to filter by ANIME_LIST or MANGA_LIST on server-side
    if (mediaType && mediaType !== 'all') {
      queryString += `&mediaType=${mediaType}`;
    }
    // Add date filters if specified (Unix timestamps in seconds)
    if (createdAtGreater !== undefined && createdAtGreater !== null && !isNaN(createdAtGreater)) {
      queryString += `&createdAt_greater=${createdAtGreater}`;
      console.log(`[fetchUserActivities] 📅 Adding createdAt_greater: ${createdAtGreater} (${new Date(createdAtGreater * 1000).toISOString()})`);
    }
    if (createdAtLesser !== undefined && createdAtLesser !== null && !isNaN(createdAtLesser)) {
      queryString += `&createdAt_lesser=${createdAtLesser}`;
      console.log(`[fetchUserActivities] 📅 Adding createdAt_lesser: ${createdAtLesser} (${new Date(createdAtLesser * 1000).toISOString()})`);
    }
    // status is NOT passed - must be filtered client-side
    
    // Build headers with optional authentication (needed for isLiked field)
    const headers: HeadersInit = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    incrementRequestCount();
    console.log(`[fetchUserActivities] 📡 Making API request to /api/anilist/activities?${queryString}`);
    
    // Use Next.js API route to avoid CORS issues
    const response = await fetch(
      `/api/anilist/activities?${queryString}`,
      { headers }
    );
    
    console.log(`[fetchUserActivities] 📥 Response received - status: ${response.status}`);

    if (!response.ok) {
      let errorData: any = {};
      try {
        const errorText = await response.text();
        console.error(`[fetchUserActivities] HTTP Error ${response.status}, raw response:`, errorText);
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { raw: errorText, error: errorText };
        }
      } catch (e) {
        console.error(`[fetchUserActivities] Error reading error response:`, e);
        errorData = { error: 'Failed to read error response' };
      }
      
      handleHttpError(response, errorData, 'fetchUserActivities');
    }

    const data = await response.json();
    
    if (data.error) {
      console.error('API Error:', data.error);
      // Check if it's a rate limit error
      if (data.error.includes('RATE_LIMIT:') || data.error.includes('Too many requests') || data.error.includes('429')) {
        throw new Error(data.error.startsWith('RATE_LIMIT:') ? data.error : 'RATE_LIMIT: ' + data.error);
      }
      throw new Error(data.error);
    }

    const activities: ActivityStatus[] = data.activities || [];
    const pageInfo = data.pageInfo || { currentPage: page, hasNextPage: false };
    console.log(`[fetchUserActivities] ✅ Success - received ${activities.length} activities (page ${pageInfo.currentPage}, hasNext: ${pageInfo.hasNextPage})`);


    // For now, just return all activities without fetching replies
    // We'll add replies later
    return {
      activities: activities,
      pageInfo,
    };
  } catch (error) {
    console.error('Error fetching user activities:', error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('Network error - check your internet connection');
    }
    // Propagate RATE_LIMIT errors so they can be handled by the UI
    if (error instanceof Error && error.message.includes('RATE_LIMIT:')) {
      throw error;
    }
    return null;
  }
}

// Fetch a single media by ID
export async function fetchMediaById(mediaId: number): Promise<Media | null> {
  console.log(`[fetchMediaById] 🔵 Starting - mediaId: ${mediaId}`);
  try {
    incrementRequestCount();
    console.log(`[fetchMediaById] 📡 Making API request to /api/anilist/media?id=${mediaId}`);
    
    const response = await fetch(`/api/anilist/media?id=${mediaId}`);
    
    console.log(`[fetchMediaById] 📥 Response received - status: ${response.status}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      handleHttpError(response, errorData, 'fetchMediaById');
    }

    const data = await response.json();
    
    if (data.error) {
      console.error('[fetchMediaById] ❌ API Error:', data.error);
      // Check if it's a rate limit error
      if (data.error.includes('Too many requests') || data.error.includes('rate limit') || data.error.includes('429')) {
        showToastNotification('⏱️ Rate limit exceeded. Please wait 30-60 seconds before trying again.', 'warning', 8000);
        throw new Error('RATE_LIMIT: ' + data.error);
      }
      showToastNotification(data.error, 'error');
      throw new Error(data.error);
    }

    console.log(`[fetchMediaById] ✅ Success - media: ${data.title?.userPreferred || data.title?.romaji || data.id}`);
    return data;
  } catch (error) {
    console.error('[fetchMediaById] ❌ Error:', error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('[fetchMediaById] 🌐 Network error - check your internet connection');
    }
    throw error;
  }
}

// Search for anime/manga with auto-completion
export async function searchMedia(
  query: string,
  type?: 'ANIME' | 'MANGA' | 'ALL',
  page: number = 1,
  perPage: number = 10
): Promise<MediaSearchResult | null> {
  console.log(`[searchMedia] 🔵 Starting - query: "${query}", type: ${type || 'ALL'}, page: ${page}, perPage: ${perPage}`);
  try {
    if (!query || query.trim().length < 2) {
      console.log('[searchMedia] ⏭️ Skipping - query too short');
      return null;
    }

    incrementRequestCount();
    const url = `/api/anilist/search?query=${encodeURIComponent(query)}&type=${type || 'ALL'}&page=${page}&perPage=${perPage}`;
    console.log(`[searchMedia] 📡 Making API request to ${url}`);
    
    const response = await fetch(url);
    
    console.log(`[searchMedia] 📥 Response received - status: ${response.status}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      handleHttpError(response, errorData, 'searchMedia');
    }

    const data = await response.json();
    
    if (data.error) {
      console.error('[searchMedia] ❌ API Error:', data.error);
      // Check if it's a rate limit error
      if (data.error.includes('Too many requests') || data.error.includes('rate limit') || data.error.includes('429')) {
        showToastNotification('⏱️ Rate limit exceeded. Please wait 30-60 seconds before trying again.', 'warning', 8000);
        throw new Error('RATE_LIMIT: ' + data.error);
      }
      showToastNotification(data.error, 'error');
      throw new Error(data.error);
    }

    const result = {
      page: data.page || 1,
      perPage: data.perPage || perPage,
      total: data.total || 0,
      lastPage: data.lastPage || 1,
      media: data.media || [],
    };
    console.log(`[searchMedia] ✅ Success - found ${result.media.length} results (total: ${result.total})`);
    return result;
  } catch (error) {
    console.error('[searchMedia] ❌ Error:', error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('[searchMedia] 🌐 Network error - check your internet connection');
    }
    throw error;
  }
}

// Get followed users (requires authentication)
export async function getFollowedUsers(accessToken: string): Promise<AniListUser[] | null> {
  console.log('[getFollowedUsers] 🔵 Starting');
  try {
    incrementRequestCount();
    console.log('[getFollowedUsers] 📡 Making API request to /api/anilist/following');
    
    const response = await fetch('/api/anilist/following', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    console.log(`[getFollowedUsers] 📥 Response received - status: ${response.status}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      handleHttpError(response, errorData, 'getFollowedUsers');
    }

    const data = await response.json();
    const users = data.users || [];
    console.log(`[getFollowedUsers] ✅ Success - found ${users.length} followed users`);
    return users;
  } catch (error) {
    console.error('[getFollowedUsers] ❌ Error:', error);
    throw error;
  }
}

/**
 * Interface for a user's media score data.
 * Represents a followed user's rating/status for a specific media.
 */
export interface UserMediaScore {
  userId: number;
  userName: string;
  userAvatar?: string;
  score?: number; // Score out of 100 (or user's score format)
  status?: string; // e.g., "CURRENT", "PLANNING", "COMPLETED", "DROPPED", "PAUSED"
  progress?: number; // Current episode/chapter progress
}

/**
 * Fetch media info and followed users scores in a single request.
 * This reduces API calls and helps avoid rate limiting.
 * 
 * @param mediaId - The ID of the media to get info and scores for
 * @param accessToken - AniList OAuth access token (optional, only needed for scores)
 * @returns Object with media info and scores array, or null on error
 * @throws Error if the request fails
 */
export async function fetchMediaWithScores(
  mediaId: number,
  accessToken?: string
): Promise<{ media: Media; scores: UserMediaScore[] } | null> {
  console.log(`[fetchMediaWithScores] 🔵 Starting - mediaId: ${mediaId}, hasToken: ${!!accessToken}`);
  try {
    const headers: HeadersInit = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    incrementRequestCount();
    console.log(`[fetchMediaWithScores] 📡 Making API request to /api/anilist/media-with-scores?mediaId=${mediaId}`);

    const response = await fetch(`/api/anilist/media-with-scores?mediaId=${mediaId}`, {
      method: 'GET',
      headers,
    });
    
    console.log(`[fetchMediaWithScores] 📥 Response received - status: ${response.status}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      handleHttpError(response, errorData, 'fetchMediaWithScores');
    }

    const data = await response.json();
    
    if (data.error) {
      console.error('[fetchMediaWithScores] ❌ API Error:', data.error);
      // Check if it's a rate limit error
      if (data.error.includes('Too many requests') || data.error.includes('rate limit') || data.error.includes('429')) {
        showToastNotification('⏱️ Rate limit exceeded. Please wait 30-60 seconds before trying again.', 'warning', 8000);
        throw new Error('RATE_LIMIT: ' + data.error);
      }
      showToastNotification(data.error, 'error');
      throw new Error(data.error);
    }

    const result = {
      media: data.media,
      scores: data.scores || [],
    };
    console.log(`[fetchMediaWithScores] ✅ Success - media: ${result.media.title?.userPreferred || result.media.id}, scores: ${result.scores.length}`);
    return result;
  } catch (error) {
    console.error('[fetchMediaWithScores] ❌ Error:', error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('[fetchMediaWithScores] 🌐 Network error - check your internet connection');
    }
    throw error;
  }
}

/**
 * Get scores from followed users for a specific media.
 * 
 * This function fetches the scores, status, and progress of all users
 * that the authenticated user follows for a given media.
 * Similar to AniList's "Social" section on media pages.
 * 
 * @param accessToken - AniList OAuth access token
 * @param mediaId - The ID of the media to get scores for
 * @returns Array of UserMediaScore objects, or null on error
 * @throws Error if the request fails or token is invalid
 */
export async function getFollowedUsersScores(
  accessToken: string,
  mediaId: number
): Promise<UserMediaScore[] | null> {
  console.log(`[getFollowedUsersScores] 🔵 Starting - mediaId: ${mediaId}`);
  try {
    incrementRequestCount();
    console.log(`[getFollowedUsersScores] 📡 Making API request to /api/anilist/media-scores?mediaId=${mediaId}`);
    
    const response = await fetch(`/api/anilist/media-scores?mediaId=${mediaId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    console.log(`[getFollowedUsersScores] 📥 Response received - status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText || 'Unknown error' };
      }
      
      handleHttpError(response, errorData, 'getFollowedUsersScores');
    }

    const data = await response.json();
    const scores = data.scores || [];
    console.log(`[getFollowedUsersScores] ✅ Success - found ${scores.length} scores`);
    return scores;
  } catch (error) {
    console.error('[getFollowedUsersScores] ❌ Error:', error);
    throw error;
  }
}

/**
 * Toggle like status for an activity.
 * 
 * @param accessToken - AniList OAuth access token
 * @param activityId - The ID of the activity to like/unlike
 * @param activityType - The type of the activity (TEXT, LIST, MESSAGE, etc.)
 * @returns Object with updated like status and count, or null on error
 * @throws Error if the request fails or token is invalid
 */
export async function toggleActivityLike(
  accessToken: string,
  activityId: number,
  activityType?: string
): Promise<{ id: number; isLiked: boolean; likeCount: number } | null> {
  console.log(`[toggleActivityLike] 🔵 Starting - activityId: ${activityId}, activityType: ${activityType || 'unknown'}`);
  try {
    incrementRequestCount();
    console.log(`[toggleActivityLike] 📡 Making API request to /api/anilist/activity-like`);
    
    const response = await fetch('/api/anilist/activity-like', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ activityId, activityType }),
    });
    
    console.log(`[toggleActivityLike] 📥 Response received - status: ${response.status}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      handleHttpError(response, errorData, 'toggleActivityLike');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error toggling activity reply like:', error);
    throw error;
  }
}

/**
 * Toggle like status for an activity reply (comment).
 * 
 * @param accessToken - AniList OAuth access token
 * @param replyId - The ID of the reply/comment to like/unlike
 * @returns Object with updated like status and count, or null on error
 * @throws Error if the request fails or token is invalid
 */
export async function toggleActivityReplyLike(
  accessToken: string,
  replyId: number
): Promise<{ id: number; isLiked: boolean; likeCount: number } | null> {
  console.log(`[toggleActivityReplyLike] 🔵 Starting - replyId: ${replyId}`);
  try {
    incrementRequestCount();
    console.log(`[toggleActivityReplyLike] 📡 Making API request to /api/anilist/activity-like`);
    
    const response = await fetch('/api/anilist/activity-like', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ activityId: replyId, activityType: 'ACTIVITY_REPLY' }),
    });
    
    console.log(`[toggleActivityReplyLike] 📥 Response received - status: ${response.status}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 401) {
        throw new Error('UNAUTHORIZED: Invalid or expired token');
      }
      
      // Build a descriptive error message
      let errorMessage = `HTTP Error: ${response.status}`;
      if (errorData.error) {
        errorMessage = errorData.error;
      } else if (errorData.details) {
        errorMessage = `${errorMessage} - ${JSON.stringify(errorData.details)}`;
      } else if (Object.keys(errorData).length > 0) {
        errorMessage = `${errorMessage} - ${JSON.stringify(errorData)}`;
      }
      
      console.error('[toggleActivityReplyLike] Error response:', errorData);
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error toggling activity reply like:', error);
    throw error;
  }
}
