// composables/useCommentFilter.ts
import type { YouTubeComment, FilterOptions } from "../types/comment";

export const useCommentFilter = () => {
  // Hàm kiểm tra comment có chứa icon/emoji
  const hasOnlyEmoji = (text: string): boolean => {
    // Bỏ toàn bộ thẻ HTML
    const stripped = text.replace(/<[^>]*>/g, "").trim();

    if (!stripped) return false;

    // Nếu không chứa bất kỳ chữ cái nào
    const hasLetter = /\p{L}/u.test(stripped);

    return !hasLetter;
  };

  // Hàm kiểm tra quảng cáo/link
  const isAdvertisement = (text: string): boolean => {
    const lowerText = text.toLowerCase();

    // Phát hiện URL
    const hasUrl = /https?:\/\/|www\./i.test(text) || /\.[a-z]{2,}/i.test(text);

    // Từ khóa quảng cáo
    const adKeywords = [
      "xem tại",
      "link",
      "tải",
      "download",
      "freeship",
      "giảm giá",
      "khuyến mãi",
      "inbox",
      "zalo",
      "mua ngay",
      "đặt hàng",
      "liên hệ",
      "sale off",
    ];

    const hasAdKeyword = adKeywords.some((keyword) =>
      lowerText.includes(keyword)
    );

    return hasUrl || hasAdKeyword;
  };

  // Hàm kiểm tra comment ngắn/đơn điệu
  const isGenericComment = (text: string): boolean => {
    // Bỏ toàn bộ thẻ HTML trước
    const stripped = text
      .replace(/<[^>]*>/g, "")
      .toLowerCase()
      .trim();

    if (!stripped) return true; // Nếu sau khi bỏ tag mà rỗng => coi là generic (bỏ)

    // Tách thành cụm từ (theo khoảng trắng)
    const phrases = stripped.split(/\s+/);

    // Nếu có ít hơn 3 cụm từ => coi là generic => true (bỏ)
    if (phrases.length < 3) {
      return true;
    }

    // Nếu có từ 3 cụm từ trở lên => không generic => false (giữ lại)
    return false;
  };

  // Hàm kiểm tra một comment có pass filter không
  const shouldKeepComment = (
    comment: YouTubeComment,
    options: FilterOptions
  ): boolean => {
    if (options.removeEmojiOnly && hasOnlyEmoji(comment.content)) {
      return false;
    }

    if (options.removeAdvertisements && isAdvertisement(comment.content)) {
      return false;
    }

    if (options.removeGenericComments && isGenericComment(comment.content)) {
      return false;
    }

    return true;
  };

  // Hàm lọc comments (bao gồm cả replies)
  const filterComments = (
    comments: YouTubeComment[],
    options: FilterOptions
  ): YouTubeComment[] => {
    const filtered: YouTubeComment[] = [];

    for (const comment of comments) {
      // Lọc replies trước
      const filteredReplies = comment.replies
        ? comment.replies.filter((reply) => shouldKeepComment(reply, options))
        : [];

      // Kiểm tra comment cha có pass filter không
      const keepParent = shouldKeepComment(comment, options);

      // Nếu comment cha pass filter, trả về với replies đã lọc
      if (keepParent) {
        filtered.push({
          ...comment,
          replies: filteredReplies,
          replyCount: filteredReplies.length,
        });
      }
      // Nếu comment cha không pass nhưng có replies pass filter
      else if (filteredReplies.length > 0) {
        filtered.push({
          ...comment,
          replies: filteredReplies,
          replyCount: filteredReplies.length,
        });
      }
    }

    return filtered;
  };

  // Hàm đếm tổng số comment (bao gồm cả replies)
  const countTotalComments = (comments: YouTubeComment[]): number => {
    return comments.reduce((total, comment) => {
      // Đếm comment cha
      let count = 1;
      // Đếm replies
      if (comment.replies && comment.replies.length > 0) {
        count += comment.replies.length;
      }
      return total + count;
    }, 0);
  };

  return {
    hasOnlyEmoji,
    isAdvertisement,
    isGenericComment,
    filterComments,
    countTotalComments,
  };
};
