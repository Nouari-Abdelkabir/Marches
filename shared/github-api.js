/* ═══════════════════════════════════════════════════════════
   🌐 GITHUB API — Couche de communication avec GitHub
   Version : Anti-conflit 409 (file d'attente + SHA frais)
   ═══════════════════════════════════════════════════════════ */

const GH_CONFIG = {
  owner: 'nouari-abdelkabir',
  repo: 'Marches',
  branch: 'main',
  tokenKey: 'github_pat'
};

/* ─── Récupérer le PAT ─── */
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

/* ─── Vérifier si PAT est configuré ─── */
function ghHasToken() {
  const t = ghGetToken();
  return t && t.startsWith('ghp_') && t.length === 40;
}

/* ─── Test de connexion ─── */
async function ghTestConnexion() {
  const token = ghGetToken();
  if (!token) return { ok: false, error: 'Pas de token' };

  try {
    const r = await fetch('https://api.github.com/user', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!r.ok) return { ok: false, error: 'HTTP ' + r.status };
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
  const url = `https://api.github.com/repos/${GH_CONFIG.owner}/${GH_CONFIG.repo}/contents/data/${marcheId}.json?ref=${GH_CONFIG.branch}&t=${Date.now()}`;

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
    const decoded = decodeURIComponent(escape(contenu));
    const json = JSON.parse(decoded);

    return { ok: true, data: json, sha: file.sha };

  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/* ═══════════════════════════════════════════════════════════
   ✏️ ÉCRITURE avec FILE D'ATTENTE (anti-409)
   ═══════════════════════════════════════════════════════════ */

/* État de la file d'attente par marché */
const GH_PENDING = {};

/**
 * Écriture publique : met en file d'attente si une écriture est déjà en cours
 */
async function ghEcrire(marcheId, data, commitMessage) {
  const token = ghGetToken();
  if (!token) return { ok: false, error: 'Token manquant' };

  /* 1. Si une écriture est en cours pour ce marché → marquer comme pending */
  if (GH_PENDING[marcheId] && GH_PENDING[marcheId].running) {
    GH_PENDING[marcheId].data = data;
    GH_PENDING[marcheId].message = commitMessage;
    console.log('⏳ Écriture mise en attente pour', marcheId);
    return { ok: true, queued: true };
  }

  /* 2. Sinon, lancer la boucle de traitement */
  GH_PENDING[marcheId] = {
    running: true,
    data: data,
    message: commitMessage
  };

  let dernierResultat = { ok: false, error: 'Aucune écriture effectuée' };

  /* 3. Boucler tant qu'il reste des modifications à envoyer */
  while (GH_PENDING[marcheId]) {
    const pending = GH_PENDING[marcheId];

    /* Marquer comme "en cours" mais garder les données */
    GH_PENDING[marcheId] = {
      running: true,
      data: null,
      message: null
    };

    /* Écrire réellement */
    dernierResultat = await ghEcrireDirect(marcheId, pending.data, pending.message);
    console.log('📤 Résultat écriture:', dernierResultat.ok ? '✅' : '❌', dernierResultat.error || '');

    /* Si une nouvelle donnée a été mise en attente pendant l'écriture → continuer */
    if (GH_PENDING[marcheId] && GH_PENDING[marcheId].data !== null) {
      console.log('🔄 Nouvelle donnée en attente, reprise...');
      continue;
    }

    /* Sinon, terminer */
    delete GH_PENDING[marcheId];
  }

  return dernierResultat;
}

/**
 * Écriture réelle (appelée par la file d'attente uniquement)
 * Lit TOUJOURS un SHA frais juste avant le PUT
 */
async function ghEcrireDirect(marcheId, data, commitMessage) {
  const token = ghGetToken();
  if (!token) return { ok: false, error: 'Token manquant' };
  if (!data) return { ok: false, error: 'Aucune donnée à écrire' };

  const url = `https://api.github.com/repos/${GH_CONFIG.owner}/${GH_CONFIG.repo}/contents/data/${marcheId}.json`;

  try {
    /* ─── A. Lire SHA FRAIS juste avant PUT (avec anti-cache) ─── */
    const getResp = await fetch(url + '?t=' + Date.now(), {
    headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github.v3+json'
    }
    });

    let sha = null;
    if (getResp.ok) {
      const file = await getResp.json();
      sha = file.sha;
      console.log('🔑 SHA frais:', sha.slice(0, 8));
    } else if (getResp.status === 404) {
      console.log('🆕 Nouveau fichier (SHA absent)');
    } else {
      return { ok: false, error: 'Lecture SHA échouée: HTTP ' + getResp.status };
    }

    /* ─── B. Encoder en base64 UTF-8 safe ─── */
    const jsonStr = JSON.stringify(data, null, 2);
    const base64 = btoa(unescape(encodeURIComponent(jsonStr)));
    console.log('📏 Taille:', Math.round(jsonStr.length / 1024), 'Ko');

    /* ─── C. Préparer le body ─── */
    const body = {
      message: commitMessage || `Update ${marcheId} — ${new Date().toISOString().slice(0,16)}`,
      content: base64,
      branch: GH_CONFIG.branch
    };
    if (sha) body.sha = sha;

    /* ─── D. Envoyer PUT ─── */
    const putResp = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!putResp.ok) {
      const err = await putResp.json().catch(() => ({}));
      return {
        ok: false,
        error: 'HTTP ' + putResp.status + ': ' + (err.message || ''),
        status: putResp.status
      };
    }

    const result = await putResp.json();
    console.log('✅ Commit:', result.commit.sha.slice(0, 8));
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
   🔄 Lecture avec fallback localStorage
   ═══════════════════════════════════════════════════════════ */
async function ghLireAvecFallback(marcheId) {
  if (ghHasToken()) {
    const remote = await ghLire(marcheId);
    if (remote.ok) {
      console.log('✅ Données lues depuis GitHub');
      return remote;
    }
    console.warn('⚠️ GitHub inaccessible, fallback localStorage:', remote.error);
  }

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

/* ─── Exposer globalement ─── */
window.ghGetToken = ghGetToken;
window.ghSaveToken = ghSaveToken;
window.ghClearToken = ghClearToken;
window.ghHasToken = ghHasToken;
window.ghTestConnexion = ghTestConnexion;
window.ghLire = ghLire;
window.ghEcrire = ghEcrire;
window.ghLireAvecFallback = ghLireAvecFallback;

console.log('🌐 github-api.js chargé (v2 — anti-409)');