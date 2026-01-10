import { NextRequest, NextResponse } from 'next/server';

const ANILIST_API_URL = 'https://graphql.anilist.co';

const GET_MEDIA_BY_ID = `
  query GetMediaById($id: Int!) {
    Media(id: $id) {
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
  }
`;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mediaId = searchParams.get('id');

  if (!mediaId) {
    return NextResponse.json(
      { error: 'Media ID is required' },
      { status: 400 }
    );
  }

  try {
    const variables = {
      id: parseInt(mediaId, 10),
    };

    const requestBody = {
      query: GET_MEDIA_BY_ID,
      variables,
    };

    const response = await fetch(ANILIST_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`[media API] AniList API returned HTTP ${response.status}:`, responseText);
      return NextResponse.json(
        { error: `HTTP Error: ${response.status}`, details: responseText },
        { status: response.status }
      );
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('[media API] Failed to parse response as JSON:', e);
      return NextResponse.json(
        { error: 'Invalid JSON response', details: responseText },
        { status: 500 }
      );
    }

    if (data.errors) {
      console.error('[media API] AniList API errors:', JSON.stringify(data.errors, null, 2));
      return NextResponse.json(
        { error: 'API error', details: data.errors },
        { status: 400 }
      );
    }

    const media = data.data?.Media;
    if (!media) {
      return NextResponse.json(
        { error: 'Media not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(media);
  } catch (error) {
    console.error('Error fetching media:', error);
    return NextResponse.json(
      { error: 'Network error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
