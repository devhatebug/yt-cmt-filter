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

// State
const videoUrl = ref("");
const isLoading = ref(false);
const videoData = ref<VideoData | null>(null);
const allComments = ref<YouTubeComment[]>([]);

const filters = ref<FilterOptions>({
  removeEmojiOnly: false,
  removeAdvertisements: false,
  removeGenericComments: false,
});

// Computed
const hasData = computed(() => allComments.value.length > 0);

const filteredComments = computed(() => {
  return filterComments(allComments.value, filters.value);
});

const estimatedRange = computed(() => {
  return videoData.value?.estimatedRange || "";
});

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

  try {
    const result = await fetchVideoData(videoUrl.value);
    videoData.value = result.videoData;
    allComments.value = result.comments;

    const totalCount = countTotalComments(result.comments);
    toast.add({
      title: "Thành công",
      description: `Đã tải ${totalCount} bình luận (bao gồm ${result.comments.length} comment chính và replies)`,
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
</script>

<template>
  <div class="container mx-auto px-4 py-8 max-w-7xl">
    <div class="mb-8">
      <h1 class="text-3xl font-bold mb-2">YouTube Comment Filter</h1>
      <p class="text-gray-600">Lọc và phân tích bình luận từ video YouTube</p>
    </div>

    <!-- Form nhập link -->
    <VideoLinkForm
      v-model="videoUrl"
      :loading="isLoading"
      @submit="fetchData"
      class="mb-6" />

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
</template>

<style scoped>
/* Đảm bảo responsive và overflow handling */
:deep(.overflow-x-auto) {
  -webkit-overflow-scrolling: touch;
}
</style>
