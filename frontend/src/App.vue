<template>
  <Toast />
  <MainPage></MainPage>
  <SessionListModal />
  <HistorySessionModal />
</template>

<script setup lang="ts">
import { useGlobalToast } from './stores/toast';
import MainPage from './view/MainPage.vue'
import SessionListModal from './components/SessionListModal.vue'
import HistorySessionModal from './components/HistorySessionModal.vue'
import { Toast, useToast } from 'primevue';

const globalToast = useGlobalToast()
globalToast.setToast(useToast())

</script>
