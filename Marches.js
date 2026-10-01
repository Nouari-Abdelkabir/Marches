/* ═══════════════════════════════════════════════════════════
   🏠 PAGE D'ACCUEIL — Gestion des Marchés
   ═══════════════════════════════════════════════════════════ */

const CLE_GLOBALE = 'suivi_adm_global';

/* Structure : { marches: { 'M0004-24': { nom, couleur, createdAt }, ... } } */
let GLOBAL = chargerGlobal();

function chargerGlobal() {
  try {
    const raw = localStorage.getItem(CLE_GLOBALE);
    if (raw) return JSON.parse(raw);
  } catch(e) { console.error(e); }
  /* Par défaut */
  return {
    marches: {
      'M0004-24': { nom: 'Entretien Axes Centre-Sud', couleur: '#1e3a8a', createdAt: new Date().toISOString() },
      'M0005-26': { nom: 'Entretien des bâtiments',   couleur: '#059669', createdAt: new Date().toISOString() },
      'M0007-25': { nom: 'M0007/25',                  couleur: '#7c3aed', createdAt: new Date().toISOString() }
    }
  };
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
      <a class="marche-card" href="${folder}/index.html" style="border-top-color:${m.couleur || '#1e3a8a'};">
        <div class="marche-card-header">
          <div>
            <div class="marche-card-num" style="color:${m.couleur || '#1e3a8a'};">${id}</div>
            <div class="marche-card-nom">${m.nom || '—'}</div>
          </div>
          <div class="marche-card-actions">
            <button class="marche-card-btn" title="Renommer"
                    onclick="event.preventDefault();event.stopPropagation();renommerMarche('${id}')">✏️</button>
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
  /* Remplir la liste des sources */
  const sel = document.getElementById('new-marche-source');
  sel.innerHTML = Object.keys(GLOBAL.marches)
    .map(id => `<option value="${id}">${id} — ${GLOBAL.marches[id].nom}</option>`).join('');

  /* Reset */
  document.getElementById('new-marche-num').value = '';
  document.getElementById('new-marche-nom').value = '';
  document.querySelector('input[name="new-marche-color"][value="#1e3a8a"]').checked = true;
  document.querySelector('input[name="new-marche-type"][value="vide"]').checked = true;
  document.getElementById('row-copie-source').style.display = 'none';

  /* Écoute changement type */
  document.querySelectorAll('input[name="new-marche-type"]').forEach(r => {
    r.onchange = () => {
      document.getElementById('row-copie-source').style.display =
        (r.value === 'copie' && r.checked) ? 'block' : 'none';
    };
  });

  document.getElementById('modal-nouveau-marche').classList.add('open');
  setTimeout(() => document.getElementById('new-marche-num').focus(), 100);
}

function fermerModalNouveau() {
  document.getElementById('modal-nouveau-marche').classList.remove('open');
}

function creerNouveauMarche() {
  const num = document.getElementById('new-marche-num').value.trim();
  const nom = document.getElementById('new-marche-nom').value.trim();

  if (!num) { alert('⚠️ Le N° du marché est obligatoire'); return; }
  if (!nom) { alert('⚠️ Le nom est obligatoire'); return; }

  /* Nettoyer : remplacer "/" par "-" */
  const id = num.replace(/\//g, '-');

  if (GLOBAL.marches[id]) {
    alert(`⚠️ Le marché "${id}" existe déjà`);
    return;
  }

  const couleur = document.querySelector('input[name="new-marche-color"]:checked').value;
  const type = document.querySelector('input[name="new-marche-type"]:checked').value;

  /* Ajouter au registre global */
  GLOBAL.marches[id] = {
    nom,
    couleur,
    createdAt: new Date().toISOString()
  };
  sauvegarderGlobal();

  /* Créer le localStorage de la nouvelle marché */
  const cle = 'suivi_' + id;
  if (type === 'copie') {
    const sourceId = document.getElementById('new-marche-source').value;
    const sourceRaw = localStorage.getItem('suivi_' + sourceId);
    if (sourceRaw) {
      const sourceData = JSON.parse(sourceRaw);
      /* Copier UNIQUEMENT les paramètres + catalogue, PAS les données */
      const newData = {
        marcheActif: id,
        parametres: sourceData.parametres ? { ...sourceData.parametres } : null,
        catalogue: sourceData.catalogue ? JSON.parse(JSON.stringify(sourceData.catalogue)) : [],
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
      localStorage.setItem(cle, JSON.stringify(newData));
    } else {
      localStorage.setItem(cle, JSON.stringify(getStructureVide(id)));
    }
  } else {
    localStorage.setItem(cle, JSON.stringify(getStructureVide(id)));
  }

  /* Créer le dossier (ne peut pas être fait par JS — afficher un message) */
  alert(
    `✅ Marché "${id}" créé !\n\n` +
    `📁 Étape suivante (manuelle) :\n` +
    `1. Créez un dossier nommé "${id}" à côté de Marches.html\n` +
    `2. Copiez-y les fichiers du dossier M0004-24\n` +
    `3. Ouvrez "${id}/config.js" et changez le numéro\n\n` +
    `Le marché apparaîtra dans la liste et fonctionnera immédiatement.`
  );

  fermerModalNouveau();
  rendreMarches();
  rendreStatsGlobales();
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
   🚀 INITIALISATION
   ═══════════════════════════════════════════════════════════ */
document.getElementById('year').textContent = new Date().getFullYear();
rendreMarches();
rendreStatsGlobales();

/* Fermer le modal au clic sur le fond */
document.getElementById('modal-nouveau-marche').addEventListener('click', (e) => {
  if (e.target.id === 'modal-nouveau-marche') fermerModalNouveau();
});