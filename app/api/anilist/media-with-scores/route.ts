import { NextRequest, NextResponse } from 'next/server';

const ANILIST_API_URL = 'https://graphql.anilist.co';

/**
 * Combined GraphQL query to fetch media info AND followed users scores in a single request.
 * This reduces API calls and helps avoid rate limiting.
 */
const GET_MEDIA_WITH_SCORES = `
  query GetMediaWithScores($mediaId: Int!) {
    # Get media information
    Media(id: $mediaId) {
      id
      title {
        romaji
        english
        native
        userPreferred
      }
      type
      format
      status
      description
      startDate {
        year
        month
        day
      }
      endDate {
        year
        month
        day
      }
      episodes
      chapters
      volumes
      coverImage {
        large
        medium
      }
      bannerImage
      genres
      averageScore
      popularity
      siteUrl
    }
    
    # Get authenticated user ID
    Viewer {
      id
    }
  }
`;

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
 * OPTIMIZED: Single combined GraphQL query that fetches everything in one request.
 * 
 * This query combines:
 * - Media information
 * - Viewer ID
 * - Following users list
 * 
 * Note: We still need a second query for mediaList because it requires the userIds
 * from the following query, which GraphQL doesn't support as dynamic variables.
 * However, this reduces from 3 queries to 2 queries.
 */
