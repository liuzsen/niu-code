<template>
    <div class="h-full flex flex-col">
        <Toast />
        <AppHeader />
        <div class=" overflow-hidden bg-page-bg h-full">
            <ChatLayout />
        </div>
    </div>
</template>

<script setup lang="ts">
import AppHeader from '../components/AppHeader.vue'
import ChatLayout from '../components/ChatLayout.vue'
import Toast from 'primevue/toast'

</script>
