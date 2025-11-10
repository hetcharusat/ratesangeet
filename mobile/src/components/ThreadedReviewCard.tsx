import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Image,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Colors from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';
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

const truncateUsername = (username: string, maxLength = 12) => {
  if (username.length <= maxLength) return username;
  return username.substring(0, maxLength) + '...';
};

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

// Helper: Count total comments including nested replies
const getTotalCommentCount = (comments: Comment[]): number => {
  let count = 0;
  for (const comment of comments) {
    count += 1; // Count this comment
    if (comment.replies && comment.replies.length > 0) {
      count += getTotalCommentCount(comment.replies); // Recursively count replies
    }
  }
  return count;
};

// Nested Comment Thread Component
const CommentThread: React.FC<{
  comment: Comment;
  depth: number;
  maxDepth?: number;
  currentUserId?: string;
  onReply: (commentId: string, text: string) => void;
  onReact: (commentId: string, reactionType: string) => void;
  onDelete?: (commentId: string) => void;
}> = ({ comment, depth, maxDepth = 2, currentUserId, onReply, onReact, onDelete }) => {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showReplies, setShowReplies] = useState(true);
  const [showThreadModal, setShowThreadModal] = useState(false);  // Modal for deep threads

  const indentSize = Math.min(depth, maxDepth) * 10;  // Reduced from 12px to 10px for tighter spacing
  const isNested = depth > 0;
  const isMaxDepth = depth >= maxDepth;
  const hasReplies = comment.replies && comment.replies.length > 0;

  // Color hierarchy based on depth
  const getDepthColor = (depth: number) => {
    const colors = [
      Colors.surface,      // depth 0 - darkest
      '#2A2A2A',          // depth 1 - slightly lighter
      '#323232',          // depth 2 - even lighter
      '#3A3A3A',          // depth 3+ - lightest
    ];
    return colors[Math.min(depth, colors.length - 1)];
  };

  const depthBackgroundColor = getDepthColor(depth);

  const handleReply = () => {
    if (replyText.trim()) {
      onReply(comment._id, replyText.trim());
      setReplyText('');
      setShowReplyInput(false);
    }
  };

  const handleReact = (reactionType: string) => {
    // Toggle logic: if already reacted with this type, remove it by sending 'none'
    if (userReaction === reactionType) {
      onReact(comment._id, 'none');
    } else {
      onReact(comment._id, reactionType);
    }
  };

  const userReaction = comment.reactionsByUser?.[currentUserId || ''];

  // Initialize counts with defaults
  const likeCount = comment.reactionsCount?.['like'] ?? 0;
  const dislikeCount = comment.reactionsCount?.['dislike'] ?? 0;
  const totalReactions = likeCount + dislikeCount;
  const totalRepliesCount = getTotalCommentCount(comment.replies || []);

  // If at max depth and has replies, show "Continue thread" button that opens modal
  if (isMaxDepth && hasReplies && !showThreadModal) {
    return (
      <View style={[styles.commentWrapper, { paddingLeft: indentSize }]}>
        <TouchableOpacity
          style={styles.continueThreadButton}
          onPress={() => setShowThreadModal(true)}
        >
          <Ionicons name="arrow-redo" size={18} color={Colors.primary} />
          <Text style={styles.continueThreadText}>
            View {totalRepliesCount} more {totalRepliesCount === 1 ? 'reply' : 'replies'}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.commentWrapper, { paddingLeft: indentSize }]}>
      {/* Vertical thread line for nested comments */}
      {isNested && <View style={styles.threadLine} />}

      <View style={[styles.commentContainer, { backgroundColor: depthBackgroundColor }]}>
        <View style={styles.commentHeader}>
          <View style={styles.commentAuthor}>
            <View style={styles.avatarSmall}>
              <Text style={styles.avatarText}>
                {(comment.username || 'U')[0].toUpperCase()}
              </Text>
            </View>
            <View style={styles.commentMeta}>
              <Text style={styles.usernameText}>
                {truncateUsername(comment.username || 'User', 15)}
              </Text>
              <Text style={styles.commentTime}>{formatTimeAgo(comment.createdAt)}</Text>
            </View>
          </View>

          {/* Collapse/Expand thread button */}
          {comment.replyCount > 0 && (
            <TouchableOpacity
              onPress={() => setShowReplies(!showReplies)}
              style={styles.collapseButton}
            >
              <Ionicons
                name={showReplies ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={Colors.textSecondary}
              />
              <Text style={styles.replyCountText}>{comment.replyCount}</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.commentText}>{comment.text}</Text>

        {/* Actions: Like/Dislike + Reply + Delete */}
        <View style={styles.commentActions}>
        {/* Combined Like/Dislike (YouTube Style) */}
        <View style={styles.likeDislikeContainerSmall}>
          <TouchableOpacity
            onPress={() => handleReact('like')}
            style={styles.likeButtonSmall}
          >
            <Ionicons
              name={userReaction === 'like' ? 'thumbs-up' : 'thumbs-up-outline'}
              size={16}
              color={userReaction === 'like' ? Colors.primary : Colors.textSecondary}
            />
            <Text style={[styles.reactionCountSmall, userReaction === 'like' && { color: Colors.primary }]}>
              {likeCount}
            </Text>
          </TouchableOpacity>

          <View style={styles.reactionDividerSmall} />

          <TouchableOpacity
            onPress={() => handleReact('dislike')}
            style={styles.dislikeButtonSmall}
          >
            <Ionicons
              name={userReaction === 'dislike' ? 'thumbs-down' : 'thumbs-down-outline'}
              size={16}
              color={userReaction === 'dislike' ? '#FF6B6B' : Colors.textSecondary}
            />
            {dislikeCount > 0 && (
              <Text style={[styles.reactionCountSmall, userReaction === 'dislike' && { color: '#FF6B6B' }]}>
                {dislikeCount}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Reply Button */}
        <TouchableOpacity
          onPress={() => setShowReplyInput(!showReplyInput)}
          style={styles.replyButton}
        >
          <Ionicons name="chatbubble-outline" size={18} color={Colors.textSecondary} />
          <Text style={styles.actionText}>Reply</Text>
        </TouchableOpacity>

        <View style={styles.spacer} />

        {/* Delete Button (only show for comment owner) */}
        {currentUserId === comment.userId && onDelete && (
          <TouchableOpacity
            onPress={() => {
              // Use platform-specific confirmation
              if (Platform.OS === 'web') {
                const confirmed = window.confirm('Are you sure you want to delete this comment? This cannot be undone.');
                if (confirmed) {
                  onDelete(comment._id);
                }
              } else {
                Alert.alert(
                  'Delete Comment',
                  'Are you sure you want to delete this comment? This cannot be undone.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => onDelete(comment._id)
                    }
                  ]
                );
              }
            }}
            style={styles.deleteButton}
          >
            <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
          </TouchableOpacity>
        )}
      </View>

      {/* Reply Input */}
      {showReplyInput && (
        <View style={styles.replyInputContainer}>
          <TextInput
            style={styles.replyInput}
            placeholder="Write a reply..."
            placeholderTextColor={Colors.textSecondary}
            value={replyText}
            onChangeText={setReplyText}
            multiline
            maxLength={500}
          />
          <View style={styles.replyActions}>
            <TouchableOpacity onPress={() => setShowReplyInput(false)}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleReply}
              disabled={!replyText.trim()}
              style={[styles.postButton, !replyText.trim() && styles.postButtonDisabled]}
            >
              <Text style={styles.postButtonText}>Post</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Nested Replies - Don't render if we're at max depth (will show in modal instead) */}
      {showReplies && hasReplies && !isMaxDepth && (
        <View style={styles.repliesContainer}>
          {comment.replies!.map((reply) => (
            <CommentThread
              key={reply._id}
              comment={reply}
              depth={depth + 1}
              maxDepth={maxDepth}
              currentUserId={currentUserId}
              onReply={onReply}
              onReact={onReact}
              onDelete={onDelete}
            />
          ))}
        </View>
      )}
      </View>

      {/* Deep Thread Modal - Opens when "Continue thread" is clicked */}
      <Modal
        visible={showThreadModal}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setShowThreadModal(false)}
      >
        <View style={styles.threadModalContainer}>
          {/* Modal Header */}
          <View style={styles.threadModalHeader}>
            <TouchableOpacity
              onPress={() => setShowThreadModal(false)}
              style={styles.threadModalBackButton}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
              <Text style={styles.threadModalBackText}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.threadModalTitle}>Thread</Text>
            <View style={{ width: 80 }} />
          </View>

          {/* Modal Content - Show parent comment + all nested replies */}
          <ScrollView style={styles.threadModalContent}>
            {/* Parent Comment (current comment, no indent) */}
            <View style={styles.threadModalParentComment}>
              <View style={styles.commentHeader}>
                <View style={styles.commentAuthor}>
                  <View style={styles.avatarSmall}>
                    <Text style={styles.avatarText}>
                      {(comment.username || 'U')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.commentMeta}>
                    <Text style={styles.usernameText}>
                      {truncateUsername(comment.username || 'User', 15)}
                    </Text>
                    <Text style={styles.commentTime}>{formatTimeAgo(comment.createdAt)}</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.commentText}>{comment.text}</Text>

              {/* Parent Comment Actions */}
              <View style={styles.commentActions}>
                <View style={styles.likeDislikeContainerSmall}>
                  <TouchableOpacity
                    onPress={() => handleReact('like')}
                    style={styles.likeButtonSmall}
                  >
                    <Ionicons
                      name={userReaction === 'like' ? 'thumbs-up' : 'thumbs-up-outline'}
                      size={16}
                      color={userReaction === 'like' ? Colors.primary : Colors.textSecondary}
                    />
                    <Text style={[styles.reactionCountSmall, userReaction === 'like' && { color: Colors.primary }]}>
                      {likeCount}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.reactionDividerSmall} />

                  <TouchableOpacity
                    onPress={() => handleReact('dislike')}
                    style={styles.dislikeButtonSmall}
                  >
                    <Ionicons
                      name={userReaction === 'dislike' ? 'thumbs-down' : 'thumbs-down-outline'}
                      size={16}
                      color={userReaction === 'dislike' ? '#FF6B6B' : Colors.textSecondary}
                    />
                    <Text style={[styles.reactionCountSmall, userReaction === 'dislike' && { color: '#FF6B6B' }]}>
                      {dislikeCount}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Separator */}
            <View style={styles.threadModalSeparator} />

            {/* All Nested Replies (start fresh from depth 0 in modal) */}
            <View style={styles.threadModalRepliesSection}>
              <Text style={styles.threadModalRepliesHeader}>
                {totalRepliesCount} {totalRepliesCount === 1 ? 'Reply' : 'Replies'}
              </Text>
              {comment.replies!.map((reply) => (
                <CommentThread
                  key={reply._id}
                  comment={reply}
                  depth={0}  // Start fresh from 0 in modal
                  maxDepth={maxDepth}  // Same maxDepth rules apply
                  currentUserId={currentUserId}
                  onReply={onReply}
                  onReact={onReact}
                  onDelete={onDelete}
                />
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>
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
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [showReactionUsersModal, setShowReactionUsersModal] = useState(false);
  const [reactionUsersType, setReactionUsersType] = useState<'like' | 'dislike'>('like');
  const [reactionUsers, setReactionUsers] = useState<any[]>([]);
  const [loadingReactionUsers, setLoadingReactionUsers] = useState(false);
  const navigation = useNavigation<NavigationProp<any>>();

  const username = getUsername(review.userId);
  const userReaction = review.userReaction || null;
  const totalReactions = Object.values(review.reactionsCount || {}).reduce((a, b) => a + b, 0);
  const totalCommentCount = getTotalCommentCount(comments);

  const handleReact = (reactionType: string) => {
    if (onReact) {
      // Toggle logic: if already reacted with this type, remove it by sending 'none'
      if (userReaction === reactionType) {
        onReact(review._id, 'none');
      } else {
        onReact(review._id, reactionType);
      }
    }
  };

  // Handle long press on like/dislike buttons to show users
  const handleLongPress = async (reactionType: 'like' | 'dislike') => {
    setReactionUsersType(reactionType);
    setShowReactionUsersModal(true);
    setLoadingReactionUsers(true);

    try {
      const { getReviewReactionUsers } = await import('../services/api');
      const users = await getReviewReactionUsers(review._id, reactionType);
      setReactionUsers(users);
    } catch (error) {
      console.error('Error loading reaction users:', error);
      setReactionUsers([]);
    } finally {
      setLoadingReactionUsers(false);
    }
  };

  const handleComment = () => {
    if (commentText.trim() && onComment) {
      onComment(review._id, commentText.trim());
      setCommentText('');
      // Keep modal open to see the new comment
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
    setShowCommentsModal(true);
  };

  const handleNavigateToItem = () => {
    if (review.itemType === 'album') {
      navigation.navigate('AlbumDetail', {
        albumId: review.spotifyId,
        albumName: review.itemName,
        artistName: review.artistName,
        albumArt: review.albumArt,
      });
    } else {
      // Navigate to track detail (we'll create this)
      navigation.navigate('AddReview', {
        itemType: 'track',
        track: {
          id: review.spotifyId,
          name: review.itemName,
          artists: [{ name: review.artistName }],
          album: {
            images: review.albumArt ? [{ url: review.albumArt }] : [],
          },
        },
      });
    }
  };

  const stars = '⭐'.repeat(Math.floor(review.rating));
  const hasHalfStar = review.rating % 1 >= 0.5;
  const profileImage = getProfileImage(review.userId);

  return (
    <View style={styles.card}>
      {/* Header: User + Item Info */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {username[0].toUpperCase()}
              </Text>
            )}
          </View>
          <View style={styles.headerText}>
            <Text style={styles.username}>
              {truncateUsername(username)}
            </Text>
            <Text style={styles.reviewMeta}>
              reviewed{' '}
              <TouchableOpacity onPress={handleNavigateToItem}>
                <Text style={[styles.itemName, styles.itemNameClickable]}>
                  {review.itemName}
                </Text>
              </TouchableOpacity>
            </Text>
          </View>
        </View>

        {review.albumArt && (
          <TouchableOpacity onPress={handleNavigateToItem}>
            <Image source={{ uri: review.albumArt }} style={styles.albumArt} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category Badge + Artist Name */}
      <TouchableOpacity onPress={handleNavigateToItem} style={styles.metadata}>
        <View style={[styles.badge, review.itemType === 'album' ? styles.badgeAlbum : styles.badgeTrack]}>
          <Ionicons
            name={review.itemType === 'album' ? 'disc' : 'musical-note'}
            size={12}
            color="#fff"
          />
          <Text style={styles.badgeText}>{review.itemType}</Text>
        </View>
        <Text style={styles.artistName}>{review.artistName}</Text>
      </TouchableOpacity>

      {/* Rating */}
      <View style={styles.ratingRow}>
        <Text style={styles.stars}>{stars}{hasHalfStar && '½'}</Text>
        <Text style={styles.ratingText}>{review.rating.toFixed(1)}</Text>
      </View>

      {/* Review Text */}
      {review.reviewText && (
        <Text style={styles.reviewText} numberOfLines={4}>
          {review.reviewText}
        </Text>
      )}

      {/* Actions: Like/Dislike + Comment */}
      <View style={styles.actions}>
        {/* Combined Like/Dislike (YouTube Style) */}
        <View style={styles.likeDislikeContainer}>
          <TouchableOpacity
            onPress={() => handleReact('like')}
            onLongPress={() => handleLongPress('like')}
            delayLongPress={500}
            style={styles.likeButton}
          >
            <Ionicons
              name={userReaction === 'like' ? 'thumbs-up' : 'thumbs-up-outline'}
              size={20}
              color={userReaction === 'like' ? Colors.primary : Colors.textSecondary}
            />
            <Text style={[styles.reactionCount, userReaction === 'like' && { color: Colors.primary }]}>
              {review.reactionsCount?.['like'] ?? 0}
            </Text>
          </TouchableOpacity>

          <View style={styles.reactionDivider} />

          <TouchableOpacity
            onPress={() => handleReact('dislike')}
            onLongPress={() => handleLongPress('dislike')}
            delayLongPress={500}
            style={styles.dislikeButton}
          >
            <Ionicons
              name={userReaction === 'dislike' ? 'thumbs-down' : 'thumbs-down-outline'}
              size={20}
              color={userReaction === 'dislike' ? '#FF6B6B' : Colors.textSecondary}
            />
            {(review.reactionsCount?.['dislike'] ?? 0) > 0 && (
              <Text style={[styles.reactionCount, userReaction === 'dislike' && { color: '#FF6B6B' }]}>
                {review.reactionsCount?.['dislike']}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Comment Button */}
        <TouchableOpacity
          onPress={handleOpenComments}
          style={styles.commentButton}
        >
          <Ionicons name="chatbubble-outline" size={20} color={Colors.textSecondary} />
          <Text style={styles.actionText}>
            {totalCommentCount > 0 ? `${totalCommentCount}` : 'Comment'}
          </Text>
        </TouchableOpacity>

        <View style={styles.spacer} />

        <Text style={styles.timestamp}>{formatTimeAgo(review.createdAt)}</Text>
      </View>

      {/* Threaded Comments */}
      {showComments && comments.length > 0 && (
        <View style={styles.commentsSection}>
          {comments.map((comment) => (
            <CommentThread
              key={comment._id}
              comment={comment}
              depth={0}
              currentUserId={currentUserId}
              onReply={handleCommentReply}
              onReact={(commentId, type) => {
                console.log('[ThreadedReviewCard] React to comment:', commentId, type);
                if (onReactToComment) {
                  onReactToComment(commentId, type);
                }
              }}
              onDelete={onDeleteComment}
            />
          ))}
        </View>
      )}

      {/* Comments Modal - Full Screen with All Comments */}
      <Modal
        visible={showCommentsModal}
        animationType="slide"
        presentationStyle="formSheet"
        transparent={false}
        onRequestClose={() => setShowCommentsModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.commentsModalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {/* Modal Header */}
          <View style={styles.commentsModalHeader}>
            <TouchableOpacity onPress={() => setShowCommentsModal(false)}>
              <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.commentsModalTitle}>Comments ({comments.length})</Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Review Summary */}
          <View style={styles.reviewSummary}>
            <Text style={styles.reviewSummaryTitle}>{review.itemName}</Text>
            <Text style={styles.reviewSummaryMeta}>
              {stars}{hasHalfStar && '½'} · {review.artistName}
            </Text>
          </View>

          {/* Comments List */}
          <ScrollView style={styles.commentsScrollView}>
            {comments.length === 0 ? (
              <View style={styles.noCommentsContainer}>
                <Text style={styles.noCommentsText}>No comments yet</Text>
                <Text style={styles.noCommentsSubtext}>Be the first to share your thoughts!</Text>
              </View>
            ) : (
              comments.map((comment) => (
                <CommentThread
                  key={comment._id}
                  comment={comment}
                  depth={0}
                  currentUserId={currentUserId}
                  onReply={handleCommentReply}
                  onReact={(commentId, type) => {
                    if (onReactToComment) {
                      onReactToComment(commentId, type);
                    }
                  }}
                  onDelete={onDeleteComment}
                />
              ))
            )}
          </ScrollView>

          {/* Comment Input Fixed at Bottom */}
          <View style={styles.commentInputContainer}>
            <TextInput
              style={styles.commentInput}
              placeholder="Add a comment..."
              placeholderTextColor={Colors.textSecondary}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              onPress={handleComment}
              disabled={!commentText.trim()}
              style={[styles.sendButton, !commentText.trim() && styles.sendButtonDisabled]}
            >
              <Ionicons name="send" size={20} color={commentText.trim() ? Colors.primary : Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Reaction Users Modal */}
      <Modal
        visible={showReactionUsersModal}
        animationType="slide"
        presentationStyle="formSheet"
        transparent={false}
        onRequestClose={() => setShowReactionUsersModal(false)}
      >
        <View style={styles.reactionUsersModal}>
          {/* Header */}
          <View style={styles.reactionUsersHeader}>
            <TouchableOpacity onPress={() => setShowReactionUsersModal(false)}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.reactionUsersTitle}>
              {reactionUsersType === 'like' ? '👍 Likes' : '👎 Dislikes'}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Users List */}
          <ScrollView style={styles.reactionUsersScrollView}>
            {loadingReactionUsers ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
              </View>
            ) : reactionUsers.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  No {reactionUsersType === 'like' ? 'likes' : 'dislikes'} yet
                </Text>
              </View>
            ) : (
              reactionUsers.map((user) => (
                <TouchableOpacity
                  key={user._id}
                  style={styles.userItem}
                  onPress={() => {
                    setShowReactionUsersModal(false);
                    navigation.navigate('Profile', { userId: user._id });
                  }}
                >
                  {user.profileImage ? (
                    <Image source={{ uri: user.profileImage }} style={styles.userAvatar} />
                  ) : (
                    <View style={[styles.userAvatar, styles.userAvatarPlaceholder]}>
                      <Ionicons name="person" size={20} color={Colors.textSecondary} />
                    </View>
                  )}
                  <View style={styles.reactionUserInfo}>
                    <Text style={styles.userName}>{user.displayName}</Text>
                    {user.username && (
                      <Text style={styles.userUsername}>@{user.username}</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 2,
    borderColor: Colors.primaryDark,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.primaryDark,
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  headerText: {
    flex: 1,
  },
  username: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  reviewMeta: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  itemName: {
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  albumArt: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  badgeAlbum: {
    backgroundColor: Colors.primary,
  },
  badgeTrack: {
    backgroundColor: '#10b981',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  parentAlbum: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  albumNameText: {
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  stars: {
    fontSize: 18,
    marginRight: 6,
  },
  ratingText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  reviewText: {
    color: Colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1.5,
    borderTopColor: Colors.borderLight,
  },
  // YouTube-style combined like/dislike container
  likeDislikeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
    marginRight: 12,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingLeft: 14,
    paddingRight: 12,
  },
  dislikeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 14,
  },
  reactionDivider: {
    width: 1.5,
    height: 24,
    backgroundColor: Colors.borderLight,
  },
  reactionCount: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  // Smaller versions for nested comments
  likeDislikeContainerSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border + '80',
    overflow: 'hidden',
    marginRight: 6,
  },
  likeButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingLeft: 8,
    paddingRight: 6,
  },
  dislikeButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingLeft: 6,
    paddingRight: 8,
  },
  reactionDividerSmall: {
    width: 1,
    height: 16,
    backgroundColor: Colors.border + '60',
  },
  reactionCountSmall: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  commentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
  },
  replyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border + '80',
    marginRight: 6,
  },
  deleteButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#FF6B6B15',
    borderWidth: 1,
    borderColor: '#FF6B6B60',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: Colors.background,
  },
  actionButtonActive: {
    backgroundColor: Colors.primary + '20',
  },
  actionIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  actionText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  spacer: {
    flex: 1,
  },
  timestamp: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  reactionPicker: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: Colors.background,
    borderRadius: 8,
    marginTop: 8,
  },
  reactionOption: {
    padding: 8,
    borderRadius: 20,
  },
  reactionOptionActive: {
    backgroundColor: Colors.primary + '20',
  },
  reactionEmoji: {
    fontSize: 24,
  },
  commentsSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1.5,
    borderTopColor: Colors.borderLight,
  },
  // Grid alignment wrappers
  commentWrapper: {
    marginBottom: 8,
    marginRight: 8,
  },
  commentMeta: {
    flexDirection: 'column',
    gap: 2,
  },
  commentContainer: {
    position: 'relative',
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border + '60',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  continueThreadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.primary + '60',
    marginVertical: 6,
  },
  continueThreadText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  threadLine: {
    position: 'absolute',
    left: 20,
    top: 40,
    bottom: 16,
    width: 2,
    backgroundColor: Colors.border + '40',
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  commentAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  usernameText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    marginRight: 6,
  },
  commentTime: {
    color: Colors.textSecondary,
    fontSize: 11,
  },
  collapseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  replyCountText: {
    color: Colors.textPrimary,
    fontSize: 13,
    marginLeft: 6,
    fontWeight: '600',
  },
  commentText: {
    color: Colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  replyInputContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: Colors.background,
    borderRadius: 8,
  },
  replyInput: {
    color: Colors.textPrimary,
    fontSize: 14,
    minHeight: 60,
    maxHeight: 120,
    textAlignVertical: 'top',
  },
  replyActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 12,
  },
  cancelButton: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  postButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  postButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  repliesContainer: {
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    minHeight: 300,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  itemNameClickable: {
    textDecorationLine: 'underline',
  },
  artistName: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginLeft: 8,
  },
  commentsModalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  commentsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface,
  },
  commentsModalTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  reviewSummary: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface,
  },
  reviewSummaryTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  reviewSummaryMeta: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  commentsScrollView: {
    flex: 1,
    padding: 16,
  },
  noCommentsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noCommentsText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  noCommentsSubtext: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    borderTopWidth: 1.5,
    borderTopColor: Colors.borderLight,
    backgroundColor: Colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },
  commentInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 10,
    color: Colors.textPrimary,
    fontSize: 14,
    maxHeight: 100,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
  },
  sendButton: {
    marginLeft: 12,
    padding: 10,
    backgroundColor: Colors.primary + '20',
    borderRadius: 24,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
    backgroundColor: Colors.surface,
  },

  // Deep Thread Modal Styles
  threadModalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  threadModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  threadModalBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
  },
  threadModalBackText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  threadModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  threadModalContent: {
    flex: 1,
  },
  threadModalParentComment: {
    padding: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  threadModalSeparator: {
    height: 8,
    backgroundColor: Colors.background,
  },
  threadModalRepliesSection: {
    padding: 16,
  },
  threadModalRepliesHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 0.5,
  },

  // Reaction Users Modal Styles
  reactionUsersModal: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  reactionUsersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface,
  },
  reactionUsersTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  reactionUsersScrollView: {
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  userAvatarPlaceholder: {
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionUserInfo: {
    flex: 1,
  },
  userName: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  userUsername: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
});

export default ThreadedReviewCard;
