// composables/useExcelExport.ts
import * as XLSX from "xlsx/xlsx.mjs";
import type { YouTubeComment, VideoData } from "../types/comment";
import { formatDate, stripHtmlTags } from "../utils/format";

export const useExcelExport = () => {
  const exportToExcel = (comments: YouTubeComment[], videoData: VideoData) => {
    // Flatten comments + replies cho export
    const data: Array<{
      "Ngày cmt": string;
      "Người cmt": string;
      Loại: string;
      "Trả lời cho": string;
      "Nội dung cmt": string;
      "Số lượng thích": number;
    }> = [];

    comments.forEach((comment) => {
      // Thêm comment cha
      data.push({
        "Ngày cmt": formatDate(comment.date),
        "Người cmt": comment.author,
        Loại: "Comment chính",
        "Trả lời cho": "",
        "Nội dung cmt": stripHtmlTags(comment.content),
        "Số lượng thích": comment.likeCount,
      });

      // Thêm replies
      if (comment.replies && comment.replies.length > 0) {
        comment.replies.forEach((reply) => {
          data.push({
            "Ngày cmt": formatDate(reply.date),
            "Người cmt": reply.author,
            Loại: "Reply",
            "Trả lời cho": comment.author,
            "Nội dung cmt": `    ${stripHtmlTags(reply.content)}`, // Indent với 4 spaces thay vì icon
            "Số lượng thích": reply.likeCount,
          });
        });
      }
    });

    // Tạo worksheet
    const ws = XLSX.utils.json_to_sheet(data);

    // Thêm metadata vào đầu sheet
    const totalCommentsExported = data.length;
    const mainComments = comments.length;
    const totalReplies = totalCommentsExported - mainComments;

    XLSX.utils.sheet_add_aoa(
      ws,
      [
        ["Tên video:", videoData.title],
        ["Link video:", videoData.url],
        ["Tổng số comments trong video:", videoData.totalComments],
        [
          "Số comments đã xuất:",
          `${totalCommentsExported} (${mainComments} chính + ${totalReplies} replies)`,
        ],
        ["Ngày xuất:", formatDate(new Date())],
        [], // Dòng trống
      ],
      { origin: "A1" }
    );

    // Di chuyển data xuống
    const range = XLSX.utils.decode_range(ws["!ref"]!);
    range.e.r += 6;
    ws["!ref"] = XLSX.utils.encode_range(range);

    // Tạo workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "YouTube Comments");

    // Xuất file
    const timestamp = Date.now();
    const fileName = `youtube_comments_${videoData.videoId}_${timestamp}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return {
    exportToExcel,
  };
};
