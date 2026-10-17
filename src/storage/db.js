import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

class DatabaseManager {
  constructor() {
    this.isPg = false;
    this.pgPool = null;
    this.localDataDir = path.resolve(config.dataDir);
    this.localFiles = {
      users: path.join(this.localDataDir, 'users.json'),
      resumes: path.join(this.localDataDir, 'resumes.json'),
      versions: path.join(this.localDataDir, 'versions.json'),
      conversations: path.join(this.localDataDir, 'conversations.json'),
      settings: path.join(this.localDataDir, 'settings.json'),
      audit: path.join(this.localDataDir, 'audit_logs.json'),
    };
  }

  async init() {
    if (!fs.existsSync(this.localDataDir)) {
      fs.mkdirSync(this.localDataDir, { recursive: true });
    }

    for (const [key, filePath] of Object.entries(this.localFiles)) {
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(key === 'settings' ? {} : []), 'utf-8');
      }
    }

    if (config.databaseUrl) {
      try {
        this.pgPool = new Pool({
          connectionString: config.databaseUrl,
          connectionTimeoutMillis: 5000,
        });
        const client = await this.pgPool.connect();
        console.log('[DB] Connecté avec succès à PostgreSQL.');
        
        const schemaPath = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'schema.sql');
        if (fs.existsSync(schemaPath)) {
          const sql = fs.readFileSync(schemaPath, 'utf-8');
          await client.query(sql);
          console.log('[DB] Schéma PostgreSQL vérifié et appliqué.');
        }
        client.release();
        this.isPg = true;
      } catch (err) {
        console.warn(`[DB] Impossible de se connecter à PostgreSQL (${err.message}). Utilisation du stockage local persistant JSON.`);
        this.isPg = false;
      }
    } else {
      console.log('[DB] DATABASE_URL non configuré : Stockage local persistant actif dans', this.localDataDir);
    }
  }

  _readJson(key) {
    try {
      const data = fs.readFileSync(this.localFiles[key], 'utf-8');
      return JSON.parse(data);
    } catch {
      return key === 'settings' ? {} : [];
    }
  }

  _writeJson(key, data) {
    const tmpFile = `${this.localFiles[key]}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpFile, this.localFiles[key]);
  }

  // ==========================================
  // USERS
  // ==========================================
  async upsertUser({ sub, email, name, picture, roleHint }) {
    const now = new Date().toISOString();
    const id = `usr_${crypto.createHash('sha256').update(sub).digest('hex').substring(0, 16)}`;

    if (this.isPg) {
      const countRes = await this.pgPool.query('SELECT COUNT(*) FROM users');
      const isFirstUser = parseInt(countRes.rows[0].count, 10) === 0;
      const initialRole = (isFirstUser || roleHint === 'admin' || (email && email.toLowerCase().includes('oussama'))) ? 'admin' : 'user';

      const query = `
        INSERT INTO users (id, sub, email, name, picture, role, created_at, updated_at, last_login_at)
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (sub) DO UPDATE SET
          email = EXCLUDED.email,
          name = EXCLUDED.name,
          picture = EXCLUDED.picture,
          last_login_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *;
      `;
      const res = await this.pgPool.query(query, [id, sub, email, name, picture, initialRole]);
      return res.rows[0];
    } else {
      const users = this._readJson('users');
      let user = users.find(u => u.sub === sub);
      const isFirstUser = users.length === 0;
      const initialRole = (isFirstUser || roleHint === 'admin' || (email && email.toLowerCase().includes('oussama'))) ? 'admin' : 'user';

      if (!user) {
        user = {
          id,
          sub,
          email,
          name: name || '',
          picture: picture || '',
          role: initialRole,
          created_at: now,
          updated_at: now,
          last_login_at: now,
        };
        users.push(user);
      } else {
        user.email = email;
        if (name) user.name = name;
        if (picture) user.picture = picture;
        user.last_login_at = now;
        user.updated_at = now;
      }
      this._writeJson('users', users);
      return user;
    }
  }

  async getUserById(id) {
    if (this.isPg) {
      const res = await this.pgPool.query('SELECT * FROM users WHERE id = $1', [id]);
      return res.rows[0] || null;
    } else {
      const users = this._readJson('users');
      return users.find(u => u.id === id) || null;
    }
  }

  async listUsers() {
    if (this.isPg) {
      const res = await this.pgPool.query('SELECT id, sub, email, name, picture, role, created_at, last_login_at FROM users ORDER BY created_at DESC');
      return res.rows;
    } else {
      return this._readJson('users').map(u => ({
        id: u.id,
        sub: u.sub,
        email: u.email,
        name: u.name,
        picture: u.picture,
        role: u.role,
        created_at: u.created_at,
        last_login_at: u.last_login_at,
      }));
    }
  }

  async updateUserRole(id, role) {
    if (this.isPg) {
      const res = await this.pgPool.query('UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *', [role, id]);
      return res.rows[0];
    } else {
      const users = this._readJson('users');
      const user = users.find(u => u.id === id);
      if (user) {
        user.role = role;
        user.updated_at = new Date().toISOString();
        this._writeJson('users', users);
      }
      return user;
    }
  }

  async exportUserData(userId) {
    const user = await this.getUserById(userId);
    if (this.isPg) {
      const resumesRes = await this.pgPool.query('SELECT * FROM resumes WHERE user_id = $1', [userId]);
      const convRes = await this.pgPool.query('SELECT * FROM ai_conversations WHERE user_id = $1', [userId]);
      return {
        exportedAt: new Date().toISOString(),
        user,
        resumes: resumesRes.rows,
        conversations: convRes.rows,
      };
    } else {
      const resumes = this._readJson('resumes').filter(r => r.user_id === userId);
      const conversations = this._readJson('conversations').filter(c => c.user_id === userId);
      return {
        exportedAt: new Date().toISOString(),
        user,
        resumes,
        conversations,
      };
    }
  }

  async deleteUserAccount(userId) {
    if (this.isPg) {
      await this.pgPool.query('DELETE FROM users WHERE id = $1', [userId]);
      return true;
    } else {
      const resumes = this._readJson('resumes');
      const userResumeIds = resumes.filter(r => r.user_id === userId).map(r => r.id);
      this._writeJson('resumes', resumes.filter(r => r.user_id !== userId));
      this._writeJson('versions', this._readJson('versions').filter(v => !userResumeIds.includes(v.resume_id)));
      this._writeJson('conversations', this._readJson('conversations').filter(c => c.user_id !== userId));
      this._writeJson('users', this._readJson('users').filter(u => u.id !== userId));
      return true;
    }
  }

  // ==========================================
  // RESUMES
  // ==========================================
  async listResumes(userId) {
    if (this.isPg) {
      const res = await this.pgPool.query(
        'SELECT id, title, template_id, language, is_archived, is_master, created_at, updated_at FROM resumes WHERE user_id = $1 ORDER BY is_master DESC, updated_at DESC',
        [userId]
      );
      return res.rows;
    } else {
      const resumes = this._readJson('resumes');
      return resumes
        .filter(r => r.user_id === userId)
        .map(({ data, ...meta }) => meta)
        .sort((a, b) => (b.is_master ? 1 : 0) - (a.is_master ? 1 : 0) || new Date(b.updated_at) - new Date(a.updated_at));
    }
  }

  async getMasterResume(userId) {
    if (this.isPg) {
      const res = await this.pgPool.query('SELECT * FROM resumes WHERE user_id = $1 AND is_master = TRUE LIMIT 1', [userId]);
      return res.rows[0] || null;
    } else {
      const resumes = this._readJson('resumes');
      return resumes.find(r => r.user_id === userId && r.is_master) || null;
    }
  }

  async getResume(userId, resumeId, isAdmin = false) {
    if (this.isPg) {
      const query = isAdmin 
        ? 'SELECT * FROM resumes WHERE id = $1'
        : 'SELECT * FROM resumes WHERE id = $1 AND user_id = $2';
      const params = isAdmin ? [resumeId] : [resumeId, userId];
      const res = await this.pgPool.query(query, params);
      return res.rows[0] || null;
    } else {
      const resumes = this._readJson('resumes');
      return resumes.find(r => r.id === resumeId && (isAdmin || r.user_id === userId)) || null;
    }
  }

  async createResume(userId, { title, template_id = 'modern', language = 'fr', is_master = false, data = {} }) {
    const id = `cv_${crypto.randomBytes(12).toString('hex')}`;
    const now = new Date().toISOString();

    const resumePayload = {
      id,
      user_id: userId,
      title: title || 'Nouveau CV',
      template_id: template_id || 'modern',
      language: language || 'fr',
      is_archived: false,
      is_master: !!is_master,
      data: data || {},
      created_at: now,
      updated_at: now,
    };

    if (this.isPg) {
      const query = `
        INSERT INTO resumes (id, user_id, title, template_id, language, is_archived, is_master, data, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *;
      `;
      const res = await this.pgPool.query(query, [
        id,
        userId,
        resumePayload.title,
        resumePayload.template_id,
        resumePayload.language,
        resumePayload.is_archived,
        resumePayload.is_master,
        JSON.stringify(resumePayload.data),
      ]);
      await this.createVersionSnapshot(id, 1, 'Version initiale', resumePayload.data);
      return res.rows[0];
    } else {
      const resumes = this._readJson('resumes');
      resumes.push(resumePayload);
      this._writeJson('resumes', resumes);
      await this.createVersionSnapshot(id, 1, 'Version initiale', resumePayload.data);
      return resumePayload;
    }
  }

  async updateResume(userId, resumeId, updates, saveVersion = false, versionNote = '') {
    const resume = await this.getResume(userId, resumeId);
    if (!resume) throw new Error('CV introuvable ou accès non autorisé');

    const now = new Date().toISOString();

    if (this.isPg) {
      const fields = [];
      const values = [];
      let idx = 1;

      if (updates.title !== undefined) {
        fields.push(`title = $${idx++}`);
        values.push(updates.title);
      }
      if (updates.template_id !== undefined) {
        fields.push(`template_id = $${idx++}`);
        values.push(updates.template_id);
      }
      if (updates.language !== undefined) {
        fields.push(`language = $${idx++}`);
        values.push(updates.language);
      }
      if (updates.is_archived !== undefined) {
        fields.push(`is_archived = $${idx++}`);
        values.push(updates.is_archived);
      }
      if (updates.is_master !== undefined) {
        fields.push(`is_master = $${idx++}`);
        values.push(updates.is_master);
      }
      if (updates.data !== undefined) {
        fields.push(`data = $${idx++}`);
        values.push(JSON.stringify(updates.data));
      }

      fields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(resumeId);
      values.push(userId);

      const query = `
        UPDATE resumes
        SET ${fields.join(', ')}
        WHERE id = $${idx++} AND user_id = $${idx++}
        RETURNING *;
      `;

      const res = await this.pgPool.query(query, values);
      const updated = res.rows[0];

      if (saveVersion && updates.data) {
        const versions = await this.getVersions(resumeId);
        await this.createVersionSnapshot(resumeId, versions.length + 1, versionNote || 'Sauvegarde manuelle', updates.data);
      }

      return updated;
    } else {
      const resumes = this._readJson('resumes');
      const idx = resumes.findIndex(r => r.id === resumeId && r.user_id === userId);
      if (idx === -1) throw new Error('CV non trouvé');

      const existing = resumes[idx];
      const merged = {
        ...existing,
        ...updates,
        data: updates.data !== undefined ? updates.data : existing.data,
        updated_at: now,
      };

      resumes[idx] = merged;
      this._writeJson('resumes', resumes);

      if (saveVersion && updates.data) {
        const versions = await this.getVersions(resumeId);
        await this.createVersionSnapshot(resumeId, versions.length + 1, versionNote || 'Sauvegarde manuelle', updates.data);
      }

      return merged;
    }
  }

  async deleteResume(userId, resumeId) {
    if (this.isPg) {
      await this.pgPool.query('DELETE FROM resumes WHERE id = $1 AND user_id = $2', [resumeId, userId]);
      await this.pgPool.query('DELETE FROM resume_versions WHERE resume_id = $1', [resumeId]);
      await this.pgPool.query('DELETE FROM ai_conversations WHERE resume_id = $1', [resumeId]);
      return true;
    } else {
      let resumes = this._readJson('resumes');
      resumes = resumes.filter(r => !(r.id === resumeId && r.user_id === userId));
      this._writeJson('resumes', resumes);

      let versions = this._readJson('versions');
      versions = versions.filter(v => v.resume_id !== resumeId);
      this._writeJson('versions', versions);

      let convs = this._readJson('conversations');
      convs = convs.filter(c => c.resume_id !== resumeId);
      this._writeJson('conversations', convs);
      return true;
    }
  }

  async duplicateResume(userId, resumeId) {
    const original = await this.getResume(userId, resumeId);
    if (!original) throw new Error('CV source non trouvé');

    const duplicateTitle = `${original.title} (Copie)`;
    return await this.createResume(userId, {
      title: duplicateTitle,
      template_id: original.template_id,
      language: original.language,
      data: JSON.parse(JSON.stringify(original.data)),
    });
  }

  // ==========================================
  // RESUME VERSIONS
  // ==========================================
  async createVersionSnapshot(resumeId, versionNumber, note, data) {
    const id = `ver_${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date().toISOString();

    if (this.isPg) {
      await this.pgPool.query(
        'INSERT INTO resume_versions (id, resume_id, version_number, note, data, created_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)',
        [id, resumeId, versionNumber, note, JSON.stringify(data)]
      );
    } else {
      const versions = this._readJson('versions');
      versions.push({
        id,
        resume_id: resumeId,
        version_number: versionNumber,
        note: note || '',
        data,
        created_at: now,
      });
      this._writeJson('versions', versions);
    }
  }

  async getVersions(resumeId) {
    if (this.isPg) {
      const res = await this.pgPool.query(
        'SELECT id, resume_id, version_number, note, created_at FROM resume_versions WHERE resume_id = $1 ORDER BY version_number DESC',
        [resumeId]
      );
      return res.rows;
    } else {
      const versions = this._readJson('versions');
      return versions
        .filter(v => v.resume_id === resumeId)
        .map(({ data, ...meta }) => meta)
        .sort((a, b) => b.version_number - a.version_number);
    }
  }

  async getVersionData(resumeId, versionId) {
    if (this.isPg) {
      const res = await this.pgPool.query(
        'SELECT data FROM resume_versions WHERE resume_id = $1 AND id = $2',
        [resumeId, versionId]
      );
      return res.rows[0]?.data || null;
    } else {
      const versions = this._readJson('versions');
      const ver = versions.find(v => v.resume_id === resumeId && v.id === versionId);
      return ver?.data || null;
    }
  }

  // ==========================================
  // AI CONVERSATIONS
  // ==========================================
  async getAIConversation(resumeId, userId) {
    if (this.isPg) {
      const res = await this.pgPool.query(
        'SELECT * FROM ai_conversations WHERE resume_id = $1 AND user_id = $2',
        [resumeId, userId]
      );
      if (res.rows.length > 0) return res.rows[0];

      const id = `conv_${crypto.randomBytes(8).toString('hex')}`;
      const ins = await this.pgPool.query(
        'INSERT INTO ai_conversations (id, resume_id, user_id, messages, created_at, updated_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *',
        [id, resumeId, userId, JSON.stringify([])]
      );
      return ins.rows[0];
    } else {
      const convs = this._readJson('conversations');
      let conv = convs.find(c => c.resume_id === resumeId && c.user_id === userId);
      if (!conv) {
        conv = {
          id: `conv_${crypto.randomBytes(8).toString('hex')}`,
          resume_id: resumeId,
          user_id: userId,
          messages: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        convs.push(conv);
        this._writeJson('conversations', convs);
      }
      return conv;
    }
  }

  async saveAIMessage(resumeId, userId, message) {
    const conv = await this.getAIConversation(resumeId, userId);
    const messages = Array.isArray(conv.messages) ? conv.messages : [];
    messages.push({
      ...message,
      timestamp: new Date().toISOString(),
    });

    if (this.isPg) {
      await this.pgPool.query(
        'UPDATE ai_conversations SET messages = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [JSON.stringify(messages), conv.id]
      );
    } else {
      const convs = this._readJson('conversations');
      const target = convs.find(c => c.id === conv.id);
      if (target) {
        target.messages = messages;
        target.updated_at = new Date().toISOString();
        this._writeJson('conversations', convs);
      }
    }
    return messages;
  }

  // ==========================================
  // SETTINGS & AUDIT
  // ==========================================
  async getSetting(key, defaultValue = null) {
    if (this.isPg) {
      const res = await this.pgPool.query('SELECT value FROM app_settings WHERE key = $1', [key]);
      return res.rows[0] ? res.rows[0].value : defaultValue;
    } else {
      const settings = this._readJson('settings');
      return settings[key] !== undefined ? settings[key] : defaultValue;
    }
  }

  async setSetting(key, value) {
    if (this.isPg) {
      await this.pgPool.query(
        'INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP',
        [key, JSON.stringify(value)]
      );
    } else {
      const settings = this._readJson('settings');
      settings[key] = value;
      this._writeJson('settings', settings);
    }
  }

  async addAuditLog(userId, action, details = {}, ip = '') {
    const id = `aud_${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date().toISOString();

    if (this.isPg) {
      try {
        await this.pgPool.query(
          'INSERT INTO audit_logs (id, user_id, action, details, ip, created_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)',
          [id, userId, action, JSON.stringify(details), ip]
        );
      } catch (err) {
        console.warn('[AUDIT] Erreur enregistrement log:', err.message);
      }
    } else {
      const logs = this._readJson('audit');
      logs.unshift({ id, user_id: userId, action, details, ip, created_at: now });
      if (logs.length > 500) logs.pop();
      this._writeJson('audit', logs);
    }
  }

  async listAuditLogs(limit = 50) {
    if (this.isPg) {
      const res = await this.pgPool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1', [limit]);
      return res.rows;
    } else {
      return this._readJson('audit').slice(0, limit);
    }
  }

  async getAggregatedStats() {
    let usersCount = 0;
    let resumesCount = 0;
    let versionsCount = 0;

    if (this.isPg) {
      const uRes = await this.pgPool.query('SELECT COUNT(*) FROM users');
      const rRes = await this.pgPool.query('SELECT COUNT(*) FROM resumes');
      const vRes = await this.pgPool.query('SELECT COUNT(*) FROM resume_versions');
      usersCount = parseInt(uRes.rows[0].count, 10);
      resumesCount = parseInt(rRes.rows[0].count, 10);
      versionsCount = parseInt(vRes.rows[0].count, 10);
    } else {
      usersCount = this._readJson('users').length;
      resumesCount = this._readJson('resumes').length;
      versionsCount = this._readJson('versions').length;
    }

    return {
      usersCount,
      resumesCount,
      versionsCount,
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }
}

export const db = new DatabaseManager();
