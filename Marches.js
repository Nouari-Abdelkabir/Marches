/* ═══════════════════════════════════════════════════════════
   🏠 PAGE D'ACCUEIL — Gestion des Marchés
   ═══════════════════════════════════════════════════════════ */

const CLE_GLOBALE = 'suivi_adm_global';

/* ═══════════════════════════════════════════════════════════
   🌐 CHARGEMENT DE LA LISTE DES MARCHÉS
   Priorité : GitHub → localStorage (fallback)
   ═══════════════════════════════════════════════════════════ */
let GLOBAL = { marches: {} };
let GLOBAL_CHARGE = false;

async function chargerGlobalAsync() {
  console.log('📡 Chargement de la liste des marchés...');

  /* 1. Essayer GitHub */
  try {
    const url = `https://raw.githubusercontent.com/${GH_CONFIG.owner}/${GH_CONFIG.repo}/${GH_CONFIG.branch}/data/_list.json?t=${Date.now()}`;
    const r = await fetch(url);

    if (r.ok) {
      const data = await r.json();
      if (data && data.marches) {
        GLOBAL = data;
        console.log('✅ Liste chargée depuis GitHub:', Object.keys(GLOBAL.marches).length, 'marché(s)');
        /* Cache localStorage */
        try { localStorage.setItem('suivi_adm_global', JSON.stringify(GLOBAL)); } catch(e) {}
        GLOBAL_CHARGE = true;
        return;
      }
    }
    console.warn('⚠️ _list.json introuvable sur GitHub (status:', r.status, ')');
  } catch (e) {
    console.warn('⚠️ Erreur GitHub:', e.message);
  }

  /* 2. Fallback : localStorage */
  try {
    const raw = localStorage.getItem('suivi_adm_global');
    if (raw) {
      GLOBAL = JSON.parse(raw);
      console.log('📦 Liste chargée depuis localStorage:', Object.keys(GLOBAL.marches).length, 'marché(s)');
      GLOBAL_CHARGE = true;
      return;
    }
  } catch (e) {
    console.error('❌ localStorage corrompu:', e);
  }

  /* 3. Défauts */
  console.warn('⚠️ Aucune source — liste vide');
  GLOBAL = { marches: {} };
  GLOBAL_CHARGE = true;
}
/* Compatibilité : chargerGlobal() en mode synchrone (déprécié) */
function chargerGlobal() {
  try {
    const raw = localStorage.getItem('suivi_adm_global');
    if (raw) {
      GLOBAL = JSON.parse(raw);
      GLOBAL_CHARGE = true;
      return GLOBAL;
    }
  } catch(e) {}
  GLOBAL = { marches: {} };
  GLOBAL_CHARGE = true;
  return GLOBAL;
}

function sauvegarderGlobal() {
  try { localStorage.setItem(CLE_GLOBALE, JSON.stringify(GLOBAL)); }
  catch(e) { alert('Erreur de sauvegarde : ' + e.message); }
}

