<template>
    <div class="diff-viewer font-mono text-sm" :class="{ 'compact-mode': compact }">
        <!-- Toolbar (hidden in compact mode) -->
        <div v-if="!compact"
            class="flex items-center justify-between mb-2 text-xs text-surface-600 dark:text-surface-400">
            <div class="flex items-center gap-4">
                <span class="text-red-600 dark:text-red-400">
                    <i class="pi pi-minus text-xs"></i>
                    {{ stats.deletions }} deletions
                </span>
                <span class="text-green-600 dark:text-green-400">
                    <i class="pi pi-plus text-xs"></i>
                    {{ stats.additions }} additions
                </span>
            </div>
        </div>

        <!-- Diff Content -->
        <div ref="containerRef" class="diff-content-wrapper relative">
            <!-- Unified View -->
            <div v-if="displayMode === 'unified'"
                class="diff-content border border-surface-200 dark:border-surface-700 rounded-lg overflow-hidden">
                <div v-for="(line, index) in displayLines" :key="index" class="diff-line-wrapper flex"
                    :class="getDiffLineClass(line.type)">
                    <!-- Diff indicator -->
                    <div class="diff-indicator flex-shrink-0 select-none">
                        <span v-if="line.type === 'delete'">-</span>
                        <span v-else-if="line.type === 'insert'">+</span>
                        <span v-else>&nbsp;</span>
                    </div>

                    <!-- Line content -->
                    <div class="diff-line-content flex-1 px-2">
                        <span v-if="line.type === 'equal'" class="whitespace-pre">{{ line.text }}</span>
                        <span v-else v-html="line.html" class="whitespace-pre"></span>
                    </div>
                </div>

                <!-- Truncation indicator (clickable) -->
                <div v-if="isTruncated"
                    class="truncation-indicator cursor-pointer hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
                    @click="handleExpand">
                    <span>... ({{ stats.totalLines - maxLines }} more lines)</span>
                </div>
            </div>

            <!-- Split View -->
            <div v-else
                class="diff-content-split grid grid-cols-2 gap-0 border border-surface-200 dark:border-surface-700 rounded-lg overflow-hidden">
                <!-- Left side (deletions) -->
                <div class="diff-split-pane border-r border-surface-200 dark:border-surface-700">
                    <div
                        class="diff-split-header bg-red-50 dark:bg-red-900/20 px-3 py-1 text-xs font-semibold text-red-600 dark:text-red-400 border-b border-surface-200 dark:border-surface-700">
                        Original
                    </div>
                    <div class="diff-split-content overflow-x-auto custom-scrollbar">
                        <div v-for="(line, index) in splitViewLines.left" :key="`left-${index}`"
                            class="diff-line-wrapper flex" :class="getSplitLineClass(line.type)">
                            <!-- Line content -->
                            <div class="diff-line-content flex-1 px-2">
                                <span v-if="line.isEmpty">&nbsp;</span>
                                <span v-else-if="line.type === 'equal'" class="whitespace-pre">{{ line.text }}</span>
                                <span v-else v-html="line.html" class="whitespace-pre"></span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Right side (additions) -->
                <div class="diff-split-pane">
                    <div
                        class="diff-split-header bg-green-50 dark:bg-green-900/20 px-3 py-1 text-xs font-semibold text-green-600 dark:text-green-400 border-b border-surface-200 dark:border-surface-700">
                        Modified
                    </div>
                    <div class="diff-split-content overflow-x-auto custom-scrollbar">
                        <div v-for="(line, index) in splitViewLines.right" :key="`right-${index}`"
                            class="diff-line-wrapper flex" :class="getSplitLineClass(line.type)">
                            <!-- Line content -->
                            <div class="diff-line-content flex-1 px-2">
                                <span v-if="line.isEmpty">&nbsp;</span>
                                <span v-else-if="line.type === 'equal'" class="whitespace-pre">{{ line.text }}</span>
                                <span v-else v-html="line.html" class="whitespace-pre"></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { diff_match_patch, DIFF_DELETE, DIFF_INSERT, DIFF_EQUAL } from 'diff-match-patch'

interface Props {
    oldText: string
    newText: string
    mode?: 'unified' | 'split' | 'auto'
    maxLines?: number
    compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    mode: 'unified',
    maxLines: Infinity,
    compact: false
})

const emit = defineEmits<{
    expand: []
}>()

type DiffType = 'equal' | 'insert' | 'delete'

interface DiffLine {
    type: DiffType
    text: string
    html?: string
    oldLineNumber: number | null
    newLineNumber: number | null
}

interface SplitViewLine {
    type: DiffType | 'empty'
    text: string
    html?: string
    lineNumber: number | null
    isEmpty?: boolean
}

// Container width tracking for responsive layout
const containerRef = ref<HTMLElement | null>(null)
const containerWidth = ref(0)

// Determine display mode with responsive behavior
const displayMode = computed(() => {
    if (props.mode === 'split') {
        // Split view requires minimum width (800px)
        if (containerWidth.value > 0 && containerWidth.value < 800) {
            return 'unified'
        }
        return 'split'
    }
    return props.mode
})

