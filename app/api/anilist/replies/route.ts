import { NextRequest, NextResponse } from 'next/server';

const ANILIST_API_URL = 'https://graphql.anilist.co';

const GET_ACTIVITY_REPLIES = `
  query GetActivityReplies($activityId: Int!) {
    Activity(id: $activityId) {
      ... on TextActivity {
        id
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
        id
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
        id
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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const activityId = searchParams.get('activityId');

  if (!activityId) {
    return NextResponse.json(
      { error: 'activityId is required' },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(ANILIST_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query: GET_ACTIVITY_REPLIES,
        variables: { activityId: parseInt(activityId, 10) },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[replies API] HTTP Error ${response.status} for activity ${activityId}:`, errorText);
      return NextResponse.json(
        { error: `HTTP Error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (data.errors) {
      // Log the error for debugging
      console.error(`[replies API] AniList API errors for activity ${activityId}:`, JSON.stringify(data.errors, null, 2));
      // Return error details for debugging
      return NextResponse.json(
        { error: 'API error', details: data.errors },
        { status: 400 }
      );
    }

    const activity = data.data?.Activity;
    if (!activity) {
      console.warn(`[replies API] Activity ${activityId} not found in response`);
      return NextResponse.json(
        { error: 'Activity not found' },
        { status: 404 }
      );
    }

    const replies = activity.replies || [];
    return NextResponse.json(replies);
  } catch (error) {
    console.error('Error fetching replies:', error);
    return NextResponse.json(
      { error: 'Network error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
