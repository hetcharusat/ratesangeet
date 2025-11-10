import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Card,
  Avatar,
  Text,
  IconButton,
  Chip,
  Divider,
  List,
  TextInput,
  Button,
  Modal,
  Portal,
} from 'react-native-paper';
import { Review } from '../services/api';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';

// Helper to extract username from userId (string or object)
const getUsername = (userId: Review['userId']): string => {
  if (typeof userId === 'string') return 'User';
  return userId.displayName || 'User';
};

// Helper to extract profile image from userId (string or object)
const getProfileImage = (userId: Review['userId']): string | undefined => {
  if (typeof userId === 'string') return undefined;
  return userId.profileImage;
};

interface Comment {
  _id: string;
  userId: string;
  username?: string;
  text: string;
  parentId?: string | null;
  depth: number;
  replyCount: number;
  reactionsCount?: Record<string, number>;
  reactionsByUser?: Record<string, string>;
  createdAt: string;
  replies?: Comment[];
}

interface ThreadedReviewCardProps {
  review: Review;
  currentUserId?: string;
  onReact?: (reviewId: string, reactionType: string) => void;
  onComment?: (reviewId: string, text: string, parentId?: string) => void;
  onDeleteComment?: (commentId: string) => void;
  onReactToComment?: (commentId: string, reactionType: string) => void;
  comments?: Comment[];
  onLoadComments?: (reviewId: string) => void;
}

const formatTimeAgo = (dateString: string) => {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
  return `${Math.floor(seconds / 2592000)}mo ago`;
};

const CommentThread: React.FC<{
  comment: Comment;
  currentUserId?: string;
  onReply: (commentId: string, text: string) => void;
  onReact: (commentId: string, reactionType: string) => void;
  onDelete?: (commentId: string) => void;
}> = ({ comment, currentUserId, onReply, onReact, onDelete }) => {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showReplies, setShowReplies] = useState(true);

  const handleReply = () => {
    if (replyText.trim()) {
      onReply(comment._id, replyText.trim());
      setReplyText('');
      setShowReplyInput(false);
    }
  };

  const userReaction = comment.reactionsByUser?.[currentUserId || ''];

  return (
    <View style={{ marginLeft: comment.depth * 16 }}>
      <List.Item
        title={comment.username || 'User'}
        description={comment.text}
        left={(props) => <Avatar.Text {...props} size={24} label={(comment.username || 'U')[0].toUpperCase()} />}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 56 }}>
        <Button
          icon={userReaction === 'like' ? 'thumb-up' : 'thumb-up-outline'}
          onPress={() => onReact(comment._id, 'like')}
        >
          {comment.reactionsCount?.like || 0}
        </Button>
        <Button
          icon={userReaction === 'dislike' ? 'thumb-down' : 'thumb-down-outline'}
          onPress={() => onReact(comment._id, 'dislike')}
        >
          {comment.reactionsCount?.dislike || 0}
        </Button>
        <Button onPress={() => setShowReplyInput(!showReplyInput)}>
          Reply
        </Button>
        {currentUserId === comment.userId && onDelete && (
          <Button onPress={() => onDelete(comment._id)} color="red">
            Delete
          </Button>
        )}
      </View>
      {showReplyInput && (
        <View style={{ marginLeft: 56, flexDirection: 'row', alignItems: 'center' }}>
          <TextInput
            style={{ flex: 1 }}
            label="Write a reply..."
            value={replyText}
            onChangeText={setReplyText}
          />
          <Button onPress={handleReply}>Post</Button>
        </View>
      )}
      {comment.replies && comment.replies.length > 0 && (
        <List.Accordion
          title={`${comment.replyCount} ${comment.replyCount === 1 ? 'reply' : 'replies'}`}
          left={(props) => <List.Icon {...props} icon="arrow-down-drop-circle" />}
        >
          {comment.replies.map((reply) => (
            <CommentThread
              key={reply._id}
              comment={reply}
              currentUserId={currentUserId}
              onReply={onReply}
              onReact={onReact}
              onDelete={onDelete}
            />
          ))}
        </List.Accordion>
      )}
    </View>
  );
};


