import { GoogleGenAI } from "@google/genai";
import * as XLSX from "xlsx/xlsx.mjs";

// Type definitions
interface CommentToTranslate {
  index: number;
  author: string;
  content: string;
  type: string;
  date: string;
}

interface TranslatedComment extends CommentToTranslate {
  translatedContent: string;
}

export const useGemini = () => {
  const config = useRuntimeConfig();
  const geminiKeys = config.public.geminiApiKey
    .split(",")
    .map((k: string) => k.trim());
  const keyIndex = ref(0);

  const getNextApiKey = () => {
    const key = geminiKeys[keyIndex.value];
    keyIndex.value = (keyIndex.value + 1) % geminiKeys.length;
    return key;
  };

  // Helper: Retry với exponential backoff
  const translateWithRetry = async <T>(
    translateFn: () => Promise<T>,
    maxRetries = 3
  ): Promise<T> => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await translateFn();
      } catch (error) {
        lastError = error as Error;
        const delay = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s

        console.warn(
          `Retry translation ${attempt + 1}/${maxRetries} sau ${delay}ms...`
        );

        await new Promise((resolve) => setTimeout(resolve, delay));

        // Rotate API key nếu bị rate limit
        if ((error as any)?.status === 429) {
          console.log("Rate limited, switching to next API key...");
        }
      }
    }

    throw lastError || new Error("Translation failed after retries");
  };

  // Batch translate với Gemini - OPTIMIZED: Chỉ gửi index + content
  const translateBatch = async (
    batch: CommentToTranslate[]
  ): Promise<TranslatedComment[]> => {
    const ai = new GoogleGenAI({
      apiKey: getNextApiKey(),
    });

    // Chỉ gửi index và content để giảm input tokens
    const minimalData = batch.map((c) => ({
      index: c.index,
      content: c.content,
    }));

    const prompt = `Bạn là một chuyên gia dịch thuật Việt-Trung. Hãy dịch các bình luận sau sang tiếng Trung giản thể (简体中文).

Lưu ý:
- Dịch chính xác ý nghĩa, không dịch máy móc
- Giữ nguyên emoji nếu có
- Với từ viết tắt tiếng Việt (vd: "đc", "ko", "cx"...), hãy hiểu ngữ cảnh và dịch đúng ý
- Với link URL, giữ nguyên không dịch
- Nếu comment chỉ có emoji/icon, giữ nguyên

Dưới đây là danh sách ${batch.length} comments cần dịch:

${minimalData.map((c) => `[${c.index}] ${c.content}`).join("\n\n")}`;

    const response = await translateWithRetry(() =>
      ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "array",
            items: {
              type: "object",
              properties: {
                index: { type: "number" },
                translatedContent: { type: "string" },
              },
              required: ["index", "translatedContent"],
            },
          },
        },
      })
    );

    if (!response.text) {
      throw new Error("Empty response from Gemini API");
    }

    const translations = JSON.parse(response.text) as Array<{
      index: number;
      translatedContent: string;
    }>;

    // Map translations back to original comments by index
    return batch.map((comment) => {
      const translation = translations.find((t) => t.index === comment.index);
      return {
        ...comment,
        translatedContent: translation?.translatedContent || comment.content,
      };
    });
  };

  // Main translation function
  const translateCommentsFromExcel = async (
    file: File,
    onProgress?: (current: number, total: number) => void
  ): Promise<TranslatedComment[]> => {
    // 1. Đọc file Excel
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer);
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      throw new Error("Excel file is empty or invalid");
    }

    const worksheet = workbook.Sheets[firstSheetName];

    if (!worksheet) {
      throw new Error("Worksheet not found");
    }

    const rawData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
    }) as unknown[][];

    // 2. Parse data (bỏ qua metadata rows)
    const comments: CommentToTranslate[] = [];
    let startRow = 0;

    // Tìm row bắt đầu của data (sau metadata)
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      if (row && row[0] === "Ngày cmt" && row[1] === "Người cmt") {
        startRow = i + 1;
        break;
      }
    }

    // Extract comments
    for (let i = startRow; i < rawData.length; i++) {
      const row = rawData[i];
      if (row && row[2]) {
        // Có nội dung
        comments.push({
          index: i - startRow,
          date: String(row[0] || ""),
          author: String(row[1] || ""),
          type: String(row[2] || ""),
          content: String(row[4] || ""), // Cột "Nội dung cmt"
        });
      }
    }

    console.log(`📖 Đã đọc ${comments.length} comments từ file Excel`);

    // 3. Batch translation - O(n/BATCH_SIZE)
    const BATCH_SIZE = 100; // 100 comments/batch để tránh token limit
    const translated: TranslatedComment[] = [];
    const totalBatches = Math.ceil(comments.length / BATCH_SIZE);

    console.log(
      `🔄 Bắt đầu dịch ${comments.length} comments (${totalBatches} batches)...`
    );

    for (let i = 0; i < comments.length; i += BATCH_SIZE) {
      const batch = comments.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

      console.log(
        `→ Đang dịch batch ${batchNumber}/${totalBatches} (${batch.length} comments)...`
      );

      try {
        const translatedBatch = await translateBatch(batch);
        translated.push(...translatedBatch);

        // Update progress
        if (onProgress) {
          onProgress(translated.length, comments.length);
        }

        // Delay giữa các batches để tránh rate limit
        if (i + BATCH_SIZE < comments.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000)); // 1s delay
        }
      } catch (error) {
        console.error(`❌ Lỗi khi dịch batch ${batchNumber}:`, error);

        // Fallback: Giữ nguyên nội dung gốc
        batch.forEach((comment) => {
          translated.push({
            ...comment,
            translatedContent: comment.content + " [Lỗi dịch]",
          });
        });
      }
    }

    console.log(`✅ Hoàn thành dịch ${translated.length} comments!`);
    return translated;
  };

  return {
    translateCommentsFromExcel,
  };
};