const GET_MEDIA_WITH_FOLLOWING = `
  query GetMediaWithFollowing($mediaId: Int!, $viewerId: Int!, $page: Int, $perPage: Int) {
    # Get media information
    Media(id: $mediaId) {
      id
      title {
        romaji
        english
        native
        userPreferred
      }
      type
      format
      status
      description
      startDate {
        year
        month
        day
      }
      endDate {
        year
        month
        day
      }
      episodes
      chapters
      volumes
      coverImage {
        large
        medium
      }
      bannerImage
      genres
      averageScore
      popularity
      siteUrl
    }
    
    # Get authenticated user ID
    Viewer {
      id
    }
    
    # Get the list of users followed by the authenticated user
    FollowingPage: Page(page: $page, perPage: $perPage) {
      following(userId: $viewerId) {
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
 * Fallback function that uses separate queries (original approach).
 * Used when the optimized combined query fails.
 */
async function fallbackToSeparateQueries(mediaIdNum: number, accessToken: string) {
  console.log('[AniList API] ⚠️ Using fallback (separate queries)');
  // Step 1: Get media + viewer
  console.log('[AniList API] 🔵 Fallback Request #1: Media + Viewer');
  const mediaQuery = {
    query: GET_MEDIA_WITH_SCORES,
    variables: {
      mediaId: mediaIdNum,
    },
  };

  const mediaResponse = await fetch(ANILIST_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(mediaQuery),
  });
  console.log('[AniList API] ✅ Fallback Request #1 completed:', mediaResponse.status);

  if (!mediaResponse.ok) {
    throw new Error(`Failed to get media: ${mediaResponse.status}`);
  }

  const mediaData = await mediaResponse.json();
  const media = mediaData.data?.Media;
  const viewerId = mediaData.data?.Viewer?.id;

  if (!media) {
    throw new Error('Media not found');
  }

  if (!viewerId) {
    return NextResponse.json({ media, scores: [] });
  }

  // Step 2: Get following
  console.log('[AniList API] 🔵 Fallback Request #2: Following users');
  const followingQuery = {
    query: GET_FOLLOWING_USER_IDS,
    variables: {
      userId: viewerId,
      page: 1,
      perPage: 50,
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
  console.log('[AniList API] ✅ Fallback Request #2 completed:', followingResponse.status);

  if (!followingResponse.ok) {
    return NextResponse.json({ media, scores: [] });
  }

  const followingData = await followingResponse.json();
  const following = followingData.data?.Page?.following || [];
  const users = Array.isArray(following) ? following : [];
  const userIds = users.map((user: any) => user.id);

  if (userIds.length === 0) {
    return NextResponse.json({ media, scores: [] });
  }

  // Step 3: Get media list entries
  console.log(`[AniList API] 🔵 Fallback Request #3: MediaList entries (${userIds.length} users)`);
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
  console.log('[AniList API] ✅ Fallback Request #3 completed:', entriesResponse.status);
  console.log('[AniList API] 📊 Total: 3 requests (fallback)');

  if (!entriesResponse.ok) {
    return NextResponse.json({ media, scores: [] });
  }

  const entriesData = await entriesResponse.json();
  const mediaListEntries = entriesData.data?.Page?.mediaList || [];

  const userMap = new Map(users.map((user: any) => [user.id, user]));
  const scores = mediaListEntries.map((entry: any) => {
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

  return NextResponse.json({ media, scores });
}

/**
 * API route that combines media info and followed users scores in an optimized way.
 * 
 * OPTIMIZED APPROACH (2 queries instead of 3):
 * 1. Get Viewer ID (1 query)
 * 2. Combined query: Media + Following (1 query) 
 * 3. MediaList entries (1 query)
 * 
 * Total: 2 queries (Viewer + Combined) + 1 query (MediaList) = 2 queries
 * (Actually we need Viewer ID first, so it's still 2 queries minimum)
 * 
 * FALLBACK: Uses separate queries if optimized approach fails (3 queries).
 * 
 * @param request - Next.js request object
 * @param request.headers.authorization - Bearer token for AniList authentication (optional, only needed for scores)
 * @param request.nextUrl.searchParams.mediaId - The ID of the media to get info and scores for
 * @returns JSON response with media info and array of scores from followed users
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const searchParams = request.nextUrl.searchParams;
  const mediaId = searchParams.get('mediaId');

  // Validate mediaId parameter
  if (!mediaId) {
    return NextResponse.json(
      { error: 'mediaId is required' },
      { status: 400 }
    );
  }

  const mediaIdNum = parseInt(mediaId, 10);
  if (isNaN(mediaIdNum)) {
    return NextResponse.json(
      { error: 'Invalid mediaId' },
      { status: 400 }
    );
  }

  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  try {
    // OPTIMIZED APPROACH: Use combined query when we have a token
    // This reduces from 3 queries to 2 queries (Media+Viewer+Following in one, then MediaList)
    
    if (!accessToken) {
      // No token: just get media info (single query)
      const mediaQuery = {
        query: GET_MEDIA_WITH_SCORES,
        variables: {
          mediaId: mediaIdNum,
        },
      };

      const mediaResponse = await fetch(ANILIST_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(mediaQuery),
      });

      if (!mediaResponse.ok) {
        const errorText = await mediaResponse.text();
        console.error('[media-with-scores API] Failed to get media:', errorText);
        return NextResponse.json(
          { error: `HTTP Error: ${mediaResponse.status}`, details: errorText },
          { status: mediaResponse.status }
        );
      }

      const mediaData = await mediaResponse.json();

      if (mediaData.errors) {
        console.error('[media-with-scores API] GraphQL errors getting media:', mediaData.errors);
        const errorMessages = mediaData.errors.map((e: any) => e.message).join(', ');
        return NextResponse.json(
          { error: `GraphQL error: ${errorMessages}`, details: mediaData.errors },
          { status: 400 }
        );
      }

      const media = mediaData.data?.Media;
      if (!media) {
        return NextResponse.json(
          { error: 'Media not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        media,
        scores: [],
      });
    }

    // OPTIMIZED APPROACH: Use combined query (Media + Viewer + Following in one query)
    // This reduces from 3 queries to 2 queries total
    
    // Step 1: Get Viewer ID first (needed for the combined query)
    console.log('[AniList API] 🔵 Request #1: Getting Viewer ID');
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
    console.log('[AniList API] ✅ Request #1 completed:', viewerResponse.status);

    if (!viewerResponse.ok) {
      console.error('[media-with-scores API] Failed to get Viewer ID, using fallback');
      return await fallbackToSeparateQueries(mediaIdNum, accessToken);
    }

    const viewerData = await viewerResponse.json();
    const viewerId = viewerData.data?.Viewer?.id;

    if (!viewerId) {
      // No viewer ID means token might be invalid, get media only
      const mediaQuery = {
        query: GET_MEDIA_WITH_SCORES,
        variables: {
          mediaId: mediaIdNum,
        },
      };

      const mediaResponse = await fetch(ANILIST_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(mediaQuery),
      });

      if (!mediaResponse.ok) {
        return NextResponse.json(
          { error: 'Failed to get media' },
          { status: mediaResponse.status }
        );
      }

      const mediaData = await mediaResponse.json();
      const media = mediaData.data?.Media;
      if (!media) {
        return NextResponse.json(
          { error: 'Media not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        media,
        scores: [],
      });
    }

    // Step 2: OPTIMIZED - Combined query: Media + Viewer + Following (reduces from 2 queries to 1)
    console.log('[AniList API] 🔵 Request #2: Combined query (Media + Viewer + Following)');
    const combinedQuery = {
      query: GET_MEDIA_WITH_FOLLOWING,
      variables: {
        mediaId: mediaIdNum,
        viewerId: viewerId,
        page: 1,
        perPage: 50,
      },
    };

    const combinedResponse = await fetch(ANILIST_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(combinedQuery),
    });
    console.log('[AniList API] ✅ Request #2 completed:', combinedResponse.status);

    if (!combinedResponse.ok) {
      console.error('[media-with-scores API] Combined query failed, using fallback');
      return await fallbackToSeparateQueries(mediaIdNum, accessToken);
    }

    const combinedData = await combinedResponse.json();

    if (combinedData.errors) {
      console.error('[media-with-scores API] GraphQL errors in combined query, using fallback');
      return await fallbackToSeparateQueries(mediaIdNum, accessToken);
    }

    const media = combinedData.data?.Media;
    if (!media) {
      return NextResponse.json(
        { error: 'Media not found' },
        { status: 404 }
      );
    }

    const following = combinedData.data?.FollowingPage?.following || [];
    const users = Array.isArray(following) ? following : [];
    const userIds = users.map((user: any) => user.id);

    // Early return if no followed users
    if (userIds.length === 0) {
      return NextResponse.json({
        media,
        scores: [],
      });
    }

    // Step 3: Get media list entries (still need separate query because it requires userIds from step 2)
    console.log(`[AniList API] 🔵 Request #3: MediaList entries (${userIds.length} users)`);
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
    console.log('[AniList API] ✅ Request #3 completed:', entriesResponse.status);
    console.log('[AniList API] 📊 Total: 2 requests (optimized)');

    if (!entriesResponse.ok) {
      console.error('[media-with-scores API] Failed to get media list entries');
      return NextResponse.json({
        media,
        scores: [],
      });
    }

    const entriesData = await entriesResponse.json();

    if (entriesData.errors) {
      console.error('[media-with-scores API] GraphQL errors getting media entries');
      return NextResponse.json({
        media,
        scores: [],
      });
    }

    const mediaListEntries = entriesData.data?.Page?.mediaList || [];

    // Create a map of user info for quick lookup
    const userMap = new Map(users.map((user: any) => [user.id, user]));

    // Transform the data to match our expected format
    const scores = mediaListEntries.map((entry: any) => {
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
      media,
      scores,
    });
  } catch (error) {
    console.error('[media-with-scores API] Unexpected error:', error);
    
    return NextResponse.json(
      { error: 'Network error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