/* ─── Rendu des cartes ─── */
function rendreMarches() {
  const grid = document.getElementById('marches-grid');
  const empty = document.getElementById('marches-empty');
  const ids = Object.keys(GLOBAL.marches).sort();

  if (ids.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  grid.innerHTML = ids.map(id => {
    const m = GLOBAL.marches[id];
    const stats = getStatistiquesMarche(id);
    const folder = id; /* le dossier porte le même nom */

    return `
      <a class="marche-card" href="app.html?m=${id}" style="border-top-color:${m.couleur || '#1e3a8a'};">
        <div class="marche-card-header">
          <div>
            <div class="marche-card-num" style="color:${m.couleur || '#1e3a8a'};">${id}</div>
            <div class="marche-card-nom">${m.nom || '—'}</div>
          </div>
          <div class="marche-card-actions">
            <button class="marche-card-btn" title="Modifier (N° + Nom + Couleur)"
                    onclick="event.preventDefault();event.stopPropagation();ouvrirEditionMarche('${id}')">✏️</button>
            <button class="marche-card-btn danger" title="Supprimer"
                    onclick="event.preventDefault();event.stopPropagation();supprimerMarche('${id}')">🗑️</button>
          </div>
        </div>

        <div class="marche-card-body">
          <div class="marche-card-stats">
            <div class="marche-stat">
              <div class="marche-stat-value">${stats.commandes}</div>
              <div class="marche-stat-label">Commandes</div>
            </div>
            <div class="marche-stat">
              <div class="marche-stat-value">${stats.metres}</div>
              <div class="marche-stat-label">Metrés</div>
            </div>
            <div class="marche-stat">
              <div class="marche-stat-value">${stats.budget.toLocaleString('fr-FR', {maximumFractionDigits:0})}</div>
              <div class="marche-stat-label">Budget (DH)</div>
            </div>
            <div class="marche-stat">
              <div class="marche-stat-value">${stats.metresMontant.toLocaleString('fr-FR', {maximumFractionDigits:0})}</div>
              <div class="marche-stat-label">Metré (DH)</div>
            </div>
          </div>
        </div>

        <div class="marche-card-footer">
          <span>📅 ${new Date(m.createdAt).toLocaleDateString('fr-FR')}</span>
          <span class="marche-card-open" style="color:${m.couleur || '#1e3a8a'};">
            Ouvrir →
          </span>
        </div>
      </a>
    `;
  }).join('');
}

/* ─── Stats d'un marché (lecture de son localStorage) ─── */
function getStatistiquesMarche(id) {
  try {
    const raw = localStorage.getItem('suivi_' + id);
    if (!raw) return { commandes:0, metres:0, budget:0, metresMontant:0 };
    const d = JSON.parse(raw);
    const commandes = (d.commandes || []).length;
    const metres = (d.metresEnregistres || []).length;
    const budget = (d.catalogue || []).reduce((s,p) => s + (p.qteInitiale || 0) * (p.prixUnitaire || 0), 0);

    let metresMontant = 0;
    (d.metresEnregistres || []).forEach(m => {
      Object.values(m.entrees || {}).forEach(row => {
        Object.entries(row).forEach(([p, q]) => {
          const cat = (d.catalogue || []).find(x => x.numero === parseInt(p));
          if (cat) metresMontant += (parseFloat(q) || 0) * (cat.prixUnitaire || 0);
        });
      });
    });

    return { commandes, metres, budget, metresMontant };
  } catch(e) {
    return { commandes:0, metres:0, budget:0, metresMontant:0 };
  }
}

/* ─── Stats globales (header) ─── */
function rendreStatsGlobales() {
  const ids = Object.keys(GLOBAL.marches);
  let budgetTotal = 0, commandesTotal = 0;

  ids.forEach(id => {
    const s = getStatistiquesMarche(id);
    budgetTotal += s.budget;
    commandesTotal += s.commandes;
  });

  /* Taille localStorage */
  let taille = 0;
  for (let k in localStorage) {
    if (k.startsWith('suivi_')) taille += localStorage[k].length;
  }
  const tailleMB = (taille / (1024 * 1024)).toFixed(2);

  document.getElementById('stat-nb-marches').textContent = ids.length;
  document.getElementById('stat-budget-total').textContent =
    budgetTotal.toLocaleString('fr-FR', {maximumFractionDigits:0});
  document.getElementById('stat-nb-commandes').textContent = commandesTotal;
  document.getElementById('stat-storage').textContent = tailleMB + ' Mo';
}

/* ─── Filtrer ─── */
function filterMarches(q) {
  q = (q || '').toLowerCase().trim();
  const cards = document.querySelectorAll('.marche-card');
  cards.forEach(card => {
    const text = card.textContent.toLowerCase();
    card.style.display = text.includes(q) ? '' : 'none';
  });
}

/* ═══════════════════════════════════════════════════════════
   ➕ NOUVEAU MARCHÉ
   ═══════════════════════════════════════════════════════════ */
function ajouterNouveauMarche() {
  /* Reset les champs */
  const numEl = document.getElementById('new-marche-num');
  const nomEl = document.getElementById('new-marche-nom');
  const debutEl = document.getElementById('new-marche-debut');
  const finEl = document.getElementById('new-marche-fin');
  const moEl = document.getElementById('new-marche-mo');
  const moeEl = document.getElementById('new-marche-moe');
  const prestEl = document.getElementById('new-marche-prestataire');
  const sectionEl = document.getElementById('new-marche-section');
  const objetEl = document.getElementById('new-marche-objet');
  const statusEl = document.getElementById('new-marche-status');
  const btnEl = document.getElementById('btn-creer-marche');

  if (numEl) numEl.value = '';
  if (nomEl) nomEl.value = '';
  if (debutEl) debutEl.value = '';
  if (finEl) finEl.value = '';
  if (moEl) moEl.value = 'La Société Nationale des Autoroutes du Maroc';
  if (moeEl) moeEl.value = 'Le Chef de division Viabilité et Sécurité';
  if (prestEl) prestEl.value = 'AIC';
  if (sectionEl) sectionEl.value = '';
  if (objetEl) objetEl.value = '';

  /* Reset couleur */
  const colDefault = document.querySelector('input[name="new-marche-color"][value="#1e3a8a"]');
  if (colDefault) colDefault.checked = true;

  /* Reset sections à cocher */
  ['dashboard', 'parametres', 'catalogue', 'commandes', 'metre', 'constat',
   'suivi', 'sinistres', 'equipements', 'historique', 'export'].forEach(s => {
    const el = document.getElementById('sec-' + s);
    if (el) el.checked = true;
  });

  /* Cacher le status */
  if (statusEl) {
    statusEl.style.display = 'none';
    statusEl.className = 'form-status';
  }

  /* Réactiver le bouton */
  if (btnEl) {
    btnEl.disabled = false;
    btnEl.textContent = '✅ Créer le Marché';
  }

  /* Ouvrir le modal */
  const modal = document.getElementById('modal-nouveau-marche');
  if (modal) {
    modal.classList.add('open');
    setTimeout(() => {
      if (numEl) numEl.focus();
    }, 100);
  } else {
    console.error('❌ Modal #modal-nouveau-marche introuvable');
  }
}

function fermerModalNouveau() {
  document.getElementById('modal-nouveau-marche').classList.remove('open');
}

/* ═══════════════════════════════════════════════════════════
   ✅ CRÉATION D'UN NOUVEAU MARCHÉ (avec GitHub API)
   ═══════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════
   ✅ CRÉATION D'UN NOUVEAU MARCHÉ (v3 — sans dossiers)
   Crée UNIQUEMENT : data/ID.json + met à jour data/_list.json
   ═══════════════════════════════════════════════════════════ */
async function creerNouveauMarche() {
  const num = document.getElementById('new-marche-num').value.trim();
  const nom = document.getElementById('new-marche-nom').value.trim();

  if (!num) return afficherStatus('error', '⚠️ Le N° du marché est obligatoire');
  if (!nom) return afficherStatus('error', '⚠️ Le nom est obligatoire');

  const id = num.replace(/\//g, '-');

  if (GLOBAL.marches[id]) {
    return afficherStatus('error', `⚠️ Le marché "${id}" existe déjà`);
  }

  if (!window.ghHasToken || !ghHasToken()) {
    return afficherStatus('error', '❌ PAT GitHub non configuré. Ajoutez-le d\'abord.');
  }

  /* ═══ Collecte des données du formulaire ═══ */
  const couleur = document.querySelector('input[name="new-marche-color"]:checked').value;
  const dateDebut = document.getElementById('new-marche-debut').value;
  const dateFin = document.getElementById('new-marche-fin').value;
  const mo = document.getElementById('new-marche-mo').value.trim();
  const moe = document.getElementById('new-marche-moe').value.trim();
  const prestataire = document.getElementById('new-marche-prestataire').value.trim();
  const section = document.getElementById('new-marche-section').value.trim();
  const objet = document.getElementById('new-marche-objet').value.trim();

  const sections = {
    dashboard:   document.getElementById('sec-dashboard').checked,
    parametres:  document.getElementById('sec-parametres').checked,
    catalogue:   document.getElementById('sec-catalogue').checked,
    commandes:   document.getElementById('sec-commandes').checked,
    metre:       document.getElementById('sec-metre').checked,
    constat:     document.getElementById('sec-constat').checked,
    attachement: false,
    decomptes:   false,
    suivi:       document.getElementById('sec-suivi').checked,
    sinistres:   document.getElementById('sec-sinistres').checked,
    equipements: document.getElementById('sec-equipements').checked,
    historique:  document.getElementById('sec-historique').checked,
    export:      document.getElementById('sec-export').checked
  };

  /* ═══ Désactiver le bouton ═══ */
  const btnCreer = document.getElementById('btn-creer-marche');
  btnCreer.disabled = true;
  btnCreer.textContent = '⏳ Création...';
  afficherStatus('loading', '⏳ Étape 1/2 : Création du fichier de données...');

  try {
    /* ═══ 1. Construire data/ID.json ═══ */
    const nouvelleData = {
      config: {
        id: id,
        nom: nom,
        couleur: couleur,
        sections: sections
      },
      marcheActif: id,
      parametres: {
        mo: mo || '',
        moe: moe || '',
        prestataire: prestataire || '',
        marche: num,
        section: section || '',
        objet: objet || '',
        dateDebut: dateDebut || '',
        dateFin: dateFin || '',
        logo: '',
        dressePar: "L'Adjoint Viabilité",
        dresseNom: '',
        validePar: 'Le chef de division sécurité et entretien',
        valideNom: '',
        acceptePar: "Le représentant de l'entreprise",
        accepteNom: '',
        accepteDate: ''
      },
      catalogue: [],
      commandes: [],
      historique: [],
      metresEnregistres: [],
      constatsEnregistres: [],
      suivisPrix: [],
      etatsSinistres: [],
      facturesSinistres: {},
      photoSinistres: {},
      equipementsEnregistres: [],
      facturesEnregistrees: [],
      factureAutoNumbers: {},
      metres: {
        TR1: { date: '', entrees: {}, sinistres: {}, fax: {}, prestations: {} },
        TR2: { date: '', entrees: {}, sinistres: {}, fax: {}, prestations: {} },
        TR3: { date: '', entrees: {}, sinistres: {}, fax: {}, prestations: {} },
        TR4: { date: '', entrees: {}, sinistres: {}, fax: {}, prestations: {} }
      },
      constats: {
        TR1: { date: '', anterieures: {}, observations: {}, quantitesMois: {} },
        TR2: { date: '', anterieures: {}, observations: {}, quantitesMois: {} },
        TR3: { date: '', anterieures: {}, observations: {}, quantitesMois: {} },
        TR4: { date: '', anterieures: {}, observations: {}, quantitesMois: {} },
        CONS: { date: '', anterieures: {}, observations: {}, quantitesMois: {} }
      }
    };

    const resultatData = await creerFichierGitHub(
      `data/${id}.json`,
      JSON.stringify(nouvelleData, null, 2),
      `Créer données ${id}`
    );

    if (!resultatData.ok) {
      throw new Error('Échec création data : ' + resultatData.error);
    }
    console.log('✅ data/' + id + '.json créé');

    /* ═══ 2. Mettre à jour data/_list.json ═══ */
    afficherStatus('loading', '⏳ Étape 2/2 : Mise à jour de la liste...');

    const listUrl = `https://api.github.com/repos/${GH_CONFIG.owner}/${GH_CONFIG.repo}/contents/data/_list.json`;
    const listResp = await fetch(listUrl, {
      headers: { 'Authorization': 'Bearer ' + ghGetToken() }
    });

    let listData = { marches: {} };
    let listSha = null;

    if (listResp.ok) {
      const file = await listResp.json();
      listSha = file.sha;
      const decoded = decodeURIComponent(escape(atob(file.content.replace(/\n/g, ''))));
      listData = JSON.parse(decoded);
    } else if (listResp.status !== 404) {
      throw new Error('Impossible de lire _list.json');
    }

    listData.marches[id] = {
      nom: nom,
      couleur: couleur,
      createdAt: new Date().toISOString(),
      sections: sections
    };

    const listBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(listData, null, 2))));
    const listBody = {
      message: `Ajouter ${id} à la liste`,
      content: listBase64,
      branch: GH_CONFIG.branch
    };
    if (listSha) listBody.sha = listSha;

    const listPut = await fetch(listUrl, {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + ghGetToken(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(listBody)
    });

    if (!listPut.ok) {
      const err = await listPut.json().catch(() => ({}));
      throw new Error('Échec mise à jour liste : ' + (err.message || listPut.status));
    }
    console.log('✅ _list.json mis à jour');

    /* ═══ 3. Mettre à jour GLOBAL local + cache ═══ */
    GLOBAL.marches[id] = {
      nom: nom,
      couleur: couleur,
      createdAt: new Date().toISOString(),
      sections: sections
    };
    try { localStorage.setItem('suivi_adm_global', JSON.stringify(GLOBAL)); } catch(e) {}

    /* ═══ 4. Succès ! ═══ */
    afficherStatus('success',
      `✅ Marché "${id}" créé avec succès !<br>
       <small>Redirection vers le nouveau marché...</small>`
    );

    setTimeout(() => {
      window.location.href = `app.html?m=${id}`;
    }, 1500);

  } catch (err) {
    console.error(err);
    afficherStatus('error', '❌ ' + err.message);
    btnCreer.disabled = false;
    btnCreer.textContent = '✅ Créer le Marché';
  }
}


