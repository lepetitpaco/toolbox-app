import { NextRequest, NextResponse } from 'next/server';

const ANILIST_API_URL = 'https://graphql.anilist.co';

/**
 * GraphQL query to get the list of users followed by a specific user.
 * 
 * Note: Viewer (User type) doesn't have a "following" field.
 * We must use Page.following(userId: $userId) instead.
 * 
 * @param userId - The ID of the user whose followed users we want to retrieve
 * @param page - Page number for pagination
 * @param perPage - Number of results per page (max 50)
 * @returns Array of User objects with id, name, and avatar
 */
const GET_FOLLOWING = `
  query GetFollowing($userId: Int!, $page: Int, $perPage: Int) {
    Viewer {
      id
    }
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
 * API route to get the list of users followed by the authenticated user.
 * 
 * @param request - Next.js request object
 * @param request.headers.authorization - Bearer token for AniList authentication
 * @returns JSON response with array of followed users
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Authorization header required' },
      { status: 401 }
    );
  }

  const accessToken = authHeader.substring(7);

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
      console.error('[following API] Failed to get Viewer ID:', errorText);
      return NextResponse.json(
        { error: `HTTP Error: ${viewerResponse.status}` },
        { status: viewerResponse.status }
      );
    }

    const viewerData = await viewerResponse.json();
    if (viewerData.errors || !viewerData.data?.Viewer?.id) {
      console.error('[following API] Failed to get Viewer ID:', viewerData);
      return NextResponse.json(
        { error: 'Failed to get authenticated user ID' },
        { status: 401 }
      );
    }

    const viewerId = viewerData.data.Viewer.id;

    // Step 2: Get the list of users followed by the authenticated user
    // Page.following(userId: $userId) returns an array of User objects directly
    const response = await fetch(ANILIST_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        query: GET_FOLLOWING,
        variables: {
          userId: viewerId,
          page: 1,
          perPage: 50,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[following API] AniList API error:', errorText);
      return NextResponse.json(
        { error: `HTTP Error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (data.errors) {
      console.error('[following API] GraphQL errors:', data.errors);
      return NextResponse.json(
        { error: 'API error', details: data.errors },
        { status: 400 }
      );
    }

    const pageData = data.data?.Page;
    if (!pageData) {
      return NextResponse.json(
        { error: 'No Page data returned. Token may be invalid or expired.' },
        { status: 401 }
      );
    }

    // Page.following(userId: $userId) returns an array directly (not { nodes: [...] })
    const following = pageData.following || [];
    return NextResponse.json({
      users: Array.isArray(following) ? following : [],
      pageInfo: {}, // Pagination info not available with this query structure
    });
  } catch (error) {
    console.error('Error fetching following:', error);
    return NextResponse.json(
      { error: 'Network error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
