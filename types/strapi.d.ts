declare module 'strapi-sdk-js' {
  export interface StrapiAuthenticationData {
    jwt: string
    user: {
      id: number
      username: string
      email: string
    }
  }

  export interface StrapiRequestParams {
    [key: string]: any
  }

  export default class Strapi {
    constructor(options?: {
      url?: string
      prefix?: string
      store?: {
        key?: string
        useLocalStorage?: boolean
        ttl?: number
      }
      axiosOptions?: any
    })

    find(contentType: string, params?: StrapiRequestParams): Promise<any>
    findOne(
      contentType: string,
      id: string | number,
      params?: StrapiRequestParams
    ): Promise<any>
    create(
      contentType: string,
      data: any,
      params?: StrapiRequestParams
    ): Promise<any>
    update(
      contentType: string,
      id: string | number,
      data: any,
      params?: StrapiRequestParams
    ): Promise<any>
    delete(
      contentType: string,
      id: string | number,
      params?: StrapiRequestParams
    ): Promise<any>
    login(
      identifier: string,
      password: string
    ): Promise<StrapiAuthenticationData>
    register(
      username: string,
      email: string,
      password: string
    ): Promise<StrapiAuthenticationData>
    setToken(token: string): void
    clearToken(): void
    fetchUser(): Promise<any>
    request(
      method: string,
      url: string,
      data?: any,
      params?: StrapiRequestParams
    ): Promise<any>
  }
}
