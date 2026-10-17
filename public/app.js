// ==============================================================
// CV BUILDER IA — CLIENT APPLICATION
// ==============================================================

const state = {
  currentUser: null,
  currentResume: null,
  resumes: [],
  templates: [],
  resumeFilter: 'active',
  currentLanguage: 'fr',
  currentZoom: 1.0,
  activeMobileTab: 'form',
  activeView: 'landing',
  autoSaveTimer: null,
  previewTimer: null,
  undoStack: [],
  redoStack: [],
  pendingExtractedPdf: null,
  pendingPdfFilename: '',
};

document.addEventListener('DOMContentLoaded', async () => {
  initLucide();
  checkAuthErrorInUrl();
  registerServiceWorker();
  await loadTemplates();
  await checkAuth();
});

function initLucide() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

function checkAuthErrorInUrl() {
  const params = new URLSearchParams(window.location.search);
  const err = params.get('auth_error');
  if (err) {
    const banner = document.getElementById('auth-error-banner');
    if (banner) {
      banner.classList.remove('hidden');
      banner.innerText = `Erreur d'authentification SSO : ${err}`;
    }
    window.history.replaceState({}, document.title, '/');
  }
}

// ==========================================
// AUTHENTICATION & NAVIGATION
// ==========================================
async function checkAuth() {
  try {
    const res = await fetch('/auth/me');
    const data = await res.json();
    if (data.authenticated && data.user) {
      state.currentUser = data.user;
      renderAuthNav(true);
      await loadResumes();
      navigate('dashboard');
    } else {
      state.currentUser = null;
      renderAuthNav(false);
      navigate('landing');
    }
  } catch (err) {
    state.currentUser = null;
    renderAuthNav(false);
    navigate('landing');
  }
}

function renderAuthNav(isAuth) {
  const container = document.getElementById('auth-nav-container');
  if (!container) return;

  if (isAuth && state.currentUser) {
    const isAdmin = state.currentUser.role === 'admin' || state.currentUser.role === 'super_admin';
    container.innerHTML = `
      <button onclick="navigate('templates')" class="hidden sm:flex px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold items-center gap-1 transition">
        <i data-lucide="layout-template" class="w-3.5 h-3.5 text-brand-600"></i>
        <span>Modèles</span>
      </button>

      ${isAdmin ? `
        <button onclick="navigate('admin')" class="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1 transition">
          <i data-lucide="shield" class="w-3.5 h-3.5 text-purple-600"></i>
          <span class="hidden md:inline">Admin</span>
        </button>
      ` : ''}

      <button onclick="navigate('settings')" class="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition" title="Paramètres du compte">
        <i data-lucide="user-cog" class="w-4 h-4"></i>
      </button>

      <div class="flex items-center gap-2 pl-2 border-l border-slate-200">
        <div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-xs">
          ${(state.currentUser.name || state.currentUser.email || 'U').charAt(0).toUpperCase()}
        </div>
        <span class="hidden md:inline-block text-xs font-semibold text-slate-700 truncate max-w-[120px]">
          ${escapeHtml(state.currentUser.name || state.currentUser.email)}
        </span>
        <a href="/auth/logout" class="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition" title="Déconnexion">
          <i data-lucide="log-out" class="w-4 h-4"></i>
        </a>
      </div>
    `;
  } else {
    container.innerHTML = `
      <a href="/auth/login" class="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition">
        <i data-lucide="log-in" class="w-4 h-4"></i>
        Connexion SSO
      </a>
    `;
  }
  initLucide();
}

function navigate(viewName) {
  state.activeView = viewName;
  document.querySelectorAll('.view-panel').forEach(el => el.classList.add('hidden'));

  const target = document.getElementById(`view-${viewName}`);
  if (target) {
    target.classList.remove('hidden');
  }

  if (viewName === 'dashboard') {
    loadResumes();
  } else if (viewName === 'admin') {
    loadAdminData();
  } else if (viewName === 'templates') {
    renderTemplatesGallery();
  } else if (viewName === 'settings') {
    renderAccountSettings();
  }
  initLucide();
}

function toggleLanguage() {
  state.currentLanguage = state.currentLanguage === 'fr' ? 'en' : 'fr';
  document.getElementById('lang-indicator').innerText = state.currentLanguage.toUpperCase();
}

// ==========================================
// RESUMES MANAGEMENT (DASHBOARD)
// ==========================================
async function loadResumes() {
  try {
    const res = await fetch('/api/resumes');
    if (!res.ok) throw new Error('Impossible de charger les CV');
    state.resumes = await res.json();
    renderResumesGrid();
  } catch (err) {
    console.error('Erreur chargement CV:', err);
  }
}

function setResumeFilter(filter) {
  state.resumeFilter = filter;
  const btnAct = document.getElementById('filter-btn-active');
  const btnArch = document.getElementById('filter-btn-archived');
  if (filter === 'active') {
    btnAct.className = 'px-3 py-1.5 rounded-lg bg-brand-50 text-brand-700 font-bold text-xs';
    btnArch.className = 'px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 font-medium text-xs';
  } else {
    btnArch.className = 'px-3 py-1.5 rounded-lg bg-brand-50 text-brand-700 font-bold text-xs';
    btnAct.className = 'px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 font-medium text-xs';
  }
  renderResumesGrid();
}

