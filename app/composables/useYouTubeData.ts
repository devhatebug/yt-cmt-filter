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
        title: video.snippet.title,
        commentCount: parseInt(video.statistics.commentCount || "0"),
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

  // Lấy replies cho một comment cha
  const getReplies = async (parentId: string): Promise<YouTubeComment[]> => {
    const replies: YouTubeComment[] = [];
    let pageToken: string | undefined = undefined;

    do {
      const response = await $fetch<YouTubeApiCommentResponse>(
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
            replyCount: snippet.replyCount || 0,
            replies: [], // reply không có reply con
          });
        });
      }

      pageToken = response.nextPageToken;
    } while (pageToken);

    return replies;
  };

  // Lấy comments cha + replies (nếu có)
  const getComments = async (
    videoId: string,
    maxResults = 100
  ): Promise<YouTubeComment[]> => {
    const comments: YouTubeComment[] = [];
    let pageToken: string | undefined = undefined;

    try {
      do {
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

            const topComment: YouTubeComment = {
              id: item.id,
              date: new Date(snippet.publishedAt),
              author: snippet.authorDisplayName,
              content: snippet.textDisplay,
              likeCount: snippet.likeCount || 0,
              replyCount: item.snippet.totalReplyCount || 0,
              replies: [],
            };

            // Nếu có reply thì gọi thêm
            if (item.snippet.totalReplyCount > 0) {
              topComment.replies = await getReplies(item.id);
            }

            comments.push(topComment);
          }
        }

        pageToken = response.nextPageToken;
      } while (pageToken && comments.length < 2000);

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
    url: string
  ): Promise<{
    videoData: VideoData;
    comments: YouTubeComment[];
  }> => {
    const videoId = extractVideoId(url);
    if (!videoId) {
      throw new Error("URL YouTube không hợp lệ");
    }

    const videoDetails = await getVideoDetails(videoId);
    const comments = await getComments(videoId);

    const videoData: VideoData = {
      videoId,
      title: videoDetails.title,
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
