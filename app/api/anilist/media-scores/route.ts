import { NextRequest, NextResponse } from 'next/server';

const ANILIST_API_URL = 'https://graphql.anilist.co';

/**
 * GraphQL query to get the list of users followed by a specific user.
 * 
 * Note: Viewer (which is of type User) doesn't have a "following" field.
 * We must use Page.following(userId: $userId) instead.
 * 
 * @param userId - The ID of the user whose followed users we want to retrieve
 * @param page - Page number for pagination
 * @param perPage - Number of results per page (max 50)
 * @returns Array of User objects with id, name, and avatar
 */
const GET_FOLLOWING_USER_IDS = `
  query GetFollowingUserIds($userId: Int!, $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      following(userId: $userId) {
        id
        name
        avatar {
          large
          medium
        }
      }
    }
  }
`;

/**
 * GraphQL query to get media list entries for specific users and a specific media.
 * 
 * Note: Media.mediaListEntries doesn't exist (only Media.mediaListEntry singular).
 * We use Page.mediaList with filters to get multiple entries at once.
 * 
 * @param mediaId - The ID of the media to get entries for
 * @param userIds - Array of user IDs to filter entries by
 * @returns Array of MediaList entries with score, status, progress, and user info
 */
const GET_MEDIA_LIST_ENTRIES = `
  query GetMediaListEntries($mediaId: Int!, $userIds: [Int!]) {
    Page {
      mediaList(mediaId: $mediaId, userId_in: $userIds) {
        userId
        score
        status
        progress
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
`;

/**
 * API route to get scores from followed users for a specific media.
 * 
 * This endpoint:
 * 1. Gets the authenticated user's ID (Viewer)
 * 2. Retrieves the list of users they follow
 * 3. Fetches media list entries for those users for the specified media
 * 4. Returns scores, status, and progress for each followed user
 * 
 * Similar to AniList's "Social" section on media pages.
 * 
 * @param request - Next.js request object
 * @param request.headers.authorization - Bearer token for AniList authentication
 * @param request.nextUrl.searchParams.mediaId - The ID of the media to get scores for
 * @returns JSON response with array of scores from followed users
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const searchParams = request.nextUrl.searchParams;
  const mediaId = searchParams.get('mediaId');

  // Validate authorization header
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Authorization header required' },
      { status: 401 }
    );
  }

  // Validate mediaId parameter
  if (!mediaId) {
    return NextResponse.json(
      { error: 'mediaId is required' },
      { status: 400 }
    );
  }

  const accessToken = authHeader.substring(7);
  const mediaIdNum = parseInt(mediaId, 10);

  if (isNaN(mediaIdNum)) {
    return NextResponse.json(
      { error: 'Invalid mediaId' },
      { status: 400 }
    );
  }

  try {
    // Step 1: Get the authenticated user's ID (Viewer)
    // We need this because Viewer (User type) doesn't have a "following" field
    const viewerQuery = {
      query: `query { Viewer { id } }`,
    };
    
    const viewerResponse = await fetch(ANILIST_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(viewerQuery),
    });

    if (!viewerResponse.ok) {
      const errorText = await viewerResponse.text();
      console.error('[media-scores API] Failed to get Viewer ID:', errorText);
      return NextResponse.json(
        { error: `HTTP Error: ${viewerResponse.status}` },
        { status: viewerResponse.status }
      );
    }

    const viewerData = await viewerResponse.json();
    
    if (viewerData.errors || !viewerData.data?.Viewer?.id) {
      console.error('[media-scores API] Failed to get Viewer ID:', viewerData);
      return NextResponse.json(
        { error: 'Failed to get authenticated user ID' },
        { status: 401 }
      );
    }

    const viewerId = viewerData.data.Viewer.id;

    // Step 2: Get the list of users followed by the authenticated user
    // Page.following(userId: $userId) returns an array of User objects directly
    const followingQuery = {
      query: GET_FOLLOWING_USER_IDS,
      variables: {
        userId: viewerId,
        page: 1,
        perPage: 50, // Max 50 users per page
      },
    };
    
    const followingResponse = await fetch(ANILIST_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(followingQuery),
    });

    if (!followingResponse.ok) {
      const errorText = await followingResponse.text();
      console.error('[media-scores API] Failed to get followed users:', errorText);
      return NextResponse.json(
        { error: `HTTP Error: ${followingResponse.status}` },
        { status: followingResponse.status }
      );
    }

    const followingData = await followingResponse.json();
    
    if (followingData.errors) {
      console.error('[media-scores API] GraphQL errors getting followed users:', followingData.errors);
      const errorMessages = followingData.errors.map((e: any) => e.message).join(', ');
      return NextResponse.json(
        { error: `GraphQL error: ${errorMessages}`, details: followingData.errors },
        { status: 400 }
      );
    }

    const pageData = followingData.data?.Page;
    if (!pageData) {
      console.error('[media-scores API] No Page data in following response');
      return NextResponse.json(
        { error: 'No Page data returned' },
        { status: 401 }
      );
    }

    // Extract user IDs from the following array
    // Page.following(userId: $userId) returns an array directly (not { nodes: [...] })
    const following = pageData.following;
    const users = Array.isArray(following) ? following : [];
    const userIds = users.map((user: any) => user.id);
    
    // Early return if no followed users
    if (userIds.length === 0) {
      return NextResponse.json({
        scores: [],
      });
    }

    // Step 3: Get media list entries for all followed users for this specific media
    // Using Page.mediaList with filters to get all entries in one query (efficient)
    const mediaEntriesQuery = {
      query: GET_MEDIA_LIST_ENTRIES,
      variables: {
        mediaId: mediaIdNum,
        userIds: userIds,
      },
    };
    
    const entriesResponse = await fetch(ANILIST_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(mediaEntriesQuery),
    });

    if (!entriesResponse.ok) {
      const errorText = await entriesResponse.text();
      console.error('[media-scores API] Failed to get media list entries:', errorText);
      return NextResponse.json(
        { error: `HTTP Error: ${entriesResponse.status}` },
        { status: entriesResponse.status }
      );
    }

    const entriesData = await entriesResponse.json();
    
    if (entriesData.errors) {
      console.error('[media-scores API] GraphQL errors getting media entries:', entriesData.errors);
      const errorMessages = entriesData.errors.map((e: any) => e.message).join(', ');
      return NextResponse.json(
        { error: `GraphQL error: ${errorMessages}`, details: entriesData.errors },
        { status: 400 }
      );
    }

    const mediaListEntries = entriesData.data?.Page?.mediaList || [];

    // Create a map of user info for quick lookup (from step 2)
    // This allows us to merge user info from the following query with entry data
    const userMap = new Map(users.map((user: any) => [user.id, user]));

    // Transform the data to match our expected format
    // Each entry contains score, status, progress, and user info
    const scores = mediaListEntries.map((entry: any) => {
      // Prefer user info from the following query, fallback to entry.user
      const user = userMap.get(entry.userId) || entry.user;
      
      return {
        userId: entry.userId || entry.user?.id,
        userName: user?.name || entry.user?.name || 'Unknown',
        userAvatar: user?.avatar?.medium || user?.avatar?.large || entry.user?.avatar?.medium || entry.user?.avatar?.large,
        score: entry.score,
        status: entry.status,
        progress: entry.progress,
      };
    });

    return NextResponse.json({
      scores,
    });
  } catch (error) {
    // Catch any unexpected errors (network issues, parsing errors, etc.)
    console.error('[media-scores API] Unexpected error:', error);
    
    return NextResponse.json(
      { error: 'Network error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
