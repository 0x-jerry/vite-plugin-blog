<script lang="ts" setup>
import { modules } from '~blog/excerpts/entry'
</script>

<template>
  <div>
    <div v-for="o in modules">
      <component :is="o.module"></component>
      <hr />
    </div>
  </div>
</template>