function afficherStatus(type, message) {
  const el = document.getElementById('new-marche-status');
  if (!el) return;
  el.className = 'form-status ' + type;
  el.innerHTML = message;
  el.style.display = 'block';
}

async function creerFichierGitHub(path, content, message) {
  const token = ghGetToken();
  if (!token) return { ok: false, error: 'Token manquant' };

  const url = `https://api.github.com/repos/${GH_CONFIG.owner}/${GH_CONFIG.repo}/contents/${path}`;

  try {
    let sha = null;
    const checkResp = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (checkResp.ok) {
      const existing = await checkResp.json();
      sha = existing.sha;
    }

    const base64 = btoa(unescape(encodeURIComponent(content)));
    const body = {
      message: message,
      content: base64,
      branch: GH_CONFIG.branch
    };
    if (sha) body.sha = sha;

    const r = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return { ok: false, error: `HTTP ${r.status}: ${err.message || ''}` };
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function getStructureVide(id) {
  return {
    marcheActif: id,
    parametres: null,
    catalogue: [],
    commandes: [],
    historique: [],
    metresEnregistres: [],
    constatsEnregistres: [],
    suivisPrix: [],
    etatsSinistres: [],
    facturesSinistres: {},
    photoSinistres: {},
    equipementsEnregistres: [],
    facturesEnregistrees: [],
    factureAutoNumbers: {},
    metres: {},
    constats: {}
  };
}

/* ═══════════════════════════════════════════════════════════
   ✏️ RENOMMER / SUPPRIMER
   ═══════════════════════════════════════════════════════════ */
function renommerMarche(id) {
  const m = GLOBAL.marches[id];
  if (!m) return;
  const nouveau = prompt(`Nouveau nom pour ${id} :`, m.nom);
  if (!nouveau || !nouveau.trim()) return;
  m.nom = nouveau.trim();
  sauvegarderGlobal();
  rendreMarches();
}

function supprimerMarche(id) {
  if (!confirm(`⚠️ Supprimer "${id}" ?\n\nToutes les données de ce marché seront effacées.`)) return;
  if (!confirm('Confirmer une seconde fois ?\n\nCette action est IRRÉVERSIBLE.')) return;

  delete GLOBAL.marches[id];
  localStorage.removeItem('suivi_' + id);
  sauvegarderGlobal();
  rendreMarches();
  rendreStatsGlobales();
  alert(`🗑️ Marché ${id} supprimé.\n\n(N'oubliez pas de supprimer aussi son dossier)`);
}

/* ═══════════════════════════════════════════════════════════
   💾 SAUVEGARDE GLOBALE (tous les marchés)
   ═══════════════════════════════════════════════════════════ */
function exporterToutJSON() {
  const all = { _global: GLOBAL, _marches: {} };
  Object.keys(GLOBAL.marches).forEach(id => {
    const raw = localStorage.getItem('suivi_' + id);
    if (raw) {
      try { all._marches[id] = JSON.parse(raw); } catch(e) {}
    }
  });

  const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Sauvegarde_Globale_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  alert('📥 Sauvegarde globale téléchargée');
}

/* Import */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('file-global-json').onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data._global || !data._marches) throw new Error('Format invalide');

        if (!confirm(`Restaurer ${Object.keys(data._marches).length} marché(s) ?\n\nLes données actuelles seront remplacées.`)) return;

        GLOBAL = data._global;
        sauvegarderGlobal();

        Object.entries(data._marches).forEach(([id, contenu]) => {
          localStorage.setItem('suivi_' + id, JSON.stringify(contenu));
        });

        rendreMarches();
        rendreStatsGlobales();
        alert('✅ Restauration réussie');
      } catch(err) {
        alert('❌ Erreur : ' + err.message);
      }
    };
    r.readAsText(f);
    e.target.value = '';
  };
});

