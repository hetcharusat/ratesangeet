import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

// Test refresh tokens directly with Spotify
const failingTokens = [
  'AQAjjzGwjrRUGjwAi1vOiI2iJBPnwTr0l_FV1J5qzVvJ8fFr0zQ8fSWmtVEv6fUYP6XvUjSRDiIf4IEgJMPWW6YHJTCp5BrsYLt9pjvYMTSBytowqO-NJUSpXdwW4', // 31avdt2qtmnemk5hpdhcqahlr5ky
];

const workingTokens = [
  'AQCJbHTudwwVBHptzcLrNPaA8fSWmtVEv6fUYP6XvUjSRDiIf4IEgJMPWW6YHJTCp5BrsYLt9pjvYMTSBytowqO-NJUSpXdwW4RGTMgWrhI-vLNuIBJv5d1lXY', // qbgsut4sn1n311rl8d7h4nyt8
];

async function testRefreshToken(refreshToken: string, label: string) {
  console.log(`\n=== Testing ${label} ===`);
  console.log(`Token length: ${refreshToken.length} chars`);
  console.log(`Token starts: ${refreshToken.substring(0, 20)}...`);

  try {
    const response = await axios.post(
      SPOTIFY_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(
            `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
          ).toString('base64')}`,
        },
      }
    );

    console.log('✅ SUCCESS!');
    console.log(`New access token: ${response.data.access_token.substring(0, 20)}...`);
    if (response.data.refresh_token) {
      console.log(`New refresh token: ${response.data.refresh_token.substring(0, 20)}...`);
      console.log(`New refresh token length: ${response.data.refresh_token.length} chars`);
    } else {
      console.log('No new refresh token (using existing one)');
    }
  } catch (error: any) {
    console.log('❌ FAILED!');
    console.log(`Error: ${error.response?.data?.error}`);
    console.log(`Description: ${error.response?.data?.error_description}`);
    console.log(`Full response:`, JSON.stringify(error.response?.data, null, 2));
  }
}

async function main() {
  console.log('🔧 Testing refresh tokens with current Client ID/Secret');
  console.log(`Client ID: ${process.env.SPOTIFY_CLIENT_ID}`);
  console.log(`Client Secret: ${process.env.SPOTIFY_CLIENT_SECRET?.substring(0, 10)}...`);

  // Test one failing token
  await testRefreshToken(failingTokens[0], 'FAILING USER (131 chars)');

  // Test one working token
  await testRefreshToken(workingTokens[0], 'WORKING USER (134 chars)');

  console.log('\n✅ Done');
}

main();