function renderResumesGrid() {
  const grid = document.getElementById('resumes-grid');
  const empty = document.getElementById('resumes-empty');
  if (!grid || !empty) return;

  const filtered = state.resumes.filter(r => state.resumeFilter === 'archived' ? !!r.is_archived : !r.is_archived);

  if (filtered.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  grid.innerHTML = filtered.map(cv => {
    const dateFormatted = new Date(cv.updated_at).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    return `
      <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition flex flex-col justify-between group">
        <div class="p-5">
          <div class="flex items-start justify-between gap-2 mb-3">
            <div class="flex items-center gap-2">
              <div class="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
                <i data-lucide="file-text" class="w-5 h-5"></i>
              </div>
              ${cv.is_master ? `<span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">★ Référence</span>` : ''}
            </div>
            <div class="flex items-center gap-1">
              <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase">
                ${escapeHtml(cv.language || 'fr')}
              </span>
              <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 capitalize">
                ${escapeHtml(cv.template_id || 'modern')}
              </span>
            </div>
          </div>

          <h3 onclick="openEditor('${cv.id}')" class="cursor-pointer font-bold text-slate-900 text-lg leading-snug group-hover:text-brand-600 transition truncate" title="${escapeHtml(cv.title)}">
            ${escapeHtml(cv.title)}
          </h3>
          <p class="text-xs text-slate-400 mt-1">Mis à jour le ${dateFormatted}</p>
        </div>

        <div class="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
          <div class="flex items-center gap-1">
            <button onclick="openEditor('${cv.id}')" class="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold transition">
              Modifier
            </button>
            <button onclick="openTailorModalFromCard('${cv.id}')" class="p-1.5 rounded-lg hover:bg-amber-100 text-amber-600 transition" title="Résumer / Orienter avec un Prompt Spécial IA">
              <i data-lucide="wand-2" class="w-4 h-4"></i>
            </button>
            <button onclick="previewResumeInModal('${cv.id}')" class="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 transition" title="Prévisualiser">
              <i data-lucide="eye" class="w-4 h-4"></i>
            </button>
            <button onclick="duplicateResume('${cv.id}')" class="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 transition" title="Dupliquer">
              <i data-lucide="copy" class="w-4 h-4"></i>
            </button>
            <button onclick="toggleArchiveResume('${cv.id}', ${!cv.is_archived})" class="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 transition" title="${cv.is_archived ? 'Désarchiver' : 'Archiver'}">
              <i data-lucide="archive" class="w-4 h-4"></i>
            </button>
          </div>

          <div class="flex items-center gap-1">
            <a href="/api/export/${cv.id}/docx?lang=${encodeURIComponent(cv.language || 'fr')}" class="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition" title="Télécharger Word DOCX">
              <i data-lucide="file-type-2" class="w-4 h-4"></i>
            </a>
            <a href="/api/export/${cv.id}/pdf?lang=${encodeURIComponent(cv.language || 'fr')}" target="_blank" class="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition" title="Télécharger PDF">
              <i data-lucide="download" class="w-4 h-4"></i>
            </a>
            <button onclick="deleteResume('${cv.id}')" class="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition" title="Supprimer">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  initLucide();
}

function previewResumeInModal(id) {
  window.open(`/api/render/${id}`, '_blank');
}

function openNewResumeModal() {
  document.getElementById('modal-new-resume').classList.remove('hidden');
  initLucide();
}

function closeNewResumeModal() {
  document.getElementById('modal-new-resume').classList.add('hidden');
}

async function confirmCreateResume(mode) {
  const title = document.getElementById('new-cv-title').value.trim() || 'Mon CV Professionnel';
  const template_id = document.getElementById('new-cv-template').value || 'modern';
  const language = document.getElementById('new-cv-lang').value || 'fr';
  const fromMaster = document.getElementById('new-cv-from-master').checked;

  try {
    const res = await fetch('/api/resumes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, template_id, language, fromMaster }),
    });
    if (!res.ok) throw new Error('Erreur lors de la création');
    const newCv = await res.json();
    closeNewResumeModal();
    await openEditor(newCv.id);
    if (mode === 'ai') {
      toggleAIAssistantDrawer(true);
    }
  } catch (err) {
    alert(`Erreur : ${err.message}`);
  }
}

async function duplicateResume(id) {
  try {
    const res = await fetch(`/api/resumes/${id}/duplicate`, { method: 'POST' });
    if (!res.ok) throw new Error('Erreur duplication');
    await loadResumes();
  } catch (err) {
    alert(`Erreur : ${err.message}`);
  }
}

async function toggleArchiveResume(id, is_archived) {
  try {
    await fetch(`/api/resumes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_archived }),
    });
    await loadResumes();
  } catch (err) {
    alert(`Erreur : ${err.message}`);
  }
}

async function deleteResume(id) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer définitivement ce CV ?')) return;
  try {
    const res = await fetch(`/api/resumes/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Erreur suppression');
    await loadResumes();
  } catch (err) {
    alert(`Erreur : ${err.message}`);
  }
}

// ==========================================
// TEMPLATES & GALLERY
// ==========================================
async function loadTemplates() {
  try {
    const res = await fetch('/api/templates');
    state.templates = await res.json();
    const select = document.getElementById('editor-template-select');
    if (select) {
      select.innerHTML = state.templates.map(t => `
        <option value="${t.id}">${t.name} (${t.category})</option>
      `).join('');
    }
  } catch (err) {
    console.warn('Erreur chargement templates:', err);
  }
}

function renderTemplatesGallery() {
  const grid = document.getElementById('templates-gallery-grid');
  if (!grid) return;

  grid.innerHTML = state.templates.map(t => `
    <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition flex flex-col justify-between">
      <div>
        <div class="h-28 flex items-center justify-center relative" style="background: ${t.defaultColor}15; border-bottom: 3px solid ${t.defaultColor};">
          <div class="text-center">
            <span class="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white shadow-xs" style="color: ${t.defaultColor}">
              ${escapeHtml(t.category)}
            </span>
          </div>
        </div>
        <div class="p-5">
          <div class="flex items-center justify-between mb-1">
            <h3 class="font-bold text-slate-900 text-base">${escapeHtml(t.name)}</h3>
            <span class="text-[11px] text-slate-400">${t.hasPhoto ? '📷 Avec photo' : '📄 Sans photo'}</span>
          </div>
          <p class="text-xs text-slate-500 leading-relaxed">${escapeHtml(t.description)}</p>
        </div>
      </div>
      <div class="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
        <button onclick="useTemplateFromGallery('${t.id}')" class="px-4 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition">
          Utiliser ce modèle
        </button>
      </div>
    </div>
  `).join('');
}

async function useTemplateFromGallery(templateId) {
  if (state.currentResume) {
    state.currentResume.template_id = templateId;
    document.getElementById('editor-template-select').value = templateId;
    navigate('editor');
    onFormInput();
  } else {
    document.getElementById('new-cv-template').value = templateId;
    navigate('dashboard');
    openNewResumeModal();
  }
}

// ==========================================
// ACCOUNT SETTINGS & GDPR
// ==========================================
function renderAccountSettings() {
  const container = document.getElementById('settings-user-details');
  if (!container || !state.currentUser) return;
  container.innerHTML = `
    <div><strong>Nom :</strong> ${escapeHtml(state.currentUser.name || '-')}</div>
    <div><strong>Email :</strong> ${escapeHtml(state.currentUser.email || '-')}</div>
    <div><strong>Identifiant OIDC (sub) :</strong> <code class="bg-slate-100 px-1.5 py-0.5 rounded text-xs">${escapeHtml(state.currentUser.sub || state.currentUser.id)}</code></div>
    <div><strong>Rôle local :</strong> <span class="uppercase font-bold text-brand-700">${escapeHtml(state.currentUser.role)}</span></div>
  `;
}

async function deleteMyAccount() {
  if (!confirm('ATTENTION : Cette action supprimera définitivement votre profil local et tous vos CV enregistrés. Confirmer ?')) return;
  try {
    const res = await fetch('/api/account', { method: 'DELETE' });
    if (res.ok) {
      window.location.href = '/';
    }
  } catch (err) {
    alert(`Erreur : ${err.message}`);
  }
}

// ==========================================
// EDITOR CORE (FORM, UNDO/REDO & LIVE PREVIEW)
// ==========================================
async function openEditor(resumeId) {
  try {
    const res = await fetch(`/api/resumes/${resumeId}`);
    if (!res.ok) throw new Error('Impossible de charger le CV');
    state.currentResume = await res.json();
    state.undoStack = [JSON.stringify(state.currentResume.data || {})];
    state.redoStack = [];

    document.getElementById('editor-title-input').value = state.currentResume.title || 'CV';
    document.getElementById('editor-template-select').value = state.currentResume.template_id || 'modern';
    document.getElementById('editor-cv-lang').value = state.currentResume.language || 'fr';
    document.getElementById('editor-is-master').checked = !!state.currentResume.is_master;

    const style = state.currentResume.data?.style || {};
    if (style.primaryColor) document.getElementById('editor-color-picker').value = style.primaryColor;
    if (style.fontFamily) document.getElementById('editor-font-select').value = style.fontFamily;
    if (style.fontSize) document.getElementById('editor-fontsize-select').value = style.fontSize;

    populateForm(state.currentResume.data || {});
    navigate('editor');
    updateLivePreview();
    loadChatHistory(resumeId);
  } catch (err) {
    alert(`Erreur : ${err.message}`);
  }
}

function pushUndoSnapshot() {
  if (!state.currentResume) return;
  const snap = JSON.stringify(state.currentResume.data || {});
  if (state.undoStack[state.undoStack.length - 1] !== snap) {
    state.undoStack.push(snap);
    if (state.undoStack.length > 30) state.undoStack.shift();
    state.redoStack = [];
  }
}

function undoEdit() {
  if (state.undoStack.length <= 1) return;
  const current = state.undoStack.pop();
  state.redoStack.push(current);
  const prev = JSON.parse(state.undoStack[state.undoStack.length - 1]);
  state.currentResume.data = prev;
  populateForm(prev);
  scheduleAutoSave();
  scheduleLivePreview();
}

function redoEdit() {
  if (state.redoStack.length === 0) return;
  const next = state.redoStack.pop();
  state.undoStack.push(next);
  const parsed = JSON.parse(next);
  state.currentResume.data = parsed;
  populateForm(parsed);
  scheduleAutoSave();
  scheduleLivePreview();
}

function normalizeClientLanguages(languages) {
  if (!Array.isArray(languages)) return [];
  return languages
    .map((item, idx) => {
      if (!item) return null;
      if (typeof item === 'string') {
        return { id: `lang_${idx + 1}`, name: item.trim(), level: 'Courant' };
      }
      const name = String(item.name || item.language || item.langue || item.title || '').trim();
      const level = String(item.level || item.niveau || item.proficiency || 'Courant').trim();
      return { id: item.id || `lang_${idx + 1}`, name, level };
    })
    .filter(Boolean);
}

function populateForm(data) {
  const p = data.personal || {};
  document.getElementById('f-firstName').value = p.firstName || '';
  document.getElementById('f-lastName').value = p.lastName || '';
  document.getElementById('f-title').value = p.title || p.jobTitle || '';
  document.getElementById('f-email').value = p.email || '';
  document.getElementById('f-phone').value = p.phone || '';
  document.getElementById('f-city').value = p.city || '';
  document.getElementById('f-country').value = p.country || '';
  document.getElementById('f-linkedin').value = p.linkedin || '';
  document.getElementById('f-github').value = p.github || '';
  document.getElementById('f-website').value = p.website || p.portfolio || '';
  document.getElementById('f-summary').value = p.summary || '';

  data.languages = normalizeClientLanguages(data.languages || []);

  renderExperienceItems(data.experiences || []);
  renderEducationItems(data.education || []);
  renderSkillItems(data.skills || []);
  renderLanguageItems(data.languages || []);
  renderProjectItems(data.projects || []);
  renderCertificationItems(data.certifications || []);
  renderCustomSections(data.customSections || []);
  updateCounters(data);
}

function updateCounters(data) {
  document.getElementById('count-experiences').innerText = (data.experiences || []).length;
  document.getElementById('count-education').innerText = (data.education || []).length;
  document.getElementById('count-skills').innerText = (data.skills || []).length;
  document.getElementById('count-languages').innerText = (data.languages || []).length;
  document.getElementById('count-projects').innerText = (data.projects || []).length;
  document.getElementById('count-certifications').innerText = (data.certifications || []).length;
  document.getElementById('count-custom').innerText = (data.customSections || []).length;
}

function collectFormData() {
  const current = state.currentResume?.data || {};

  const personal = {
    firstName: document.getElementById('f-firstName').value.trim(),
    lastName: document.getElementById('f-lastName').value.trim(),
    title: document.getElementById('f-title').value.trim(),
    email: document.getElementById('f-email').value.trim(),
    phone: document.getElementById('f-phone').value.trim(),
    city: document.getElementById('f-city').value.trim(),
    country: document.getElementById('f-country').value.trim(),
    linkedin: document.getElementById('f-linkedin').value.trim(),
    github: document.getElementById('f-github').value.trim(),
    website: document.getElementById('f-website').value.trim(),
    summary: document.getElementById('f-summary').value.trim(),
    photo: current.personal?.photo || '',
  };

  const style = {
    primaryColor: document.getElementById('editor-color-picker').value,
    fontFamily: document.getElementById('editor-font-select').value,
    fontSize: document.getElementById('editor-fontsize-select').value,
  };

  return {
    ...current,
    language: document.getElementById('editor-cv-lang').value || 'fr',
    personal,
    style,
  };
}

function handlePhotoUpload(e) {
  const file = e.target.files?.[0];
  if (!file || !state.currentResume) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    state.currentResume.data.personal = state.currentResume.data.personal || {};
    state.currentResume.data.personal.photo = ev.target.result;
    onFormInput();
  };
  reader.readAsDataURL(file);
}

function onFormInput() {
  if (!state.currentResume) return;
  state.currentResume.data = collectFormData();
  pushUndoSnapshot();
  scheduleAutoSave();
  scheduleLivePreview();
}

function onTemplateChange() {
  if (!state.currentResume) return;
  state.currentResume.template_id = document.getElementById('editor-template-select').value;
  onFormInput();
}

function onStyleChange() {
  onFormInput();
}

async function onCvLangChange() {
  if (!state.currentResume) return;
  const newLang = document.getElementById('editor-cv-lang').value || 'fr';
  state.currentResume.language = newLang;
  state.currentResume.data = collectFormData();
  state.currentResume.data.language = newLang;

  // Immediate preview update for localized section headers & RTL direction
  scheduleLivePreview();

  // Seamless & automatic AI translation of the CV content into the selected language
  const d = state.currentResume.data;
  const hasSubstantialContent =
    (d.personal?.summary && d.personal.summary.length > 5) ||
    (d.experiences && d.experiences.length > 0) ||
    (d.education && d.education.length > 0) ||
    (d.skills && d.skills.length > 0);

  if (!hasSubstantialContent) {
    scheduleAutoSave();
    return;
  }

  const statusBadge = document.getElementById('lang-translate-status');
  const saveIndicator = document.getElementById('save-status-indicator');
  if (statusBadge) {
    statusBadge.classList.remove('hidden');
    statusBadge.innerText = `Adaptation IA (${newLang.toUpperCase()})...`;
  }
  if (saveIndicator) {
    saveIndicator.innerHTML = '<i data-lucide="loader-2" class="w-3 h-3 animate-spin text-purple-600"></i> Traduction IA en cours...';
    initLucide();
  }

  try {
    const res = await fetch(`/api/ai/translate/${state.currentResume.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetLanguage: newLang,
        resumeData: state.currentResume.data,
      }),
    });

    if (res.ok) {
      const result = await res.json();
      if (result.resume && result.resume.data) {
        state.currentResume = result.resume;
        pushUndoSnapshot();
        populateForm(state.currentResume.data);
        updateLivePreview();
      }
      if (saveIndicator) {
        saveIndicator.innerHTML = `<i data-lucide="check" class="w-3 h-3 text-emerald-600"></i> Traduit en ${escapeHtml(result.languageName || newLang.toUpperCase())}`;
        initLucide();
      }
    } else {
      scheduleAutoSave();
    }
  } catch (err) {
    console.warn('Traduction automatique ignorée:', err);
    scheduleAutoSave();
  } finally {
    if (statusBadge) statusBadge.classList.add('hidden');
  }
}

function onMasterToggle() {
  if (!state.currentResume) return;
  state.currentResume.is_master = document.getElementById('editor-is-master').checked;
  scheduleAutoSave();
}

function scheduleAutoSave() {
  const indicator = document.getElementById('save-status-indicator');
  if (indicator) {
    indicator.innerHTML = '<i data-lucide="loader-2" class="w-3 h-3 animate-spin text-amber-500"></i> Enregistrement...';
    initLucide();
  }

  clearTimeout(state.autoSaveTimer);
  state.autoSaveTimer = setTimeout(async () => {
    try {
      const title = document.getElementById('editor-title-input').value.trim();
      const template_id = document.getElementById('editor-template-select').value;
      const language = document.getElementById('editor-cv-lang').value;
      const is_master = document.getElementById('editor-is-master').checked;

      await fetch(`/api/resumes/${state.currentResume.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          template_id,
          language,
          is_master,
          data: state.currentResume.data,
        }),
      });

      if (indicator) {
        indicator.innerHTML = '<i data-lucide="check" class="w-3 h-3 text-emerald-600"></i> Enregistré';
        initLucide();
      }
    } catch (err) {
      if (indicator) {
        indicator.innerHTML = '<i data-lucide="alert-circle" class="w-3 h-3 text-red-500"></i> Erreur sauvegarde';
        initLucide();
      }
    }
  }, 900);
}

