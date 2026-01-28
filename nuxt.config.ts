// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  modules: ['@nuxtjs/tailwindcss'],
  nitro: {
    externals: {
      inline: [
        '~/app/generated/prisma/client',
        'app/generated/prisma/client',
        '@prisma/adapter-pg'
      ]
    }
  }
})
