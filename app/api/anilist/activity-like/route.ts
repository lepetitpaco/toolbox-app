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
    // AniList uses specific types: TEXT, ANIME_LIST, MANGA_LIST, MESSAGE
    // But ToggleLike expects: ACTIVITY, THREAD, THREAD_COMMENT, etc.
    // For activities, we should use ACTIVITY
    let likeableType = 'ACTIVITY';
    
    // If activityType is provided, we could potentially use it,
    // but based on AniList API, activities should use ACTIVITY type
    console.log('[activity-like API] Activity type:', activityType);

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
          type: 'ACTIVITY'
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

    // Step 2: Fetch the updated activity to get isLiked and likeCount
    const activityResponse = await fetch(ANILIST_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        query: GET_ACTIVITY,
        variables: { 
          id: parseInt(activityId, 10)
        },
      }),
    });

    const activityResponseText = await activityResponse.text();

    if (!activityResponse.ok) {
      console.error(`[activity-like API] GetActivity returned HTTP ${activityResponse.status}:`, activityResponseText);
      // Even if this fails, the like was toggled, so return success with estimated values
      return NextResponse.json({
        id: parseInt(activityId, 10),
        isLiked: true, // Assume toggled
        likeCount: 0,
      });
    }

    let activityData;
    try {
      activityData = JSON.parse(activityResponseText);
    } catch (e) {
      console.error('[activity-like API] Failed to parse GetActivity response as JSON:', e);
      return NextResponse.json({
        id: parseInt(activityId, 10),
        isLiked: true,
        likeCount: 0,
      });
    }

    if (activityData.errors) {
      console.error('[activity-like API] GetActivity GraphQL errors:', JSON.stringify(activityData.errors, null, 2));
      return NextResponse.json({
        id: parseInt(activityId, 10),
        isLiked: true,
        likeCount: 0,
      });
    }

    const activity = activityData.data?.Activity;
    if (!activity) {
      return NextResponse.json({
        id: parseInt(activityId, 10),
        isLiked: true,
        likeCount: 0,
      });
    }

    return NextResponse.json({
      id: activity.id,
      isLiked: activity.isLiked,
      likeCount: activity.likeCount,
    });
  } catch (error) {
    console.error('[activity-like API] Error toggling activity like:', error);
    return NextResponse.json(
      { error: 'Network error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
