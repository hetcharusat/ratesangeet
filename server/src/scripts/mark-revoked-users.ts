import mongoose from 'mongoose';
import dotenv from 'dotenv';
import axios from 'axios';
import User from '../models/User.js';

dotenv.config();

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

type TokenStatus = 'active' | 'revoked' | 'inactive';

interface ResultRow {
  _id: any;
  spotifyId: string;
  displayName: string;
  email: string;
  username?: string;
  tokenStatus?: TokenStatus;
  lastTokenError?: string;
}

async function canRefresh(refreshToken: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await axios.post(
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
        timeout: 5000,
      }
    );
    return { ok: true };
  } catch (err: any) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    const code = data?.error || err.message;
    if (status === 400 || status === 401) return { ok: false, error: code };
    console.warn(`  ⚠️ Network/unknown during refresh test: ${code}`);
    return { ok: true }; // treat transient as ok
  }
}

async function run(options: { apply: boolean; limit?: number }) {
  const { apply, limit } = options;
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/spotify-tracker');
  console.log('✅ Connected to MongoDB');

  const query = User.find();
  if (limit) query.limit(limit);

  const users = await query.select('_id spotifyId displayName email username refreshToken tokenStatus lastTokenError').lean();
  console.log(`\n🔎 Scanning ${users.length} users for revoked tokens...\n`);

  let active = 0, revoked = 0, unchanged = 0;
  const updates: Array<{ id: any; from?: TokenStatus; to: TokenStatus; reason?: string }> = [];

  for (let i = 0; i < users.length; i++) {
    const u = users[i] as ResultRow & { refreshToken: string };
    const progress = `[${i + 1}/${users.length}]`;
    process.stdout.write(`${progress} ${u.displayName} (${u.spotifyId}) ... `);
    const test = await canRefresh(u.refreshToken);

    if (test.ok) {
      if (u.tokenStatus !== 'active') {
        updates.push({ id: u._id, from: u.tokenStatus, to: 'active' });
      } else {
        unchanged++;
      }
      active++;
      console.log('✅ active');
    } else {
      revoked++;
      if (u.tokenStatus !== 'revoked') {
        updates.push({ id: u._id, from: u.tokenStatus, to: 'revoked', reason: test.error });
      } else {
        unchanged++;
      }
      console.log(`❌ revoked (${test.error})`);
    }
  }

  console.log('\n—'.repeat(60));
  console.log(`Active: ${active}  •  Revoked: ${revoked}  •  Unchanged: ${unchanged}`);
  console.log(`Pending updates: ${updates.length}`);

  if (!apply) {
    console.log('\n💡 Dry run only. Re-run with --apply to write tokenStatus changes.');
  } else {
    console.log('\n📝 Applying updates...');
    for (const up of updates) {
      await User.updateOne(
        { _id: up.id },
        {
          $set: {
            tokenStatus: up.to,
            lastTokenError: up.reason,
            lastTokenErrorAt: up.to === 'revoked' ? new Date() : undefined,
            lastTokenRefreshAt: up.to === 'active' ? new Date() : undefined,
            consecutiveRefreshFailures: up.to === 'revoked' ? 1 : 0,
          },
        }
      );
    }
    console.log('✅ Updates applied.');
  }

  await mongoose.disconnect();
  console.log('🔌 Disconnected');
}

// CLI
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const limitArg = args.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined;

console.log('🧪 MARK REVOKED USERS (non-destructive)');
console.log('='.repeat(60));
console.log(`Mode: ${apply ? 'APPLY (writes tokenStatus)' : 'DRY RUN (no writes)'}`);
if (limit) console.log(`Limit: ${limit}`);
console.log('='.repeat(60));

run({ apply, limit }).catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