// Main Review Card Component
export const ThreadedReviewCard: React.FC<ThreadedReviewCardProps> = ({
  review,
  currentUserId,
  onReact,
  onComment,
  onDeleteComment,
  onReactToComment,
  comments = [],
  onLoadComments,
}) => {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const navigation = useNavigation<NavigationProp<any>>();

  const username = getUsername(review.userId);
  const profileImage = getProfileImage(review.userId);
  const userReaction = review.userReaction || null;
  const totalCommentCount = comments.length;

  const handleReact = (reactionType: string) => {
    if (onReact) {
      onReact(review._id, userReaction === reactionType ? 'none' : reactionType);
    }
  };

  const handleComment = () => {
    if (commentText.trim() && onComment) {
      onComment(review._id, commentText.trim());
      setCommentText('');
    }
  };

  const handleCommentReply = (commentId: string, text: string) => {
    if (onComment) {
      onComment(review._id, text, commentId);
    }
  };

  const handleOpenComments = () => {
    if (onLoadComments) {
      onLoadComments(review._id);
    }
    setShowComments(!showComments);
  };

  const handleNavigateToItem = () => {
    // Navigation logic remains the same
  };

  const renderStars = () => {
    const stars = '⭐'.repeat(Math.floor(review.rating));
    const hasHalfStar = review.rating % 1 >= 0.5;
    return (
      <Text>
        {stars}
        {hasHalfStar && '½'}
      </Text>
    );
  };

  return (
    <>
      <Card style={{ marginBottom: 16 }}>
        <Card.Title
          title={username}
          subtitle={`reviewed ${review.itemName}`}
          left={(props) =>
            profileImage ? (
              <Avatar.Image {...props} source={{ uri: profileImage }} />
            ) : (
              <Avatar.Text {...props} label={username[0].toUpperCase()} />
            )
          }
          right={(props) => (
            <IconButton {...props} icon="album" onPress={handleNavigateToItem} />
          )}
        />
        <Card.Content>
          <View style={styles.row}>
            <Chip
              icon={review.itemType === 'album' ? 'album' : 'music-note'}
              style={{ marginRight: 8 }}
            >
              {review.itemType}
            </Chip>
            <Text variant="bodyMedium">{review.artistName}</Text>
          </View>
          <View style={styles.row}>
            {renderStars()}
            <Text variant="bodyLarge" style={{ marginLeft: 8 }}>
              {review.rating.toFixed(1)}
            </Text>
          </View>
          {review.reviewText && <Text style={{ marginTop: 8 }}>{review.reviewText}</Text>}
        </Card.Content>
        <Card.Actions>
          <Button
            icon={userReaction === 'like' ? 'thumb-up' : 'thumb-up-outline'}
            onPress={() => handleReact('like')}
          >
            {review.reactionsCount?.['like'] ?? 0}
          </Button>
          <Button
            icon={userReaction === 'dislike' ? 'thumb-down' : 'thumb-down-outline'}
            onPress={() => handleReact('dislike')}
          >
            {review.reactionsCount?.['dislike'] ?? 0}
          </Button>
          <Button icon="comment-outline" onPress={handleOpenComments}>
            {totalCommentCount}
          </Button>
          <View style={{ flex: 1 }} />
          <Text variant="bodySmall">{formatTimeAgo(review.createdAt)}</Text>
        </Card.Actions>
        {showComments && (
          <>
            <Divider />
            <Card.Content>
              <List.Section>
                {comments.map((comment) => (
                  <CommentThread
                    key={comment._id}
                    comment={comment}
                    currentUserId={currentUserId}
                    onReply={handleCommentReply}
                    onReact={onReactToComment!}
                    onDelete={onDeleteComment}
                  />
                ))}
              </List.Section>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                <Avatar.Text size={24} label="Y" style={{ marginRight: 8 }} />
                <TextInput
                  style={{ flex: 1 }}
                  label="Add a comment..."
                  value={commentText}
                  onChangeText={setCommentText}
                />
                <IconButton icon="send" onPress={handleComment} />
              </View>
            </Card.Content>
          </>
        )}
      </Card>
    </>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
});

export default ThreadedReviewCard;
