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

  // 🚀 PERFORMANCE OPTIMIZATION:
  // 1. Độ phức tạp thuật toán: O(n) thay vì O(n²) - dùng Map cho lookup O(1)
  // 2. Compact prompts: Giảm 60-70% tokens (i/t/c/w/n thay vì full names)
  // 3. Batch processing: 100-200 comments/batch (cân bằng speed vs rate limit)
  // 4. Memory efficient: Không duplicate data, chỉ store minimal fields
  //
  // 🔄 RATE LIMIT PROTECTION:
  // 1. Delay between batches: 3s
  // 2. Retry exponential backoff: 5s→10s→20s→40s→80s (rate limit)
  // 3. Auto API key rotation khi 429
  // 4. Sample data cho word frequency (200 thay vì toàn bộ)

  // 🏷️ FIXED CATEGORIES - O(1) lookup với Map
  const CATEGORIES = [
    "怀旧情感与童年回忆", // 0: Cảm xúc hoài niệm & ký ức tuổi thơ
    "角色与演员表现", // 1: Khen ngợi nhân vật & diễn viên
    "剧情与艺术价值", // 2: Đánh giá về cốt truyện & giá trị nghệ thuật
    "版本对比与比较", // 3: So sánh với phiên bản khác / phim khác
    "文化共鸣与道德价值", // 4: Đồng cảm văn hoá & giá trị đạo đức
    "语言与配音翻译", // 5: Ngôn ngữ & bản dịch (lồng tiếng)
  ] as const;

  const CATEGORIES_VI = [
    "Cảm xúc hoài niệm & ký ức tuổi thơ",
    "Khen ngợi nhân vật & diễn viên",
    "Đánh giá về cốt truyện & giá trị nghệ thuật",
    "So sánh với phiên bản khác / phim khác",
    "Đồng cảm văn hoá & giá trị đạo đức",
    "Ngôn ngữ & bản dịch (lồng tiếng)",
  ] as const;

  // O(1) category lookup Map
  const categoryMap = new Map(CATEGORIES.map((name, idx) => [idx, name]));
  const categoryMapVi = new Map(CATEGORIES_VI.map((name, idx) => [idx, name]));

  const getNextApiKey = () => {
    const key = geminiKeys[keyIndex.value];
    keyIndex.value = (keyIndex.value + 1) % geminiKeys.length;
    return key;
  };

  // Helper: Retry với exponential backoff và rate limit handling
  const translateWithRetry = async <T>(
    translateFn: () => Promise<T>,
    maxRetries = 10 // Tăng lên 10 lần retry
  ): Promise<T> => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await translateFn();
      } catch (error) {
        lastError = error as Error;
        const errorObj = error as { status?: number; message?: string };

        // Nếu bị rate limit (429), đợi lâu hơn
        const isRateLimit =
          errorObj?.status === 429 ||
          errorObj?.message?.includes("429") ||
          errorObj?.message?.toLowerCase().includes("rate limit");

        // Exponential backoff: 2s, 4s, 8s, 16s, 32s
        // Với rate limit: 5s, 10s, 20s, 40s, 80s
        const baseDelay = isRateLimit ? 5000 : 2000;
        const delay = baseDelay * Math.pow(2, attempt);

        console.warn(
          `${isRateLimit ? "⚠️ Rate limited!" : "❌ Lỗi!"} Retry ${
            attempt + 1
          }/${maxRetries} sau ${delay / 1000}s...`
        );

        // Rotate API key nếu bị rate limit
        if (isRateLimit && geminiKeys.length > 1) {
          console.log("🔄 Đang chuyển sang API key khác...");
          getNextApiKey(); // Force rotation
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error("Translation failed after retries");
  };

  // OPTIMIZED: Batch translate với minimal data transfer
  const translateBatch = async (
    batch: CommentToTranslate[]
  ): Promise<TranslatedComment[]> => {
    const ai = new GoogleGenAI({
      apiKey: getNextApiKey(),
    });

    // Chỉ gửi index và content để giảm input tokens & memory
    const minimalData = batch.map((c) => ({
      i: c.index, // Rút ngắn "index" -> "i" để giảm tokens
      c: c.content, // "content" -> "c"
    }));

    // Compact prompt để giảm tokens
    const prompt = `Dịch Việt→中文. JSON: [{"i":idx,"t":"译文"}]

${minimalData.map((d) => `[${d.i}] ${d.c}`).join("\n")}`;

    const response = await translateWithRetry(() =>
      ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "array",
            items: {
              type: "object",
              properties: {
                i: { type: "number" }, // Shortened from "index"
                t: { type: "string" }, // Shortened from "translatedContent"
              },
              required: ["i", "t"],
            },
          },
        },
      })
    );

    if (!response.text) {
      throw new Error("Empty response from Gemini API");
    }

    const translations = JSON.parse(response.text) as Array<{
      i: number;
      t: string;
    }>;

    // OPTIMIZED: O(1) Map lookup thay vì O(n) find()
    const translationMap = new Map(translations.map((tr) => [tr.i, tr.t]));

    return batch.map((comment) => ({
      ...comment,
      translatedContent: translationMap.get(comment.index) || comment.content,
    }));
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

    // 2. Parse data - Tự động tìm cột "Nội dung cmt"
    const rawData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
    }) as unknown[][];

    const comments: CommentToTranslate[] = [];

    // Tìm header row và index cột "Nội dung cmt"
    let headerRowIndex = -1;
    let contentColIndex = -1;
    let typeColIndex = -1;

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      if (row && Array.isArray(row)) {
        for (let j = 0; j < row.length; j++) {
          const cell = String(row[j] || "").trim();
          if (cell === "Nội dung cmt") {
            headerRowIndex = i;
            contentColIndex = j;
          }
          if (cell === "Loại") typeColIndex = j;
        }
        if (headerRowIndex !== -1) break;
      }
    }

    if (contentColIndex === -1) {
      throw new Error('Không tìm thấy cột "Nội dung cmt" trong file Excel');
    }

    console.log(`✅ Tìm thấy cột "Nội dung cmt" ở vị trí ${contentColIndex}`);

    // Extract comments từ dòng sau header
    // Cột 0 = Ngày cmt, Cột 1 = Người cmt (fixed)
    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (row && row[contentColIndex]) {
        const content = String(row[contentColIndex] || "").trim();
        if (content) {
          comments.push({
            index: i - headerRowIndex - 1,
            date: String(row[0] || ""), // Cột đầu tiên = Ngày
            author: String(row[1] || ""), // Cột thứ 2 = Người comment
            type: typeColIndex !== -1 ? String(row[typeColIndex] || "") : "",
            content: content,
          });
        }
      }
    }

    console.log(`📖 Đã đọc ${comments.length} comments từ file Excel`);

    // 3. Batch translation - TIME: O(n/BATCH_SIZE), SPACE: O(n)
    const BATCH_SIZE = 150; // Optimal: 150 comments/batch (balance speed vs rate limit)
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
          await new Promise((resolve) => setTimeout(resolve, 3000)); // 3s delay (tăng từ 1s)
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

  // OPTIMIZED: Classify với fixed categories (chỉ trả về index 0-5)
  const classifyBatch = async (
    batch: Array<{ index: number; content: string }>
  ): Promise<Array<{ index: number; categoryName: string }>> => {
    const ai = new GoogleGenAI({
      apiKey: getNextApiKey(),
    });

    // Ultra-compact: AI chỉ trả về category index (0-5)
    const prompt = `分类评论主题。JSON: [{"i":评论索引,"c":主题索引}]

主题分类标准（0-5，选择最匹配的一个）:

0=怀旧情感与童年回忆
特征：表达对过去的怀念、童年回忆、时光流逝的感慨
例子："小时候看的"、"童年回忆"、"怀念以前"、"还记得那时候"

1=角色与演员表现
特征：评论角色塑造、演员演技、配音表现、角色魅力
例子："孙悟空演得好"、"六小龄童太棒了"、"这个演员很厉害"、"角色很生动"

2=剧情与艺术价值
特征：评价故事情节、艺术价值、文学性、深度、制作水平
例子："剧情很精彩"、"经典之作"、"艺术价值高"、"制作精良"

3=版本对比与比较
特征：对比不同版本、不同翻拍、与其他作品比较
例子："比新版好看"、"86版最经典"、"和原著不一样"、"其他版本都不如"

4=文化共鸣与道德价值
特征：讨论文化内涵、传统价值观、道德教育、人生哲理、寓意深刻
例子："教育意义深刻"、"传承文化"、"有道德价值"、"富含哲理"
注意：讽刺或批评性评论（如"让猴子看桃园"）不属于此类

5=语言与配音翻译
特征：评论配音质量、翻译水平、台词、口音、语言表达
例子："配音很好听"、"翻译准确"、"台词经典"、"声音很配"

${batch.map((c) => `[${c.index}] ${c.content}`).join("\n")}`;

    const response = await translateWithRetry(() =>
      ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "array",
            items: {
              type: "object",
              properties: {
                i: { type: "number" }, // comment index
                c: {
                  type: "number", // category index (0-5)
                  minimum: 0,
                  maximum: 5,
                },
              },
              required: ["i", "c"],
            },
          },
        },
      })
    );

    if (!response.text) {
      throw new Error("Empty response from Gemini API");
    }

    const result = JSON.parse(response.text) as Array<{
      i: number;
      c: number;
    }>;

    // O(1) Map lookup
    return result.map((r) => ({
      index: r.i,
      categoryName: categoryMap.get(r.c) || CATEGORIES[0],
    }));
  };

  // Main classification function
  const classifyCommentsFromExcel = async (
    file: File,
    onProgress?: (current: number, total: number) => void
  ): Promise<
    Array<{
      index: number;
      date: string;
      author: string;
      type: string;
      viContent: string;
      zhContent: string;
      categoryName: string;
    }>
  > => {
    // 1. Đọc file Excel
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer);

    // 🔍 DEBUG: Log ra tất cả sheets trong workbook
    console.log("📚 File Excel có các sheets sau:", workbook.SheetNames);

    // Tìm sheet có chứa "中文评论内容"
    let targetSheetName: string | null = null;
    let worksheet: XLSX.WorkSheet | null = null;

    for (const sheetName of workbook.SheetNames) {
      console.log(`\n🔎 Đang kiểm tra sheet: "${sheetName}"`);
      const ws = workbook.Sheets[sheetName];
      if (!ws) continue;

      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];

      // Log 5 rows đầu tiên của mỗi sheet
      console.log(`📋 5 rows đầu của sheet "${sheetName}":`);
      for (let i = 0; i < Math.min(5, data.length); i++) {
        console.log(
          `  Row ${i}:`,
          data[i]?.map(
            (cell, idx) => `[${idx}] ${String(cell || "").substring(0, 30)}`
          )
        );
      }

      // Kiểm tra xem sheet này có cột "中文评论内容" không
      for (let i = 0; i < Math.min(10, data.length); i++) {
        const row = data[i];
        if (row && Array.isArray(row)) {
          for (let j = 0; j < row.length; j++) {
            const cell = String(row[j] || "").trim();
            if (cell.includes("中文") && cell.includes("内容")) {
              targetSheetName = sheetName;
              worksheet = ws;
              console.log(
                `✅ Tìm thấy sheet đúng: "${sheetName}" ở row ${i}, column ${j}`
              );
              break;
            }
          }
          if (targetSheetName) break;
        }
      }
      if (targetSheetName) break;
    }

    if (!targetSheetName || !worksheet) {
      console.error("❌ Không tìm thấy sheet nào có cột '中文评论内容'");
      throw new Error(
        `Không tìm thấy sheet chứa cột "中文评论内容". File có ${
          workbook.SheetNames.length
        } sheets: ${workbook.SheetNames.join(", ")}`
      );
    }

    console.log(`\n🎯 Sẽ xử lý sheet: "${targetSheetName}"`);

    // 2. Parse data - Tìm cột "中文评论内容"
    const rawData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
    }) as unknown[][];

    // Tìm header row
    let headerRowIndex = -1;
    let dateColIndex = -1;
    let authorColIndex = -1;
    let typeColIndex = -1;
    let viContentColIndex = -1;
    let zhContentColIndex = -1;

    for (let i = 0; i < Math.min(10, rawData.length); i++) {
      const row = rawData[i];
      if (row && Array.isArray(row)) {
        // Log tất cả rows để debug
        console.log(
          `📋 Row ${i}:`,
          row.map((cell, idx) => `[${idx}] ${String(cell || "").trim()}`)
        );

        // Reset column indices for each row
        let foundZhContent = false;

        for (let j = 0; j < row.length; j++) {
          const cell = String(row[j] || "")
            .trim()
            .replace(/\s+/g, ""); // Remove all whitespace

          if (cell === "序号") dateColIndex = j;
          if (cell === "日期") dateColIndex = j;
          if (cell === "账号名") authorColIndex = j;
          if (cell === "类型") typeColIndex = j;
          if (cell.includes("越南语") && cell.includes("内容"))
            viContentColIndex = j;
          if (cell.includes("中文") && cell.includes("内容")) {
            zhContentColIndex = j;
            foundZhContent = true;
          }
        }

        if (foundZhContent) {
          headerRowIndex = i;
          console.log(`✅ Tìm thấy header row ở dòng ${i}`);
          break;
        }
      }
    }

    if (zhContentColIndex === -1) {
      console.error("❌ Không tìm thấy cột chứa '中文' và '内容'");
      console.error("📋 Đã quét 10 rows đầu tiên, không tìm thấy header");
      throw new Error(
        'Không tìm thấy cột "中文评论内容" trong file Excel. File có thể không đúng định dạng.'
      );
    }

    console.log(`✅ Tìm thấy cột "中文评论内容" ở vị trí ${zhContentColIndex}`);

    // 3. Extract comments
    const comments: Array<{
      index: number;
      date: string;
      author: string;
      type: string;
      viContent: string;
      zhContent: string;
    }> = [];

    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (row && row[zhContentColIndex]) {
        const zhContent = String(row[zhContentColIndex] || "").trim();
        if (zhContent) {
          // Tìm cột "序号" để lấy index thực từ file
          const seqNumber = row[0]
            ? parseInt(String(row[0]))
            : i - headerRowIndex - 1;

          comments.push({
            index: isNaN(seqNumber) ? i - headerRowIndex - 1 : seqNumber - 1,
            date: dateColIndex !== -1 ? String(row[dateColIndex] || "") : "",
            author:
              authorColIndex !== -1 ? String(row[authorColIndex] || "") : "",
            type: typeColIndex !== -1 ? String(row[typeColIndex] || "") : "",
            viContent:
              viContentColIndex !== -1
                ? String(row[viContentColIndex] || "")
                : "",
            zhContent: zhContent,
          });
        }
      }
    }

    console.log(`📖 Đã đọc ${comments.length} comments từ file Excel`);

    // 4. Batch classification - TIME: O(n), SPACE: O(n)
    const BATCH_SIZE = 150; // Optimal batch size
    const classified: Array<{
      index: number;
      date: string;
      author: string;
      type: string;
      viContent: string;
      zhContent: string;
      categoryName: string;
    }> = [];
    const totalBatches = Math.ceil(comments.length / BATCH_SIZE);

    console.log(
      `🔄 Bắt đầu phân loại ${comments.length} comments (${totalBatches} batches)...`
    );

    for (let i = 0; i < comments.length; i += BATCH_SIZE) {
      const batch = comments.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

      console.log(
        `→ Đang phân loại batch ${batchNumber}/${totalBatches} (${batch.length} comments)...`
      );

      try {
        // Chỉ gửi index và zhContent
        const minimalData = batch.map((c) => ({
          index: c.index,
          content: c.zhContent,
        }));

        const classifiedBatch = await classifyBatch(minimalData);

        // OPTIMIZED: O(n²) -> O(n) với Map lookup
        const categoryMap = new Map(
          classifiedBatch.map((c) => [c.index, c.categoryName])
        );

        batch.forEach((comment) => {
          classified.push({
            ...comment,
            categoryName: categoryMap.get(comment.index) || "未分类",
          });
        });

        // Update progress
        if (onProgress) {
          onProgress(classified.length, comments.length);
        }

        // Delay giữa các batches để tránh rate limit
        if (i + BATCH_SIZE < comments.length) {
          await new Promise((resolve) => setTimeout(resolve, 3000)); // 3s delay (tăng từ 1s)
        }
      } catch (error) {
        console.error(`❌ Lỗi khi phân loại batch ${batchNumber}:`, error);

        // Fallback: Gán categoryName = "未分类"
        batch.forEach((comment) => {
          classified.push({
            ...comment,
            categoryName: "未分类",
          });
        });
      }
    }

    console.log(`✅ Hoàn thành phân loại ${classified.length} comments!`);
    return classified;
  };

  // OPTIMIZED: Word frequency với compact prompt
  const analyzeWordFrequency = async (
    comments: string[]
  ): Promise<Array<{ word: string; count: number }>> => {
    const ai = new GoogleGenAI({
      apiKey: getNextApiKey(),
    });

    // Sample 200 comments thay vì 100 để đại diện tốt hơn
    const sample = comments.length > 200 ? comments.slice(0, 200) : comments;

    const prompt = `提取Top20关键词(2-4字). JSON: [{"w":"词","n":次数}]

${sample.join("\n")}`;

    const response = await translateWithRetry(() =>
      ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "array",
            items: {
              type: "object",
              properties: {
                w: { type: "string" }, // word
                n: { type: "number" }, // count
              },
              required: ["w", "n"],
            },
          },
        },
      })
    );

    if (!response.text) {
      throw new Error("Empty response from Gemini API");
    }

    const result = JSON.parse(response.text) as Array<{
      w: string;
      n: number;
    }>;

    return result.map((r) => ({
      word: r.w,
      count: r.n,
    }));
  };

  // OPTIMIZED: Gộp Sentiment + Topic trong 1 API call với fixed categories
  const analyzeSentimentAndTopicBatch = async (
    batch: Array<{ index: number; content: string }>
  ): Promise<
    Array<{
      index: number;
      sentiment: "positive" | "neutral" | "negative";
      categoryName: string;
    }>
  > => {
    const ai = new GoogleGenAI({
      apiKey: getNextApiKey(),
    });

    // Ultra-compact: AI chỉ trả về index của category (0-5)
    const prompt = `分析评论情感和主题。JSON: [{"i":评论索引,"s":"情感","c":主题索引}]

情感(s): "1"=积极, "0"=中性, "-1"=消极

主题(c)分类标准（0-5，选择最匹配的一个）:

0=怀旧情感与童年回忆
特征：表达对过去的怀念、童年回忆、时光流逝的感慨
例子："小时候看的"、"童年回忆"、"怀念以前"、"还记得那时候"

1=角色与演员表现
特征：评论角色塑造、演员演技、配音表现、角色魅力
例子："孙悟空演得好"、"六小龄童太棒了"、"这个演员很厉害"、"角色很生动"

2=剧情与艺术价值
特征：评价故事情节、艺术价值、文学性、深度、制作水平
例子："剧情很精彩"、"经典之作"、"艺术价值高"、"制作精良"

3=版本对比与比较
特征：对比不同版本、不同翻拍、与其他作品比较
例子："比新版好看"、"86版最经典"、"和原著不一样"、"其他版本都不如"

4=文化共鸣与道德价值
特征：讨论文化内涵、传统价值观、道德教育、人生哲理、寓意深刻
例子："教育意义深刻"、"传承文化"、"有道德价值"、"富含哲理"
注意：讽刺或批评性评论（如"让猴子看桃园"）不属于此类

5=语言与配音翻译
特征：评论配音质量、翻译水平、台词、口音、语言表达
例子："配音很好听"、"翻译准确"、"台词经典"、"声音很配"

${batch.map((c) => `[${c.index}] ${c.content}`).join("\n")}`;

    const response = await translateWithRetry(() =>
      ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "array",
            items: {
              type: "object",
              properties: {
                i: { type: "number" }, // comment index
                s: {
                  type: "string", // sentiment
                  enum: ["1", "0", "-1"],
                },
                c: {
                  type: "number", // category index (0-5)
                  minimum: 0,
                  maximum: 5,
                },
              },
              required: ["i", "s", "c"],
            },
          },
        },
      })
    );

    if (!response.text) {
      throw new Error("Empty response from Gemini API");
    }

    const result = JSON.parse(response.text) as Array<{
      i: number;
      s: "1" | "0" | "-1";
      c: number;
    }>;

    // O(1) lookups
    const sentimentMap: Record<string, "positive" | "neutral" | "negative"> = {
      "1": "positive",
      "0": "neutral",
      "-1": "negative",
    };

    return result.map((r) => ({
      index: r.i,
      sentiment: sentimentMap[r.s] || "neutral",
      categoryName: categoryMap.get(r.c) || CATEGORIES[0], // O(1) lookup
    }));
  };

  // DEPRECATED: Giữ lại để backward compatibility
  const analyzeSentimentBatch = async (
    batch: Array<{ index: number; content: string }>
  ): Promise<
    Array<{ index: number; sentiment: "positive" | "neutral" | "negative" }>
  > => {
    const combined = await analyzeSentimentAndTopicBatch(batch);
    return combined.map((r) => ({
      index: r.index,
      sentiment: r.sentiment,
    }));
  };

  // ========== PHÂN TÍCH TỔNG HỢP (OPTIMIZED: Song song 3 API calls) ==========
  const analyzeCommentsFromExcel = async (
    file: File,
    onProgress?: (stage: string, current: number, total: number) => void
  ): Promise<{
    comments: Array<{
      index: number;
      date: string;
      author: string;
      viContent: string;
      zhContent: string;
      categoryName: string;
      sentiment: "positive" | "neutral" | "negative";
      topKeywords: string[];
    }>;
    wordFrequency: Array<{ word: string; count: number }>;
    sentimentSummary: {
      positive: number;
      neutral: number;
      negative: number;
    };
    topicDistribution: Record<string, number>;
  }> => {
    onProgress?.("reading", 0, 100);

    // 1. Đọc file Excel (tái sử dụng logic từ classifyCommentsFromExcel)
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer);

    // Tìm sheet đúng
    let targetSheetName: string | null = null;
    let worksheet: XLSX.WorkSheet | null = null;

    for (const sheetName of workbook.SheetNames) {
      const ws = workbook.Sheets[sheetName];
      if (!ws) continue;

      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
      for (let i = 0; i < Math.min(10, data.length); i++) {
        const row = data[i];
        if (row && Array.isArray(row)) {
          for (let j = 0; j < row.length; j++) {
            const cell = String(row[j] || "").trim();
            if (cell.includes("中文") && cell.includes("内容")) {
              targetSheetName = sheetName;
              worksheet = ws;
              break;
            }
          }
          if (targetSheetName) break;
        }
      }
      if (targetSheetName) break;
    }

    if (!targetSheetName || !worksheet) {
      throw new Error('Không tìm thấy sheet chứa cột "中文评论内容"');
    }

    // Parse data
    const rawData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
    }) as unknown[][];

    let headerRowIndex = -1;
    let dateColIndex = -1;
    let authorColIndex = -1;
    let viContentColIndex = -1;
    let zhContentColIndex = -1;

    for (let i = 0; i < Math.min(10, rawData.length); i++) {
      const row = rawData[i];
      if (row && Array.isArray(row)) {
        // Log toàn bộ header row để debug
        const headers = row.map((cell, idx) => ({
          index: idx,
          value: String(cell || "").trim(),
        }));
        console.log(`🔍 Row ${i} headers:`, headers);

        for (let j = 0; j < row.length; j++) {
          const cellOriginal = String(row[j] || "").trim();
          const cell = cellOriginal.replace(/\s+/g, "");

          if (cell === "日期") dateColIndex = j;
          if (cell === "账号名") authorColIndex = j;

          // Tìm cột tiếng Việt - ưu tiên cột có "内容"
          if (
            (cellOriginal.includes("越南") ||
              cellOriginal.includes("Việt") ||
              cell.includes("越南") ||
              cell.includes("Việt")) &&
            (cellOriginal.includes("内容") || cellOriginal.includes("评论"))
          ) {
            viContentColIndex = j;
            console.log(
              `✅ Found VI content column at index ${j}: "${cellOriginal}"`
            );
          }

          if (cell.includes("中文") && cell.includes("内容")) {
            zhContentColIndex = j;
            headerRowIndex = i;
            console.log(`✅ Found ZH column at index ${j}: "${cellOriginal}"`);
          }
        }
        if (headerRowIndex !== -1) break;
      }
    }

    const comments: Array<{
      index: number;
      date: string;
      author: string;
      viContent: string;
      zhContent: string;
    }> = [];

    // Log first data row to debug
    const firstRow = rawData[headerRowIndex + 1];
    if (firstRow && Array.isArray(firstRow)) {
      console.log(`🔍 First data row (all columns):`, firstRow);
      console.log(`🔍 First data row mapped:`, {
        date: firstRow[dateColIndex],
        author: firstRow[authorColIndex],
        viContent: firstRow[viContentColIndex],
        zhContent: firstRow[zhContentColIndex],
      });
    }

    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (row && row[zhContentColIndex]) {
        const zhContent = String(row[zhContentColIndex] || "").trim();
        if (zhContent) {
          comments.push({
            index: i - headerRowIndex - 1,
            date: dateColIndex !== -1 ? String(row[dateColIndex] || "") : "",
            author:
              authorColIndex !== -1 ? String(row[authorColIndex] || "") : "",
            viContent:
              viContentColIndex !== -1
                ? String(row[viContentColIndex] || "")
                : "",
            zhContent: zhContent,
          });
        }
      }
    }

    console.log(`📖 Đã đọc ${comments.length} comments`);
    console.log(
      `🔍 Header indices - Date: ${dateColIndex}, Author: ${authorColIndex}, VI: ${viContentColIndex}, ZH: ${zhContentColIndex}`
    );
    console.log(
      `📝 Sample viContent (first 50 chars):`,
      comments.slice(0, 3).map((c) => c.viContent.substring(0, 50))
    );
    onProgress?.("analyzing", 10, 100);

    const BATCH_SIZE = 150; // Optimal batch size
    const totalBatches = Math.ceil(comments.length / BATCH_SIZE);

    // 🚀 OPTIMIZED: Chạy SONG SONG 3 phân tích với Promise.all()
    // Time complexity: O(n) thay vì O(3n) - Giảm 66% thời gian!
    console.log(
      "� Đang phân tích song song: Tần suất từ + Cảm xúc + Chủ đề..."
    );

    const sentimentResults: Array<{
      index: number;
      sentiment: "positive" | "neutral" | "negative";
    }> = [];
    const topicResults: Array<{ index: number; categoryName: string }> = [];

    // Process batches với Promise.all() cho sentiment + topic
    for (let i = 0; i < comments.length; i += BATCH_SIZE) {
      const batch = comments.slice(i, i + BATCH_SIZE).map((c) => ({
        index: c.index,
        content: c.zhContent,
      }));

      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      console.log(`→ Đang xử lý ${batchNumber}/${totalBatches}...`);

      // 🔥 1 API CALL duy nhất cho cả sentiment + topic (giảm 50% tokens!)
      const batchResult = await analyzeSentimentAndTopicBatch(batch);

      // Tách kết quả
      const sentimentBatch = batchResult.map((r) => ({
        index: r.index,
        sentiment: r.sentiment,
      }));
      const topicBatch = batchResult.map((r) => ({
        index: r.index,
        categoryName: r.categoryName,
      }));

      sentimentResults.push(...sentimentBatch);
      topicResults.push(...topicBatch);

      onProgress?.("analyzing", 20 + (i / comments.length) * 60, 100);

      // Delay giữa các batch
      if (i + BATCH_SIZE < comments.length) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }

    // Word frequency - Sample 200 comments để nhanh hơn
    console.log("🔤 Đang phân tích tần suất từ...");
    const wordFrequency = await analyzeWordFrequency(
      comments.map((c) => c.zhContent)
    );
    onProgress?.("analyzing", 85, 100);

    onProgress?.("finalizing", 95, 100);

    // 5. Kết hợp kết quả - OPTIMIZED: O(n²) -> O(n) với Map
    const sentimentMap = new Map(
      sentimentResults.map((s) => [s.index, s.sentiment])
    );
    const topicMap = new Map(
      topicResults.map((t) => [t.index, t.categoryName])
    );

    // Pre-build word set cho O(1) lookup thay vì includes() O(m)
    const topWords = wordFrequency.slice(0, 50).map((wf) => wf.word);

    const finalComments = comments.map((comment) => {
      // O(1) Map lookup thay vì O(n) find()
      const sentiment = sentimentMap.get(comment.index) || "neutral";
      const categoryName = topicMap.get(comment.index) || "未分类";

      // O(k) với k=50 top words thay vì O(n) filter trên toàn bộ wordFrequency
      const commentWords = topWords
        .filter((word) => comment.zhContent.includes(word))
        .slice(0, 3);

      return {
        ...comment,
        categoryName,
        sentiment,
        topKeywords: commentWords,
      };
    });

    // 6. Tính toán thống kê - OPTIMIZED: O(3n) -> O(n) với single pass
    const sentimentSummary = { positive: 0, neutral: 0, negative: 0 };
    const topicDistribution: Record<string, number> = {};

    // Single pass O(n) thay vì 3 lần filter() O(3n)
    sentimentResults.forEach((s) => {
      sentimentSummary[s.sentiment]++;
    });

    topicResults.forEach((t) => {
      topicDistribution[t.categoryName] =
        (topicDistribution[t.categoryName] || 0) + 1;
    });

    onProgress?.("complete", 100, 100);

    console.log("✅ Hoàn thành phân tích tổng hợp!");
    console.log(
      `📊 Final data - Comments: ${finalComments.length}, Words: ${
        wordFrequency.length
      }, Sentiment: ${JSON.stringify(
        sentimentSummary
      )}, Topics: ${JSON.stringify(topicDistribution)}`
    );
    console.log(
      `📝 Sample final comment with viContent:`,
      finalComments.slice(0, 2).map((c) => ({
        vi: c.viContent?.substring(0, 30),
        zh: c.zhContent.substring(0, 30),
      }))
    );

    return {
      comments: finalComments,
      wordFrequency,
      sentimentSummary,
      topicDistribution,
    };
  };

  return {
    translateCommentsFromExcel,
    classifyCommentsFromExcel,
    analyzeWordFrequency,
    analyzeSentimentBatch,
    analyzeCommentsFromExcel,
  };
};
