import crypto from 'crypto';
import { config } from '../config.js';

export class SessionManager {
  static signToken(payload) {
    const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', config.sso.sessionSecret)
      .update(data)
      .digest('base64url');
    return `${data}.${signature}`;
  }

  static verifyToken(token) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [data, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', config.sso.sessionSecret)
      .update(data)
      .digest('base64url');

    // Constant-time comparison
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    try {
      const decoded = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8'));
      if (decoded.exp && Date.now() > decoded.exp) {
        return null; // Expired
      }
      return decoded;
    } catch {
      return null;
    }
  }

  static createSessionCookie(res, user) {
    const sessionPayload = {
      id: user.id,
      sub: user.sub,
      email: user.email,
      name: user.name,
      role: user.role || 'user',
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    const token = this.signToken(sessionPayload);
    const isProd = config.nodeEnv === 'production';

    res.cookie(config.sso.cookieName, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return token;
  }

  static clearSessionCookie(res) {
    res.clearCookie(config.sso.cookieName, {
      httpOnly: true,
      path: '/',
    });
  }
}
