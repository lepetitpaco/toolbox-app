import { NextRequest, NextResponse } from 'next/server';

const ANILIST_CLIENT_ID = process.env.ANILIST_CLIENT_ID;
const ANILIST_REDIRECT_URI = process.env.ANILIST_REDIRECT_URI || 'http://localhost:3000/api/anilist/auth/callback';

export async function GET(request: NextRequest) {
  if (!ANILIST_CLIENT_ID) {
    console.error('ANILIST_CLIENT_ID is not set in environment variables');
    return NextResponse.json(
      { 
        error: 'AniList Client ID not configured',
        message: 'Please configure ANILIST_CLIENT_ID in your .env file. See README.md for instructions.'
      },
      { status: 500 }
    );
  }

  const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  
  // Store state in a cookie for verification
  const response = NextResponse.redirect(
    `https://anilist.co/api/v2/oauth/authorize?client_id=${ANILIST_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(ANILIST_REDIRECT_URI)}`
  );
  
  response.cookies.set('anilist_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
  });

  return response;
}
