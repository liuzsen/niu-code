<template>
  <div v-if="images.length > 0" class="flex flex-wrap gap-2 mb-2">
    <div v-for="image in images" :key="image.id" class="relative group">
      <!-- 缩略图 -->
      <img :src="image.thumbnailUrl" :alt="image.mediaType"
        class="w-8 h-8 object-cover rounded-lg border-2 border-surface-200 dark:border-surface-700" />

      <!-- 删除按钮 -->
      <button @click="$emit('remove', image.id)" class="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full
               flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity
               shadow-lg" title="移除图片">
        <i class="pi pi-times text-xs"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ImageAttachment } from '../../composables/useMessageEditor'

defineProps<{
  images: ImageAttachment[]
}>()

defineEmits<{
  remove: [id: string]
}>()
</script>
