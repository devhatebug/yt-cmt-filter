// utils/format.ts

export const formatDate = (date: Date | string): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
};

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat("vi-VN").format(num);
};

export const estimateCommentRange = (count: number): string => {
  if (count < 100) {
    return `${count}`;
  } else if (count < 1000) {
    return `${Math.floor(count / 100) * 100}-${Math.ceil(count / 100) * 100}`;
  } else {
    return `${Math.floor(count / 1000)}k-${Math.ceil(count / 1000)}k`;
  }
};

// Decode HTML entities từ YouTube API
export const decodeHtmlEntities = (text: string): string => {
  if (typeof document === "undefined") {
    // Server-side: basic replacements
    return text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'");
  }

  // Client-side: use textarea trick for full decoding
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
};

// Sanitize và format comment content từ YouTube
export const formatYouTubeComment = (htmlContent: string): string => {
  // Decode HTML entities
  const decoded = decodeHtmlEntities(htmlContent);

  // Cho phép các tags an toàn: <br>, <a>
  // Loại bỏ hoặc escape các tags nguy hiểm
  const sanitized = decoded
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "");

  return sanitized;
};

// Strip HTML tags và convert về plain text (cho Excel export)
export const stripHtmlTags = (htmlContent: string): string => {
  // Decode HTML entities trước
  const decoded = decodeHtmlEntities(htmlContent);

  // Convert <br> thành newline
  const withNewlines = decoded.replace(/<br\s*\/?>/gi, "\n");

  // Loại bỏ tất cả HTML tags
  const stripped = withNewlines.replace(/<[^>]+>/g, "");

  return stripped.trim();
};

// Truncate HTML content an toàn (không cắt giữa tag)
export const truncateHtml = (
  htmlContent: string,
  maxLength: number
): string => {
  // Strip tags để đếm độ dài text thực
  const plainText = stripHtmlTags(htmlContent);

  // Nếu không cần truncate
  if (plainText.length <= maxLength) {
    return htmlContent;
  }

  // Tìm vị trí cắt an toàn (không ở giữa tag)
  let truncated = "";
  let textLength = 0;
  let insideTag = false;

  for (let i = 0; i < htmlContent.length; i++) {
    const char = htmlContent[i];

    if (char === "<") {
      insideTag = true;
    }

    truncated += char;

    if (char === ">") {
      insideTag = false;
      continue;
    }

    // Chỉ đếm ký tự ngoài tags
    if (!insideTag && char !== ">") {
      textLength++;

      if (textLength >= maxLength) {
        break;
      }
    }
  }

  // Đóng các tags chưa đóng (đơn giản hóa)
  return truncated;
};
