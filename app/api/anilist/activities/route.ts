import { NextRequest, NextResponse } from 'next/server';

const ANILIST_API_URL = 'https://graphql.anilist.co';

const GET_USER_ACTIVITIES = `
  query GetUserActivities($userId: Int!, $page: Int, $perPage: Int, $type: ActivityType, $createdAt_greater: Int, $createdAt_lesser: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        currentPage
        hasNextPage
      }
      activities(userId: $userId, sort: ID_DESC, type: $type, createdAt_greater: $createdAt_greater, createdAt_lesser: $createdAt_lesser) {
        ... on TextActivity {
          id
          userId
          type
          replyCount
          likeCount
          isLiked
          createdAt
          text(asHtml: true)
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
          isLiked
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
          isLiked
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
  const createdAtGreater = searchParams.get('createdAt_greater'); // Unix timestamp (seconds)
  const createdAtLesser = searchParams.get('createdAt_lesser'); // Unix timestamp (seconds)
  
  // Log received parameters for debugging
  console.log('[activities API] 📥 Received parameters:', {
    userId,
    page,
    perPage,
    activityType,
    mediaType,
    createdAtGreater,
    createdAtLesser
  });
  const authHeader = request.headers.get('authorization');

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
    const userIdInt = parseInt(userId, 10);
    if (isNaN(userIdInt)) {
      console.error('[activities API] Invalid userId:', userId);
      return NextResponse.json(
        { error: 'Invalid userId parameter' },
        { status: 400 }
      );
    }
    
    const pageInt = parseInt(page, 10);
    const perPageInt = parseInt(perPage, 10);
    
    if (isNaN(pageInt) || pageInt < 1) {
      console.error('[activities API] Invalid page:', page);
      return NextResponse.json(
        { error: 'Invalid page parameter' },
        { status: 400 }
      );
    }
    
    if (isNaN(perPageInt) || perPageInt < 1 || perPageInt > 50) {
      console.error('[activities API] Invalid perPage:', perPage);
      return NextResponse.json(
        { error: 'Invalid perPage parameter (must be between 1 and 50)' },
        { status: 400 }
      );
    }
    
    const variables: any = {
      userId: userIdInt,
      page: pageInt,
      perPage: perPageInt,
    };
    
    console.log('[activities API] 📋 Parsed parameters:', { userId: userIdInt, page: pageInt, perPage: perPageInt, activityType, mediaType });
    
    // Only add type if specified (ANIME_LIST, MANGA_LIST, TEXT, or MESSAGE)
    if (graphQLType) {
      variables.type = graphQLType;
    }
    
    // Add date filters if specified (Unix timestamps in seconds)
    // Only process if the value is not null, not empty string, and not "undefined"
    if (createdAtGreater && createdAtGreater !== '' && createdAtGreater !== 'undefined') {
      const greaterValue = parseInt(createdAtGreater, 10);
      if (isNaN(greaterValue) || greaterValue < 0) {
        console.error('[activities API] Invalid createdAt_greater value:', createdAtGreater);
        return NextResponse.json(
          { error: 'Invalid createdAt_greater parameter (must be a valid positive integer)' },
          { status: 400 }
        );
      }
      variables.createdAt_greater = greaterValue;
      console.log('[activities API] ✅ Added createdAt_greater:', greaterValue, `(${new Date(greaterValue * 1000).toISOString()})`);
    }
    if (createdAtLesser && createdAtLesser !== '' && createdAtLesser !== 'undefined') {
      const lesserValue = parseInt(createdAtLesser, 10);
      if (isNaN(lesserValue) || lesserValue < 0) {
        console.error('[activities API] Invalid createdAt_lesser value:', createdAtLesser);
        return NextResponse.json(
          { error: 'Invalid createdAt_lesser parameter (must be a valid positive integer)' },
          { status: 400 }
        );
      }
      variables.createdAt_lesser = lesserValue;
      console.log('[activities API] ✅ Added createdAt_lesser:', lesserValue, `(${new Date(lesserValue * 1000).toISOString()})`);
    }
    
    // Validate that createdAt_greater <= createdAt_lesser if both are set
    if (variables.createdAt_greater !== undefined && variables.createdAt_lesser !== undefined) {
      if (variables.createdAt_greater > variables.createdAt_lesser) {
        console.error('[activities API] Invalid date range: createdAt_greater > createdAt_lesser', {
          greater: variables.createdAt_greater,
          lesser: variables.createdAt_lesser
        });
        return NextResponse.json(
          { error: 'Invalid date range: start date must be before end date' },
          { status: 400 }
        );
      }
    }

    const requestBody = {
      query: GET_USER_ACTIVITIES,
      variables,
    };
    
    console.log('[activities API] 📤 Sending request to AniList with variables:', JSON.stringify(variables, null, 2));

    // Build headers with optional authentication
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    
    // Add authorization header if provided (needed for isLiked field)
    if (authHeader && authHeader.startsWith('Bearer ')) {
      headers['Authorization'] = authHeader;
    }

    console.log('[activities API] 📤 Request body:', JSON.stringify(requestBody, null, 2));
    
    const response = await fetch(ANILIST_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log('[activities API] 📥 AniList response status:', response.status);

    if (!response.ok) {
      console.error(`[activities API] AniList API returned HTTP ${response.status}:`, responseText);
      
      // Check if it's a rate limit error (429)
      if (response.status === 429) {
        let errorMessage = 'Too many requests. Please wait 30-60 seconds before trying again.';
        try {
          const errorData = JSON.parse(responseText);
          if (errorData.errors && errorData.errors.length > 0) {
            errorMessage = errorData.errors[0].message || errorMessage;
          }
        } catch (e) {
          // Use default message if parsing fails
        }
        return NextResponse.json(
          { error: `RATE_LIMIT: ${errorMessage}`, details: responseText },
          { status: 429 }
        );
      }
      
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

    if (data.errors) {
      console.error('[activities API] ❌ AniList GraphQL errors:', JSON.stringify(data.errors, null, 2));
      const errorMessages = data.errors.map((e: any) => e.message || JSON.stringify(e)).join('; ');
      return NextResponse.json(
        { error: `GraphQL Error: ${errorMessages}`, details: data.errors },
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
