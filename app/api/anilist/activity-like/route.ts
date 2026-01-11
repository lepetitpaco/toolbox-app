import { NextRequest, NextResponse } from 'next/server';

const ANILIST_API_URL = 'https://graphql.anilist.co';

// ToggleLike returns a LikeableUnion, but for activities it seems to return users
// So we'll just toggle and then fetch the activity separately
const TOGGLE_ACTIVITY_LIKE = `
  mutation ToggleLike($id: Int!, $type: LikeableType!) {
    ToggleLike(id: $id, type: $type) {
      __typename
    }
  }
`;

// Query to get updated activity with like info
const GET_ACTIVITY = `
  query GetActivity($id: Int!) {
    Activity(id: $id) {
      ... on TextActivity {
        id
        isLiked
        likeCount
      }
      ... on ListActivity {
        id
        isLiked
        likeCount
      }
      ... on MessageActivity {
        id
        isLiked
        likeCount
      }
    }
  }
`;

// Query to get updated activity reply with like info
const GET_ACTIVITY_REPLY = `
  query GetActivityReply($id: Int!) {
    ActivityReply(id: $id) {
      id
      isLiked
      likeCount
    }
  }
`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { activityId, activityType } = body;
    const authHeader = request.headers.get('authorization');

    if (!activityId) {
      return NextResponse.json(
        { error: 'Activity ID is required' },
        { status: 400 }
      );
    }

    // Determine the LikeableType from activityType
    // AniList uses specific types: TEXT, ANIME_LIST, MANGA_LIST, MESSAGE, ACTIVITY_REPLY
    // But ToggleLike expects: ACTIVITY, THREAD, THREAD_COMMENT, ACTIVITY_REPLY, etc.
    let likeableType = 'ACTIVITY';
    const isReply = activityType === 'ACTIVITY_REPLY';
    
    if (isReply) {
      likeableType = 'ACTIVITY_REPLY';
    }
    
    console.log('[activity-like API] Activity type:', activityType, 'LikeableType:', likeableType);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const accessToken = authHeader.replace('Bearer ', '');

    // Step 1: Toggle the like
    const toggleResponse = await fetch(ANILIST_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        query: TOGGLE_ACTIVITY_LIKE,
        variables: { 
          id: parseInt(activityId, 10),
          type: likeableType
        },
      }),
    });

    const toggleResponseText = await toggleResponse.text();

    if (!toggleResponse.ok) {
      console.error(`[activity-like API] ToggleLike returned HTTP ${toggleResponse.status}:`, toggleResponseText);
      return NextResponse.json(
        { error: `HTTP Error: ${toggleResponse.status}`, details: toggleResponseText },
        { status: toggleResponse.status }
      );
    }

    let toggleData;
    try {
      toggleData = JSON.parse(toggleResponseText);
    } catch (e) {
      console.error('[activity-like API] Failed to parse ToggleLike response as JSON:', e);
      return NextResponse.json(
        { error: 'Invalid JSON response', details: toggleResponseText },
        { status: 500 }
      );
    }

    if (toggleData.errors) {
      console.error('[activity-like API] ToggleLike GraphQL errors:', JSON.stringify(toggleData.errors, null, 2));
      const errorMessages = toggleData.errors.map((e: any) => e.message).join(', ');
      return NextResponse.json(
        { error: `GraphQL error: ${errorMessages}`, details: toggleData.errors },
        { status: 400 }
      );
    }

    // Step 2: Fetch the updated activity/reply to get isLiked and likeCount
    const fetchQuery = isReply ? GET_ACTIVITY_REPLY : GET_ACTIVITY;
    const fetchResponse = await fetch(ANILIST_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        query: fetchQuery,
        variables: { 
          id: parseInt(activityId, 10)
        },
      }),
    });

    const fetchResponseText = await fetchResponse.text();

    if (!fetchResponse.ok) {
      console.error(`[activity-like API] Get${isReply ? 'ActivityReply' : 'Activity'} returned HTTP ${fetchResponse.status}:`, fetchResponseText);
      // Even if this fails, the like was toggled, so return success with estimated values
      return NextResponse.json({
        id: parseInt(activityId, 10),
        isLiked: true, // Assume toggled
        likeCount: 0,
      });
    }

    let fetchData;
    try {
      fetchData = JSON.parse(fetchResponseText);
    } catch (e) {
      console.error(`[activity-like API] Failed to parse Get${isReply ? 'ActivityReply' : 'Activity'} response as JSON:`, e);
      return NextResponse.json({
        id: parseInt(activityId, 10),
        isLiked: true,
        likeCount: 0,
      });
    }

    if (fetchData.errors) {
      console.error(`[activity-like API] Get${isReply ? 'ActivityReply' : 'Activity'} GraphQL errors:`, JSON.stringify(fetchData.errors, null, 2));
      return NextResponse.json({
        id: parseInt(activityId, 10),
        isLiked: true,
        likeCount: 0,
      });
    }

    const result = isReply ? fetchData.data?.ActivityReply : fetchData.data?.Activity;
    if (!result) {
      return NextResponse.json({
        id: parseInt(activityId, 10),
        isLiked: true,
        likeCount: 0,
      });
    }

    return NextResponse.json({
      id: result.id,
      isLiked: result.isLiked,
      likeCount: result.likeCount,
    });
  } catch (error) {
    console.error('[activity-like API] Error toggling activity like:', error);
    return NextResponse.json(
      { error: 'Network error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
