// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  css: ['~/assets/main.css'],
  modules: ['@nuxtjs/tailwindcss'],
  nitro: {
    externals: {
      inline: [
        '@prisma/adapter-pg'
      ]
    }
  }
})
