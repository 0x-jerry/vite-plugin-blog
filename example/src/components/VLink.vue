<script lang="ts" setup>
defineProps<{ href?: string }>()
</script>

<template>
  <a class="v-link" :href="href">
    <slot></slot>
  </a>
</template>

<style></style>
