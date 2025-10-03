// types/comment.ts

export interface YouTubeComment {
  id: string;
  date: Date;
  author: string;
  content: string;
  likeCount: number;
  replyCount: number;
  replies?: YouTubeComment[];
}

export interface FilterOptions {
  removeEmojiOnly: boolean;
  removeAdvertisements: boolean;
  removeGenericComments: boolean;
}

export interface VideoData {
  videoId: string;
  title: string;
  url: string;
  totalComments: number;
  estimatedRange: string;
}

export interface TableSort {
  column: string;
  direction: "asc" | "desc";
}
