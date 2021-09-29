<template>
  <div>
    This is a test component

    <button @click="count++">{{ count }}</button>

    <slot></slot>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'

const count = ref(0)
</script>