function scheduleLivePreview() {
  clearTimeout(state.previewTimer);
  state.previewTimer = setTimeout(updateLivePreview, 250);
}

function resizePreviewIframeToContent(iframe) {
  if (!iframe) return;
  try {
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc || !doc.body) return;
    const pageEl = doc.querySelector('.cv-page') || doc.body;
    const rawHeight = Math.max(
      pageEl.scrollHeight || 0,
      doc.body.scrollHeight || 0,
      doc.documentElement.scrollHeight || 0,
      1122
    );
    iframe.style.height = `${rawHeight + 4}px`;

    // 1 A4 page at 96 DPI is ~1122.5px (297mm)
    const pageCount = Math.max(1, Math.ceil((rawHeight - 24) / 1122));
    const badge = document.getElementById('preview-page-count');
    if (badge) {
      badge.innerText = pageCount === 1 ? '1 page A4' : `${pageCount} pages A4`;
    }
  } catch (err) {
    // Ignore cross-origin or transient errors
  }
}

async function updateLivePreview() {
  if (!state.currentResume) return;
  const iframe = document.getElementById('cv-preview-iframe');
  if (!iframe) return;

  const template_id = document.getElementById('editor-template-select').value;
  const primaryColor = document.getElementById('editor-color-picker').value;
  const fontFamily = document.getElementById('editor-font-select').value;
  const fontSize = document.getElementById('editor-fontsize-select').value;
  const language = document.getElementById('editor-cv-lang').value || state.currentResume.language || 'fr';

  try {
    const res = await fetch('/api/render/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id,
        data: { ...(state.currentResume.data || {}), language },
        options: { primaryColor, fontFamily, fontSize, language },
      }),
    });
    const html = await res.text();
    iframe.onload = () => {
      resizePreviewIframeToContent(iframe);
      setTimeout(() => resizePreviewIframeToContent(iframe), 180);
    };
    iframe.srcdoc = html;
  } catch (err) {
    console.error('Erreur rafraîchissement aperçu:', err);
  }
}

function toggleSectionAccordion(sec) {
  const content = document.getElementById(`acc-content-${sec}`);
  const icon = document.getElementById(`acc-icon-${sec}`);
  if (content) {
    content.classList.toggle('hidden');
    if (icon) icon.classList.toggle('rotate-180');
  }
}

function switchMobileTab(tab) {
  state.activeMobileTab = tab;
  const leftPane = document.getElementById('editor-left-pane');
  const rightPane = document.getElementById('editor-right-pane');

  ['form', 'preview', 'ai'].forEach(t => {
    const btn = document.getElementById(`tab-btn-${t}`);
    if (btn) {
      if (t === tab) {
        btn.classList.add('bg-white', 'text-slate-900', 'shadow-xs');
        btn.classList.remove('text-slate-600');
      } else {
        btn.classList.remove('bg-white', 'text-slate-900', 'shadow-xs');
        btn.classList.add('text-slate-600');
      }
    }
  });

  if (tab === 'form') {
    leftPane.classList.remove('hidden');
    rightPane.classList.add('hidden');
    toggleAIAssistantDrawer(false);
  } else if (tab === 'preview') {
    leftPane.classList.add('hidden');
    rightPane.classList.remove('hidden');
    rightPane.classList.add('flex');
    toggleAIAssistantDrawer(false);
    updateLivePreview();
  } else if (tab === 'ai') {
    toggleAIAssistantDrawer(true);
  }
}