// Observe container width changes
const updateWidth = () => {
    if (containerRef.value) {
        containerWidth.value = containerRef.value.offsetWidth
    }
}

onMounted(() => {
    updateWidth()
    window.addEventListener('resize', updateWidth)
})

onUnmounted(() => {
    window.removeEventListener('resize', updateWidth)
})

// Calculate line-by-line diff with character-level highlighting
const diffLines = computed((): DiffLine[] => {
    const dmp = new diff_match_patch()

    // Split texts into lines first
    const oldLines = props.oldText.split('\n')
    const newLines = props.newText.split('\n')

    // Convert lines to characters for efficient diff
    const lineArray: string[] = []
    const charToLine: Map<string, string> = new Map()

    const encodeLines = (lines: string[]): string => {
        return lines.map(line => {
            let char = charToLine.get(line)
            if (!char) {
                char = String.fromCharCode(lineArray.length)
                lineArray.push(line)
                charToLine.set(line, char)
            }
            return char
        }).join('')
    }

    const oldEncoded = encodeLines(oldLines)
    const newEncoded = encodeLines(newLines)

    // Perform diff on encoded strings (each char represents a line)
    const diffs = dmp.diff_main(oldEncoded, newEncoded, false)
    dmp.diff_cleanupSemantic(diffs)

    // Convert back to lines
    const result: DiffLine[] = []
    let oldLineNum = 1
    let newLineNum = 1

    for (const [op, text] of diffs) {
        // Decode each character back to original line
        for (let i = 0; i < text.length; i++) {
            const lineText = lineArray[text.charCodeAt(i)]

            if (op === DIFF_EQUAL) {
                result.push({
                    type: 'equal',
                    text: lineText,
                    oldLineNumber: oldLineNum++,
                    newLineNumber: newLineNum++
                })
            } else if (op === DIFF_DELETE) {
                result.push({
                    type: 'delete',
                    text: lineText,
                    html: escapeHtml(lineText),
                    oldLineNumber: oldLineNum++,
                    newLineNumber: null
                })
            } else if (op === DIFF_INSERT) {
                result.push({
                    type: 'insert',
                    text: lineText,
                    html: escapeHtml(lineText),
                    oldLineNumber: null,
                    newLineNumber: newLineNum++
                })
            }
        }
    }

    // Enhance with character-level diff for adjacent delete/insert pairs
    return enhanceWithCharDiff(result)
})

// Display lines (with maxLines truncation for unified view)
const displayLines = computed(() => {
    if (props.maxLines === Infinity) {
        return diffLines.value
    }
    return diffLines.value.slice(0, props.maxLines)
})

// Check if content is truncated
const isTruncated = computed(() => {
    return props.maxLines < diffLines.value.length
})

// Split view lines with proper alignment
const splitViewLines = computed(() => {
    const left: SplitViewLine[] = []
    const right: SplitViewLine[] = []

    for (const line of diffLines.value) {
        if (line.type === 'delete') {
            // Delete: show on left, empty on right
            left.push({
                type: 'delete',
                text: line.text,
                html: line.html,
                lineNumber: line.oldLineNumber,
                isEmpty: false
            })
            right.push({
                type: 'empty',
                text: '',
                lineNumber: null,
                isEmpty: true
            })
        } else if (line.type === 'insert') {
            // Insert: empty on left, show on right
            left.push({
                type: 'empty',
                text: '',
                lineNumber: null,
                isEmpty: true
            })
            right.push({
                type: 'insert',
                text: line.text,
                html: line.html,
                lineNumber: line.newLineNumber,
                isEmpty: false
            })
        } else {
            // Equal lines appear on both sides
            left.push({
                type: 'equal',
                text: line.text,
                lineNumber: line.oldLineNumber,
                isEmpty: false
            })
            right.push({
                type: 'equal',
                text: line.text,
                lineNumber: line.newLineNumber,
                isEmpty: false
            })
        }
    }

    return { left, right }
})

// Statistics
const stats = computed(() => {
    const deletions = diffLines.value.filter(line => line.type === 'delete').length
    const additions = diffLines.value.filter(line => line.type === 'insert').length
    const totalLines = diffLines.value.length

    return { deletions, additions, totalLines }
})

// Enhance adjacent delete/insert pairs with character-level diff
function enhanceWithCharDiff(lines: DiffLine[]): DiffLine[] {
    const dmp = new diff_match_patch()
    const result: DiffLine[] = []

    for (let i = 0; i < lines.length; i++) {
        const current = lines[i]
        const next = lines[i + 1]

        // Check if current is delete and next is insert (modified line)
        if (current.type === 'delete' && next?.type === 'insert') {
            // Perform character-level diff
            const charDiffs = dmp.diff_main(current.text, next.text)
            dmp.diff_cleanupSemantic(charDiffs)

            // Generate HTML with character-level highlights
            const deleteHtml = generateCharDiffHtml(charDiffs, 'delete')
            const insertHtml = generateCharDiffHtml(charDiffs, 'insert')

            result.push({
                ...current,
                html: deleteHtml
            })
            result.push({
                ...next,
                html: insertHtml
            })

            i++ // Skip next since we processed it
        } else {
            result.push(current)
        }
    }

    return result
}

