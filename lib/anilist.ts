// AniList GraphQL API utility

const ANILIST_API_URL = 'https://graphql.anilist.co';

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

export async function fetchActivityReplies(activityId: number): Promise<ActivityComment[] | null> {
  try {
    // Use Next.js API route to avoid CORS issues
    const response = await fetch(`/api/anilist/replies?activityId=${activityId}`);

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
      
      console.error(`[fetchActivityReplies] HTTP Error ${response.status} for activity ${activityId}:`, errorData);
      
      if (response.status === 429) {
        console.warn(`Rate limit exceeded while fetching replies for activity ${activityId}`);
        throw new Error('RATE_LIMIT: Too many requests');
      }
      // For 400 errors, log the full error details and return empty array
      if (response.status === 400) {
        console.warn(`Activity ${activityId} returned 400 error. Details:`, errorData);
        // Return empty array instead of null to show "no comments" message
        return [];
      }
      return [];
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

export async function fetchUserId(username: string): Promise<AniListUser | null> {
  try {
    // Use Next.js API route to avoid CORS issues
    const response = await fetch(`/api/anilist/user?username=${encodeURIComponent(username)}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 429) {
        const errorMessage = errorData.error || 'Trop de requêtes. Veuillez attendre quelques secondes avant de réessayer.';
        throw new Error('RATE_LIMIT: ' + errorMessage);
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
      
      console.error('[fetchUserId] HTTP Error:', response.status, errorData);
      throw new Error(errorMessage);
    }

    const userData = await response.json();
    
    if (userData.error) {
      console.error('API Error:', userData.error);
      // Check if it's a rate limit error in the error message
      if (userData.error.includes('Too many requests') || userData.error.includes('rate limit') || userData.error.includes('429')) {
        throw new Error('RATE_LIMIT: ' + userData.error);
      }
      throw new Error(userData.error);
    }

    return userData;
  } catch (error) {
    console.error('Error fetching user ID:', error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('Network error - check your internet connection');
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
  status?: string
): Promise<ActivityPage | null> {
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
    // status is NOT passed - must be filtered client-side
    
    
    // Use Next.js API route to avoid CORS issues
    const response = await fetch(
      `/api/anilist/activities?${queryString}`
    );

    if (!response.ok) {
      let errorData: any = {};
      try {
        const errorText = await response.text();
        console.error(`[fetchUserActivities] HTTP Error ${response.status}, raw response:`, errorText);
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { raw: errorText };
        }
      } catch (e) {
        console.error(`[fetchUserActivities] Error reading error response:`, e);
      }
      
      if (response.status === 429) {
        const errorMessage = errorData.error || 'Trop de requêtes. Veuillez attendre quelques secondes avant de réessayer.';
        throw new Error(errorMessage);
      }
      console.error('[fetchUserActivities] HTTP Error:', response.status, errorData);
      if (errorData.error) {
        throw new Error(errorData.error);
      }
      if (errorData.details) {
        console.error('[fetchUserActivities] Error details:', errorData.details);
        throw new Error(`Erreur API: ${JSON.stringify(errorData.details)}`);
      }
      return null;
    }

    const data = await response.json();
    
    if (data.error) {
      console.error('API Error:', data.error);
      throw new Error(data.error);
    }

    const activities: ActivityStatus[] = data.activities || [];
    const pageInfo = data.pageInfo || { currentPage: page, hasNextPage: false };


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
    return null;
  }
}

// Fetch a single media by ID
export async function fetchMediaById(mediaId: number): Promise<Media | null> {
  try {
    const response = await fetch(`/api/anilist/media?id=${mediaId}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 429) {
        throw new Error('RATE_LIMIT: Too many requests. Please wait a moment and try again.');
      }
      console.error('HTTP Error:', response.status, errorData);
      if (errorData.error) {
        throw new Error(errorData.error);
      }
      return null;
    }

    const data = await response.json();
    
    if (data.error) {
      console.error('API Error:', data.error);
      if (data.error.includes('Too many requests') || data.error.includes('rate limit') || data.error.includes('429')) {
        throw new Error('RATE_LIMIT: ' + data.error);
      }
      throw new Error(data.error);
    }

    return data;
  } catch (error) {
    console.error('Error fetching media by ID:', error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('Network error - check your internet connection');
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
  try {
    if (!query || query.trim().length < 2) {
      return null;
    }

    const response = await fetch(`/api/anilist/search?query=${encodeURIComponent(query)}&type=${type || 'ALL'}&page=${page}&perPage=${perPage}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 429) {
        throw new Error('RATE_LIMIT: Too many requests. Please wait a moment and try again.');
      }
      console.error('HTTP Error:', response.status, errorData);
      if (errorData.error) {
        throw new Error(errorData.error);
      }
      return null;
    }

    const data = await response.json();
    
    if (data.error) {
      console.error('API Error:', data.error);
      if (data.error.includes('Too many requests') || data.error.includes('rate limit') || data.error.includes('429')) {
        throw new Error('RATE_LIMIT: ' + data.error);
      }
      throw new Error(data.error);
    }

    return data;
  } catch (error) {
    console.error('Error searching media:', error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('Network error - check your internet connection');
    }
    throw error;
  }
}

// Get followed users (requires authentication)
export async function getFollowedUsers(accessToken: string): Promise<AniListUser[] | null> {
  try {
    const response = await fetch('/api/anilist/following', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 401) {
        throw new Error('UNAUTHORIZED: Invalid or expired token');
      }
      throw new Error(errorData.error || 'Failed to fetch followed users');
    }

    const data = await response.json();
    return data.users || [];
  } catch (error) {
    console.error('Error fetching followed users:', error);
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
  try {
    const response = await fetch(`/api/anilist/media-scores?mediaId=${mediaId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText || 'Unknown error' };
      }
      
      // Handle unauthorized errors (expired token)
      if (response.status === 401) {
        throw new Error('UNAUTHORIZED: Invalid or expired token');
      }
      
      // Extract error message from response
      let errorMessage = errorData.error || errorText || 'Failed to fetch user scores';
      if (errorData.details) {
        if (Array.isArray(errorData.details)) {
          errorMessage = errorData.details.map((d: any) => d.message || JSON.stringify(d)).join(', ');
        } else if (typeof errorData.details === 'string') {
          errorMessage = errorData.details;
        } else if (errorData.details.error) {
          errorMessage = errorData.details.error;
        }
      }
      
      throw new Error(`HTTP ${response.status}: ${errorMessage}`);
    }

    const data = await response.json();
    return data.scores || [];
  } catch (error) {
    console.error('[getFollowedUsersScores] Error:', error);
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
  try {
    const response = await fetch('/api/anilist/activity-like', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ activityId, activityType }),
    });

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
      
      console.error('[toggleActivityLike] Error response:', errorData);
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error toggling activity like:', error);
    throw error;
  }
}
