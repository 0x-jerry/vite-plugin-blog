<template>
  <router-view />
</template>

<style>
.code-highlight-lines {
  position: relative;
  line-height: 1.2em;
}

.code-highlight-lines .highlight-lines {
  position: absolute;
  width: 100%;
  pointer-events: none;
}

.code-highlight-lines .highlight-lines .highlighted {
  background: rgba(177, 177, 177, 0.342);
}
</style>
