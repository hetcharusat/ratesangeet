import React, { useMemo, useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme, Text } from 'react-native-paper';
import { CommentCard, Spacer } from './index';
import { layoutTokens } from '../../theme';

export type ThreadComment = {
  id: string;
  parentId?: string | null;
  username: string;
  text: string;
  timestamp: Date;
  depth: number;
  replyCount: number;
  reactions?: { like?: number; heart?: number };
};

type CommentThreadProps = {
  comments: ThreadComment[]; // flat list from API
  maxDepth?: number; // limit render depth
  collapsedByDefaultDepth?: number; // auto collapse replies beyond this depth
  onReply?: (commentId: string) => void;
  loadReplies?: (commentId: string) => Promise<ThreadComment[]>; // lazy load
};

export default function CommentThread({
  comments,
  maxDepth = 6,
  collapsedByDefaultDepth = 2,
  onReply,
  loadReplies,
}: CommentThreadProps) {
  const theme = useTheme();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [loadingReplies, setLoadingReplies] = useState<Record<string, boolean>>({});
  const [dynamicReplies, setDynamicReplies] = useState<Record<string, ThreadComment[]>>({});

  // Build tree structure from flat list
  const tree = useMemo(() => {
    const byParent: Record<string, ThreadComment[]> = {};
    comments.forEach((c) => {
      const key = c.parentId || 'root';
      if (!byParent[key]) byParent[key] = [];
      byParent[key].push(c);
    });
    return byParent;
  }, [comments]);

  const handleToggle = useCallback(
    (id: string) => setCollapsed((prev) => ({ ...prev, [id]: !prev[id] })),
    []
  );

  const handleLoadReplies = useCallback(
    async (commentId: string) => {
      if (!loadReplies) return;
      setLoadingReplies((p) => ({ ...p, [commentId]: true }));
      try {
        const newReplies = await loadReplies(commentId);
        setDynamicReplies((p) => ({ ...p, [commentId]: newReplies }));
        // Ensure expanded
        setCollapsed((p) => ({ ...p, [commentId]: false }));
      } finally {
        setLoadingReplies((p) => ({ ...p, [commentId]: false }));
      }
    },
    [loadReplies]
  );

  const renderBranch = (parentId: string | null, depth: number): React.ReactNode => {
    if (depth > maxDepth) return null;
    const branch = [...(tree[parentId || 'root'] || [])];
    // Append dynamically loaded replies
    if (parentId && dynamicReplies[parentId]) branch.push(...dynamicReplies[parentId]);

    return branch.map((comment) => {
      const isCollapsed = collapsed[comment.id] || (comment.depth >= collapsedByDefaultDepth && !collapsed[comment.id]);
      const hasChildren = (tree[comment.id]?.length || 0) + (dynamicReplies[comment.id]?.length || 0) > 0;
      const canLoadMore = !!loadReplies && comment.replyCount > (tree[comment.id]?.length || 0);

      return (
        <View key={comment.id}>
          <CommentCard
            username={comment.username}
            text={comment.text}
            timestamp={comment.timestamp}
            depth={depth}
            replyCount={comment.replyCount}
            reactions={comment.reactions}
            isCollapsed={isCollapsed}
            onReply={() => onReply && onReply(comment.id)}
            onToggleExpand={() => (canLoadMore ? handleLoadReplies(comment.id) : handleToggle(comment.id))}
          />
          {/* Children */}
          {!isCollapsed && hasChildren && (
            <View>{renderBranch(comment.id, depth + 1)}</View>
          )}
          {/* Load more indicator */}
          {canLoadMore && !loadingReplies[comment.id] && (
            <Text
              variant="labelSmall"
              onPress={() => handleLoadReplies(comment.id)}
              style={{
                color: theme.colors.primary,
                marginLeft: Math.min(depth, 4) * layoutTokens.spacing(2) + layoutTokens.spacing(2),
                marginBottom: layoutTokens.spacing(1),
              }}
            >
              Load more replies ({comment.replyCount - (tree[comment.id]?.length || 0)})
            </Text>
          )}
          {loadingReplies[comment.id] && (
            <Text
              variant="labelSmall"
              style={{
                color: theme.colors.onSurfaceVariant,
                marginLeft: Math.min(depth, 4) * layoutTokens.spacing(2) + layoutTokens.spacing(2),
                marginBottom: layoutTokens.spacing(1),
              }}
            >
              Loading...
            </Text>
          )}
        </View>
      );
    });
  };

  return <View style={styles.container}>{renderBranch(null, 0)}</View>;
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingBottom: layoutTokens.spacing(2),
  },
});
