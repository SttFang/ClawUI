/** Auth method for a provider */
export interface ProviderAuthEffective {
  kind: 'env' | 'profiles' | 'token' | 'none'
  detail?: string
}

/** OAuth profile status */
export interface OAuthProfile {
  type: 'oauth'
  status: 'ok' | 'expired' | 'missing'
  expiresAt?: string
}

/** Per-provider OAuth status */
export interface OAuthProviderStatus {
  provider: string
  status: 'ok' | 'expired' | 'missing'
  profiles: OAuthProfile[]
}

/** Per-provider auth info from CLI */
export interface ProviderAuthInfo {
  provider: string
  effective: ProviderAuthEffective
  profiles?: Record<string, number>
}

/** Full output of `openclaw models status --json` */
export interface ModelsStatus {
  defaultModel: string
  fallbacks: string[]
  auth: {
    providers: ProviderAuthInfo[]
    oauthStatus?: {
      providers: OAuthProviderStatus[]
    }
  }
}
