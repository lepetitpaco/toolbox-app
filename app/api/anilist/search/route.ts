import { NextRequest, NextResponse } from 'next/server';

const ANILIST_API_URL = 'https://graphql.anilist.co';

const SEARCH_MEDIA = `
  query SearchMedia($search: String, $type: MediaType, $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        total
        perPage
        currentPage
        lastPage
        hasNextPage
      }
      media(search: $search, type: $type, sort: SEARCH_MATCH) {
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
        description(asHtml: false)
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
    }
  }
`;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('query');
  const typeParam = searchParams.get('type') || 'ALL';
  const page = searchParams.get('page') || '1';
  const perPage = searchParams.get('perPage') || '10';

  if (!query || query.trim().length < 2) {
    return NextResponse.json(
      { error: 'Query must be at least 2 characters' },
      { status: 400 }
    );
  }

  // Map type parameter to MediaType enum
  let mediaType: string | null = null;
  if (typeParam.toUpperCase() === 'ANIME') {
    mediaType = 'ANIME';
  } else if (typeParam.toUpperCase() === 'MANGA') {
    mediaType = 'MANGA';
  }
  // If 'ALL', mediaType stays null

  try {
    const variables: any = {
      search: query.trim(),
      page: parseInt(page, 10),
      perPage: parseInt(perPage, 10),
    };

    if (mediaType) {
      variables.type = mediaType;
    }

    console.log('[search API] Sending GraphQL query with variables:', JSON.stringify(variables, null, 2));

    const response = await fetch(ANILIST_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query: SEARCH_MEDIA,
        variables,
      }),
    });

    const responseText = await response.text();
    console.log(`[search API] AniList API response status: ${response.status}`);

    if (!response.ok) {
      console.error(`[search API] AniList API returned HTTP ${response.status}:`, responseText);
      return NextResponse.json(
        { error: `HTTP Error: ${response.status}`, details: responseText },
        { status: response.status }
      );
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('[search API] Failed to parse response as JSON:', e);
      return NextResponse.json(
        { error: 'Invalid JSON response', details: responseText },
        { status: 500 }
      );
    }

    if (data.errors) {
      console.error('[search API] AniList API errors:', JSON.stringify(data.errors, null, 2));
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

    return NextResponse.json({
      media: pageData.media || [],
      pageInfo: pageData.pageInfo,
    });
  } catch (error) {
    console.error('Error searching media:', error);
    return NextResponse.json(
      { error: 'Network error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
