import { NextRequest, NextResponse } from 'next/server';

const ANILIST_API_URL = 'https://graphql.anilist.co';

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
      return NextResponse.json(
        { error: `HTTP Error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (data.errors) {
      // Log the error for debugging
      console.error('AniList API errors for replies:', JSON.stringify(data.errors, null, 2));
      // Return empty array instead of error - some activities may not have accessible replies
      return NextResponse.json([]);
    }

    const activity = data.data?.Activity;
    if (!activity) {
      // Activity not found or not accessible - return empty array
      return NextResponse.json([]);
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
