import { NextRequest, NextResponse } from 'next/server';

const ANILIST_CLIENT_ID = process.env.ANILIST_CLIENT_ID;
const ANILIST_CLIENT_SECRET = process.env.ANILIST_CLIENT_SECRET;
const ANILIST_REDIRECT_URI = process.env.ANILIST_REDIRECT_URI || 'http://localhost:3000/api/anilist/auth/callback';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');
  const storedState = request.cookies.get('anilist_oauth_state')?.value;

  // Get the base URL, replacing 0.0.0.0 with localhost for browser compatibility
  const getBaseUrl = () => {
    const url = new URL(request.url);
    if (url.hostname === '0.0.0.0') {
      url.hostname = 'localhost';
    }
    return url.origin;
  };

  const baseUrl = getBaseUrl();

  if (error) {
    return NextResponse.redirect(
      `${baseUrl}/anilist?error=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${baseUrl}/anilist?error=no_code`
    );
  }

  if (!ANILIST_CLIENT_ID || !ANILIST_CLIENT_SECRET) {
    return NextResponse.redirect(
      `${baseUrl}/anilist?error=config_error`
    );
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://anilist.co/api/v2/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: ANILIST_CLIENT_ID,
        client_secret: ANILIST_CLIENT_SECRET,
        redirect_uri: ANILIST_REDIRECT_URI,
        code: code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error('Token exchange error:', errorData);
      return NextResponse.redirect(
        `${baseUrl}/anilist?error=token_exchange_failed`
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return NextResponse.redirect(
        `${baseUrl}/anilist?error=no_access_token`
      );
    }

    // Get user info to verify token
    const userResponse = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        query: `
          query {
            Viewer {
              id
              name
              avatar {
                large
                medium
              }
            }
          }
        `,
      }),
    });

    if (!userResponse.ok) {
      return NextResponse.redirect(
        `${baseUrl}/anilist?error=user_fetch_failed`
      );
    }

    const userData = await userResponse.json();
    
    if (userData.errors) {
      return NextResponse.redirect(
        `${baseUrl}/anilist?error=user_fetch_failed`
      );
    }

    // Redirect to anilist page with success
    // The token will be stored client-side via a query parameter (we'll handle this in the frontend)
    const redirectUrl = `${baseUrl}/anilist?auth_success=true&token=${encodeURIComponent(accessToken)}`;
    
    const response = NextResponse.redirect(redirectUrl);
    
    // Clear the state cookie
    response.cookies.delete('anilist_oauth_state');
    
    return response;
  } catch (error) {
    console.error('OAuth callback error:', error);
    const baseUrl = (() => {
      const url = new URL(request.url);
      if (url.hostname === '0.0.0.0') {
        url.hostname = 'localhost';
      }
      return url.origin;
    })();
    return NextResponse.redirect(
      `${baseUrl}/anilist?error=oauth_error`
    );
  }
}
