import crypto from 'crypto';
import { config } from '../config.js';
import { db } from '../storage/db.js';
import { SessionManager } from './session.js';

export class OIDCAuthService {
  static generatePKCE() {
    // Generate high-entropy 64-character verifier
    const code_verifier = crypto.randomBytes(32).toString('base64url');
    const code_challenge = crypto
      .createHash('sha256')
      .update(code_verifier)
      .digest('base64url');
    return { code_verifier, code_challenge };
  }

  static generateSignedState() {
    const nonce = crypto.randomBytes(16).toString('hex');
    const signature = crypto
      .createHmac('sha256', config.sso.sessionSecret)
      .update(`state:${nonce}`)
      .digest('hex');
    return `${nonce}.${signature}`;
  }

  static verifySignedState(state) {
    if (!state || typeof state !== 'string') return false;
    const parts = state.split('.');
    if (parts.length !== 2) return false;

    const [nonce, signature] = parts;
    const expected = crypto
      .createHmac('sha256', config.sso.sessionSecret)
      .update(`state:${nonce}`)
      .digest('hex');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return false;

    return crypto.timingSafeEqual(sigBuf, expBuf);
  }

  static getAuthorizationUrl(redirectUri, state, code_challenge) {
    const authEndpoint = `${config.sso.baseUrl}/oauth/authorize`;
    const url = new URL(authEndpoint);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', config.sso.clientId);
    url.searchParams.set('redirect_uri', redirectUri || config.sso.redirectUri);
    url.searchParams.set('scope', config.sso.scopes);
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', code_challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  }

  static async exchangeCodeForToken(code, code_verifier, redirectUri) {
    const tokenEndpoint = `${config.sso.baseUrl}/oauth/token`;
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.sso.clientId,
      client_secret: config.sso.clientSecret,
      code: code,
      redirect_uri: redirectUri || config.sso.redirectUri,
      code_verifier: code_verifier,
    });

    const res = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: body.toString(),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Erreur échange code SSO (${res.status}): ${errText}`);
    }

    return await res.json();
  }

  static async fetchUserInfo(accessToken) {
    const userinfoEndpoint = `${config.sso.baseUrl}/oauth/userinfo`;
    const res = await fetch(userinfoEndpoint, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Erreur récupération profil SSO (${res.status}): ${errText}`);
    }

    return await res.json();
  }
}

// Middleware to extract user from session cookie
export function authenticateUser(req, res, next) {
  const token = req.cookies?.[config.sso.cookieName];
  if (!token) {
    req.user = null;
    return next();
  }

  const session = SessionManager.verifyToken(token);
  if (!session) {
    SessionManager.clearSessionCookie(res);
    req.user = null;
    return next();
  }

  req.user = session;
  next();
}

// Middleware requiring authentication
export function requireAuth(req, res, next) {
  if (!req.user) {
    if (req.accepts('html')) {
      return res.redirect('/auth/login');
    }
    return res.status(401).json({ error: 'Non authentifié. Veuillez vous connecter via le SSO.' });
  }
  next();
}

// Middleware requiring admin role
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Non authentifié.' });
  }
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Accès interdit. Droits administrateur requis.' });
  }
  next();
}
