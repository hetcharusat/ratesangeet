# Threaded Review System - Implementation Guide

## Overview
A comprehensive, Reddit-style threaded review and comment system with emoji reactions, infinite nesting, and mobile-responsive UI.

## Features
- ✅ **Compact Review Cards** - Shows user, item (album/track), rating, and review text
- ✅ **Single-Select Emoji Reactions** - 5 reaction types (🔥 Fire, ❤️ Love, 👏 Clap, 🤔 Think, 😢 Emotional)
- ✅ **Infinite Thread Nesting** - Comments can be replied to infinitely
- ✅ **Collapsible Threads** - Hide/show nested replies
- ✅ **Visual Thread Lines** - Clear visual hierarchy
- ✅ **Mobile & Web Responsive** - Works on all screen sizes
- ✅ **Real-time Updates** - Reactions and comments update immediately

## Architecture

### Backend (Node.js + MongoDB)

#### Models

**Review Model** (`server/src/models/Review.ts`)
```typescript
{
  userId: ObjectId,
  itemType: 'track' | 'album',
  spotifyId: string,
  itemName: string,
  artistName: string,
  albumArt?: string,
  rating: number, // 0.5-5.0 scale
  reviewText?: string,
  isPublic: boolean,
  reactionsCount: Map<string, number>, // { fire: 5, heart: 3 }
  reactionsByUser: Map<string, string>, // { userId: 'fire' }
  createdAt: Date
}
```

**ReviewComment Model** (`server/src/models/ReviewComment.ts`)
```typescript
{
  reviewId: ObjectId,
  userId: ObjectId,
  username: string, // Denormalized
  text: string,
  parentId?: ObjectId, // null for top-level
  depth: number, // 0 = top-level, 1+ = nested
  replyCount: number,
  reactionsCount: Map<string, number>,
  reactionsByUser: Map<string, string>,
  createdAt: Date
}
```

#### API Routes (`server/src/routes/comments.ts`)

```
GET    /api/comments/:reviewId          → Get all comments (threaded)
POST   /api/comments                    → Post a comment/reply
POST   /api/comments/:commentId/react   → React to a comment
DELETE /api/comments/:commentId         → Delete comment (cascade)
POST   /api/comments/reviews/:reviewId/react → React to a review
```

### Frontend (React Native)

#### Component Usage

```tsx
import { ThreadedReviewCard } from '../components/ThreadedReviewCard';
import { getReviewComments, reactToReview, addReviewComment } from '../services/api';

const MyScreen = () => {
  const [comments, setComments] = useState([]);
  const { user } = useAuth();

  const loadComments = async (reviewId: string) => {
    const data = await getReviewComments(reviewId);
    setComments(data);
  };

  const handleReact = async (reviewId: string, reactionType: string) => {
    await reactToReview(reviewId, user.id, reactionType);
    // Refresh review data
  };

  const handleComment = async (reviewId: string, text: string, parentId?: string) => {
    await addReviewComment(reviewId, user.id, text, parentId);
    await loadComments(reviewId); // Refresh comments
  };

  return (
    <ThreadedReviewCard
      review={review}
      currentUserId={user?.id}
      comments={comments}
      onReact={handleReact}
      onComment={handleComment}
      onLoadComments={loadComments}
    />
  );
};
```

## UI Components

### ThreadedReviewCard
Main review card component with reactions and comment display.

**Props:**
- `review`: Review object
- `currentUserId`: Logged-in user ID
- `comments`: Array of threaded comments
- `onReact`: Callback for review reactions
- `onComment`: Callback for adding comments
- `onLoadComments`: Callback to load comments

### CommentThread
Recursive component for displaying nested comment threads.

**Props:**
- `comment`: Comment object with replies
- `depth`: Current nesting level (0 = top)
- `maxDepth`: Maximum indentation depth (default: 5)
- `currentUserId`: Logged-in user ID
- `onReply`: Callback for replying to comment
- `onReact`: Callback for reacting to comment

## Styling

The component uses a minimalist design with:
- **Compact spacing** - Efficient use of screen space
- **Clear typography** - Sans-serif with proper hierarchy
- **Thread lines** - Visual vertical lines for nested threads
- **Badge system** - Color-coded album/track badges
- **Rounded corners** - Modern, friendly appearance