function changeZoom(delta) {
  state.currentZoom = Math.max(0.5, Math.min(1.6, state.currentZoom + delta));
  applyZoom();
}

function resetZoom() {
  state.currentZoom = 1.0;
  applyZoom();
}

function applyZoom() {
  const container = document.getElementById('preview-container');
  const text = document.getElementById('zoom-level-text');
  if (container) container.style.transform = `scale(${state.currentZoom})`;
  if (text) text.innerText = `${Math.round(state.currentZoom * 100)}%`;
}

// ==========================================
// REORDER & DUPLICATE ITEMS HELPER
// ==========================================
function moveSectionItem(sectionKey, idx, dir) {
  const arr = state.currentResume?.data?.[sectionKey];
  if (!Array.isArray(arr)) return;
  const targetIdx = idx + dir;
  if (targetIdx < 0 || targetIdx >= arr.length) return;
  const temp = arr[idx];
  arr[idx] = arr[targetIdx];
  arr[targetIdx] = temp;
  populateForm(state.currentResume.data);
  onFormInput();
}

function duplicateSectionItem(sectionKey, idx) {
  const arr = state.currentResume?.data?.[sectionKey];
  if (!Array.isArray(arr) || !arr[idx]) return;
  const copy = JSON.parse(JSON.stringify(arr[idx]));
  copy.id = `${sectionKey}_${Date.now()}`;
  arr.splice(idx + 1, 0, copy);
  populateForm(state.currentResume.data);
  onFormInput();
}

// ==========================================
// REPEATABLE SECTIONS
// ==========================================
function renderExperienceItems(items) {
  const container = document.getElementById('experiences-list');
  if (!container) return;
  container.innerHTML = items.map((item, idx) => `
    <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold text-slate-700">Expérience #${idx + 1}</span>
        <div class="flex items-center gap-1">
          <button type="button" onclick="moveSectionItem('experiences', ${idx}, -1)" class="p-1 text-slate-400 hover:text-slate-700" title="Monter"><i data-lucide="arrow-up" class="w-3.5 h-3.5"></i></button>
          <button type="button" onclick="moveSectionItem('experiences', ${idx}, 1)" class="p-1 text-slate-400 hover:text-slate-700" title="Descendre"><i data-lucide="arrow-down" class="w-3.5 h-3.5"></i></button>
          <button type="button" onclick="duplicateSectionItem('experiences', ${idx})" class="p-1 text-slate-400 hover:text-brand-600" title="Dupliquer"><i data-lucide="copy" class="w-3.5 h-3.5"></i></button>
          <button type="button" onclick="removeExperienceItem(${idx})" class="p-1 text-red-500 hover:text-red-700" title="Supprimer"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input type="text" placeholder="Entreprise" value="${escapeHtml(item.company || '')}" oninput="updateExperienceField(${idx}, 'company', this.value)" class="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white">
        <input type="text" placeholder="Poste occupé" value="${escapeHtml(item.position || '')}" oninput="updateExperienceField(${idx}, 'position', this.value)" class="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white">
        <input type="text" placeholder="Localisation" value="${escapeHtml(item.location || '')}" oninput="updateExperienceField(${idx}, 'location', this.value)" class="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white">
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
        <input type="text" placeholder="Début (ex: 2021-03)" value="${escapeHtml(item.startDate || '')}" oninput="updateExperienceField(${idx}, 'startDate', this.value)" class="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white">
        <input type="text" placeholder="Fin (ex: 2024-06)" value="${escapeHtml(item.endDate || '')}" oninput="updateExperienceField(${idx}, 'endDate', this.value)" class="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white">
        <label class="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 pl-1">
          <input type="checkbox" ${item.current ? 'checked' : ''} onchange="updateExperienceField(${idx}, 'current', this.checked)" class="rounded text-brand-600">
          Poste actuel
        </label>
      </div>

      <input type="text" placeholder="Résumé court du rôle (optionnel)" value="${escapeHtml(item.summary || '')}" oninput="updateExperienceField(${idx}, 'summary', this.value)" class="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white">

      <div>
        <label class="block text-[11px] font-semibold text-slate-500 mb-1">Missions & Réalisations (1 par ligne)</label>
        <textarea rows="3" oninput="updateExperienceHighlights(${idx}, this.value)" class="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white" placeholder="Architecture microservices...&#10;Réduction du temps de build de 40%...">${(item.highlights || []).join('\n')}</textarea>
      </div>

      <div>
        <label class="block text-[11px] font-semibold text-slate-500 mb-1">Technologies utilisées (séparées par des virgules)</label>
        <input type="text" value="${escapeHtml((item.technologies || []).join(', '))}" oninput="updateExperienceTechnologies(${idx}, this.value)" class="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white" placeholder="Node.js, PostgreSQL, Docker, Coolify...">
      </div>
    </div>
  `).join('');
  initLucide();
}

function addExperienceItem() {
  state.currentResume.data.experiences = state.currentResume.data.experiences || [];
  state.currentResume.data.experiences.push({
    id: `exp_${Date.now()}`,
    company: '',
    position: '',
    location: '',
    startDate: '',
    endDate: '',
    current: false,
    summary: '',
    highlights: [],
    technologies: [],
  });
  renderExperienceItems(state.currentResume.data.experiences);
  updateCounters(state.currentResume.data);
  onFormInput();
}

function removeExperienceItem(idx) {
  state.currentResume.data.experiences.splice(idx, 1);
  renderExperienceItems(state.currentResume.data.experiences);
  updateCounters(state.currentResume.data);
  onFormInput();
}

function updateExperienceField(idx, field, val) {
  state.currentResume.data.experiences[idx][field] = val;
  onFormInput();
}

function updateExperienceHighlights(idx, val) {
  state.currentResume.data.experiences[idx].highlights = val.split('\n').map(s => s.trim()).filter(Boolean);
  onFormInput();
}

function updateExperienceTechnologies(idx, val) {
  state.currentResume.data.experiences[idx].technologies = val.split(',').map(s => s.trim()).filter(Boolean);
  onFormInput();
}

// Education
function renderEducationItems(items) {
  const container = document.getElementById('education-list');
  if (!container) return;
  container.innerHTML = items.map((item, idx) => `
    <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold text-slate-700">Formation #${idx + 1}</span>
        <div class="flex items-center gap-1">
          <button type="button" onclick="moveSectionItem('education', ${idx}, -1)" class="p-1 text-slate-400 hover:text-slate-700"><i data-lucide="arrow-up" class="w-3.5 h-3.5"></i></button>
          <button type="button" onclick="moveSectionItem('education', ${idx}, 1)" class="p-1 text-slate-400 hover:text-slate-700"><i data-lucide="arrow-down" class="w-3.5 h-3.5"></i></button>
          <button type="button" onclick="removeEducationItem(${idx})" class="text-red-500 p-1"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
        </div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input type="text" placeholder="Établissement / Université" value="${escapeHtml(item.institution || '')}" oninput="state.currentResume.data.education[${idx}].institution = this.value; onFormInput()" class="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white">
        <input type="text" placeholder="Diplôme (ex: Master, Ingénieur)" value="${escapeHtml(item.degree || '')}" oninput="state.currentResume.data.education[${idx}].degree = this.value; onFormInput()" class="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white">
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input type="text" placeholder="Domaine" value="${escapeHtml(item.field || '')}" oninput="state.currentResume.data.education[${idx}].field = this.value; onFormInput()" class="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white">
        <input type="text" placeholder="Début" value="${escapeHtml(item.startDate || '')}" oninput="state.currentResume.data.education[${idx}].startDate = this.value; onFormInput()" class="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white">
        <input type="text" placeholder="Fin" value="${escapeHtml(item.endDate || '')}" oninput="state.currentResume.data.education[${idx}].endDate = this.value; onFormInput()" class="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white">
      </div>
      <input type="text" placeholder="Description ou mention (facultatif)" value="${escapeHtml(item.summary || '')}" oninput="state.currentResume.data.education[${idx}].summary = this.value; onFormInput()" class="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white">
    </div>
  `).join('');
  initLucide();
}

function addEducationItem() {
  state.currentResume.data.education = state.currentResume.data.education || [];
  state.currentResume.data.education.push({ id: `edu_${Date.now()}`, institution: '', degree: '', field: '', startDate: '', endDate: '', summary: '' });
  renderEducationItems(state.currentResume.data.education);
  updateCounters(state.currentResume.data);
  onFormInput();
}

function removeEducationItem(idx) {
  state.currentResume.data.education.splice(idx, 1);
  renderEducationItems(state.currentResume.data.education);
  updateCounters(state.currentResume.data);
  onFormInput();
}

