<script setup lang="ts">
import { router } from '@inertiajs/vue3'
import { ref } from 'vue'

defineProps<{
  foo: string
  bar: string
}>()

const errors = ref(0)
const finished = ref(0)
const success = ref(0)

const bagErrors = () => {
  router.replace({
    preserveState: true,
    props: (props) => ({ ...props, errors: { bag: { foo: 'bar' } } }),
    errorBag: 'bag',
    onError: (err) => {
      errors.value = Object.keys(err).length
    },
    onFinish: () => finished.value++,
    onSuccess: () => success.value++,
  })
}

const defaultErrors = () => {
  router.replace({
    preserveState: true,
    props: (props) => ({ ...props, errors: { foo: 'bar', baz: 'qux' } }),
    onError: (err) => {
      errors.value = Object.keys(err).length
    },
    onFinish: () => finished.value++,
    onSuccess: () => success.value++,
  })
}

const replace = () => {
  router.replace({
    preserveState: true,
    props: (props) => ({ ...props, foo: 'foo from client' }),
    onFinish: (visit) => {
      if (visit.preserveState) {
        finished.value++
      }
    },
    onSuccess: (page) => {
      if (page.props.foo === 'foo from client') {
        success.value++
      }
    },
  })
}

const push = () => {
  router.push({
    url: '/client-side-visit-2',
    component: 'ClientSideVisit/Page2',
    props: {
      baz: 'baz from client',
    },
  })
}
</script>

<template>
  <div>{{ foo }}</div>
  <div>{{ bar }}</div>
  <button @click="replace">Replace</button>
  <button @click="push">Push</button>
  <button @click="defaultErrors">Errors (default)</button>
  <button @click="bagErrors">Errors (bag)</button>
  <div>Errors: {{ errors }}</div>
  <div>Finished: {{ finished }}</div>
  <div>Success: {{ success }}</div>
</template>
