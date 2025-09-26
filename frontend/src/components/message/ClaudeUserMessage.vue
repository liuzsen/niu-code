<template>
    <div class="p-4">
        <MarkdownRenderer :content="content"></MarkdownRenderer>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import MarkdownRenderer from './MarkdownRenderer.vue'
import { extractTaggedContent } from '../../utils/messageExtractors';

const props = defineProps<{
    content: string
}>()

const content = computed(() => {
    return extractTaggedContent(props.content)
})

</script>