// Skills
function renderSkillItems(items) {
  const container = document.getElementById('skills-list');
  if (!container) return;
  container.innerHTML = items.map((item, idx) => `
    <div class="flex items-center gap-2">
      <input type="text" placeholder="Catégorie (ex: Backend)" value="${escapeHtml(item.category || '')}" oninput="state.currentResume.data.skills[${idx}].category = this.value; onFormInput()" class="w-28 text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white">
      <input type="text" placeholder="Compétence (ex: Node.js)" value="${escapeHtml(item.name || '')}" oninput="state.currentResume.data.skills[${idx}].name = this.value; onFormInput()" class="flex-1 text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white">
      <input type="text" placeholder="Niveau / Années" value="${escapeHtml(item.level || '')}" oninput="state.currentResume.data.skills[${idx}].level = this.value; onFormInput()" class="w-28 text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white">
      <button type="button" onclick="removeSkillItem(${idx})" class="text-red-500 p-1"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
    </div>
  `).join('');
  initLucide();
}

function addSkillItem() {
  state.currentResume.data.skills = state.currentResume.data.skills || [];
  state.currentResume.data.skills.push({ id: `sk_${Date.now()}`, name: '', level: 'Avancé', category: 'Technique' });
  renderSkillItems(state.currentResume.data.skills);
  updateCounters(state.currentResume.data);
  onFormInput();
}

function removeSkillItem(idx) {
  state.currentResume.data.skills.splice(idx, 1);
  renderSkillItems(state.currentResume.data.skills);
  updateCounters(state.currentResume.data);
  onFormInput();
}

// Languages
function renderLanguageItems(items) {
  const container = document.getElementById('languages-list');
  if (!container) return;
  container.innerHTML = items.map((item, idx) => `
    <div class="flex items-center gap-2">
      <input type="text" placeholder="Langue (ex: Anglais)" value="${escapeHtml(item.name || '')}" oninput="state.currentResume.data.languages[${idx}].name = this.value; onFormInput()" class="flex-1 text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white">
      <input type="text" placeholder="Niveau (ex: C1 / Courant)" value="${escapeHtml(item.level || '')}" oninput="state.currentResume.data.languages[${idx}].level = this.value; onFormInput()" class="w-36 text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white">
      <button type="button" onclick="removeLanguageItem(${idx})" class="text-red-500 p-1"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
    </div>
  `).join('');
  initLucide();
}

function addLanguageItem() {
  state.currentResume.data.languages = state.currentResume.data.languages || [];
  state.currentResume.data.languages.push({ id: `lang_${Date.now()}`, name: '', level: 'Courant' });
  renderLanguageItems(state.currentResume.data.languages);
  updateCounters(state.currentResume.data);
  onFormInput();
}

function removeLanguageItem(idx) {
  state.currentResume.data.languages.splice(idx, 1);
  renderLanguageItems(state.currentResume.data.languages);
  updateCounters(state.currentResume.data);
  onFormInput();
}

// Projects
function renderProjectItems(items) {
  const container = document.getElementById('projects-list');
  if (!container) return;
  container.innerHTML = items.map((item, idx) => `
    <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold text-slate-700">Projet #${idx + 1}</span>
        <button type="button" onclick="removeProjectItem(${idx})" class="text-red-500 p-1"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input type="text" placeholder="Nom du projet" value="${escapeHtml(item.name || '')}" oninput="state.currentResume.data.projects[${idx}].name = this.value; onFormInput()" class="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white">
        <input type="text" placeholder="Rôle" value="${escapeHtml(item.role || '')}" oninput="state.currentResume.data.projects[${idx}].role = this.value; onFormInput()" class="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white">
        <input type="text" placeholder="Lien / URL" value="${escapeHtml(item.url || '')}" oninput="state.currentResume.data.projects[${idx}].url = this.value; onFormInput()" class="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white">
      </div>
      <textarea rows="2" placeholder="Description..." oninput="state.currentResume.data.projects[${idx}].description = this.value; onFormInput()" class="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white">${escapeHtml(item.description || '')}</textarea>
      <input type="text" placeholder="Technologies (séparées par des virgules)" value="${escapeHtml((item.technologies || []).join(', '))}" oninput="state.currentResume.data.projects[${idx}].technologies = this.value.split(',').map(s=>s.trim()).filter(Boolean); onFormInput()" class="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white">
    </div>
  `).join('');
  initLucide();
}

function addProjectItem() {
  state.currentResume.data.projects = state.currentResume.data.projects || [];
  state.currentResume.data.projects.push({ id: `proj_${Date.now()}`, name: '', description: '', role: '', url: '', technologies: [] });
  renderProjectItems(state.currentResume.data.projects);
  updateCounters(state.currentResume.data);
  onFormInput();
}

function removeProjectItem(idx) {
  state.currentResume.data.projects.splice(idx, 1);
  renderProjectItems(state.currentResume.data.projects);
  updateCounters(state.currentResume.data);
  onFormInput();
}

// Certifications
function renderCertificationItems(items) {
  const container = document.getElementById('certifications-list');
  if (!container) return;
  container.innerHTML = items.map((item, idx) => `
    <div class="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
      <input type="text" placeholder="Certification" value="${escapeHtml(item.name || '')}" oninput="state.currentResume.data.certifications[${idx}].name = this.value; onFormInput()" class="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white">
      <input type="text" placeholder="Organisme" value="${escapeHtml(item.issuer || '')}" oninput="state.currentResume.data.certifications[${idx}].issuer = this.value; onFormInput()" class="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white">
      <input type="text" placeholder="Date" value="${escapeHtml(item.date || '')}" oninput="state.currentResume.data.certifications[${idx}].date = this.value; onFormInput()" class="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white">
      <div class="flex items-center gap-1">
        <input type="text" placeholder="URL vérif." value="${escapeHtml(item.url || '')}" oninput="state.currentResume.data.certifications[${idx}].url = this.value; onFormInput()" class="flex-1 text-xs px-2 py-1.5 border border-slate-200 rounded-lg bg-white">
        <button type="button" onclick="removeCertificationItem(${idx})" class="text-red-500 p-1"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
      </div>
    </div>
  `).join('');
  initLucide();
}

function addCertificationItem() {
  state.currentResume.data.certifications = state.currentResume.data.certifications || [];
  state.currentResume.data.certifications.push({ id: `cert_${Date.now()}`, name: '', issuer: '', date: '', url: '' });
  renderCertificationItems(state.currentResume.data.certifications);
  updateCounters(state.currentResume.data);
  onFormInput();
}

function removeCertificationItem(idx) {
  state.currentResume.data.certifications.splice(idx, 1);
  renderCertificationItems(state.currentResume.data.certifications);
  updateCounters(state.currentResume.data);
  onFormInput();
}

// Custom Sections
function renderCustomSections(sections) {
  const container = document.getElementById('custom-sections-list');
  if (!container) return;
  container.innerHTML = sections.map((sec, sIdx) => `
    <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
      <div class="flex items-center justify-between gap-2">
        <input type="text" placeholder="Titre de la section (ex: Bénévolat)" value="${escapeHtml(sec.title || '')}" oninput="state.currentResume.data.customSections[${sIdx}].title = this.value; onFormInput()" class="font-bold text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white flex-1">
        <button type="button" onclick="removeCustomSection(${sIdx})" class="text-red-500 p-1"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
      </div>
      <div class="space-y-2">
        ${(sec.items || []).map((it, iIdx) => `
          <div class="p-2.5 bg-white border border-slate-200 rounded-lg space-y-1.5">
            <div class="flex gap-2">
              <input type="text" placeholder="Intitulé" value="${escapeHtml(it.title || '')}" oninput="state.currentResume.data.customSections[${sIdx}].items[${iIdx}].title = this.value; onFormInput()" class="flex-1 text-xs px-2 py-1 border border-slate-200 rounded">
              <input type="text" placeholder="Date" value="${escapeHtml(it.date || '')}" oninput="state.currentResume.data.customSections[${sIdx}].items[${iIdx}].date = this.value; onFormInput()" class="w-28 text-xs px-2 py-1 border border-slate-200 rounded">
              <button type="button" onclick="removeCustomSectionItem(${sIdx}, ${iIdx})" class="text-red-500 p-1"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
            </div>
            <input type="text" placeholder="Description..." value="${escapeHtml(it.description || '')}" oninput="state.currentResume.data.customSections[${sIdx}].items[${iIdx}].description = this.value; onFormInput()" class="w-full text-xs px-2 py-1 border border-slate-200 rounded">
          </div>
        `).join('')}
      </div>
      <button type="button" onclick="addCustomSectionItem(${sIdx})" class="text-xs text-brand-600 font-semibold flex items-center gap-1">
        <i data-lucide="plus" class="w-3.5 h-3.5"></i> Ajouter un élément
      </button>
    </div>
  `).join('');
  initLucide();
}