/* ═══════════════════════════════════════════════════════════
   ✏️ MODIFICATION D'UN MARCHÉ (N° + Nom + Couleur)
   ═══════════════════════════════════════════════════════════ */

/* État de l'édition en cours */
let editingMarcheId = null;

/* ─── Ouvrir la fenêtre ─── */
function ouvrirEditionMarche(id) {
  const m = GLOBAL.marches[id];
  if (!m) { alert('⚠️ Marché introuvable'); return; }

  editingMarcheId = id;

  /* Remplir les champs */
  document.getElementById('edit-marche-old-id').value = id;
  document.getElementById('edit-marche-new-id').value = '';
  document.getElementById('edit-marche-nom').value = m.nom || '';

  /* Cocher la couleur actuelle */
  const colorInputs = document.querySelectorAll('input[name="edit-marche-color"]');
  let colorFound = false;
  colorInputs.forEach(inp => {
    if (inp.value === m.couleur) { inp.checked = true; colorFound = true; }
  });
  if (!colorFound) colorInputs[0].checked = true;

  /* Cacher le status */
  const statusEl = document.getElementById('edit-marche-status');
  statusEl.style.display = 'none';
  statusEl.className = 'form-status';

  /* Réactiver le bouton */
  const btn = document.getElementById('btn-save-edition');
  btn.disabled = false;
  btn.textContent = '✅ Enregistrer';

  /* Ouvrir */
  document.getElementById('modal-edition-marche').classList.add('open');
}

