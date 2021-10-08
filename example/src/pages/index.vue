<script lang="ts" setup>
import { components } from '~blog/excerpts/entry'
</script>

<template>
  <div>
    <div v-for="o in components">
      <component :is="o"></component>
      <hr />
    </div>
  </div>
</template>