function addCustomSection() {
  state.currentResume.data.customSections = state.currentResume.data.customSections || [];
  state.currentResume.data.customSections.push({
    id: `csec_${Date.now()}`,
    title: 'Centres d\'intérêt',
    items: [{ title: '', date: '', description: '' }],
  });
  renderCustomSections(state.currentResume.data.customSections);
  updateCounters(state.currentResume.data);
  onFormInput();
}

function removeCustomSection(sIdx) {
  state.currentResume.data.customSections.splice(sIdx, 1);
  renderCustomSections(state.currentResume.data.customSections);
  updateCounters(state.currentResume.data);
  onFormInput();
}

function addCustomSectionItem(sIdx) {
  state.currentResume.data.customSections[sIdx].items.push({ title: '', date: '', description: '' });
  renderCustomSections(state.currentResume.data.customSections);
  onFormInput();
}

function removeCustomSectionItem(sIdx, iIdx) {
  state.currentResume.data.customSections[sIdx].items.splice(iIdx, 1);
  renderCustomSections(state.currentResume.data.customSections);
  onFormInput();
}

// ==========================================
// VERSIONS HISTORY MODAL
// ==========================================
async function openVersionsModal() {
  if (!state.currentResume) return;
  document.getElementById('modal-versions').classList.remove('hidden');
  await loadVersionsList();
  initLucide();
}

function closeVersionsModal() {
  document.getElementById('modal-versions').classList.add('hidden');
}

async function loadVersionsList() {
  const container = document.getElementById('versions-list');
  if (!container || !state.currentResume) return;
  try {
    const res = await fetch(`/api/resumes/${state.currentResume.id}/versions`);
    const versions = await res.json();
    container.innerHTML = versions.map(v => `
      <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
        <div>
          <div class="font-bold text-slate-800">Version #${v.version_number} — ${escapeHtml(v.note || 'Sauvegarde')}</div>
          <div class="text-slate-400 text-[11px]">${new Date(v.created_at).toLocaleString('fr-FR')}</div>
        </div>
        <button onclick="restoreVersion('${v.id}')" class="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-brand-50 hover:text-brand-700 font-semibold transition">
          Restaurer
        </button>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = '<div class="text-xs text-red-500">Erreur chargement des versions.</div>';
  }
}

async function saveManualVersionSnapshot() {
  if (!state.currentResume) return;
  const note = prompt('Nom de cette version :', 'Avant adaptation offre');
  if (note === null) return;

  try {
    await fetch(`/api/resumes/${state.currentResume.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: state.currentResume.data,
        saveVersion: true,
        versionNote: note || 'Point de sauvegarde',
      }),
    });
    await loadVersionsList();
  } catch (err) {
    alert(`Erreur : ${err.message}`);
  }
}

async function restoreVersion(verId) {
  if (!confirm('Restaurer cette version remplacera le contenu actuel du CV. Continuer ?')) return;
  try {
    const res = await fetch(`/api/resumes/${state.currentResume.id}/versions/${verId}/restore`, { method: 'POST' });
    if (!res.ok) throw new Error('Erreur restauration');
    const { resume } = await res.json();
    state.currentResume = resume;
    populateForm(resume.data || {});
    updateLivePreview();
    closeVersionsModal();
  } catch (err) {
    alert(`Erreur : ${err.message}`);
  }
}

// ==========================================
// AI CHAT ASSISTANT
// ==========================================
function toggleAIAssistantDrawer(forceState) {
  const drawer = document.getElementById('ai-assistant-drawer');
  if (!drawer) return;
  if (typeof forceState === 'boolean') {
    if (forceState) drawer.classList.remove('translate-x-full');
    else drawer.classList.add('translate-x-full');
  } else {
    drawer.classList.toggle('translate-x-full');
  }
}

async function loadChatHistory(resumeId) {
  const container = document.getElementById('ai-chat-messages');
  if (!container) return;
  container.innerHTML = `
    <div class="flex items-start gap-2.5">
      <div class="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
        <i data-lucide="bot" class="w-4 h-4"></i>
      </div>
      <div class="bg-purple-50 text-slate-800 p-3 rounded-2xl rounded-tl-xs text-xs leading-relaxed max-w-[85%] border border-purple-100">
        Bonjour ! Je suis votre assistant IA connecté à LiteLLM. Décrivez votre parcours librement (ex: <em>« Je suis développeur Drupal avec 8 ans d'expérience »</em>) et je construirai ou améliorerai votre CV étape par étape.
      </div>
    </div>
  `;
  initLucide();

  try {
    const res = await fetch(`/api/ai/chat/${resumeId}`);
    if (res.ok) {
      const messages = await res.json();
      for (const m of messages) {
        appendChatMessage(m.role, m.content, m.proposedChanges, m.missingSuggestions);
      }
    }
  } catch (err) {
    console.warn('Erreur chargement messages chat:', err);
  }
}

function appendChatMessage(role, text, proposedChanges, suggestions) {
  const container = document.getElementById('ai-chat-messages');
  if (!container) return;

  const isUser = role === 'user';
  const msgDiv = document.createElement('div');
  msgDiv.className = `flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`;

  let proposedHtml = '';
  if (proposedChanges) {
    const encoded = encodeURIComponent(JSON.stringify(proposedChanges));
    proposedHtml = `
      <div class="mt-2.5 p-2.5 bg-white border border-purple-200 rounded-xl text-xs space-y-1.5 shadow-xs">
        <div class="font-bold text-purple-700 flex items-center gap-1">
          <i data-lucide="sparkles" class="w-3.5 h-3.5"></i> Modification proposée
        </div>
        <p class="text-slate-600">${describeProposedChange(proposedChanges)}</p>
        <button onclick="applyEncodedProposedChanges('${encoded}')" class="w-full mt-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-xs transition flex items-center justify-center gap-1">
          <i data-lucide="check" class="w-3.5 h-3.5"></i> Appliquer au CV
        </button>
      </div>
    `;
  }

  let suggestionsHtml = '';
  if (Array.isArray(suggestions) && suggestions.length > 0) {
    suggestionsHtml = `
      <div class="mt-2 pt-2 border-t border-purple-200/60 text-[11px] text-purple-800 space-y-1">
        <span class="font-bold">Informations utiles à compléter :</span>
        <ul class="list-disc pl-4 space-y-0.5">
          ${suggestions.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  msgDiv.innerHTML = `
    <div class="w-7 h-7 rounded-full ${isUser ? 'bg-brand-600 text-white' : 'bg-purple-100 text-purple-700'} flex items-center justify-center shrink-0 text-xs font-bold">
      ${isUser ? 'Moi' : '<i data-lucide="bot" class="w-4 h-4"></i>'}
    </div>
    <div class="${isUser ? 'bg-brand-600 text-white' : 'bg-purple-50 text-slate-800 border border-purple-100'} p-3 rounded-2xl ${isUser ? 'rounded-tr-xs' : 'rounded-tl-xs'} text-xs leading-relaxed max-w-[85%]">
      <div>${escapeHtml(text)}</div>
      ${proposedHtml}
      ${suggestionsHtml}
    </div>
  `;

  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
  initLucide();
}

function describeProposedChange(change) {
  if (change.action === 'add_experience' || change.action === 'update_experience') {
    return `Ajout / mise à jour du poste <strong>${escapeHtml(change.data?.position || '')}</strong> chez <strong>${escapeHtml(change.data?.company || '')}</strong>.`;
  } else if (change.action === 'update_personal') {
    return `Mise à jour des informations / présentation personnelle.`;
  } else if (change.action === 'add_skills' || change.action === 'add_skill') {
    return `Ajout de compétences professionnelles structurées.`;
  } else if (change.action === 'add_education') {
    return `Ajout d'une formation académique.`;
  } else if (change.action === 'add_language' || change.action === 'add_languages') {
    return `Ajout / mise à jour des langues parlées.`;
  } else if (change.action === 'add_certification') {
    return `Ajout d'une certification professionnelle.`;
  } else if (change.action === 'add_project') {
    return `Ajout d'un projet notable.`;
  }
  return `Mise à jour de la section <strong>${escapeHtml(change.section || '')}</strong>.`;
}

function applyEncodedProposedChanges(encoded) {
  try {
    const change = JSON.parse(decodeURIComponent(encoded));
    applyProposedChanges(change);
  } catch (err) {
    console.error('Erreur application changement:', err);
  }
}

