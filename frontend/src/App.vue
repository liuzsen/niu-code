<template>
  <Toast />
  <router-view />
  <SessionListModal />
</template>

<script setup lang="ts">
import { useGlobalToast } from './stores/toast';
import SessionListModal from './components/SessionListModal.vue'
import { Toast, useToast } from 'primevue';

const globalToast = useGlobalToast()
globalToast.setToast(useToast())

</script>
