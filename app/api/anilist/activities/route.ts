import { NextRequest, NextResponse } from 'next/server';

const ANILIST_API_URL = 'https://graphql.anilist.co';

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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('userId');
  const page = searchParams.get('page') || '1';
  const perPage = searchParams.get('perPage') || '50';
  const activityType = searchParams.get('type'); // 'text', 'list', 'message', 'anime', 'manga', or null for all
  const mediaType = searchParams.get('mediaType'); // 'anime', 'manga', or null
  
  console.log(`[activities API] Request params: userId=${userId}, page=${page}, perPage=${perPage}, type=${activityType}, mediaType=${mediaType}`);

  if (!userId) {
    return NextResponse.json(
      { error: 'userId is required' },
      { status: 400 }
    );
  }

  // Map filter values to ActivityType enum values
  // Note: status filtering is NOT supported and must be done client-side
  let graphQLType: string | null = null;
  
  if (mediaType) {
    // If mediaType is specified, use ANIME_LIST or MANGA_LIST
    if (mediaType.toLowerCase() === 'anime') {
      graphQLType = 'ANIME_LIST';
    } else if (mediaType.toLowerCase() === 'manga') {
      graphQLType = 'MANGA_LIST';
    }
  } else if (activityType) {
    // If activityType is specified, map it
    const typeMap: Record<string, string> = {
      'text': 'TEXT',
      'list': null, // For 'list', we don't filter (get both ANIME_LIST and MANGA_LIST)
      'message': 'MESSAGE'
    };
    graphQLType = typeMap[activityType.toLowerCase()] || null;
  }

  try {
    const variables: any = {
      userId: parseInt(userId, 10),
      page: parseInt(page, 10),
      perPage: parseInt(perPage, 10),
    };
    
    // Only add type if specified (ANIME_LIST, MANGA_LIST, TEXT, or MESSAGE)
    if (graphQLType) {
      variables.type = graphQLType;
    }

    console.log('[activities API] Sending GraphQL query with variables:', JSON.stringify(variables, null, 2));

    const requestBody = {
      query: GET_USER_ACTIVITIES,
      variables,
    };
    console.log('[activities API] Full request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(ANILIST_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log(`[activities API] AniList API response status: ${response.status}`);
    console.log(`[activities API] AniList API response body:`, responseText);

    if (!response.ok) {
      console.error(`[activities API] AniList API returned HTTP ${response.status}:`, responseText);
      return NextResponse.json(
        { error: `HTTP Error: ${response.status}`, details: responseText },
        { status: response.status }
      );
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('[activities API] Failed to parse response as JSON:', e);
      return NextResponse.json(
        { error: 'Invalid JSON response', details: responseText },
        { status: 500 }
      );
    }

    console.log('[activities API] AniList API parsed response:', JSON.stringify(data, null, 2));

    if (data.errors) {
      console.error('[activities API] AniList API errors for activities:', JSON.stringify(data.errors, null, 2));
      return NextResponse.json(
        { error: 'API error', details: data.errors },
        { status: 400 }
      );
    }

    const pageData = data.data?.Page;
    if (!pageData) {
      return NextResponse.json(
        { error: 'No data returned' },
        { status: 500 }
      );
    }

    // Return all activities for now (we'll filter by comments later if needed)
    return NextResponse.json({
      activities: pageData.activities || [],
      pageInfo: pageData.pageInfo,
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    return NextResponse.json(
      { error: 'Network error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