function applyProposedChanges(change) {
  if (!state.currentResume || !change) return;

  const d = state.currentResume.data;
  if ((change.action === 'add_experience' || change.action === 'update_experience') && change.data) {
    d.experiences = d.experiences || [];
    d.experiences.unshift({
      id: `exp_${Date.now()}`,
      company: change.data.company || '',
      position: change.data.position || '',
      location: change.data.location || '',
      startDate: change.data.startDate || '',
      endDate: change.data.endDate || '',
      current: !!change.data.current,
      summary: change.data.summary || change.data.description || '',
      highlights: Array.isArray(change.data.highlights)
        ? change.data.highlights
        : (Array.isArray(change.data.missions) ? change.data.missions : []),
      technologies: Array.isArray(change.data.technologies) ? change.data.technologies : [],
    });
  } else if (change.action === 'update_personal' && change.data) {
    d.personal = { ...(d.personal || {}), ...change.data };
  } else if ((change.action === 'add_skills' || change.action === 'add_skill') && change.data) {
    d.skills = d.skills || [];
    const list = Array.isArray(change.data) ? change.data : [change.data];
    for (const sk of list) {
      d.skills.push({
        id: `sk_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        name: typeof sk === 'string' ? sk : (sk.name || ''),
        category: sk.category || 'Technique',
        level: sk.level || 'Avancé',
      });
    }
  } else if (change.action === 'add_education' && change.data) {
    d.education = d.education || [];
    d.education.push({
      id: `edu_${Date.now()}`,
      institution: change.data.institution || '',
      degree: change.data.degree || '',
      field: change.data.field || '',
      startDate: change.data.startDate || '',
      endDate: change.data.endDate || '',
      summary: change.data.summary || '',
    });
  } else if ((change.action === 'add_language' || change.action === 'add_languages' || change.section === 'languages') && change.data) {
    d.languages = d.languages || [];
    const list = Array.isArray(change.data) ? change.data : [change.data];
    for (const lg of list) {
      const name = typeof lg === 'string' ? lg : (lg.name || lg.language || lg.langue || '');
      const level = typeof lg === 'string' ? 'Courant' : (lg.level || lg.niveau || 'Courant');
      if (name) {
        d.languages.push({
          id: `lang_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          name,
          level,
        });
      }
    }
  } else if ((change.action === 'add_certification' || change.section === 'certifications') && change.data) {
    d.certifications = d.certifications || [];
    const list = Array.isArray(change.data) ? change.data : [change.data];
    for (const cert of list) {
      d.certifications.push({
        id: `cert_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        name: cert.name || '',
        issuer: cert.issuer || '',
        date: cert.date || '',
        url: cert.url || '',
      });
    }
  } else if ((change.action === 'add_project' || change.section === 'projects') && change.data) {
    d.projects = d.projects || [];
    const list = Array.isArray(change.data) ? change.data : [change.data];
    for (const pr of list) {
      d.projects.push({
        id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        name: pr.name || '',
        role: pr.role || '',
        description: pr.description || '',
        url: pr.url || '',
        technologies: Array.isArray(pr.technologies) ? pr.technologies : [],
      });
    }
  }

  populateForm(d);
  onFormInput();
}

async function onAIChatSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('ai-chat-input');
  const msg = input.value.trim();
  if (!msg || !state.currentResume) return;

  input.value = '';
  appendChatMessage('user', msg);

  const btn = document.getElementById('ai-chat-send-btn');
  btn.disabled = true;

  try {
    const res = await fetch(`/api/ai/chat/${state.currentResume.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: msg,
        resumeData: state.currentResume.data,
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Erreur de réponse IA');
    }
    const data = await res.json();
    appendChatMessage('assistant', data.reply, data.proposedChanges, data.missingSuggestions);
  } catch (err) {
    appendChatMessage('assistant', `Désolé, une erreur s'est produite : ${err.message}`);
  } finally {
    btn.disabled = false;
  }
}

function sendQuickPrompt(promptText) {
  document.getElementById('ai-chat-input').value = promptText;
  document.getElementById('ai-chat-form').dispatchEvent(new Event('submit'));
}

async function askAIToRewriteSummary() {
  const currentSummary = document.getElementById('f-summary').value.trim();
  const prompt = currentSummary
    ? `Peux-tu reformuler et sublimer mon résumé professionnel pour le rendre plus percutant : "${currentSummary}"`
    : `Peux-tu me proposer un résumé professionnel percutant basé sur mes compétences et expériences indiquées dans mon CV ?`;
  toggleAIAssistantDrawer(true);
  sendQuickPrompt(prompt);
}

// ==========================================
// EXPORTS (INVISIBLE MULTILINGUAL SUPPORT)
// ==========================================
function exportDocx() {
  if (!state.currentResume) return;
  const primaryColor = document.getElementById('editor-color-picker').value;
  const lang = document.getElementById('editor-cv-lang').value || state.currentResume.language || 'fr';
  window.location.href = `/api/export/${state.currentResume.id}/docx?color=${encodeURIComponent(primaryColor)}&lang=${encodeURIComponent(lang)}`;
}

function exportPdf() {
  if (!state.currentResume) return;
  const templateId = document.getElementById('editor-template-select').value;
  const primaryColor = document.getElementById('editor-color-picker').value;
  const fontFamily = document.getElementById('editor-font-select').value;
  const lang = document.getElementById('editor-cv-lang').value || state.currentResume.language || 'fr';
  window.open(`/api/export/${state.currentResume.id}/pdf?template=${templateId}&color=${encodeURIComponent(primaryColor)}&font=${encodeURIComponent(fontFamily)}&lang=${encodeURIComponent(lang)}`, '_blank');
}

// ==========================================
// MODAL: TAILOR / SUMMARIZE CV WITH SPECIAL PROMPT
// ==========================================
function openTailorModal() {
  if (!state.currentResume) return;
  const modal = document.getElementById('modal-tailor');
  if (!modal) return;

  const currentLang = document.getElementById('editor-cv-lang')?.value || state.currentResume.language || 'fr';
  const langSelect = document.getElementById('tailor-target-lang');
  if (langSelect) langSelect.value = currentLang;

  document.getElementById('tailor-loading')?.classList.add('hidden');
  document.getElementById('tailor-result-box')?.classList.add('hidden');
  modal.classList.remove('hidden');
  initLucide();
}

async function openTailorModalFromCard(resumeId) {
  await openEditor(resumeId);
  openTailorModal();
}

function closeTailorModal() {
  document.getElementById('modal-tailor')?.classList.add('hidden');
}

function setTailorPreset(promptText, targetLength = 'auto') {
  const promptEl = document.getElementById('tailor-custom-prompt');
  const lenEl = document.getElementById('tailor-target-length');
  if (promptEl) promptEl.value = promptText;
  if (lenEl && targetLength) lenEl.value = targetLength;
}

async function submitTailorResume() {
  if (!state.currentResume) return;
  const customPrompt = document.getElementById('tailor-custom-prompt').value.trim();
  const targetLength = document.getElementById('tailor-target-length').value || 'auto';
  const targetLanguage = document.getElementById('tailor-target-lang').value || 'fr';
  const mode = document.getElementById('tailor-mode').value || 'update';

  if (!customPrompt) {
    alert('Veuillez saisir un prompt spécial ou cliquer sur une suggestion rapide.');
    return;
  }

  const loadingEl = document.getElementById('tailor-loading');
  const resultBox = document.getElementById('tailor-result-box');
  const submitBtn = document.getElementById('tailor-submit-btn');

  loadingEl.classList.remove('hidden');
  resultBox.classList.add('hidden');
  submitBtn.disabled = true;

  try {
    const res = await fetch(`/api/ai/tailor/${state.currentResume.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customPrompt,
        targetLength,
        targetLanguage,
        mode,
        resumeData: collectFormData(),
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Erreur lors du traitement IA');
    }

    const result = await res.json();
    state.currentResume = result.resume;
    document.getElementById('editor-title-input').value = state.currentResume.title || 'CV';
    document.getElementById('editor-cv-lang').value = state.currentResume.language || targetLanguage;
    if (state.currentResume.data?.style?.fontSize) {
      document.getElementById('editor-fontsize-select').value = state.currentResume.data.style.fontSize;
    }

    pushUndoSnapshot();
    populateForm(state.currentResume.data || {});
    updateLivePreview();

    document.getElementById('tailor-pitch-text').innerText = result.executivePitch || '';
    const notesList = document.getElementById('tailor-notes-list');
    notesList.innerHTML = (result.tailoringNotes || []).map(n => `<li>${escapeHtml(n)}</li>`).join('');
    resultBox.classList.remove('hidden');
  } catch (err) {
    alert(`Erreur : ${err.message}`);
  } finally {
    loadingEl.classList.add('hidden');
    submitBtn.disabled = false;
  }
}

function copyTailorPitch() {
  const text = document.getElementById('tailor-pitch-text')?.innerText || '';
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    alert('Pitch exécutif copié dans le presse-papiers !');
  }).catch(() => {});
}

// ==========================================
// MODAL: IMPORT PDF & LINKEDIN (WITH VALIDATION)
// ==========================================
function openImportModal() {
  state.pendingExtractedPdf = null;
  document.getElementById('modal-import').classList.remove('hidden');
  document.getElementById('pdf-file-input').value = '';
  document.getElementById('pdf-import-loading').classList.add('hidden');
  document.getElementById('pdf-import-review').classList.add('hidden');
  document.getElementById('pdf-drop-zone').classList.remove('hidden');
  initLucide();
}

function closeImportModal() {
  document.getElementById('modal-import').classList.add('hidden');
}

function switchImportModalTab(tab) {
  const tabPdf = document.getElementById('import-tab-pdf');
  const tabLinkedin = document.getElementById('import-tab-linkedin');
  const contentPdf = document.getElementById('import-content-pdf');
  const contentLinkedin = document.getElementById('import-content-linkedin');

  if (tab === 'pdf') {
    tabPdf.className = 'px-4 py-2 border-b-2 border-brand-600 font-bold text-brand-600 text-sm';
    tabLinkedin.className = 'px-4 py-2 border-b-2 border-transparent font-medium text-slate-500 hover:text-slate-800 text-sm';
    contentPdf.classList.remove('hidden');
    contentLinkedin.classList.add('hidden');
  } else {
    tabLinkedin.className = 'px-4 py-2 border-b-2 border-brand-600 font-bold text-brand-600 text-sm';
    tabPdf.className = 'px-4 py-2 border-b-2 border-transparent font-medium text-slate-500 hover:text-slate-800 text-sm';
    contentLinkedin.classList.remove('hidden');
    contentPdf.classList.add('hidden');
  }
}

async function handlePdfFileSelect(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const dropZone = document.getElementById('pdf-drop-zone');
  const loading = document.getElementById('pdf-import-loading');
  const review = document.getElementById('pdf-import-review');

  dropZone.classList.add('hidden');
  review.classList.add('hidden');
  loading.classList.remove('hidden');

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/ai/import-pdf', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Erreur lors de l\'import');
    }

    const { extractedData } = await res.json();
    state.pendingExtractedPdf = extractedData;
    state.pendingPdfFilename = file.name.replace(/\.[^/.]+$/, '');

    loading.classList.add('hidden');
    review.classList.remove('hidden');

    const warningsEl = document.getElementById('pdf-uncertain-warnings');
    if (Array.isArray(extractedData.uncertainOrMissingFields) && extractedData.uncertainOrMissingFields.length > 0) {
      warningsEl.classList.remove('hidden');
      warningsEl.innerHTML = `<strong>Champs absents ou à vérifier :</strong> ${extractedData.uncertainOrMissingFields.map(escapeHtml).join(', ')}`;
    } else {
      warningsEl.classList.add('hidden');
    }

    const p = extractedData.personal || {};
    const langsList = normalizeClientLanguages(extractedData.languages || []).map(l => `${l.name} (${l.level})`).join(', ');
    document.getElementById('pdf-review-summary').innerHTML = `
      <div><strong>Candidat :</strong> ${escapeHtml(p.firstName)} ${escapeHtml(p.lastName)}</div>
      <div><strong>Titre :</strong> ${escapeHtml(p.title || 'Non détecté')}</div>
      <div><strong>Langue du CV détectée :</strong> <span class="uppercase font-bold text-brand-700">${escapeHtml(extractedData.language || 'fr')}</span></div>
      <div><strong>Expériences extraites :</strong> ${(extractedData.experiences || []).length}</div>
      <div><strong>Formations extraites :</strong> ${(extractedData.education || []).length}</div>
      <div><strong>Compétences extraites :</strong> ${(extractedData.skills || []).length}</div>
      <div><strong>Langues parlées :</strong> ${escapeHtml(langsList || 'Non détectées')}</div>
    `;
  } catch (err) {
    alert(`Erreur d'importation : ${err.message}`);
    dropZone.classList.remove('hidden');
    loading.classList.add('hidden');
  }
}

async function confirmSaveImportedPdf() {
  if (!state.pendingExtractedPdf) return;
  try {
    const title = `CV Importé - ${state.pendingPdfFilename || 'PDF'}`;
    const createRes = await fetch('/api/resumes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        template_id: 'modern',
        language: state.pendingExtractedPdf.language || 'fr',
        data: state.pendingExtractedPdf,
      }),
    });

    if (!createRes.ok) throw new Error('Erreur création CV après validation');
    const newCv = await createRes.json();

    closeImportModal();
    await openEditor(newCv.id);
  } catch (err) {
    alert(`Erreur : ${err.message}`);
  }
}