/* ─── Fermer la fenêtre ─── */
function fermerModalEdition() {
  document.getElementById('modal-edition-marche').classList.remove('open');
  editingMarcheId = null;
}

/* ─── Helper : Afficher un statut ─── */
function afficherEditStatus(type, message) {
  const el = document.getElementById('edit-marche-status');
  el.className = 'form-status ' + type;
  el.innerHTML = message;
  el.style.display = 'block';
}

/* ─── Sauvegarder les modifications ─── */
async function sauvegarderEditionMarche() {
  if (!editingMarcheId) return;

  const oldId = editingMarcheId;
  const newIdRaw = document.getElementById('edit-marche-new-id').value.trim();
  const newId = newIdRaw ? newIdRaw.replace(/\//g, '-') : oldId;
  const nom = document.getElementById('edit-marche-nom').value.trim();
  const couleur = document.querySelector('input[name="edit-marche-color"]:checked').value;

  /* ─── Validations ─── */
  if (!nom) return afficherEditStatus('error', '⚠️ Le nom est obligatoire');

  const changeId = (newId !== oldId);

  if (changeId && GLOBAL.marches[newId]) {
    return afficherEditStatus('error', `⚠️ Le marché "${newId}" existe déjà`);
  }

  if (changeId && !confirm(
    `⚠️ ATTENTION\n\n` +
    `Vous allez renommer "${oldId}" en "${newId}"\n\n` +
    `Cela signifie :\n` +
    `• Créer data/${newId}.json\n` +
    `• Supprimer data/${oldId}.json\n` +
    `• Mettre à jour la liste\n\n` +
    `L'ancien lien app.html?m=${oldId} ne fonctionnera plus.\n\n` +
    `Continuer ?`
  )) return;

  if (!window.ghHasToken || !ghHasToken()) {
    return afficherEditStatus('error', '❌ PAT GitHub non configuré');
  }

  /* Désactiver le bouton */
  const btn = document.getElementById('btn-save-edition');
  btn.disabled = true;
  btn.textContent = '⏳ Enregistrement...';
  afficherEditStatus('loading', '⏳ Enregistrement en cours...');

  try {
    /* ═══ A. Lire les données existantes ═══ */
    afficherEditStatus('loading', '⏳ Lecture des données...');
    const oldDataRaw = await lireFichierGitHub(`data/${oldId}.json`);
    if (!oldDataRaw.ok) throw new Error('Impossible de lire les données : ' + oldDataRaw.error);

    const data = JSON.parse(oldDataRaw.content);

    /* ═══ B. Mettre à jour les champs ═══ */
    if (!data.config) data.config = {};
    data.config.id = newId;
    data.config.nom = nom;
    data.config.couleur = couleur;
    if (!data.config.sections) {
      data.config.sections = GLOBAL.marches[oldId]?.sections || {};
    }
    data.marcheActif = newId;

    /* ═══ C. Écrire le nouveau fichier ═══ */
    if (changeId) {
      afficherEditStatus('loading', `⏳ Création de data/${newId}.json...`);
      const writeResult = await ecrireFichierGitHub(
        `data/${newId}.json`,
        JSON.stringify(data, null, 2),
        `Renommer ${oldId} → ${newId}`
      );
      if (!writeResult.ok) throw new Error('Échec création : ' + writeResult.error);
    } else {
      /* Même ID — simple mise à jour */
      afficherEditStatus('loading', '⏳ Mise à jour du fichier...');
      const writeResult = await ecrireFichierGitHub(
        `data/${oldId}.json`,
        JSON.stringify(data, null, 2),
        `Modifier ${oldId}`
      );
      if (!writeResult.ok) throw new Error('Échec mise à jour : ' + writeResult.error);
    }

    /* ═══ D. Supprimer l'ancien fichier (si ID changé) ═══ */
    if (changeId) {
      afficherEditStatus('loading', `⏳ Suppression de data/${oldId}.json...`);
      const delResult = await supprimerFichierGitHub(
        `data/${oldId}.json`,
        `Renommer ${oldId} → ${newId}`
      );
      if (!delResult.ok) console.warn('⚠️ Échec suppression ancien fichier:', delResult.error);
    }

    /* ═══ E. Mettre à jour _list.json ═══ */
    afficherEditStatus('loading', '⏳ Mise à jour de la liste...');

    /* ⏱️ Attendre 1 seconde pour laisser GitHub traiter les opérations précédentes */
    await new Promise(r => setTimeout(r, 1000));

    const listResult = await lireFichierGitHub('data/_list.json');
    let listData = listResult.ok ? JSON.parse(listResult.content) : { marches: {} };

    /* Supprimer l'ancien */
    if (changeId) delete listData.marches[oldId];

    /* Ajouter/mettre à jour le nouveau */
    listData.marches[newId] = {
      nom: nom,
      couleur: couleur,
      createdAt: GLOBAL.marches[oldId]?.createdAt || new Date().toISOString(),
      sections: data.config.sections
    };

    const listWrite = await ecrireFichierGitHub(
      'data/_list.json',
      JSON.stringify(listData, null, 2),
      `Mise à jour liste après modification ${newId}`
    );
    if (!listWrite.ok) throw new Error('Échec mise à jour liste : ' + listWrite.error);

    /* ═══ F. Mettre à jour GLOBAL local ═══ */
    if (changeId) delete GLOBAL.marches[oldId];
    GLOBAL.marches[newId] = listData.marches[newId];
    try { localStorage.setItem('suivi_adm_global', JSON.stringify(GLOBAL)); } catch(e) {}

    /* ═══ G. Succès ! ═══ */
    afficherEditStatus('success', `✅ Marché "${newId}" modifié avec succès !`);

    setTimeout(() => {
      fermerModalEdition();
      rendreMarches();
      rendreStatsGlobales();
      if (changeId && confirm(`Marché renommé "${newId}".\n\nVoulez-vous y accéder maintenant ?`)) {
        window.location.href = `app.html?m=${newId}`;
      }
    }, 1500);

  } catch (err) {
    console.error(err);
    afficherEditStatus('error', '❌ ' + err.message);
    btn.disabled = false;
    btn.textContent = '✅ Enregistrer';
  }
}

/* ═══════════════════════════════════════════════════════════
   🔧 HELPERS GITHUB (lecture / écriture / suppression)
   ═══════════════════════════════════════════════════════════ */

async function lireFichierGitHub(path) {
  const token = ghGetToken();
  const url = `https://api.github.com/repos/${GH_CONFIG.owner}/${GH_CONFIG.repo}/contents/${path}?t=${Date.now()}`;

  try {
    const r = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (r.status === 404) return { ok: false, error: '404', status: 404 };
    if (!r.ok) return { ok: false, error: 'HTTP ' + r.status, status: r.status };

    const file = await r.json();
    const content = decodeURIComponent(escape(atob(file.content.replace(/\n/g, ''))));
    return { ok: true, content: content, sha: file.sha };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function ecrireFichierGitHub(path, content, message) {
  const token = ghGetToken();
  const url = `https://api.github.com/repos/${GH_CONFIG.owner}/${GH_CONFIG.repo}/contents/${path}`;

  try {
    /* Lire SHA si existe — anti-cache via ?t= */
    let sha = null;
    const check = await fetch(url + '?t=' + Date.now(), {
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });
    if (check.ok) sha = (await check.json()).sha;

    const base64 = btoa(unescape(encodeURIComponent(content)));
    const body = { message: message, content: base64, branch: GH_CONFIG.branch };
    if (sha) body.sha = sha;

    const r = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));

      /* 🔄 Retry si 409 */
      if (r.status === 409) {
        console.warn('⚠️ 409 Conflict — Retry avec SHA frais...');

        const retryCheck = await fetch(url + '?t=' + Date.now(), {
          headers: {
            'Authorization': 'Bearer ' + token
          }
        });

        if (retryCheck.ok) {
          const freshSha = (await retryCheck.json()).sha;
          body.sha = freshSha;

          const retry = await fetch(url, {
            method: 'PUT',
            headers: {
              'Authorization': 'Bearer ' + token,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
          });

          if (retry.ok) {
            console.log('✅ Retry réussi');
            return { ok: true };
          }
          const retryErr = await retry.json().catch(() => ({}));
          return { ok: false, error: `HTTP ${retry.status} (retry): ${retryErr.message || ''}` };
        }
      }

      return { ok: false, error: `HTTP ${r.status}: ${err.message || ''}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}


async function supprimerFichierGitHub(path, message) {
  const token = ghGetToken();
  const url = `https://api.github.com/repos/${GH_CONFIG.owner}/${GH_CONFIG.repo}/contents/${path}`;

  try {
    const check = await fetch(url + '?t=' + Date.now(), {
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });
    if (!check.ok) return { ok: false, error: 'Fichier introuvable' };
    const sha = (await check.json()).sha;

    const r = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: message, sha: sha, branch: GH_CONFIG.branch })
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return { ok: false, error: `HTTP ${r.status}: ${err.message || ''}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/* ─── Exposer globalement ─── */
window.ouvrirEditionMarche = ouvrirEditionMarche;
window.fermerModalEdition = fermerModalEdition;
window.sauvegarderEditionMarche = sauvegarderEditionMarche;

/* ═══════════════════════════════════════════════════════════
   🚀 INITIALISATION
   ═══════════════════════════════════════════════════════════ */
document.getElementById('year').textContent = new Date().getFullYear();

/* Charger depuis GitHub puis afficher */
(async function initHome() {
  await chargerGlobalAsync();
  rendreMarches();
  rendreStatsGlobales();
  console.log('🏠 Accueil prêt');
})();

/* Fermer le modal au clic sur le fond */
document.getElementById('modal-nouveau-marche').addEventListener('click', (e) => {
  if (e.target.id === 'modal-nouveau-marche') fermerModalNouveau();
});