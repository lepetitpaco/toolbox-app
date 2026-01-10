// AniList GraphQL API utility

const ANILIST_API_URL = 'https://graphql.anilist.co';

export interface AniListUser {
  id: number;
  name: string;
  avatar?: {
    large?: string;
    medium?: string;
  };
}

export interface ActivityComment {
  id: number;
  userId: number;
  user?: AniListUser;
  comment?: string;
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

// GraphQL query to fetch user activities with comments
const GET_USER_ACTIVITIES = `
  query GetUserActivities($userId: Int!, $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        currentPage
        hasNextPage
      }
      activities(userId: $userId, sort: ID_DESC) {
        ... on TextActivity {
          id
          userId
          type
          replyCount
          likeCount
          createdAt
          text
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
          comment
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
          comment
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
          comment
          createdAt
          isLiked
          likeCount
        }
      }
    }
  }
`;

async function fetchActivityReplies(activityId: number): Promise<ActivityComment[] | null> {
  try {
    // Use Next.js API route to avoid CORS issues
    const response = await fetch(`/api/anilist/replies?activityId=${activityId}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 429) {
        console.warn(`Rate limit exceeded while fetching replies for activity ${activityId}`);
        return null;
      }
      // For 400 errors, some activities may not have accessible replies - just return null silently
      if (response.status === 400) {
        console.warn(`Activity ${activityId} may not have accessible replies (this is normal for some activities)`);
        return null;
      }
      console.error(`HTTP Error fetching replies for activity ${activityId}:`, response.status, errorData);
      return null;
    }

    const replies = await response.json();
    
    if (Array.isArray(replies) && replies.length > 0) {
      return replies;
    }

    return null;
  } catch (error) {
    console.error(`Error fetching activity replies for ${activityId}:`, error);
    return null;
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
      console.error('HTTP Error:', response.status, errorData);
      if (errorData.error) {
        throw new Error(errorData.error);
      }
      return null;
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
  perPage: number = 50
): Promise<ActivityPage | null> {
  try {
    // Use Next.js API route to avoid CORS issues
    const response = await fetch(
      `/api/anilist/activities?userId=${userId}&page=${page}&perPage=${perPage}`
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 429) {
        const errorMessage = errorData.error || 'Trop de requêtes. Veuillez attendre quelques secondes avant de réessayer.';
        throw new Error(errorMessage);
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
      throw new Error(data.error);
    }

    const activities: ActivityStatus[] = data.activities || [];
    const pageInfo = data.pageInfo || { currentPage: page, hasNextPage: false };

    console.log(`Found ${activities.length} activities`);

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
