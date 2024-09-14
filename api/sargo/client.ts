import Strapi from 'strapi-sdk-js'

const strapi = new Strapi({
  url: process.env.NEXT_PUBLIC_STRAPI_API_URL || 'http://localhost:1337',
  prefix: '/api',
  store: {
    key: 'strapi_jwt',
    useLocalStorage: false,
    ttl: 86400,
  },
})

export default strapi
