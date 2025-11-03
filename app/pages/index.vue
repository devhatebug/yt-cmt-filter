<script lang="ts" setup>
import type {
  YouTubeComment,
  VideoData,
  FilterOptions,
} from "../types/comment";

const toast = useToast();
const { fetchVideoData } = useYouTubeData();
const { filterComments, countTotalComments } = useCommentFilter();
const { exportToExcel } = useExcelExport();
const { translateCommentsFromExcel, analyzeCommentsFromExcel } = useGemini();

// State
const activeTab = ref<"crawl" | "translate" | "analyze">("crawl");
const videoUrl = ref("");
const isLoading = ref(false);
const videoData = ref<VideoData | null>(null);
const allComments = ref<YouTubeComment[]>([]);
const loadingProgress = ref({
  current: 0,
  total: 0,
});

const filters = ref<FilterOptions>({
  removeEmojiOnly: false,
  removeAdvertisements: false,
  removeGenericComments: false,
});

// Translation state
const isTranslating = ref(false);
const translatedComments = ref<
  Array<{
    index: number;
    author: string;
    content: string;
    type: string;
    date: string;
    translatedContent: string;
  }>
>([]);
const translationProgress = ref({
  current: 0,
  total: 0,
});

// Computed
const hasData = computed(() => allComments.value.length > 0);

const filteredComments = computed(() => {
  return filterComments(allComments.value, filters.value);
});

// const estimatedRange = computed(() => {
//   return videoData.value?.estimatedRange || "";
// });

// Methods
const fetchData = async () => {
  if (!videoUrl.value) {
    toast.add({
      title: "Lỗi",
      description: "Vui lòng nhập link video YouTube",
      color: "error",
      icon: "i-heroicons-exclamation-circle",
    });
    return;
  }

  isLoading.value = true;
  loadingProgress.value = { current: 0, total: 0 };

  try {
    const result = await fetchVideoData(videoUrl.value, (current, total) => {
      loadingProgress.value = { current, total };
    });

    videoData.value = result.videoData;
    allComments.value = result.comments;

    const totalCount = countTotalComments(result.comments);
    toast.add({
      title: "Thành công",
      description: `Đã tải ${totalCount} bình luận (bao gồm ${
        result.comments.length
      } comment chính và ${totalCount - result.comments.length} replies)`,
      color: "success",
      icon: "i-heroicons-check-circle",
    });
  } catch (error) {
    console.error(error);
    toast.add({
      title: "Lỗi",
      description: (error as Error).message,
      color: "error",
      icon: "i-heroicons-exclamation-circle",
    });
  } finally {
    isLoading.value = false;
    loadingProgress.value = { current: 0, total: 0 };
  }
};

const exportData = () => {
  if (!videoData.value) return;

  try {
    exportToExcel(filteredComments.value, videoData.value);
    toast.add({
      title: "Thành công",
      description: "Đã xuất file Excel",
      color: "success",
      icon: "i-heroicons-check-circle",
    });
  } catch (error) {
    console.log("error export data", error);
    toast.add({
      title: "Lỗi",
      description: "Không thể xuất file Excel",
      color: "error",
      icon: "i-heroicons-exclamation-circle",
    });
  }
};

// Translation methods
const handleTranslationUpload = async (file: File) => {
  isTranslating.value = true;
  translationProgress.value = { current: 0, total: 0 };
  translatedComments.value = [];

  try {
    const results = await translateCommentsFromExcel(file, (current, total) => {
      translationProgress.value = { current, total };
    });

    translatedComments.value = results;

    toast.add({
      title: "Thành công",
      description: `Đã dịch ${results.length} comments sang tiếng Trung`,
      color: "success",
      icon: "i-heroicons-check-circle",
    });
  } catch (error) {
    console.error("Translation error:", error);
    toast.add({
      title: "Lỗi",
      description: (error as Error).message || "Không thể dịch comments",
      color: "error",
      icon: "i-heroicons-exclamation-circle",
    });
  } finally {
    isTranslating.value = false;
    translationProgress.value = { current: 0, total: 0 };
  }
};

