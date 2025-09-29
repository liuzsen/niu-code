<template>
  <Toast />
  <MainPage></MainPage>
</template>

<script setup lang="ts">
import { useGlobalToast } from './stores/toast';
import MainPage from './view/MainPage.vue'
import { Toast, useToast } from 'primevue';

const globalToast = useGlobalToast()
globalToast.setToast(useToast())

</script>
