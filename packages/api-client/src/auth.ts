import { chain, FutureInstance, map } from 'fluture'
import { AuthStore, DataLoader } from './common'

export function createAuthApi(authStore: AuthStore, dataLoader: DataLoader) {
  function forgotPassword(email: string): FutureInstance<unknown, void> {
    return dataLoader('/auth/forgot', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  }

  function login(
    email: string,
    password: string
  ): FutureInstance<unknown, void> {
    const token = dataLoader<string>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
      }),
    })

    return token
      .pipe(chain(token => authStore.setSessionToken(token)))
      .pipe(map(() => undefined))
  }

  function logout(): FutureInstance<unknown, void> {
    return dataLoader('/auth/logout')
  }

  return {
    forgotPassword,
    login,
    logout,
  }
}

export type AuthApi = ReturnType<typeof createAuthApi>