// Analysis state (đã gộp classify vào đây)
const isAnalyzing = ref(false);
const analysisResults = ref<{
  comments: Array<{
    index: number;
    date: string;
    author: string;
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
} | null>(null);
const analysisProgress = ref({
  stage: "",
  current: 0,
  total: 0,
});

// Analysis methods
const handleAnalysisUpload = async (file: File) => {
  isAnalyzing.value = true;
  analysisProgress.value = { stage: "reading", current: 0, total: 100 };
  analysisResults.value = null;

  try {
    const results = await analyzeCommentsFromExcel(
      file,
      (stage, current, total) => {
        analysisProgress.value = { stage, current, total };
      }
    );

    analysisResults.value = results;

    toast.add({
      title: "Thành công",
      description: `Đã phân tích ${results.comments.length} comments`,
      color: "success",
      icon: "i-heroicons-check-circle",
    });
  } catch (error) {
    console.error("Analysis error:", error);
    toast.add({
      title: "Lỗi",
      description: (error as Error).message || "Không thể phân tích comments",
      color: "error",
      icon: "i-heroicons-exclamation-circle",
    });
  } finally {
    isAnalyzing.value = false;
    analysisProgress.value = { stage: "", current: 0, total: 0 };
  }
};

const getProgressMessage = (stage: string) => {
  switch (stage) {
    case "reading":
      return "Đang đọc file...";
    case "analyzing":
      return "Đang phân tích...";
    case "finalizing":
      return "Đang hoàn thiện...";
    case "complete":
      return "Hoàn thành!";
    default:
      return "Đang xử lý...";
  }
};
</script>

<template>
  <div class="container mx-auto px-4 py-8 max-w-7xl">
    <div class="mb-8">
      <h1 class="text-3xl font-bold mb-2">
        YouTube Comment Filter & Translator
      </h1>
      <p class="text-gray-600">
        Lọc, phân tích và dịch bình luận từ video YouTube
      </p>
    </div>

    <!-- Tabs -->
    <div class="mb-6">
      <div class="border-b border-[var(--ui-border-muted)]">
        <nav class="-mb-px flex space-x-8">
          <button
            :class="[
              'py-4 px-1 border-b-2 border-[var(--ui-border-muted)] font-medium text-sm transition-colors',
              activeTab === 'crawl'
                ? 'border-primary-500 text-primary-600'
                : 'border-[var(--ui-border-muted)] text-gray-500 hover:text-gray-700',
            ]"
            @click="activeTab = 'crawl'">
            <TobiIcon name="i-heroicons-cloud-arrow-down" class="inline mr-2" />
            Thu thập Comments
          </button>
          <button
            :class="[
              'py-4 px-1 border-b-2 font-medium text-sm transition-colors',
              activeTab === 'translate'
                ? 'border-primary-500 text-primary-600'
                : 'border-[var(--ui-border-muted)] text-gray-500 hover:text-gray-700',
            ]"
            @click="activeTab = 'translate'">
            <TobiIcon name="i-heroicons-language" class="inline mr-2" />
            Dịch sang Tiếng Trung
          </button>
          <button
            :class="[
              'py-4 px-1 border-b-2 font-medium text-sm transition-colors',
              activeTab === 'analyze'
                ? 'border-primary-500 text-primary-600'
                : 'border-[var(--ui-border-muted)] text-gray-500 hover:text-gray-700',
            ]"
            @click="activeTab = 'analyze'">
            <TobiIcon name="i-heroicons-chart-bar" class="inline mr-2" />
            Phân tích tổng hợp
          </button>
        </nav>
      </div>
    </div>

    <!-- Tab: Crawl Comments -->
    <div v-show="activeTab === 'crawl'" class="space-y-6">
      <!-- Form nhập link -->
      <VideoLinkForm
        v-model="videoUrl"
        :loading="isLoading"
        :progress="loadingProgress"
        @submit="fetchData" />

      <!-- Bộ lọc -->
      <CommentFilters
        v-if="hasData"
        v-model="filters"
        :total="countTotalComments(allComments)"
        :filtered="countTotalComments(filteredComments)" />

      <!-- Bảng hoặc Empty State -->
      <TobiCard>
        <CommentsTable
          v-if="hasData"
          :comments="filteredComments"
          :loading="isLoading"
          @export="exportData" />

        <EmptyState v-else />
      </TobiCard>
    </div>

    <!-- Tab: Translate -->
    <div v-show="activeTab === 'translate'" class="space-y-6">
      <!-- Upload form -->
      <TranslationUploadForm @upload="handleTranslationUpload" />

      <!-- Progress -->
      <TobiCard v-if="isTranslating">
        <div class="space-y-3">
          <div class="flex justify-between items-center">
            <span class="text-sm font-medium text-gray-700">Đang dịch...</span>
            <span class="text-sm font-semibold text-primary-600">
              {{ translationProgress.current }} /
              {{ translationProgress.total }}
            </span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2.5">
            <div
              class="bg-primary-600 h-2.5 rounded-full transition-all duration-300"
              :style="{
                width: `${
                  (translationProgress.current / translationProgress.total) *
                  100
                }%`,
              }" />
          </div>
        </div>
      </TobiCard>

      <!-- Translated results -->
      <TobiCard v-if="translatedComments.length > 0">
        <TranslatedCommentsTable
          :comments="translatedComments"
          :loading="isTranslating" />
      </TobiCard>
    </div>

    <!-- Tab: Analyze (Phân tích tổng hợp) - Gộp cả classify vào đây -->
    <div v-show="activeTab === 'analyze'" class="space-y-6">
      <!-- Upload form -->
      <AnalysisUploadForm @upload="handleAnalysisUpload" />

      <!-- Progress -->
      <TobiCard v-if="isAnalyzing">
        <div class="space-y-3">
          <div class="flex justify-between items-center">
            <span class="text-sm font-medium text-gray-700">
              {{ getProgressMessage(analysisProgress.stage) }}
            </span>
            <span class="text-sm font-semibold text-primary-600">
              {{ analysisProgress.current }}%
            </span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2.5">
            <div
              class="bg-primary-600 h-2.5 rounded-full transition-all duration-300"
              :style="{
                width: `${analysisProgress.current}%`,
              }" />
          </div>
          <p class="text-xs text-gray-500 text-center">
            🚀 Song song 3 phân tích: Tần suất từ + Cảm xúc + Chủ đề (nhanh gấp
            3 lần!)
          </p>
        </div>
      </TobiCard>

      <!-- Analysis results -->
      <AnalysisResults
        v-if="analysisResults"
        :data="analysisResults"
        :loading="isAnalyzing" />
    </div>
  </div>
</template>

<style scoped>
/* Đảm bảo responsive và overflow handling */
:deep(.overflow-x-auto) {
  -webkit-overflow-scrolling: touch;
}
</style>