// Generate HTML with character-level highlighting
function generateCharDiffHtml(diffs: [number, string][], mode: 'delete' | 'insert'): string {
    let html = ''

    for (const [op, text] of diffs) {
        const escaped = escapeHtml(text)

        if (op === DIFF_EQUAL) {
            html += escaped
        } else if (mode === 'delete' && op === DIFF_DELETE) {
            html += `<span class="char-diff-delete">${escaped}</span>`
        } else if (mode === 'insert' && op === DIFF_INSERT) {
            html += `<span class="char-diff-insert">${escaped}</span>`
        }
    }

    return html
}

// Escape HTML entities
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

// Get CSS class for diff line (unified view)
function getDiffLineClass(type: DiffType): string {
    switch (type) {
        case 'delete':
            return 'diff-line-delete'
        case 'insert':
            return 'diff-line-insert'
        default:
            return 'diff-line-equal'
    }
}

// Get CSS class for split view line
function getSplitLineClass(type: DiffType | 'empty'): string {
    switch (type) {
        case 'delete':
            return 'diff-line-delete'
        case 'insert':
            return 'diff-line-insert'
        case 'empty':
            return 'diff-line-empty'
        default:
            return 'diff-line-equal'
    }
}

// Handle expand click
function handleExpand() {
    emit('expand')
}
</script>

<style scoped>
.diff-viewer {
    width: 100%;
}

.compact-mode {
    font-size: 0.8125rem;
}

.diff-content-wrapper {
    position: relative;
}

.diff-content,
.diff-content-split {
    background-color: var(--p-surface-0);
}

.diff-line-wrapper {
    min-height: 1.5rem;
    line-height: 1.5rem;
}

/* Line background colors */
.diff-line-equal {
    background-color: var(--p-surface-0);
}

.diff-line-delete {
    background-color: rgba(255, 235, 233, 1);
}

.diff-line-insert {
    background-color: rgba(230, 255, 236, 1);
}

.dark .diff-line-delete {
    background-color: rgba(74, 28, 28, 0.4);
}

.dark .diff-line-insert {
    background-color: rgba(28, 62, 42, 0.4);
}

/* Empty line for split view */
.diff-line-empty {
    background-color: var(--p-surface-50);
}

.dark .diff-line-empty {
    background-color: var(--p-surface-900);
}

/* Diff indicator */
.diff-indicator {
    width: 1.5rem;
    text-align: center;
    font-weight: bold;
    padding: 0 0.25rem;
}

.diff-line-delete .diff-indicator {
    color: rgba(220, 38, 38, 1);
}

.diff-line-insert .diff-indicator {
    color: rgba(22, 163, 74, 1);
}

.dark .diff-line-delete .diff-indicator {
    color: rgba(248, 113, 113, 1);
}

.dark .diff-line-insert .diff-indicator {
    color: rgba(74, 222, 128, 1);
}

/* Compact mode (chat bubble) - hide scrollbars and truncate text */
.compact-mode .diff-content .diff-line-content {
    overflow-x: hidden;
    text-overflow: ellipsis;
}

/* Character-level diff highlighting */
:deep(.char-diff-delete) {
    background-color: rgba(255, 193, 187, 1);
    font-weight: 600;
}

:deep(.char-diff-insert) {
    background-color: rgba(172, 242, 189, 1);
    font-weight: 600;
}

.dark :deep(.char-diff-delete) {
    background-color: rgba(153, 27, 27, 0.6);
}

.dark :deep(.char-diff-insert) {
    background-color: rgba(21, 128, 61, 0.5);
}

/* Truncation indicator */
.truncation-indicator {
    padding: 0.5rem 1rem;
    text-align: center;
    background-color: var(--p-surface-50);
    border-top: 1px solid var(--p-surface-200);
    color: var(--p-surface-500);
    font-size: 0.875rem;
}

.dark .truncation-indicator {
    background-color: var(--p-surface-800);
    border-top-color: var(--p-surface-700);
}

/* Split view specific */
.diff-split-pane {
    display: flex;
    flex-direction: column;
}

.diff-split-header {
    flex-shrink: 0;
}

.diff-split-content {
    flex: 1;
    overflow-y: auto;
    /* Horizontal scroll is handled here, each pane scrolls independently */
    display: flex;
    flex-direction: column;
}

.diff-split-content .diff-line-wrapper {
    /* Each line takes full width of the scrollable container */
    flex-shrink: 0;
    width: 100%;
}

.diff-split-content .diff-line-content {
    /* Content can extend horizontally */
    white-space: nowrap;
    display: inline-block;
    min-width: 100%;
}
</style>
