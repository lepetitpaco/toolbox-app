import { NextRequest, NextResponse } from 'next/server';

const ANILIST_API_URL = 'https://graphql.anilist.co';

const GET_USER_ID = `
  query GetUserId($username: String!) {
    User(search: $username) {
      id
      name
      avatar {
        large
        medium
      }
      statistics {
        anime {
          count
          episodesWatched
          meanScore
          minutesWatched
        }
        manga {
          count
          chaptersRead
          volumesRead
          meanScore
        }
      }
    }
  }
`;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const username = searchParams.get('username');

  if (!username) {
    return NextResponse.json(
      { error: 'Username is required' },
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
        query: GET_USER_ID,
        variables: { username: username.trim() },
      }),
    });

    // Read response as text first to capture any errors
    const responseText = await response.text();

    if (!response.ok) {
      console.error(`[user API] AniList API returned HTTP ${response.status}:`, responseText);
      if (response.status === 429) {
        return NextResponse.json(
          { error: 'Too many requests. Please wait a moment and try again.' },
          { status: 429 }
        );
      }
      // Try to parse error details from response
      let errorDetails = responseText;
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.errors) {
          errorDetails = errorData.errors;
        } else if (errorData.error) {
          errorDetails = errorData.error;
        }
      } catch (e) {
        // Keep responseText as is if parsing fails
      }
      return NextResponse.json(
        { error: `HTTP Error: ${response.status}`, details: errorDetails },
        { status: response.status }
      );
    }

    // Parse JSON response
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('[user API] Failed to parse response as JSON:', e);
      return NextResponse.json(
        { error: 'Invalid JSON response', details: responseText },
        { status: 500 }
      );
    }

    if (data.errors) {
      console.error('[user API] AniList GraphQL errors:', JSON.stringify(data.errors, null, 2));
      const errorMessages = data.errors.map((e: any) => e.message).join(', ');
      return NextResponse.json(
        { error: `GraphQL error: ${errorMessages}`, details: data.errors },
        { status: 400 }
      );
    }

    if (!data.data?.User) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Return user data (followers/following are not available in public API)
    const user = data.data.User;
    return NextResponse.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Network error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
