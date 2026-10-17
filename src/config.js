import dotenv from 'dotenv';
dotenv.config();

const appUrl = (process.env.APP_URL || 'https://fgsig3a5qv8fl5npseoryxxx.oussamma.tn').replace(/\/+$/, '');

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'production',
  appUrl,
  
  // SSO / OIDC Configuration (supports both OIDC_* and SSO_* conventions)
  sso: {
    baseUrl: (process.env.OIDC_ISSUER || process.env.SSO_BASE_URL || 'https://sso-a.oussamma.tn').replace(/\/+$/, ''),
    clientId: process.env.OIDC_CLIENT_ID || process.env.SSO_CLIENT_ID || 'client_cvbuilder_app',
    clientSecret: process.env.OIDC_CLIENT_SECRET || process.env.SSO_CLIENT_SECRET || '',
    redirectUri: process.env.OIDC_REDIRECT_URI || process.env.SSO_REDIRECT_URI || `${appUrl}/auth/callback`,
    postLogoutRedirectUri: process.env.OIDC_POST_LOGOUT_REDIRECT_URI || `${appUrl}/`,
    scopes: process.env.SSO_SCOPES || 'openid profile email',
    sessionSecret: process.env.SESSION_SECRET || 'default-dev-session-secret-change-in-prod',
    cookieName: 'cvbuilder_session',
  },

  // LiteLLM Configuration (supports both LITELLM_MODEL and LITELLM_DEFAULT_MODEL)
  litellm: {
    baseUrl: (process.env.LITELLM_BASE_URL || 'https://ai.oussamma.tn/v1').replace(/\/+$/, ''),
    apiKey: process.env.LITELLM_API_KEY || '',
    defaultModel: process.env.LITELLM_MODEL || process.env.LITELLM_DEFAULT_MODEL || 'gemini/gemini-3.1-flash-lite-preview',
    timeout: parseInt(process.env.LITELLM_TIMEOUT || '60000', 10),
    maxTokens: parseInt(process.env.LITELLM_MAX_TOKENS || '4096', 10),
  },

  // Database & Storage
  databaseUrl: process.env.DATABASE_URL || '',
  dataDir: process.env.DATA_DIR || './data',
};