async function submitLinkedInUrl() {
  const url = document.getElementById('linkedin-url-input').value.trim();
  const feedback = document.getElementById('linkedin-url-feedback');
  if (!url) return;

  try {
    const res = await fetch('/api/ai/import-linkedin-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();

    feedback.classList.remove('hidden');
    feedback.innerHTML = `
      <div class="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl space-y-2">
        <p class="font-semibold">${escapeHtml(data.message)}</p>
        <p class="font-bold">${escapeHtml(data.advice)}</p>
        <ul class="list-disc pl-4 space-y-1">
          ${data.steps.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
        </ul>
        <button onclick="switchImportModalTab('pdf')" class="mt-2 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-bold">
          Importer le PDF LinkedIn maintenant
        </button>
      </div>
    `;
  } catch (err) {
    alert(`Erreur : ${err.message}`);
  }
}

// ==========================================
// ADMIN BACKOFFICE
// ==========================================
async function loadAdminData() {
  try {
    const statsRes = await fetch('/api/admin/stats');
    if (statsRes.ok) {
      const stats = await statsRes.json();
      document.getElementById('adm-users-count').innerText = stats.usersCount;
      document.getElementById('adm-resumes-count').innerText = stats.resumesCount;
      document.getElementById('adm-ai-requests').innerText = stats.aiStats?.totalRequests || 0;
      document.getElementById('adm-db-type').innerText = stats.databaseType;
    }

    const settingsRes = await fetch('/api/admin/settings');
    if (settingsRes.ok) {
      const settings = await settingsRes.json();
      const modelSelect = document.getElementById('adm-model-select');
      modelSelect.innerHTML = settings.available_models.map(m => `
        <option value="${m}" ${m === settings.litellm_model ? 'selected' : ''}>${m}</option>
      `).join('');
      document.getElementById('adm-app-name').value = settings.app_name || 'CV Builder IA';
    }

    const usersRes = await fetch('/api/admin/users');
    if (usersRes.ok) {
      const users = await usersRes.json();
      const table = document.getElementById('adm-users-table');
      table.innerHTML = users.map(u => `
        <tr class="hover:bg-slate-50 transition">
          <td class="py-3 px-4 font-semibold text-slate-900 flex items-center gap-2">
            <div class="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold">
              ${(u.name || u.email || 'U').charAt(0).toUpperCase()}
            </div>
            ${escapeHtml(u.name || 'Sans nom')}
          </td>
          <td class="py-3 px-4 text-xs font-mono">${escapeHtml(u.email)}</td>
          <td class="py-3 px-4">
            <span class="text-xs px-2.5 py-0.5 rounded-full font-bold ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'}">
              ${escapeHtml(u.role)}
            </span>
          </td>
          <td class="py-3 px-4 text-xs text-slate-400">
            ${new Date(u.last_login_at || u.created_at).toLocaleString('fr-FR')}
          </td>
          <td class="py-3 px-4">
            <button onclick="toggleUserRole('${u.id}', '${u.role === 'admin' ? 'user' : 'admin'}')" class="text-xs text-brand-600 hover:text-brand-800 font-semibold">
              ${u.role === 'admin' ? 'Rétrograder user' : 'Promouvoir admin'}
            </button>
          </td>
        </tr>
      `).join('');
    }

    const auditRes = await fetch('/api/admin/audit');
    if (auditRes.ok) {
      const logs = await auditRes.json();
      const auditEl = document.getElementById('adm-audit-list');
      if (auditEl) {
        auditEl.innerHTML = logs.map(l => `
          <div class="p-2 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
            <div>
              <span class="font-bold text-slate-800">${escapeHtml(l.action)}</span>
              <span class="text-slate-400 ml-2">(${escapeHtml(l.user_id || 'anon')})</span>
            </div>
            <span class="text-slate-400">${new Date(l.created_at).toLocaleString('fr-FR')}</span>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Erreur chargement admin:', err);
  }
}

async function onSaveAdminSettings(e) {
  e.preventDefault();
  const litellm_model = document.getElementById('adm-model-select').value;
  const app_name = document.getElementById('adm-app-name').value.trim();

  try {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ litellm_model, app_name }),
    });
    if (!res.ok) throw new Error('Erreur sauvegarde');
    alert('Paramètres mis à jour avec succès.');
  } catch (err) {
    alert(`Erreur : ${err.message}`);
  }
}

async function toggleUserRole(userId, newRole) {
  if (!confirm(`Voulez-vous modifier le rôle vers '${newRole}' ?`)) return;
  try {
    const res = await fetch(`/api/admin/users/${userId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    });
    if (!res.ok) throw new Error('Erreur modification rôle');
    loadAdminData();
  } catch (err) {
    alert(`Erreur : ${err.message}`);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
