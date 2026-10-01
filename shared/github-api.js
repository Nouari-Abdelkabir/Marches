/* ═══════════════════════════════════════════════════════════
   🌐 GITHUB API — Couche de communication avec GitHub
   ═══════════════════════════════════════════════════════════
   Permet de lire et écrire les fichiers JSON des marchés
   depuis GitHub au lieu de localStorage uniquement.
   ═══════════════════════════════════════════════════════════ */

const GH_CONFIG = {
  owner: 'nouari-abdelkabir',
  repo: 'Marches',
  branch: 'main',
  tokenKey: 'github_pat'   /* Clé dans localStorage */
};

/* ─── Récupérer le PAT stocké ─── */
function ghGetToken() {
  return localStorage.getItem(GH_CONFIG.tokenKey) || '';
}

/* ─── Sauvegarder le PAT ─── */
function ghSaveToken(token) {
  if (!token || !token.startsWith('ghp_')) {
    console.warn('⚠️ Token invalide');
    return false;
  }
  localStorage.setItem(GH_CONFIG.tokenKey, token);
  return true;
}

/* ─── Supprimer le PAT ─── */
function ghClearToken() {
  localStorage.removeItem(GH_CONFIG.tokenKey);
}

/* ─── Vérifier si un PAT est configuré ─── */
function ghHasToken() {
  const t = ghGetToken();
  return t && t.startsWith('ghp_') && t.length === 40;
}

/* ─── Test de connexion (retourne le user GitHub) ─── */
async function ghTestConnexion() {
  const token = ghGetToken();
  if (!token) return { ok: false, error: 'Pas de token' };

  try {
    const r = await fetch('https://api.github.com/user', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!r.ok) {
      return { ok: false, error: 'HTTP ' + r.status };
    }
    const data = await r.json();
    return { ok: true, login: data.login, name: data.name };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/* ═══════════════════════════════════════════════════════════
   📖 LECTURE d'un fichier JSON
   ═══════════════════════════════════════════════════════════ */
async function ghLire(marcheId) {
  const token = ghGetToken();
  const url = `https://api.github.com/repos/${GH_CONFIG.owner}/${GH_CONFIG.repo}/contents/data/${marcheId}.json?ref=${GH_CONFIG.branch}`;

  try {
    const headers = { 'Accept': 'application/vnd.github.v3+json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const r = await fetch(url, { headers });

    if (r.status === 404) {
      return { ok: false, error: 'Fichier non trouvé', status: 404 };
    }
    if (!r.ok) {
      return { ok: false, error: 'HTTP ' + r.status, status: r.status };
    }

    const file = await r.json();
    const contenu = atob(file.content.replace(/\n/g, ''));
    /* Décoder UTF-8 correctement */
    const decoded = decodeURIComponent(escape(contenu));
    const json = JSON.parse(decoded);

    return { ok: true, data: json, sha: file.sha };

  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/* ═══════════════════════════════════════════════════════════
   ✏️ ÉCRITURE d'un fichier JSON
   ═══════════════════════════════════════════════════════════ */
async function ghEcrire(marcheId, data, commitMessage) {
  const token = ghGetToken();
  if (!token) return { ok: false, error: 'Token manquant' };

  const url = `https://api.github.com/repos/${GH_CONFIG.owner}/${GH_CONFIG.repo}/contents/data/${marcheId}.json`;

  try {
    /* 1. Lire le SHA actuel */
    const current = await ghLire(marcheId);
    if (!current.ok && current.status !== 404) {
      return { ok: false, error: 'Lecture SHA échouée: ' + current.error };
    }

    /* 2. Encoder en base64 (UTF-8 safe) */
    const jsonStr = JSON.stringify(data, null, 2);
    const base64 = btoa(unescape(encodeURIComponent(jsonStr)));

    /* 3. Préparer le body */
    const body = {
      message: commitMessage || `Update ${marcheId}`,
      content: base64,
      branch: GH_CONFIG.branch
    };
    /* SHA requis si le fichier existe déjà */
    if (current.ok && current.sha) {
      body.sha = current.sha;
    }

    /* 4. Envoyer */
    const r = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return { ok: false, error: 'HTTP ' + r.status + ': ' + (err.message || ''), status: r.status };
    }

    const result = await r.json();
    return {
      ok: true,
      commit: result.commit.sha.slice(0, 8),
      message: result.commit.message
    };

  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/* ═══════════════════════════════════════════════════════════
   🔄 Lecture silencieuse avec fallback localStorage
   (utilisée au démarrage : essaie GitHub, sinon localStorage)
   ═══════════════════════════════════════════════════════════ */
async function ghLireAvecFallback(marcheId) {
  /* 1. Si PAT disponible → essayer GitHub */
  if (ghHasToken()) {
    const remote = await ghLire(marcheId);
    if (remote.ok) {
      console.log('✅ Données lues depuis GitHub');
      return remote;
    }
    console.warn('⚠️ GitHub inaccessible, utilisation localStorage:', remote.error);
  }

  /* 2. Fallback : localStorage */
  const local = localStorage.getItem('suivi_' + marcheId);
  if (local) {
    try {
      console.log('📦 Données lues depuis localStorage');
      return { ok: true, data: JSON.parse(local), source: 'local' };
    } catch (e) {
      return { ok: false, error: 'localStorage corrompu: ' + e.message };
    }
  }

  return { ok: false, error: 'Aucune donnée disponible' };
}

/* ─── Exposer les fonctions globalement ─── */
window.ghGetToken = ghGetToken;
window.ghSaveToken = ghSaveToken;
window.ghClearToken = ghClearToken;
window.ghHasToken = ghHasToken;
window.ghTestConnexion = ghTestConnexion;
window.ghLire = ghLire;
window.ghEcrire = ghEcrire;
window.ghLireAvecFallback = ghLireAvecFallback;

console.log('🌐 github-api.js chargé');