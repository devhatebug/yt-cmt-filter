// composables/useYouTubeData.ts
import { useRuntimeConfig } from "nuxt/app";
import type { YouTubeComment, VideoData } from "../types/comment";
import { estimateCommentRange } from "../utils/format";

interface YouTubeApiVideoResponse {
  items: Array<{
    snippet: {
      title: string;
    };
    statistics: {
      commentCount?: string;
    };
  }>;
}

interface YouTubeApiCommentThreadResponse {
  items: Array<{
    id: string;
    snippet: {
      totalReplyCount: number;
      topLevelComment: {
        snippet: {
          publishedAt: string;
          authorDisplayName: string;
          textDisplay: string;
          likeCount: number;
        };
      };
    };
  }>;
  nextPageToken?: string;
}

interface YouTubeApiCommentResponse {
  items: Array<{
    id: string;
    snippet: {
      publishedAt: string;
      authorDisplayName: string;
      textDisplay: string;
      likeCount: number;
    };
  }>;
  nextPageToken?: string;
}

export const useYouTubeData = () => {
  const config = useRuntimeConfig();
  const apiKey = config.public.youtubeApiKey;

  // Lấy video ID từ URL
  const extractVideoId = (url: string): string | null => {
    const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  // Lấy thông tin video
  const getVideoDetails = async (videoId: string) => {
    try {
      const response = await $fetch<YouTubeApiVideoResponse>(
        `https://www.googleapis.com/youtube/v3/videos`,
        {
          params: {
            id: videoId,
            key: apiKey,
            part: "snippet,statistics",
          },
        }
      );

      if (!response.items || response.items.length === 0) {
        throw new Error("Video không tồn tại hoặc bị hạn chế");
      }

      const video = response.items[0];
      return {
        title: video?.snippet.title,
        commentCount: parseInt(video?.statistics.commentCount || "0"),
      };
    } catch (error: unknown) {
      const err = error as { response?: { status?: number } };
      if (err.response?.status === 403) {
        throw new Error("API Key không hợp lệ hoặc đã hết quota");
      }
      throw new Error(
        "Không thể lấy thông tin video: " + (error as Error).message
      );
    }
  };

  // Helper: Retry với exponential backoff
  const fetchWithRetry = async <T>(
    fetchFn: () => Promise<T>,
    maxRetries = 3,
    initialDelay = 1000
  ): Promise<T> => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fetchFn();
      } catch (error) {
        lastError = error as Error;
        const delay = initialDelay * Math.pow(2, attempt); // Exponential backoff

        console.warn(
          `Retry ${attempt + 1}/${maxRetries} sau ${delay}ms...`,
          error
        );

        // Chờ trước khi retry
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error("Failed after retries");
  };

  // Lấy replies cho một comment cha
  const getReplies = async (parentId: string): Promise<YouTubeComment[]> => {
    const replies: YouTubeComment[] = [];
    let pageToken: string | undefined = undefined;

    do {
      const response = await fetchWithRetry(() =>
        $fetch<YouTubeApiCommentResponse>(
          "https://www.googleapis.com/youtube/v3/comments",
          {
            params: {
              parentId,
              key: apiKey,
              part: "snippet",
              maxResults: 100,
              pageToken,
            },
          }
        )
      );

      if (response.items) {
        response.items.forEach((item) => {
          const snippet = item.snippet;
          replies.push({
            id: item.id,
            date: new Date(snippet.publishedAt),
            author: snippet.authorDisplayName,
            content: snippet.textDisplay,
            likeCount: snippet.likeCount || 0,
            replyCount: 0, // replies không có replies con
            replies: [],
          });
        });
      }

      pageToken = response.nextPageToken;
    } while (pageToken);

    return replies;
  };

  // Lấy comments cha + replies (nếu có) - OPTIMIZED O(n)
  const getComments = async (
    videoId: string,
    maxResults = 100,
    onProgress?: (current: number, total: number) => void
  ): Promise<YouTubeComment[]> => {
    const comments: YouTubeComment[] = [];
    let pageToken: string | undefined = undefined;
    let pageCount = 0;
    const BATCH_SIZE = 10; // Fetch 10 replies cùng lúc

    // Dedupe tracking - O(1) lookup
    const seenIds = new Set<string>();
    const seenContents = new Set<string>();
    let duplicateCount = 0;

    try {
      // Phase 1: Fetch tất cả comment cha (parent comments)
      do {
        pageCount++;
        const response = await $fetch<YouTubeApiCommentThreadResponse>(
          `https://www.googleapis.com/youtube/v3/commentThreads`,
          {
            params: {
              videoId,
              key: apiKey,
              part: "snippet",
              maxResults,
              pageToken,
              order: "time",
            },
          }
        );

        if (response.items) {
          for (const item of response.items) {
            const snippet = item.snippet.topLevelComment.snippet;
            const commentId = item.id;
            const commentContent = snippet.textDisplay.trim();

            // Kiểm tra trùng lặp ID hoặc content
            if (seenIds.has(commentId) || seenContents.has(commentContent)) {
              duplicateCount++;
              continue;
            }

            // kiểm tra comment không phải là tiếng anh ( chỉ chấp nhận comment bằng tiếng việt)
            const vietnameseRegex =
              /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

            if (!vietnameseRegex.test(commentContent)) {
              console.log(
                "Bỏ qua comment không có dấu tiếng Việt:",
                commentContent
              );
              continue;
            }

            // Thêm vào tracking sets
            seenIds.add(commentId);
            seenContents.add(commentContent);

            const topComment: YouTubeComment = {
              id: commentId,
              date: new Date(snippet.publishedAt),
              author: snippet.authorDisplayName,
              content: snippet.textDisplay,
              likeCount: snippet.likeCount || 0,
              replyCount: item.snippet.totalReplyCount || 0,
              replies: [],
            };

            comments.push(topComment);
          }
        }

        pageToken = response.nextPageToken;

        // Log progress
        console.log(
          `Đã tải ${comments.length} comment cha (page ${pageCount})...`
        );

        // Update progress sau mỗi page
        if (onProgress) {
          onProgress(comments.length, -1);
        }
      } while (pageToken);

      console.log(
        `✓ Hoàn thành fetch ${comments.length} comment cha. Bắt đầu fetch replies...`
      );

      if (duplicateCount > 0) {
        console.log(`⚠ Đã bỏ qua ${duplicateCount} comment cha trùng lặp`);
      }

      // Phase 2: Batch fetch replies song song - O(n/BATCH_SIZE) thay vì O(n)
      const commentsWithReplies = comments.filter((c) => c.replyCount > 0);
      console.log(
        `→ Cần fetch replies cho ${commentsWithReplies.length} comments`
      );

      let replyDuplicateCount = 0;

      // Chia thành batches để tránh quá tải API
      for (let i = 0; i < commentsWithReplies.length; i += BATCH_SIZE) {
        const batch = commentsWithReplies.slice(i, i + BATCH_SIZE);

        // Fetch parallel trong batch
        const repliesPromises = batch.map((comment) =>
          getReplies(comment.id)
            .then((replies) => {
              // Dedupe replies
              const uniqueReplies: YouTubeComment[] = [];
              const replySeenIds = new Set<string>();
              const replySeenContents = new Set<string>();

              replies.forEach((reply) => {
                const replyContent = reply.content.trim();

                if (
                  !replySeenIds.has(reply.id) &&
                  !replySeenContents.has(replyContent)
                ) {
                  replySeenIds.add(reply.id);
                  replySeenContents.add(replyContent);
                  uniqueReplies.push(reply);
                } else {
                  replyDuplicateCount++;
                }
              });

              comment.replies = uniqueReplies;
              return comment;
            })
            .catch((error) => {
              console.error(
                `Lỗi khi fetch replies cho comment ${comment.id}:`,
                error
              );
              return comment; // Giữ comment, bỏ qua replies lỗi
            })
        );

        await Promise.all(repliesPromises);

        // Update progress
        const processed = Math.min(i + BATCH_SIZE, commentsWithReplies.length);
        console.log(
          `→ Đã fetch replies: ${processed}/${commentsWithReplies.length}`
        );

        if (onProgress) {
          onProgress(comments.length, -1);
        }
      }

      if (replyDuplicateCount > 0) {
        console.log(`⚠ Đã bỏ qua ${replyDuplicateCount} reply trùng lặp`);
      }

      console.log(
        `✓ Hoàn thành! Tổng cộng ${comments.length} comments (đã loại bỏ ${
          duplicateCount + replyDuplicateCount
        } trùng lặp)`
      );
      return comments;
    } catch (error: unknown) {
      const err = error as {
        response?: {
          status?: number;
          _data?: {
            error?: {
              errors?: Array<{ reason?: string }>;
            };
          };
        };
      };
      if (err.response?.status === 403) {
        if (
          err.response._data?.error?.errors?.[0]?.reason === "commentsDisabled"
        ) {
          throw new Error("Video này đã tắt bình luận");
        }
        throw new Error("API Key không hợp lệ hoặc đã hết quota");
      }
      throw new Error("Không thể lấy bình luận: " + (error as Error).message);
    }
  };

  // Fetch tất cả dữ liệu
  const fetchVideoData = async (
    url: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<{
    videoData: VideoData;
    comments: YouTubeComment[];
  }> => {
    const videoId = extractVideoId(url);
    if (!videoId) {
      throw new Error("URL YouTube không hợp lệ");
    }

    const videoDetails = await getVideoDetails(videoId);

    // Truyền callback progress với total từ video details
    const comments = await getComments(videoId, 100, (current) => {
      if (onProgress) {
        onProgress(current, videoDetails.commentCount);
      }
    });

    const videoData: VideoData = {
      videoId,
      title: videoDetails.title || "Untitled",
      url,
      totalComments: videoDetails.commentCount,
      estimatedRange: estimateCommentRange(videoDetails.commentCount),
    };

    return {
      videoData,
      comments,
    };
  };

  return {
    extractVideoId,
    getVideoDetails,
    getComments,
    fetchVideoData,
  };
};