## Reaction System

**5 Reaction Types:**
1. 🔥 **Fire** - "This is hot!" / Trending
2. ❤️ **Heart** - Love it
3. 👏 **Clap** - Applause / Great review
4. 🤔 **Think** - Thought-provoking
5. 😢 **Cry** - Emotional / Moving

**Single-Select Behavior:**
- User can only have ONE reaction at a time
- Clicking same reaction removes it (toggle off)
- Clicking different reaction switches to new one
- Backend auto-updates counts

## Comment Threading

**Thread Depth Management:**
- Depth 0: Top-level comment
- Depth 1+: Nested replies
- Visual indent increases by 12px per level (max 60px)
- Vertical thread line shows hierarchy

**Collapse/Expand:**
- Comments with replies show collapse button
- Button displays reply count
- Collapsing hides all nested replies

## Data Flow

### Adding a Comment
```
User clicks "Comment" → Modal opens → User types → Post
  ↓
POST /api/comments { reviewId, userId, text, parentId }
  ↓
Server: Calculate depth, increment parent replyCount
  ↓
Return new comment → Refresh comments tree → Update UI
```

### Reacting to Review
```
User clicks reaction emoji → Previous reaction removed
  ↓
POST /api/comments/reviews/:reviewId/react { userId, reactionType }
  ↓
Server: Single-select logic (remove old, add new OR toggle off)
  ↓
Return updated review → Update UI counts
```

## Performance Optimizations

1. **Denormalized Username** - Stored in comments for fast display
2. **Indexed Queries** - MongoDB indexes on reviewId, parentId
3. **Lazy Loading** - Comments load on demand (expandable)
4. **Map-based Reactions** - Fast lookup for user reactions
5. **Batch Updates** - Reply counts updated atomically

## Best Practices

### Creating Reviews
```typescript
const review = {
  itemType: 'album',
  spotifyId: '3pLdWdkj83EYfDN6H2N8MR',
  itemName: 'Thriller',
  artistName: 'Michael Jackson',
  albumArt: 'https://...',
  rating: 4.5,
  reviewText: 'A masterpiece!',
  isPublic: true,
};
```

### Handling Reactions
```typescript
// Always pass userId for auth
await reactToReview(reviewId, user.id, 'fire');

// Check current user reaction
const userReaction = review.reactionsByUser?.[user.id];
```

### Building Comment Tree
```typescript
// Backend does this automatically
// Returns: [{ comment, replies: [{ comment, replies: [...] }] }]
```

## Mobile Considerations

1. **Touch Targets** - Minimum 44x44pt tap areas
2. **Keyboard Handling** - Auto-scroll when keyboard opens
3. **Modal Sheets** - Bottom sheets for comment input
4. **Pull-to-Refresh** - Standard mobile gesture support
5. **Haptic Feedback** - On reactions and post actions

## Testing

```bash
# Backend
cd server
npm run dev

# Test endpoints
curl http://localhost:5000/api/comments/:reviewId
curl -X POST http://localhost:5000/api/comments \
  -H "Content-Type: application/json" \
  -d '{"reviewId": "...", "userId": "...", "text": "Great review!"}'
```

## Future Enhancements

- [ ] Markdown support in comments
- [ ] @mentions for users
- [ ] Image/GIF support in comments
- [ ] Comment edit history
- [ ] Mod tools (pin, lock, delete)
- [ ] Notification system for replies
- [ ] "Sort by" options (hot, new, top)
- [ ] Load more pagination for huge threads

## Troubleshooting

**Comments not loading?**
- Check `onLoadComments` is called
- Verify reviewId is correct
- Check network tab for 404/500 errors

**Reactions not updating?**
- Ensure userId matches logged-in user
- Check reactionType is valid (fire, heart, clap, think, cry)
- Verify backend is updating Maps correctly

**Thread depth not showing?**
- Backend calculates depth on comment creation
- Re-run comment creation if parentId was wrong
- Check `depth` field in MongoDB

## License
This implementation follows the project's existing license.
