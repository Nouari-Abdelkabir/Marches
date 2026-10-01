/* ============================================================
   SUIVI COMMANDES & CONSTATS — Marché
   Version : Novembre 2025 — Système multi-marchés
   ============================================================ */

/* ═══════════════════════════════════════════════════════════
   🔑 CLÉ DE STOCKAGE DYNAMIQUE (par marché)
   ═══════════════════════════════════════════════════════════ */
const ID_MARCHE = (document.body.dataset.marche || window.MARCHE_ID || 'M0004-24').trim();
const CLE_STORAGE = 'suivi_' + ID_MARCHE;
/* ═══════════════════════════════════════════════════════════
   📅 ÉTAT GLOBAL — Périodes et TR actifs
   (déclarations indispensables pour éviter ReferenceError)
   ═══════════════════════════════════════════════════════════ */
var currentMetreTR     = 'TR1';
var currentConstatTR   = 'TR1';
var currentMoisMetre   = new Date().toISOString().slice(0,7);
var currentMoisConstat = new Date().toISOString().slice(0,7);
var currentDashDebut   = new Date().toISOString().slice(0,7);
var currentDashFin     = new Date().toISOString().slice(0,7);

console.log('🔑 Marché actif :', ID_MARCHE);
console.log('🔑 Clé localStorage :', CLE_STORAGE);

/* ═══════════════════════════════════════════════════════════
   CONSTANTES
   ═══════════════════════════════════════════════════════════ */
const SENS_LIST = ['AM','MA','CM','MC','CA','AC','Tam/Casa','Palm/Aga','Targa/Casa','Casa/Targa'];
const COTE_LIST = ['BAU','TPC','ITPC','BCD','ADS','Ech','Gare','Parking','BPV','Ilôt','Autre'];
const TYPE_LIST = ['glissière','panneau type standard','pannonceau','Musoir','Massif',
  'Renouvellement du revêtement','Balise B12','Points kilométrique','support','BHO',
  'plaque kilométrique','Balise transposable','cônes','panneaux'];

const TRONCON_LABELS = {
  TR1: 'TR1 — Berrchid / Oum-Rbia',
  TR2: 'TR2 — Oum-Rbia / Palmeraie',
  TR3: 'TR3 — Bifurcation Chichaoua',
  TR4: 'TR4 — Chichaoua / Agadir'
};

const TRONCON_LABELS_LONG = {
  TR1: 'TR1 Nœud Berrchid - OUM-RBII',
  TR2: 'TR2 OUM-RBII - Palmeraie',
  TR3: 'TR3 Bifurcation - Chichaoua',
  TR4: 'TR4 Chichaoua - Agadir'
};

const SECTION_LABELS = {
  TR1: 'PK 27 - PK 106',
  TR2: 'PK 106 - PK 198 + A301',
  TR3: 'PK 198 - PK 282',
  TR4: 'PK 282 - PK 424',
  CONS: 'PK 27 - PK 427 (Toutes sections)'
};

const PLAGES_PK = {
  TR1: [[27000, 106000]],
  TR2: [[106001, 198000], [0, 13000]],
  TR3: [[198001, 282200]],
  TR4: [[282201, 430000]]
};

/* ═══════════════════════════════════════════════════════════
   ÉTAT GLOBAL
   ═══════════════════════════════════════════════════════════ */
/* DATA sera chargé de manière asynchrone au démarrage */
let DATA = {
  parametres: getDefaultParametres(),
  catalogue: [], commandes: [], historique: [],
  metresEnregistres: [], constatsEnregistres: [],
  suivisPrix: [], etatsSinistres: [],
  facturesSinistres: {}, photoSinistres: {},
  equipementsEnregistres: [], facturesEnregistrees: [],
  factureAutoNumbers: {}
};
initMetres(DATA);
initConstats(DATA);

/* ═══════════════════════════════════════════════════════════
   UTILITAIRES
   ═══════════════════════════════════════════════════════════ */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function uidMetre()   { return 'm_' + uid(); }
function uidConstat() { return 'c_' + uid(); }

function formatDateFR(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR');
}

function formatMoisFR(mois) {
  if (!mois) return '';
  const [y,m] = mois.split('-');
  const noms = ['Janvier','Février','Mars','Avril','Mai','Juin',
                'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  return `${noms[parseInt(m,10)-1] || m} ${y}`;
}

function getFinDeMois(mois) {
  if (!mois) return new Date().toISOString().slice(0,10);
  const [y, m] = mois.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
}

/* ═══ NUMÉROTATION PAR MOIS (même N° pour tous les TR) ═══ */
function numeroMetrePourMois(mois) {
  if (!mois) return 1;
  const list = [...new Set(DATA.metresEnregistres.map(m => m.mois))];
  if (!list.includes(mois)) list.push(mois);
  list.sort();
  return list.indexOf(mois) + 1;
}

function numeroConstatPourMois(mois) {
  if (!mois) return 1;
  const list = [...new Set(DATA.constatsEnregistres.map(c => c.mois))];
  if (!list.includes(mois)) list.push(mois);
  list.sort();
  return list.indexOf(mois) + 1;
}

/* Mois précédent dans les Constats pour un TR donné */
function getMoisPrecedentConstat(mois, tr) {
  const list = [...new Set(DATA.constatsEnregistres
    .filter(c => c.troncon === tr && c.mois < mois)
    .map(c => c.mois))].sort();
  return list.length > 0 ? list[list.length - 1] : null;
}

/* Totaux d'un Metré */
function totalQteMetre(metre) {
  let t = 0;
  Object.values(metre.entrees || {}).forEach(row => {
    Object.values(row).forEach(v => { t += parseFloat(v) || 0; });
  });
  return t;
}

function nbLignesMetre(metre) {
  return Object.keys(metre.entrees || {}).filter(k =>
    Object.keys(metre.entrees[k]).length > 0).length;
}

/* Somme d'un prix dans un Metré archivé */
function calculerQteDuMoisMetre(metre, prix) {
  let t = 0;
  Object.values(metre.entrees || {}).forEach(row => {
    t += parseFloat(row[prix]) || 0;
  });
  return t;
}

function notifier(msg, type = 'info') {
  const n = document.createElement('div');
  n.textContent = msg;
  n.style.cssText = `position:fixed;top:20px;left:50%;transform:translateX(-50%);
    background:${type==='success'?'#16a34a':type==='danger'?'#dc2626':'#1e3a8a'};
    color:#fff;padding:12px 24px;border-radius:8px;z-index:99999;
    box-shadow:0 4px 12px rgba(0,0,0,.2);font-weight:600;`;
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 2600);
}

/* ═══ NORMALISATION D'EN-TÊTES EXCEL ═══ */
function normaliserEntete(texte) {
  return String(texte == null ? '' : texte)
    .replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/°/g, '').toLowerCase();
}
function construireIndexColonnes(entetes) {
  const index = {};
  entetes.forEach((h, i) => { index[normaliserEntete(h)] = i; });
  return index;
}
function trouverColonne(index, variantes) {
  for (const v of variantes) {
    const key = normaliserEntete(v);
    if (key in index) return index[key];
  }
  return -1;
}
function nettoyerDesignation(txt) {
  if (!txt) return '';
  if (String(txt).startsWith('=')) {
    return String(txt).replace(/^=/, '')
      .replace(/"[^"]*"/g, m => m.replace(/^"|"$/g, ''))
      .replace(/&[A-Z]+\d+&/g, '').replace(/&/g, '').trim();
  }
  return String(txt);
}
function devinerType(libelle) {
  const s = String(libelle).toLowerCase();
  if (s.includes('glissière')) return 'glissière';
  if (s.includes('musoir')) return 'Musoir';
  if (s.includes('panonceau')) return 'pannonceau';
  if (s.includes('panneau')) return 'panneau type standard';
  if (s.includes('balise b12')) return 'Balise B12';
  if (s.includes('point') && s.includes('kilométr')) return 'Points kilométrique';
  if (s.includes('plaque kilométrique')) return 'plaque kilométrique';
  if (s.includes('support')) return 'support';
  if (s.includes('massif')) return 'Massif';
  if (s.includes('revêtement')) return 'Renouvellement du revêtement';
  if (s.includes('bho')) return 'BHO';
  return 'Autre';
}
function trouverPrixParLibelle(libelle) {
  if (!libelle) return null;
  const cible = String(libelle).trim().toLowerCase();
  return DATA.catalogue.find(p => p.libelle.trim().toLowerCase() === cible) || null;
}
function extraireDateDeObservation(obs) {
  if (!obs) return '';
  const s = String(obs).trim();
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(parseInt(m[1]), parseInt(m[2])-1, parseInt(m[3]));
    return d.toLocaleDateString('fr-FR');
  }
  m = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) return m[0];
  return '';
}
function ligneKey(pk, sens, cote) { return `${pk}|${sens}|${cote}`; }

function trouverTronconParPK(pk) {
  const premier = String(pk).split('+')[0].trim();
  const n = parseInt(premier, 10);
  if (isNaN(n)) return null;
  for (const tr of ['TR1','TR2','TR3','TR4']) {
    for (const [min, max] of PLAGES_PK[tr]) {
      if (n >= min && n <= max) return tr;
    }
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════
   PARAMÈTRES PAR DÉFAUT
   ═══════════════════════════════════════════════════════════ */
function getDefaultParametres() {
  return {
    mo: "La Société Nationale des Autoroutes du Maroc représentée par le Chef de la Division Prestations Techniques",
    moe: "Le Chef de division Viabilité et Sécurité EL Jadida",
    prestataire: "AIC",
    marche: "M0004/24",
    section: "PK106 oued Oum rbii - Chichaoua",
    objet: "La réalisation des travaux de l'Entretien multitechnique des Axes Autoroutiers Centre et Sud.",
    dateDebut: "",
    dateFin: "",
    logo: "",
    /* ✅ Pied de page */
    dressePar: "L'Adjoint Viabilité",
    dresseNom: "",
    validePar: "Le chef de division sécurité et entretien",
    valideNom: "",
    acceptePar: "Le représentant de l'entreprise",
    accepteNom: "",
    accepteDate: ""
  };
}

/* ═══════════════════════════════════════════════════════════
   INITIALISATION DES STRUCTURES
   ═══════════════════════════════════════════════════════════ */
function initMetres(d) {
  if (!d.metres) d.metres = {};
  ['TR1','TR2','TR3','TR4'].forEach(tr => {
    if (!d.metres[tr]) d.metres[tr] = { date: '', entrees: {}, sinistres: {}, fax: {}, prestations: {} };
  });
}
function initConstats(d) {
  if (!d.constats) d.constats = {};
  ['TR1','TR2','TR3','TR4'].forEach(tr => {
    if (!d.constats[tr]) d.constats[tr] = { date: '', anterieures: {}, observations: {}, quantitesMois: {} };
    if (!d.constats[tr].quantitesMois) d.constats[tr].quantitesMois = {};
  });
  if (!d.constats.CONS) d.constats.CONS = { date: '', anterieures: {}, observations: {}, quantitesMois: {} };
  if (!d.constats.CONS.quantitesMois) d.constats.CONS.quantitesMois = {};
}

/* ═══════════════════════════════════════════════════════════
   💾 CHARGEMENT DES DONNÉES (SIMPLE — pas de migration)
   ═══════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════
   💾 CHARGEMENT — Depuis GitHub si possible, sinon localStorage
   ═══════════════════════════════════════════════════════════ */
async function chargerDonneesAsync() {
  let d = null;

  /* 1. Essayer GitHub (si PAT configuré) */
  if (typeof ghHasToken === 'function' && ghHasToken()) {
    try {
      console.log('🌐 Chargement depuis GitHub...');
      const remote = await ghLire(ID_MARCHE);
      if (remote.ok) {
        d = remote.data;
        console.log('✅ Chargé depuis GitHub');
        console.log('   • Commandes:', d.commandes?.length || 0);
        console.log('   • Catalogue:', d.catalogue?.length || 0);
        console.log('   • Metrés:', d.metresEnregistres?.length || 0);
        /* Synchroniser localStorage (cache) */
        localStorage.setItem(CLE_STORAGE, JSON.stringify(d));
      } else {
        console.warn('⚠️ GitHub inaccessible:', remote.error);
      }
    } catch (e) {
      console.warn('⚠️ Erreur GitHub:', e.message);
    }
  }

  /* 2. Fallback localStorage */
  if (!d) {
    try {
      const raw = localStorage.getItem(CLE_STORAGE);
      if (raw && raw.length > 5) {
        d = JSON.parse(raw);
        console.log('📦 Chargé depuis localStorage (cache)');
      }
    } catch (e) {
      console.error('❌ localStorage corrompu:', e);
    }
  }

  /* 3. Structure vide si rien */
  if (!d) {
    console.log('📂 Nouveau marché vide :', ID_MARCHE);
    d = {
      marcheActif: ID_MARCHE,
      parametres: getDefaultParametres(),
      catalogue: [], commandes: [], historique: [],
      metresEnregistres: [], constatsEnregistres: [],
      suivisPrix: [], etatsSinistres: [],
      facturesSinistres: {}, photoSinistres: {},
      equipementsEnregistres: [], facturesEnregistrees: [],
      factureAutoNumbers: {}
    };
  }

  /* 4. S'assurer que tous les champs existent */
  if (!d.parametres) d.parametres = getDefaultParametres();
  if (!d.catalogue) d.catalogue = [];
  if (!d.commandes) d.commandes = [];
  if (!d.historique) d.historique = [];
  if (!d.metresEnregistres) d.metresEnregistres = [];
  if (!d.constatsEnregistres) d.constatsEnregistres = [];
  if (!d.suivisPrix) d.suivisPrix = [];
  if (!d.etatsSinistres) d.etatsSinistres = [];
  if (!d.facturesSinistres) d.facturesSinistres = {};
  if (!d.photoSinistres) d.photoSinistres = {};
  if (!d.equipementsEnregistres) d.equipementsEnregistres = [];
  if (!d.facturesEnregistrees) d.facturesEnregistrees = [];
  if (!d.factureAutoNumbers) d.factureAutoNumbers = {};

  initMetres(d);
  initConstats(d);
  return d;
}

/* Initialise les champs vides d'un marché */
function initStructureMarche(m) {
  if (!m.parametres) m.parametres = getDefaultParametres();
  if (!m.catalogue)  m.catalogue = [];
  if (!m.commandes)  m.commandes = [];
  if (!m.historique) m.historique = [];
  if (!m.metresEnregistres)  m.metresEnregistres = [];
  if (!m.constatsEnregistres) m.constatsEnregistres = [];
  if (!m.suivisPrix)         m.suivisPrix = [];
  if (!m.etatsSinistres)     m.etatsSinistres = [];
  if (!m.facturesSinistres)  m.facturesSinistres = {};
  if (!m.photoSinistres)     m.photoSinistres = {};
  if (!m.equipementsEnregistres) m.equipementsEnregistres = [];
  if (!m.facturesEnregistrees)   m.facturesEnregistrees = [];
  if (!m.factureAutoNumbers)     m.factureAutoNumbers = {};
  initMetres(m);
  initConstats(m);
}

/* ═══════════════════════════════════════════════════════════
   💾 SAUVEGARDE — localStorage + GitHub (async)
   ═══════════════════════════════════════════════════════════ */
async function sauvegarderDonnees(silencieux = false) {
  /* 1. Toujours sauvegarder dans localStorage (rapide, local) */
  try {
    localStorage.setItem(CLE_STORAGE, JSON.stringify(DATA));
  } catch (e) {
    console.error('❌ localStorage:', e);
    notifier('❌ Mémoire locale pleine', 'danger');
    return;
  }

  /* 2. Sync vers GitHub si PAT disponible */
  if (typeof ghHasToken === 'function' && ghHasToken()) {
    try {
      const result = await ghEcrire(ID_MARCHE, DATA, `Update ${ID_MARCHE} — ${new Date().toISOString().slice(0,16)}`);
      if (result.ok) {
        if (!silencieux) notifier('☁️ Synchronisé avec GitHub', 'success');
      } else {
        console.warn('⚠️ GitHub échoué:', result.error);
        if (!silencieux) notifier('⚠️ Local sauvegardé, GitHub échoué', 'danger');
      }
    } catch (e) {
      console.warn('⚠️ GitHub exception:', e.message);
    }
  } else {
    if (!silencieux) notifier('💾 Sauvegardé localement', 'success');
  }
}

function logHistorique(action, details) {
  DATA.historique.unshift({ id: uid(), date: new Date().toISOString(), action, details });
  if (DATA.historique.length > 500) DATA.historique.length = 500;
  sauvegarderDonnees(true);
  const h = document.getElementById('tab-historique');
  if (h && h.classList.contains('active')) rendreHistorique();
}

/* ═══════════════════════════════════════════════════════════
   NAVIGATION
   ═══════════════════════════════════════════════════════════ */
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    const t = tab.dataset.tab;
    if (t === 'dashboard')     rendreDashboard();
    if (t === 'parametres')    chargerFormParametres();
    if (t === 'catalogue')     rendreCatalogue();
    if (t === 'commandes')     rendreListeCommandes();
    if (t === 'metre')         switchMetre(currentMetreTR);
    if (t === 'constat')       switchConstat(currentConstatTR);
    if (t === 'suivi')         switchSuivi();
    if (t === 'sinistres')     switchSinistre('sin-sinistres');
    if (t === 'equipements')   switchEquipements();
    if (t === 'historique')    rendreHistorique();
    if (t === 'export')        switchExport();
  });
});

/* ═══════════════════════════════════════════════════════════
   PARAMÈTRES
   ═══════════════════════════════════════════════════════════ */
function chargerFormParametres() {
  const p = DATA.parametres;

  /* Champs existants (MO, MOE, etc.) */
  document.getElementById('param-mo').value = p.mo || '';
  document.getElementById('param-moe').value = p.moe || '';
  document.getElementById('param-prestataire').value = p.prestataire || '';
  document.getElementById('param-marche').value = p.marche || '';
  document.getElementById('param-section').value = p.section || '';
  document.getElementById('param-objet').value = p.objet || '';
  document.getElementById('param-date-debut').value = p.dateDebut || '';
  document.getElementById('param-date-fin').value = p.dateFin || '';

  /* Signatures par TR */
  const sig = p.signatures || {};
  ['TR1','TR2','TR3','TR4'].forEach(tr => {
    const s = sig[tr] || {};
    const fctEl  = document.getElementById(`sig-tech-fct-${tr}`);
    const nomEl  = document.getElementById(`sig-tech-nom-${tr}`);
    const rempEl = document.getElementById(`sig-tech-remp-${tr}`);
    const cgEl   = document.getElementById(`sig-tech-conge-${tr}`);
    if (fctEl)  fctEl.value  = s.fonction || '';
    if (nomEl)  nomEl.value  = s.nom || '';
    if (rempEl) rempEl.value = s.remplacant || '';
    if (cgEl)   cgEl.checked = !!s.enConge;
  });

  /* Ingénieurs */
  const ing1 = (p.ingenieurs && p.ingenieurs.ing1) || {};
  const ing2 = (p.ingenieurs && p.ingenieurs.ing2) || {};
  const e1f = document.getElementById('sig-ing1-fct');
  const e1n = document.getElementById('sig-ing1-nom');
  const e2f = document.getElementById('sig-ing2-fct');
  const e2n = document.getElementById('sig-ing2-nom');
  if (e1f) e1f.value = ing1.fonction || '';
  if (e1n) e1n.value = ing1.nom || '';
  if (e2f) e2f.value = ing2.fonction || '';
  if (e2n) e2n.value = ing2.nom || '';

  /* Entreprise */
  const ent = p.entreprise || {};
  const et = document.getElementById('sig-ent-txt');
  const en = document.getElementById('sig-ent-nom');
  const ed = document.getElementById('sig-ent-date');
  if (et) et.value = ent.texte || '';
  if (en) en.value = ent.nom || '';
  if (ed) ed.value = ent.date || '';

  afficherLogoPreview();
}

function afficherLogoPreview() {
  const cont = document.getElementById('param-logo-preview');
  const btnSuppr = document.getElementById('btn-supprimer-logo');
  if (DATA.parametres.logo) {
    cont.innerHTML = `<img src="${DATA.parametres.logo}" alt="Logo" style="max-height:80px;border:1px solid #cbd5e1;border-radius:6px;padding:4px;background:#fff;">`;
    btnSuppr.style.display = 'block';
  } else {
    cont.innerHTML = '<span style="font-size:12px;color:#94a3b8;">Aucun logo</span>';
    btnSuppr.style.display = 'none';
  }
}

document.getElementById('param-logo').addEventListener('change', (e) => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    DATA.parametres.logo = ev.target.result;
    afficherLogoPreview();
    notifier('✅ Logo chargé — cliquez sur Enregistrer', 'success');
  };
  reader.readAsDataURL(file);
  e.target.value = '';
});

document.getElementById('btn-supprimer-logo').addEventListener('click', () => {
  if (!confirm('Supprimer le logo ?')) return;
  DATA.parametres.logo = '';
  afficherLogoPreview();
  sauvegarderDonnees(true);
  notifier('🗑️ Logo supprimé', 'success');
});

document.getElementById('btn-save-parametres').addEventListener('click', () => {
  const p = DATA.parametres;

  /* Champs principaux */
  p.mo = document.getElementById('param-mo').value.trim();
  p.moe = document.getElementById('param-moe').value.trim();
  p.prestataire = document.getElementById('param-prestataire').value.trim();
  p.marche = document.getElementById('param-marche').value.trim();
  p.section = document.getElementById('param-section').value.trim();
  p.objet = document.getElementById('param-objet').value.trim();
  p.dateDebut = document.getElementById('param-date-debut').value;
  p.dateFin = document.getElementById('param-date-fin').value;

  /* Signatures par TR */
  p.signatures = p.signatures || {};
  ['TR1','TR2','TR3','TR4'].forEach(tr => {
    p.signatures[tr] = {
      fonction:    document.getElementById(`sig-tech-fct-${tr}`)?.value.trim() || '',
      nom:         document.getElementById(`sig-tech-nom-${tr}`)?.value.trim() || '',
      remplacant:  document.getElementById(`sig-tech-remp-${tr}`)?.value.trim() || '',
      enConge:     document.getElementById(`sig-tech-conge-${tr}`)?.checked || false
    };
  });

  /* Ingénieurs */
  p.ingenieurs = {
    ing1: {
      fonction: document.getElementById('sig-ing1-fct')?.value.trim() || '',
      nom:      document.getElementById('sig-ing1-nom')?.value.trim() || ''
    },
    ing2: {
      fonction: document.getElementById('sig-ing2-fct')?.value.trim() || '',
      nom:      document.getElementById('sig-ing2-nom')?.value.trim() || ''
    }
  };

  /* Entreprise */
  p.entreprise = {
    texte: document.getElementById('sig-ent-txt')?.value.trim() || '',
    nom:   document.getElementById('sig-ent-nom')?.value.trim() || '',
    date:  document.getElementById('sig-ent-date')?.value || ''
  };

  logHistorique('MODIFICATION PARAMÈTRES', 'Mise à jour des paramètres et signatures');
  sauvegarderDonnees(true);
  notifier('✅ Paramètres enregistrés', 'success');
  switchMetre(currentMetreTR);
  switchConstat(currentConstatTR);
});

/* ═══════════════════════════════════════════════════════════
   IMPORT DE.xlsx (CATALOGUE)
   ═══════════════════════════════════════════════════════════ */
document.getElementById('file-de').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  const status = document.getElementById('de-status');
  try {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true, blankrows: false });

    let idxHeader = -1;
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const l = rows[i].map(x => normaliserEntete(x));
      if (l.some(c => c.includes('prix') && c.includes('n'))) { idxHeader = i; break; }
    }
    if (idxHeader === -1) throw new Error("Ligne d'en-tête introuvable");

    const entetes = rows[idxHeader];
    const idx = construireIndexColonnes(entetes);

    const colNumero  = trouverColonne(idx, ['N° du Prix','N du Prix','N° Prix','Numero','N°']);
    const colLibelle = trouverColonne(idx, ['Libellé des prix','Libelle des prix','Libellé','Designation','Désignation']);
    const colUnite   = trouverColonne(idx, ['Unité','Unite','U']);
    const colQteInit = trouverColonne(idx, ['Qts INITIALES','Qts initiales','Qtés initiales','Qte initiale','Qts INIT','Qte']);
    const colPU      = trouverColonne(idx, ['P.U  en DHs','P.U en DHs','PU en DHs','Prix unitaire','P.U']);
    const colPT      = trouverColonne(idx, ['P.T  en DHs','P.T en DHs','PT en DHs','Prix total','P.T','Montant']);

    if (colNumero < 0 || colLibelle < 0) throw new Error('Colonnes obligatoires introuvables');

    DATA.catalogue = [];
    for (let i = idxHeader + 1; i < rows.length; i++) {
      const r = rows[i]; if (!r || r.length === 0) continue;
      const numero = parseFloat(String(r[colNumero] || '').replace(',', '.')) || 0;
      if (!numero) continue;
      const libelle = String(r[colLibelle] || '').trim();
      const unite   = String(r[colUnite]   || '').trim();
      const qteInit = parseFloat(String(r[colQteInit] || '0').replace(/\s/g,'').replace(',', '.')) || 0;
      const pu      = parseFloat(String(r[colPU] || '0').replace(/\s/g,'').replace(',', '.')) || 0;
      const pt      = colPT >= 0
        ? parseFloat(String(r[colPT] || '0').replace(/\s/g,'').replace(',', '.')) || 0
        : qteInit * pu;
      DATA.catalogue.push({ numero, libelle, unite, qteInitiale: qteInit, prixUnitaire: pu, prixTotal: pt });
    }
    if (DATA.catalogue.length === 0) throw new Error('Aucun prix valide');
    logHistorique('IMPORT DE.xlsx', `${DATA.catalogue.length} prix importés`);
    sauvegarderDonnees(true);
    rendreCatalogue(); rendreDashboard();

    status.textContent = `✅ ${DATA.catalogue.length} prix importés`;
    status.className = 'status ok';
    notifier(`✅ ${DATA.catalogue.length} prix chargés`, 'success');
  } catch (err) {
    console.error(err);
    status.textContent = '❌ ' + err.message;
    status.className = 'status err';
    notifier('❌ ' + err.message, 'danger');
  }
  e.target.value = '';
});

/* ═══════════════════════════════════════════════════════════
   RENDU CATALOGUE
   ═══════════════════════════════════════════════════════════ */
function rendreCatalogue() {
  const filtre = (document.getElementById('filtre-catalogue').value || '').toLowerCase();
  const tbody = document.getElementById('tbody-catalogue');
  const tfoot = document.getElementById('tfoot-catalogue');

  let liste = DATA.catalogue.slice();
  if (filtre) {
    liste = liste.filter(p =>
      String(p.numero).includes(filtre) ||
      p.libelle.toLowerCase().includes(filtre) ||
      p.unite.toLowerCase().includes(filtre));
  }

  tbody.innerHTML = liste.map(p => `
    <tr>
      <td><strong>${p.numero}</strong></td>
      <td style="font-size:12px;">${p.libelle}</td>
      <td>${p.unite}</td>
      <td>${p.qteInitiale.toLocaleString('fr-FR')}</td>
      <td>${p.prixUnitaire.toLocaleString('fr-FR', {minimumFractionDigits:2})}</td>
      <td style="font-weight:600;">${(p.prixTotal || p.qteInitiale * p.prixUnitaire).toLocaleString('fr-FR', {minimumFractionDigits:2})}</td>
    </tr>`).join('');

  if (liste.length === 0)
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#64748b;">Aucun prix.</td></tr>';

  const totalPT = liste.reduce((s,p) => s + (p.prixTotal || p.qteInitiale * p.prixUnitaire), 0);
  tfoot.innerHTML = `<tr>
    <td colspan="5">TOTAL (${liste.length} prix)</td>
    <td>${totalPT.toLocaleString('fr-FR', {minimumFractionDigits:2})} DH</td>
  </tr>`;
}
document.getElementById('filtre-catalogue').addEventListener('input', rendreCatalogue);

/* ═══════════════════════════════════════════════════════════
   IMPORT COMMANDE
   ═══════════════════════════════════════════════════════════ */
document.getElementById('file-commande').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  const status = document.getElementById('commande-status');
  const nomBase = document.getElementById('import-nom').value.trim() || `commande${DATA.commandes.length + 1}`;
  const dateImport = document.getElementById('import-date').value || new Date().toISOString().slice(0, 10);

  try {
    const existe = DATA.commandes.find(c => c.numero.toLowerCase() === nomBase.toLowerCase());
    if (existe) throw new Error(`❌ La commande "${nomBase}" existe déjà.`);

    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });

    let idxHeader = -1;
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0] || '').trim() === 'PK') { idxHeader = i; break; }
    }
    if (idxHeader === -1) throw new Error('Entête (PK) non trouvée');

    const lignes = [];
    let tronconCourant = null;

    for (let i = idxHeader + 1; i < rows.length; i++) {
      const r = rows[i];
      const a = String(r[0] || '').trim();
      const b = String(r[1] || '').trim();
      const c = String(r[2] || '').trim();
      const d = String(r[3] || '').trim();
      const o = String(r[4] || '').trim();
      const qteBrut = r[5];
      const type = String(r[6] || '').trim();

      const match = a.match(/Tron[çc]on\s*([1-4])/i);
      if (match) { tronconCourant = 'TR' + match[1]; continue; }
      if (!tronconCourant) continue;
      if (!a && !b && !d) continue;
      if (a === 'PK') continue;

      let quantite = 0;
      if (typeof qteBrut === 'number') quantite = qteBrut;
      else {
        const m = String(qteBrut).match(/(\d+(?:[.,]\d+)?)/);
        if (m) quantite = parseFloat(m[1].replace(',', '.'));
      }
      if (!quantite || !d) continue;

      const designation = nettoyerDesignation(d);
      const prix = trouverPrixParLibelle(designation);

      lignes.push({
        id: uid(),
        troncon: tronconCourant,
        pk: a, sens: b, cote: c,
        designation: prix ? prix.libelle : designation,
        observations: o,
        quantite,
        type: type || (prix ? devinerType(prix.libelle) : 'Autre'),
        numeroPrix: prix ? prix.numero : null,
        unite: prix ? prix.unite : '',
        prixUnitaire: prix ? prix.prixUnitaire : 0
      });
    }

    if (lignes.length === 0) throw new Error('Aucune ligne valide');

    DATA.commandes.push({
      id: uid(), numero: nomBase, date: dateImport,
      objet: `Import : ${file.name}`, source: 'excel', lignes
    });

    logHistorique('IMPORT COMMANDE', `${nomBase} — ${lignes.length} ligne(s)`);
    sauvegarderDonnees(true);
    rendreListeCommandes(); rendreDashboard();

    status.textContent = `✅ ${lignes.length} ligne(s) dans ${nomBase}`;
    status.className = 'status ok';
    notifier(`✅ ${lignes.length} lignes importées`, 'success');
  } catch (err) {
    console.error(err);
    status.textContent = '❌ ' + err.message;
    status.className = 'status err';
    notifier(err.message, 'danger');
  }
  e.target.value = '';
});

/* ═══════════════════════════════════════════════════════════
   LISTE DES COMMANDES
   ═══════════════════════════════════════════════════════════ */
function rendreListeCommandes() {
  const acc = document.getElementById('liste-commandes-accordion');
  if (DATA.commandes.length === 0) {
    acc.innerHTML = '<p style="text-align:center;padding:20px;color:#64748b;">Aucune commande enregistrée.</p>';
  } else {
    acc.innerHTML = DATA.commandes.map(c => {
      const totalQte = c.lignes.reduce((s,l) => s + (l.quantite||0), 0);
      return `
        <div class="cmd-item">
          <div class="cmd-item-header">
            <div class="cmd-item-title" onclick="toggleCmdItem('${c.id}')">
              <span class="arrow">▶</span>
              <strong>${c.numero}</strong>
              <span>${c.date}</span>
              <span class="badge badge-tr1">${c.lignes.length} ligne(s)</span>
              <span>Qté : ${totalQte}</span>
              ${c.objet ? `<span style="color:#64748b;font-size:12px;">${c.objet}</span>` : ''}
            </div>
            <div style="display:flex;gap:6px;">
              <button class="btn-icon" title="Aperçu & Export"
                onclick="event.stopPropagation();apercuCommande('${c.id}')">📄</button>
              <button class="btn-icon danger" title="Supprimer"
                onclick="event.stopPropagation();supprimerCommande('${c.id}')">🗑️ Supprimer</button>
            </div>
          </div>
          <div class="cmd-item-body" id="cmdbody-${c.id}">
            <div style="overflow-x:auto;">
              <table class="table" style="font-size:12px;">
                <thead>
                  <tr>
                    <th style="width:70px;">Tronçon</th>
                    <th style="width:90px;">PK</th>
                    <th style="width:60px;">Sens</th>
                    <th style="width:70px;">Côté</th>
                    <th>Désignation</th>
                    <th style="width:180px;">Observations</th>
                    <th style="width:60px;">Qté</th>
                    <th style="width:110px;">Type</th>
                    <th style="width:100px;">Changer</th>
                  </tr>
                </thead>
                <tbody>
                  ${c.lignes.map(l => rendreLigneAccordion(c.id, l)).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  const filtreTR = document.getElementById('filtre-troncon').value;
  const recherche = (document.getElementById('filtre-recherche').value || '').toLowerCase();
  const tbody = document.getElementById('tbody-liste-commandes');
  const tfoot = document.getElementById('tfoot-liste-commandes');
  tbody.innerHTML = '';

  const rows = [];
  DATA.commandes.forEach(c => {
    c.lignes.forEach(l => {
      if (filtreTR && l.troncon !== filtreTR) return;
      if (recherche) {
        const hay = [c.numero, c.date, l.troncon, l.pk, l.sens, l.cote,
                     l.designation, l.observations, l.type, l.quantite]
                     .join(' ').toLowerCase();
        if (!hay.includes(recherche)) return;
      }
      rows.push({ cmdId: c.id, cmdNumero: c.numero, ligne: l });
    });
  });

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:#64748b;padding:20px;">Aucune ligne.</td></tr>';
    tfoot.innerHTML = '';
    return;
  }

  tbody.innerHTML = rows.map(it => {
    const l = it.ligne;
    return `
      <tr>
        <td><strong>${it.cmdNumero}</strong></td>
        <td><span class="badge-tr badge-tr${(l.troncon||'TR1')[2]}">${l.troncon}</span></td>
        <td style="font-family:Consolas,monospace;">${l.pk}</td>
        <td>${l.sens}</td>
        <td>${l.cote}</td>
        <td style="font-size:11px;">${l.designation}</td>
        <td style="font-size:11px;">${l.observations || ''}</td>
        <td style="text-align:center;font-weight:600;">${l.quantite}</td>
        <td>${l.type}</td>
        <td style="text-align:center;white-space:nowrap;">
          <button class="btn-icon" title="Modifier"
            onclick="ouvrirEditionLigne('${it.cmdId}','${l.id}')">✏️</button>
          <button class="btn-icon danger" title="Supprimer"
            onclick="supprimerLigneCommande('${it.cmdId}','${l.id}')">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');

  const totalQte = rows.reduce((s,it) => s + (it.ligne.quantite||0), 0);
  tfoot.innerHTML = `
    <tr>
      <td colspan="7" style="text-align:left;">Total : ${rows.length} ligne(s)</td>
      <td style="text-align:center;">${totalQte}</td>
      <td colspan="2"></td>
    </tr>
  `;
}

function rendreLigneAccordion(cmdId, l) {
  const enEdition = editingState.cmdId === cmdId && editingState.ligneId === l.id;
  const b = enEdition ? editingState.buffer : null;

  if (enEdition) {
    return `
      <tr style="background:#fef3c7;">
        <td><select onchange="updateBuffer('troncon', this.value)">
          ${['TR1','TR2','TR3','TR4'].map(t => `<option ${t===b.troncon?'selected':''}>${t}</option>`).join('')}
        </select></td>
        <td><input type="text" value="${b.pk||''}" oninput="updateBuffer('pk', this.value)"></td>
        <td><select onchange="updateBuffer('sens', this.value)">
          ${SENS_LIST.map(s => `<option ${s===b.sens?'selected':''}>${s}</option>`).join('')}
        </select></td>
        <td><select onchange="updateBuffer('cote', this.value)">
          ${COTE_LIST.map(c => `<option ${c===b.cote?'selected':''}>${c}</option>`).join('')}
        </select></td>
        <td><select onchange="updateBufferPrix(this.value)" style="font-size:11px;">
          <option value="">-- Choisir --</option>
          ${DATA.catalogue.map(p =>
            `<option value="${p.numero}" ${b.numeroPrix === p.numero ? 'selected' : ''}>${p.numero} — ${p.libelle.slice(0,60)}${p.libelle.length>60?'…':''}</option>`
          ).join('')}
        </select></td>
        <td><input type="text" value="${(b.observations||'').replace(/"/g,'&quot;')}" oninput="updateBuffer('observations', this.value)"></td>
        <td><input type="number" min="0" value="${b.quantite||0}" oninput="updateBuffer('quantite', parseFloat(this.value)||0)"></td>
        <td><select onchange="updateBuffer('type', this.value)">
          ${TYPE_LIST.map(t => `<option ${t===b.type?'selected':''}>${t}</option>`).join('')}
        </select></td>
        <td style="text-align:center;white-space:nowrap;">
          <button class="btn-icon success" onclick="sauverLigne()">💾</button>
          <button class="btn-icon" onclick="annulerEdition()">❌</button>
        </td>
      </tr>`;
  }

  return `
    <tr>
      <td><span class="badge-tr badge-tr${(l.troncon||'TR1')[2]}">${l.troncon}</span></td>
      <td style="font-family:Consolas,monospace;">${l.pk}</td>
      <td>${l.sens}</td>
      <td>${l.cote}</td>
      <td style="font-size:11px;">${l.designation}</td>
      <td style="font-size:11px;">${l.observations || ''}</td>
      <td style="text-align:center;font-weight:600;">${l.quantite}</td>
      <td>${l.type}</td>
      <td style="text-align:center;white-space:nowrap;">
        <button class="btn-icon" onclick="editerLigne('${cmdId}','${l.id}')">✏️</button>
        <button class="btn-icon danger" onclick="supprimerLigneCommande('${cmdId}','${l.id}')">🗑️</button>
      </td>
    </tr>`;
}

/* ═══ ÉDITION LIGNE COMMANDE ═══ */
window.editerLigne = function(cmdId, ligneId) {
  const cmd = DATA.commandes.find(c => c.id === cmdId);
  const ligne = cmd.lignes.find(l => l.id === ligneId);
  if (!ligne) return;
  editingState = { cmdId, ligneId, buffer: {...ligne} };
  rendreListeCommandes();
  const body = document.getElementById('cmdbody-' + cmdId);
  if (body) body.classList.add('open');
};
window.annulerEdition = function() {
  editingState = { cmdId: null, ligneId: null, buffer: null };
  rendreListeCommandes();
};
window.updateBuffer = function(field, value) {
  if (!editingState.buffer) return;
  editingState.buffer[field] = value;
};
window.updateBufferPrix = function(numero) {
  const p = DATA.catalogue.find(x => x.numero === parseInt(numero));
  if (!p) { editingState.buffer.numeroPrix = null; return; }
  editingState.buffer.designation = p.libelle;
  editingState.buffer.numeroPrix = p.numero;
  editingState.buffer.unite = p.unite;
  editingState.buffer.prixUnitaire = p.prixUnitaire;
  if (!editingState.buffer.type || editingState.buffer.type === 'Autre')
    editingState.buffer.type = devinerType(p.libelle);
  rendreListeCommandes();
  const body = document.getElementById('cmdbody-' + editingState.cmdId);
  if (body) body.classList.add('open');
};
window.sauverLigne = function() {
  const { cmdId, ligneId, buffer } = editingState;
  if (!cmdId || !ligneId || !buffer) return;
  if (!buffer.pk) { notifier('⚠️ PK obligatoire', 'danger'); return; }
  if (!buffer.designation || !buffer.numeroPrix) { notifier('⚠️ Désignation obligatoire', 'danger'); return; }
  if (!buffer.quantite || buffer.quantite <= 0) { notifier('⚠️ Qté > 0 requise', 'danger'); return; }
  const trDetecte = trouverTronconParPK(buffer.pk);
  if (trDetecte) buffer.troncon = trDetecte;
  const cmd = DATA.commandes.find(c => c.id === cmdId);
  const ligneIndex = cmd.lignes.findIndex(l => l.id === ligneId);
  if (ligneIndex < 0) return;
  cmd.lignes[ligneIndex] = { ...cmd.lignes[ligneIndex], ...buffer };
  logHistorique('MODIFICATION LIGNE', `Cmd ${cmd.numero} — PK=${buffer.pk}`);
  sauvegarderDonnees(true);
  editingState = { cmdId: null, ligneId: null, buffer: null };
  rendreListeCommandes(); rendreDashboard();
  const body = document.getElementById('cmdbody-' + cmdId);
  if (body) body.classList.add('open');
  notifier('✅ Ligne modifiée', 'success');
};
window.toggleCmdItem = function(id) {
  const body = document.getElementById('cmdbody-' + id);
  if (!body) return;
  body.classList.toggle('open');
  const arrow = body.previousElementSibling.querySelector('.cmd-item-title .arrow');
  if (arrow) arrow.textContent = body.classList.contains('open') ? '▼' : '▶';
};
window.supprimerCommande = function(id) {
  const cmd = DATA.commandes.find(c => c.id === id);
  if (!cmd) return;
  if (!confirm(`Supprimer la commande "${cmd.numero}" (${cmd.lignes.length} lignes) ?`)) return;
  DATA.commandes = DATA.commandes.filter(c => c.id !== id);
  logHistorique('SUPPRESSION COMMANDE', `${cmd.numero} — ${cmd.lignes.length} ligne(s)`);
  sauvegarderDonnees(true);
  rendreListeCommandes(); rendreDashboard();
  notifier('🗑️ Commande supprimée', 'success');
};
window.supprimerLigneCommande = function(cmdId, ligneId) {
  if (!confirm('Supprimer cette ligne ?')) return;
  const cmd = DATA.commandes.find(c => c.id === cmdId);
  if (!cmd) return;
  cmd.lignes = cmd.lignes.filter(l => l.id !== ligneId);
  logHistorique('SUPPRESSION LIGNE', `Cmd ${cmd.numero}`);
  sauvegarderDonnees(true);
  rendreListeCommandes(); rendreDashboard();
  notifier('🗑️ Ligne supprimée', 'success');
};
window.ouvrirEditionLigne = function(cmdId, ligneId) {
  editerLigne(cmdId, ligneId);
  document.getElementById('liste-commandes-accordion').scrollIntoView({behavior:'smooth'});
};
document.getElementById('filtre-troncon').addEventListener('change', rendreListeCommandes);
document.getElementById('filtre-recherche').addEventListener('input', rendreListeCommandes);

/* ═══════════════════════════════════════════════════════════
   🏠 DASHBOARD (avec filtre de période)
   ═══════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════
   🏠 DASHBOARD (avec filtre de période)
   ═══════════════════════════════════════════════════════════ */
window.changerPeriodeDashboard = function() {
  const d = getMonthPickerValue('dash-debut');
  const f = getMonthPickerValue('dash-fin');
  if (!d || !f) return;
  if (f < d) { notifier('⚠️ La date de fin doit être ≥ au début', 'danger'); return; }
  currentDashDebut = d;
  currentDashFin   = f;
  rendreDashboard();
  notifier(`📅 Période : ${formatMoisFR(d)} → ${formatMoisFR(f)}`, 'info');
};

function rendreDashboard() {
  /* ─── Pickers ─── */
  const pickerD = document.getElementById('dash-picker-debut');
  const pickerF = document.getElementById('dash-picker-fin');
  if (pickerD && !pickerD.innerHTML.trim()) {
    pickerD.innerHTML = htmlMonthPicker('dash-debut', currentDashDebut, 'changerPeriodeDashboard');
    pickerF.innerHTML = htmlMonthPicker('dash-fin',   currentDashFin,   'changerPeriodeDashboard');
  } else if (pickerD) {
    const yD = document.getElementById('dash-debut-year');
    const mD = document.getElementById('dash-debut-month');
    const yF = document.getElementById('dash-fin-year');
    const mF = document.getElementById('dash-fin-month');
    if (yD) yD.value = currentDashDebut.slice(0,4);
    if (mD) mD.value = currentDashDebut.slice(5,7);
    if (yF) yF.value = currentDashFin.slice(0,4);
    if (mF) mF.value = currentDashFin.slice(5,7);
  }

  const label = document.getElementById('dash-periode-label');
  if (label) label.textContent = `${formatMoisFR(currentDashDebut)} → ${formatMoisFR(currentDashFin)}`;

  const dDebut = currentDashDebut;
  const dFin   = currentDashFin;

  /* ═══ Helpers ═══ */
  const isInPeriode = (dateStr) => {
    if (!dateStr) return false;
    let mois = '';
    if (/^\d{4}-\d{2}/.test(dateStr)) {
      mois = dateStr.slice(0,7);
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      const [,mm,yyyy] = dateStr.split('/');
      mois = `${yyyy}-${mm}`;
    } else {
      return false;
    }
    return mois >= dDebut && mois <= dFin;
  };

  const fmt = v => (v || 0).toLocaleString('fr-FR', {minimumFractionDigits:2, maximumFractionDigits:2});
  const fmtInt = v => (v || 0).toLocaleString('fr-FR');

  /* ═══ 1. Budget total du marché (DE) ═══ */
  const budgetTotal = DATA.catalogue.reduce((s, p) =>
    s + ((p.qteInitiale || 0) * (p.prixUnitaire || 0)), 0);

  /* ═══ 2. Montant Metrés (période) ═══ */
  let montantMet = 0, nbMet = 0;
  DATA.metresEnregistres.forEach(m => {
    if (!isInPeriode(m.mois)) return;
    nbMet++;
    Object.values(m.entrees || {}).forEach(row => {
      Object.entries(row).forEach(([prixNum, qte]) => {
        const p = DATA.catalogue.find(x => x.numero === parseInt(prixNum));
        if (p) montantMet += (parseFloat(qte) || 0) * (p.prixUnitaire || 0);
      });
    });
  });

  /* ═══ 3. Montant Factures payées + 4. TVA ═══ */
  let montantFac = 0, tvaTotal = 0, nbFacPayees = 0;
  DATA.facturesEnregistrees.forEach(f => {
    if (!isInPeriode(f.date)) return;
    nbFacPayees++;
    montantFac += (f.totalTTC || 0);
    tvaTotal   += (f.tva || 0);
  });

  /* ═══ 5. Taux de consommation : Metré / Budget total marché ═══ */
  const taux = budgetTotal > 0 ? (montantMet / budgetTotal) * 100 : 0;

  /* ═══ 6. Commandes (count) ═══ */
  let nbCmd = 0;
  DATA.commandes.forEach(c => {
    if (isInPeriode(c.date)) nbCmd++;
  });

  /* ═══ 7. Constats ═══ */
  let nbConstat = 0;
  DATA.constatsEnregistres.forEach(c => {
    if (isInPeriode(c.mois)) nbConstat++;
  });

  /* ═══ 8. Sinistres ═══ */
  let nbSin = 0;
  try {
    const sinistres = extraireSinistres();
    sinistres.forEach(s => {
      if (isInPeriode(s.date)) nbSin++;
    });
  } catch(e) {}

  /* ═══ Affichage ═══ */
  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setTxt('dash-budget-marche',      fmt(budgetTotal));
  setTxt('dash-montant-metres',     fmt(montantMet));
  setTxt('dash-montant-factures',   fmt(montantFac));
  setTxt('dash-tva',                fmt(tvaTotal));
  setTxt('dash-taux',               taux.toFixed(1) + '%');

  setTxt('dash-nb-commandes',  fmtInt(nbCmd));
  setTxt('dash-nb-metres',     fmtInt(nbMet));
  setTxt('dash-nb-constats',   fmtInt(nbConstat));
  setTxt('dash-nb-sinistres',  fmtInt(nbSin));
  setTxt('dash-nb-factures',   fmtInt(nbFacPayees));

  /* ═══ Répartition par Tronçon (montant depuis METRÉ) ═══ */
  const stats = {
    TR1: { nb:0, qte:0, montant:0 },
    TR2: { nb:0, qte:0, montant:0 },
    TR3: { nb:0, qte:0, montant:0 },
    TR4: { nb:0, qte:0, montant:0 }
  };

  DATA.metresEnregistres.forEach(m => {
    if (!isInPeriode(m.mois)) return;
    if (!stats[m.troncon]) return;
    Object.values(m.entrees || {}).forEach(row => {
      Object.entries(row).forEach(([prixNum, qte]) => {
        const q = parseFloat(qte) || 0;
        if (q <= 0) return;
        const p = DATA.catalogue.find(x => x.numero === parseInt(prixNum));
        const pu = p ? (p.prixUnitaire || 0) : 0;
        stats[m.troncon].qte     += q;
        stats[m.troncon].montant += q * pu;
        stats[m.troncon].nb++;
      });
    });
  });

  const cards = document.getElementById('dashboard-tr-cards');
  if (cards) {
    cards.innerHTML = Object.entries(stats).map(([tr, s]) => `
      <div class="tr-card">
        <div class="tr-lbl">${TRONCON_LABELS[tr]}</div>
        <div class="tr-val">${fmtInt(s.nb)}</div>
        <div class="tr-sub">Qté : ${fmtInt(s.qte)}</div>
        <div class="tr-sub" style="color:#16a34a;font-weight:700;font-size:13px;">
          ${fmt(s.montant)} DH
        </div>
      </div>
    `).join('');
  }
}

/* ═══════════════════════════════════════════════════════════
   METRÉ — GESTION PAR MOIS
   ═══════════════════════════════════════════════════════════ */
window.switchMetre = function(tr) {
  currentMetreTR = tr;
  document.querySelectorAll('#subtabs-metre .sub-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.subtab === 'metre-' + tr);
  });
  rendreMetre(tr);
  rendreMetresEnregistres();
};

/* Change le mois → recharge le working copy */
window.changerMoisMetre = function(mois) {
  if (!mois) return;
  currentMoisMetre = mois;
  ['TR1','TR2','TR3','TR4'].forEach(tr => {
    const existing = DATA.metresEnregistres.find(m => m.mois === mois && m.troncon === tr);
    if (existing) {
      DATA.metres[tr] = {
        date: existing.dateReference || getFinDeMois(mois),
        entrees: JSON.parse(JSON.stringify(existing.entrees || {})),
        sinistres: { ...(existing.sinistres || {}) },
        fax: { ...(existing.fax || {}) },
        prestations: { ...(existing.prestations || {}) }
      };
    } else {
      DATA.metres[tr] = {
        date: getFinDeMois(mois),
        entrees: {}, sinistres: {}, fax: {}, prestations: {}
      };
    }
  });
  sauvegarderDonnees(true);
  rendreMetre(currentMetreTR);
  rendreMetresEnregistres();
};

/* Lignes PK d'un TR pour un mois donné — SANS déduplication
   Chaque ligne de commande = 1 ligne dans le Metré
   (autorise les PK dupliqués si plusieurs commandes dans le même mois) */
function getLignesMetre(tr, mois) {
  const rows = [];
  DATA.commandes.forEach(c => {
    if (mois && (c.date || '').slice(0,7) !== mois) return;
    c.lignes.forEach(l => {
      if (l.troncon !== tr) return;
      const sinistreAuto = extraireDateDeObservation(l.observations);
      rows.push({
        key: `${c.id}|${l.id}`,
        cmdId: c.id,
        cmdNumero: c.numero,
        pk: l.pk,
        sens: l.sens,
        cote: l.cote,
        designation: l.designation,
        observations: l.observations || '',
        quantiteCommande: l.quantite,
        numeroPrix: l.numeroPrix,
        sinistreAuto
      });
    });
  });
  /* ✅ AUCUN TRI — l'ordre Excel est préservé */
  return rows;
}

/* ═══ RENDU METRÉ (avec toolbar intégré) ═══ */
function rendreMetre(tr) {
  const cont = document.getElementById('metre-content');
  const m = DATA.metres[tr];
  const mois = currentMoisMetre;
  const numero = numeroMetrePourMois(mois);
  const rows = getLignesMetre(tr, mois);

  /* Toolbar (calendrier + boutons) */
  const toolbar = `
    <div class="metre-toolbar" style="background:#f0f9ff;padding:12px 16px;border-radius:8px;
         margin-bottom:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;
         border:2px solid #bfdbfe;">
      <label style="font-weight:700;color:#1e3a8a;">📅 Mois :</label>
      ${htmlMonthPicker('metre-mois', mois, 'changerMoisMetrePicker')}
      <span style="font-weight:700;color:#1e3a8a;font-size:14px;">${formatMoisFR(mois)}</span>
      <span style="background:#1e3a8a;color:#fff;padding:5px 14px;border-radius:12px;
                   font-weight:700;font-size:13px;">Metré N°${numero}</span>
      <span style="font-size:12px;color:#64748b;">Tronçon ${tr}</span>
      <button class="btn btn-secondary btn-sm" onclick="apercuMetre('${tr}')"
              style="margin-left:auto;">👁️ Aperçu</button>
      <button class="btn btn-primary btn-sm" onclick="sauvegarderMetreMois()">💾 Enregistrer</button>
    </div>
  `;

  if (rows.length === 0) {
    cont.innerHTML = toolbar + `
      <div class="panel">
        <p style="text-align:center;padding:30px;color:#64748b;">
          Aucune commande dans <strong>${formatMoisFR(mois)}</strong> pour ce tronçon.<br>
          <span style="font-size:12px;">Importez des commandes datées de ${formatMoisFR(mois)} ou utilisez 📥 Importer Excel.</span>
        </p>
      </div>`;
    return;
  }

  /* Préparer les colonnes prix */
  const prixData = DATA.catalogue.filter(p => p.numero)
    .sort((a, b) => a.numero - b.numero)
    .map(p => ({ numero: p.numero, libelle: p.libelle || '', unite: p.unite || '' }));

  const totals = {};
  prixData.forEach(p => { totals[p.numero] = 0; });
  Object.values(m.entrees).forEach(row => {
    prixData.forEach(p => { totals[p.numero] += (parseFloat(row[p.numero]) || 0); });
  });

  /* Tableau SEUL — sans entête (l'entête est dans l'aperçu) */
  const html = toolbar + `
    <div class="panel">
      <div class="metre-scroll">
        <table class="metre-table">
          <thead>
            <tr>
              <th rowspan="2" class="col-pk">PK</th>
              <th rowspan="2" class="col-sens">Sens</th>
              <th rowspan="2" class="col-cote">Côté</th>
              <th rowspan="2" class="col-cmd">Commande</th>
              ${prixData.map(p => `<th class="prix-num" title="Prix n°${p.numero} — ${p.libelle.replace(/"/g,'&quot;')}">${p.numero}</th>`).join('')}
              <th rowspan="2" class="col-sinistre">sinistre</th>
              <th rowspan="2" class="col-fax">Date d'envoi du fax</th>
              <th rowspan="2" class="col-prest">Prestations exécutées au</th>
            </tr>
            <tr>
              ${prixData.map(p => `<th class="prix-desc" title="${p.libelle.replace(/"/g,'&quot;')}"><div class="vtext">${p.libelle}</div></th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td class="col-pk pk-cell">${r.pk}</td>
                <td class="col-sens">${r.sens}</td>
                <td class="col-cote">${r.cote}</td>
                <td class="col-cmd" style="font-size:10px;color:#64748b;white-space:nowrap;">${r.cmdNumero || ''}</td>
                ${prixData.map(p => {
                  const val = (m.entrees[r.key] && m.entrees[r.key][p.numero]) || '';
                  const hint = (r.numeroPrix === p.numero && r.quantiteCommande) ? `Cmd: ${r.quantiteCommande}` : '';
                  return `<td class="prix-cell" title="${hint}">
                    <input type="number" min="0" step="0.01" value="${val}"
                      onchange="setMetreQte('${tr}', '${r.key}', ${p.numero}, this.value)">
                  </td>`;
                }).join('')}
                <td class="col-sinistre"><input type="text" class="sinistre-input"
                  value="${m.sinistres[r.key] !== undefined ? m.sinistres[r.key] : r.sinistreAuto}"
                  onchange="setMetreSinistre('${tr}', '${r.key}', this.value)"></td>
                <td class="col-fax"><input type="text" class="fax-input" value="${m.fax[r.key] || ''}"
                  onchange="setMetreFax('${tr}', '${r.key}', this.value)"></td>
                <td class="col-prest"><input type="text" class="prest-input" value="${m.prestations[r.key] || ''}"
                  onchange="setMetrePrestations('${tr}', '${r.key}', this.value)"></td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="4" style="text-align:right;">Total</td>
              ${prixData.map(p => `<td class="prix-total">${totals[p.numero] ? totals[p.numero].toFixed(2) : ''}</td>`).join('')}
              <td colspan="3"></td>
            </tr>
            <tr class="unite-row">
              <td colspan="4" style="text-align:right;">Unité</td>
              ${prixData.map(p => `<td>${p.unite}</td>`).join('')}
              <td colspan="3"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;
  cont.innerHTML = html;

  /* ✅ Activer la navigation clavier */
  setupMetreKeyboard();
}

/* ═══ HANDLERS METRÉ ═══ */
window.setMetreDate = function(tr, val) {
  DATA.metres[tr].date = val;
  sauvegarderDonnees(true);
  rendreMetre(tr);
};
window.setMetreQte = function(tr, key, prix, val) {
  if (!DATA.metres[tr].entrees[key]) DATA.metres[tr].entrees[key] = {};
  const n = parseFloat(val);
  if (isNaN(n) || n === 0) delete DATA.metres[tr].entrees[key][prix];
  else DATA.metres[tr].entrees[key][prix] = n;
  sauvegarderDonnees(true);
  rendreMetre(tr);
};
window.setMetreSinistre = function(tr, key, val) {
  DATA.metres[tr].sinistres[key] = val;
  sauvegarderDonnees(true);
};
window.setMetreFax = function(tr, key, val) {
  DATA.metres[tr].fax[key] = val;
  sauvegarderDonnees(true);
};
window.setMetrePrestations = function(tr, key, val) {
  DATA.metres[tr].prestations[key] = val;
  sauvegarderDonnees(true);
};

/* ═══ SAUVEGARDER LE METRÉ DU MOIS EN COURS ═══ */
window.sauvegarderMetreMois = function() {
  const tr = currentMetreTR;
  const mois = currentMoisMetre;
  if (!mois) { notifier('⚠️ Sélectionnez un mois', 'danger'); return; }

  const wc = DATA.metres[tr];
  const nbLignes = Object.keys(wc.entrees || {}).filter(k =>
    Object.keys(wc.entrees[k]).length > 0).length;
  if (nbLignes === 0) { notifier('⚠️ Aucune quantité saisie', 'danger'); return; }

  const numero = numeroMetrePourMois(mois);
  const dateReference = getFinDeMois(mois);

  let existing = DATA.metresEnregistres.find(m => m.mois === mois && m.troncon === tr);
  if (existing) {
    existing.entrees = JSON.parse(JSON.stringify(wc.entrees));
    existing.sinistres = { ...(wc.sinistres || {}) };
    existing.fax = { ...(wc.fax || {}) };
    existing.prestations = { ...(wc.prestations || {}) };
    existing.dateReference = dateReference;
    existing.updatedAt = new Date().toISOString();
    notifier(`💾 Metré N°${numero} — ${tr} mis à jour`, 'success');
  } else {
    DATA.metresEnregistres.push({
      id: uidMetre(), numero, mois, troncon: tr, dateReference,
      entrees: JSON.parse(JSON.stringify(wc.entrees)),
      sinistres: { ...(wc.sinistres || {}) },
      fax: { ...(wc.fax || {}) },
      prestations: { ...(wc.prestations || {}) },
      createdAt: new Date().toISOString()
    });
    notifier(`💾 Metré N°${numero} — ${tr} enregistré`, 'success');
  }

  logHistorique('SAUVEGARDE METRÉ', `Metré N°${numero} — ${tr} — ${formatMoisFR(mois)}`);
  sauvegarderDonnees(true);
  rendreMetresEnregistres();
};

/* ═══ LISTE DES METRÉS ENREGISTRÉS ═══ */
window.rendreMetresEnregistres = function() {
  const filtreTR = document.getElementById('filtre-metre-troncon')?.value || '';
  const rech = (document.getElementById('filtre-metre-recherche')?.value || '').toLowerCase();
  const cont = document.getElementById('liste-metres-accordion');
  if (!cont) return;

  let list = DATA.metresEnregistres.slice();
  list.forEach(m => { m._numero = numeroMetrePourMois(m.mois); });
  list.sort((a,b) => (b._numero - a._numero) || a.troncon.localeCompare(b.troncon));

  if (filtreTR) list = list.filter(m => m.troncon === filtreTR);
  if (rech) {
    list = list.filter(m =>
      [String(m._numero), m.dateReference, m.troncon, formatMoisFR(m.mois)]
        .join(' ').toLowerCase().includes(rech));
  }

  if (list.length === 0) {
    cont.innerHTML = '<p style="text-align:center;padding:20px;color:#64748b;">Aucun Metré enregistré.</p>';
    return;
  }

  cont.innerHTML = list.map(m => `
    <div class="cmd-item">
      <div class="cmd-item-header">
        <div class="cmd-item-title">
          <strong>Metré N°${m._numero}</strong>
          <span class="badge-tr badge-tr${(m.troncon||'TR1')[2]}">${m.troncon}</span>
          <span>📅 ${formatDateFR(m.dateReference)}</span>
          <span>🗓️ ${formatMoisFR(m.mois)}</span>
          <span class="badge badge-tr1">${nbLignesMetre(m)} ligne(s)</span>
          <span>Qté : ${totalQteMetre(m)}</span>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn-icon" title="Charger dans la zone de travail"
                  onclick="chargerMetreArchive('${m.id}')">📂</button>
          <button class="btn-icon danger" title="Supprimer"
                  onclick="supprimerMetreArchive('${m.id}')">🗑️</button>
        </div>
      </div>
    </div>
  `).join('');
};

window.chargerMetreArchive = function(id) {
  const m = DATA.metresEnregistres.find(x => x.id === id);
  if (!m) return;
  currentMoisMetre = m.mois;
  changerMoisMetre(m.mois);
  currentMetreTR = m.troncon;
  switchMetre(m.troncon);
  notifier(`📂 Metré N°${numeroMetrePourMois(m.mois)} — ${m.troncon} chargé`, 'success');
};

window.supprimerMetreArchive = function(id) {
  const m = DATA.metresEnregistres.find(x => x.id === id);
  if (!m) return;
  const num = numeroMetrePourMois(m.mois);
  if (!confirm(`Supprimer Metré N°${num} — ${m.troncon} (${formatMoisFR(m.mois)}) ?`)) return;
  DATA.metresEnregistres = DATA.metresEnregistres.filter(x => x.id !== id);
  logHistorique('SUPPRESSION METRÉ', `N°${num} — ${m.troncon} — ${formatMoisFR(m.mois)}`);
  sauvegarderDonnees(true);
  rendreMetresEnregistres();
  notifier('🗑️ Metré supprimé', 'success');
};

/* ═══════════════════════════════════════════════════════════
   CONSTAT — GESTION PAR MOIS
   ═══════════════════════════════════════════════════════════ */
window.switchConstat = function(tr) {
  currentConstatTR = tr;
  document.querySelectorAll('#subtabs-constat .sub-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.subtab === 'constat-' + tr);
  });

  /* ✅ Masquer le bouton Import si CONSOLIDÉ */
  const btnImport = document.getElementById('btn-import-constat');
  if (btnImport) {
    btnImport.style.display = (tr === 'CONS') ? 'none' : '';
  }

  rendreConstatTR(tr);
  rendreConstatsEnregistres();
};

/* Change le mois → charge ou crée avec héritage */
window.changerMoisConstatPicker = function() {
  const v = getMonthPickerValue('constat-mois');
  if (v) changerMoisConstat(v);
};

window.changerMoisConstat = function(mois) {
  if (!mois) return;
  currentMoisConstat = mois;

  ['TR1','TR2','TR3','TR4'].forEach(tr => {
    const existing = DATA.constatsEnregistres.find(c => c.mois === mois && c.troncon === tr);
    if (existing) {
      DATA.constats[tr] = {
        date: existing.dateReference || getFinDeMois(mois),
        anterieures: { ...(existing.anterieures || {}) },
        observations: { ...(existing.observations || {}) },
        quantitesMois: { ...(existing.quantitesMois || {}) }
      };
    } else {
      const prevMois = getMoisPrecedentConstat(mois, tr);
      const anterieures = {};
      if (prevMois) {
        const prev = DATA.constatsEnregistres.find(c => c.mois === prevMois && c.troncon === tr);
        if (prev && prev.cumulees) {
          Object.entries(prev.cumulees).forEach(([p, v]) => { anterieures[p] = v; });
        }
      }
      DATA.constats[tr] = {
        date: getFinDeMois(mois),
        anterieures,
        observations: {},
        quantitesMois: {}
      };
    }
  });

  /* CONS */
  const existingCons = DATA.constatsEnregistres.find(c => c.mois === mois && c.troncon === 'CONS');
  if (existingCons) {
    DATA.constats.CONS = {
      date: existingCons.dateReference || getFinDeMois(mois),
      anterieures: {},
      observations: {},
      quantitesMois: { ...(existingCons.quantitesMois || {}) }
    };
  } else {
    DATA.constats.CONS = {
      date: getFinDeMois(mois),
      anterieures: {},
      observations: {},
      quantitesMois: {}
    };
  }

  sauvegarderDonnees(true);
  rendreConstatTR(currentConstatTR);
  rendreConstatsEnregistres();
};

/* ═══ RENDU CONSTAT (avec toolbar intégré) ═══ */
function rendreConstatTR(tr) {
  const cont = document.getElementById('constat-content');
  const c = DATA.constats[tr];
  if (!c) { cont.innerHTML = '<div class="panel"><p>Erreur de chargement</p></div>'; return; }
  const mois = currentMoisConstat;
  const numero = numeroConstatPourMois(mois);
  const dateAffichage = formatDateFR(getFinDeMois(mois));

  const toolbar = `
    <div class="metre-toolbar" style="background:#fff7ed;padding:12px 16px;border-radius:8px;
         margin-bottom:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;
         border:2px solid #fed7aa;">
      <label style="font-weight:700;color:#c2410c;">📅 Mois :</label>
      ${htmlMonthPicker('constat-mois', mois, 'changerMoisConstatPicker')}
      <span style="font-weight:700;color:#c2410c;font-size:14px;">${formatMoisFR(mois)}</span>
      <span style="background:${tr === 'CONS' ? '#dc2626' : '#c2410c'};color:#fff;padding:5px 14px;
                   border-radius:12px;font-weight:700;font-size:13px;">
        ${tr === 'CONS' ? 'CONSTAT CONSOLIDÉ' : 'Constat N°' + numero}
      </span>
      <span style="font-size:12px;color:#64748b;">${tr === 'CONS' ? 'Tous tronçons' : 'Tronçon ' + tr}</span>
      <button class="btn btn-secondary btn-sm" onclick="apercuConstat('${tr}')" style="margin-left:auto;">👁️ Aperçu</button>
      <button class="btn btn-primary btn-sm" onclick="sauvegarderConstatMois()">💾 Enregistrer</button>
    </div>
  `;

  /* Récupérer les prix avec quantité */
  const trs = tr === 'CONS' ? ['TR1','TR2','TR3','TR4'] : [tr];
  const prixSet = new Set();

  trs.forEach(t => {
    const met = DATA.metresEnregistres.find(m => m.mois === mois && m.troncon === t);
    if (met) {
      Object.values(met.entrees || {}).forEach(row => {
        Object.keys(row).forEach(p => { if (parseFloat(row[p])) prixSet.add(parseInt(p)); });
      });
    }
    if (DATA.constats[t]?.anterieures) {
      Object.keys(DATA.constats[t].anterieures).forEach(p => prixSet.add(parseInt(p)));
    }
    if (DATA.constats[t]?.observations) {
      Object.keys(DATA.constats[t].observations).forEach(p => prixSet.add(parseInt(p)));
    }
    if (DATA.constats[t]?.quantitesMois) {
      Object.keys(DATA.constats[t].quantitesMois).forEach(p => prixSet.add(parseInt(p)));
    }
  });
  if (c.quantitesMois) Object.keys(c.quantitesMois).forEach(p => prixSet.add(parseInt(p)));

  if (prixSet.size === 0) {
    cont.innerHTML = toolbar + `
      <div class="panel">
        <p style="text-align:center;padding:30px;color:#64748b;">
          Aucun prix pour <strong>${formatMoisFR(mois)}</strong>.<br>
          <span style="font-size:12px;">Enregistrez un Metré ou importez un fichier Excel.</span>
        </p>
      </div>`;
    return;
  }

  const prixList = [...prixSet].sort((a, b) => a - b);

  let totalAnt = 0, totalMois = 0, totalCum = 0;
  const lignes = prixList.map(p => {
    const cat = DATA.catalogue.find(x => x.numero === p);

    /* Quantité du mois : importée OU calculée depuis Metré */
    let qteMois = 0;
    if (c.quantitesMois && c.quantitesMois[p] !== undefined) {
      qteMois = c.quantitesMois[p];
    } else {
      trs.forEach(t => {
        const met = DATA.metresEnregistres.find(m => m.mois === mois && m.troncon === t);
        if (met) qteMois += calculerQteDuMoisMetre(met, p);
      });
    }

    let qteAnt = 0;
    if (tr === 'CONS') {
      qteAnt = trs.reduce((s, t) => s + (parseFloat(DATA.constats[t].anterieures[p]) || 0), 0);
    } else {
      qteAnt = parseFloat(c.anterieures[p]) || 0;
    }
    const qteCum = qteAnt + qteMois;
    totalAnt += qteAnt; totalMois += qteMois; totalCum += qteCum;

    return {
      prix: p,
      libelle: cat ? cat.libelle : '(non trouvé)',
      unite: cat ? cat.unite : '',
      qteAnt, qteMois, qteCum,
      observations: (tr !== 'CONS') ? (c.observations[p] || '') : ''
    };
  });

  /* ⚠️ TABLEAU SEUL — sans entête, sans logo, sans N°, sans footer */
  const html = toolbar + `
    <div class="panel">
      <div style="overflow-x:auto;">
        <table class="constat-table">
          <thead>
            <tr>
              <th style="width:70px;">N° Prix</th>
              <th>Libellé des prix</th>
              <th style="width:70px;">Unité</th>
              <th style="width:130px;">Quantité antérieure</th>
              <th style="width:130px;">Quantité du mois</th>
              <th style="width:130px;">Quantité cumulée</th>
              <th style="width:180px;">Observations</th>
            </tr>
          </thead>
          <tbody>
            ${lignes.map(l => `
              <tr>
                <td style="text-align:center;font-weight:700;">${l.prix}</td>
                <td style="font-size:11.5px;">${l.libelle}</td>
                <td style="text-align:center;">${l.unite}</td>
                <td class="num">
                  ${tr !== 'CONS'
                    ? `<input type="number" min="0" step="0.01" value="${l.qteAnt || ''}"
                        onchange="setConstatAnterieure('${tr}', ${l.prix}, this.value)">`
                    : (l.qteAnt ? l.qteAnt.toLocaleString('fr-FR', {minimumFractionDigits:2}) : '-')}
                </td>
                <td class="num" style="font-weight:700;color:#1e3a8a;">
                  ${l.qteMois ? l.qteMois.toLocaleString('fr-FR', {minimumFractionDigits:2}) : '-'}
                </td>
                <td class="num" style="font-weight:700;">
                  ${l.qteCum ? l.qteCum.toLocaleString('fr-FR', {minimumFractionDigits:2}) : '-'}
                </td>
                <td>
                  ${tr !== 'CONS'
                    ? `<input type="text" value="${(l.observations||'').replace(/"/g,'&quot;')}"
                        onchange="setConstatObservations('${tr}', ${l.prix}, this.value)" placeholder="...">`
                    : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="text-align:right;">TOTAL</td>
              <td class="num">${totalAnt.toLocaleString('fr-FR', {minimumFractionDigits:2})}</td>
              <td class="num">${totalMois.toLocaleString('fr-FR', {minimumFractionDigits:2})}</td>
              <td class="num">${totalCum.toLocaleString('fr-FR', {minimumFractionDigits:2})}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;

  cont.innerHTML = html;
}

/* ═══ HANDLERS CONSTAT ═══ */
window.setConstatDate = function(tr, val) {
  DATA.constats[tr].date = val;
  sauvegarderDonnees(true);
  rendreConstatTR(tr);
};
window.setConstatAnterieure = function(tr, prix, val) {
  const n = parseFloat(val);
  if (isNaN(n) || n === 0) delete DATA.constats[tr].anterieures[prix];
  else DATA.constats[tr].anterieures[prix] = n;
  sauvegarderDonnees(true);
  rendreConstatTR(tr);
};
window.setConstatObservations = function(tr, prix, val) {
  if (!val) delete DATA.constats[tr].observations[prix];
  else DATA.constats[tr].observations[prix] = val;
  sauvegarderDonnees(true);
};

/* ═══ SAUVEGARDER LE CONSTAT DU MOIS ═══ */
window.sauvegarderConstatMois = function() {
  const tr = currentConstatTR;
  const mois = currentMoisConstat;
  if (!mois) { notifier('⚠️ Sélectionnez un mois', 'danger'); return; }

  const numero = numeroConstatPourMois(mois);

  /* ═══════════ CASE 1 : CONSTAT CONSOLIDÉ ═══════════ */
  if (tr === 'CONS') {
    const prixSet = new Set();
    ['TR1','TR2','TR3','TR4'].forEach(t => {
      const met = DATA.metresEnregistres.find(m => m.mois === mois && m.troncon === t);
      if (met) {
        Object.values(met.entrees || {}).forEach(row => {
          Object.keys(row).forEach(p => {
            if (parseFloat(row[p])) prixSet.add(parseInt(p));
          });
        });
      }
      const cst = DATA.constats[t];
      if (cst) {
        Object.keys(cst.anterieures || {}).forEach(p => prixSet.add(parseInt(p)));
        Object.keys(cst.observations || {}).forEach(p => prixSet.add(parseInt(p)));
        Object.keys(cst.quantitesMois || {}).forEach(p => prixSet.add(parseInt(p)));
      }
    });

    const cumulees = {};
    prixSet.forEach(p => {
      let total = 0;
      ['TR1','TR2','TR3','TR4'].forEach(t => {
        const met = DATA.metresEnregistres.find(m => m.mois === mois && m.troncon === t);
        const ant = parseFloat((DATA.constats[t]?.anterieures || {})[p]) || 0;
        const qMois = (DATA.constats[t]?.quantitesMois?.[p] !== undefined)
          ? DATA.constats[t].quantitesMois[p]
          : (met ? calculerQteDuMoisMetre(met, p) : 0);
        total += ant + qMois;
      });
      cumulees[p] = total;
    });

    let existing = DATA.constatsEnregistres.find(c => c.mois === mois && c.troncon === 'CONS');
    if (existing) {
      existing.cumulees = cumulees;
      existing.quantitesMois = { ...(DATA.constats.CONS.quantitesMois || {}) };
      existing.dateReference = getFinDeMois(mois);
      existing.updatedAt = new Date().toISOString();
      notifier(`💾 Constat CONSOLIDÉ N°${numero} mis à jour`, 'success');
    } else {
      DATA.constatsEnregistres.push({
        id: uidConstat(),
        numero, mois, troncon: 'CONS',
        dateReference: getFinDeMois(mois),
        anterieures: {},
        observations: {},
        quantitesMois: { ...(DATA.constats.CONS.quantitesMois || {}) },
        cumulees,
        createdAt: new Date().toISOString()
      });
      notifier(`💾 Constat CONSOLIDÉ N°${numero} enregistré`, 'success');
    }

    logHistorique('SAUVEGARDE CONSTAT CONSOLIDÉ', `N°${numero} — ${formatMoisFR(mois)}`);
    sauvegarderDonnees(true);
    rendreConstatsEnregistres();
    return;
  }

  /* ═══════════ CASE 2 : TRs (TR1, TR2, TR3, TR4) ═══════════ */
  const wc = DATA.constats[tr];

  const met = DATA.metresEnregistres.find(m => m.mois === mois && m.troncon === tr);
  const prixSet = new Set();
  Object.keys(wc.anterieures || {}).forEach(p => prixSet.add(p));
  Object.keys(wc.observations || {}).forEach(p => prixSet.add(p));
  Object.keys(wc.quantitesMois || {}).forEach(p => prixSet.add(p));
  if (met) {
    Object.values(met.entrees || {}).forEach(row => {
      Object.keys(row).forEach(p => prixSet.add(p));
    });
  }

  const cumulees = {};
  prixSet.forEach(p => {
    const ant = parseFloat(wc.anterieures[p]) || 0;
    const qMois = (wc.quantitesMois?.[p] !== undefined)
      ? wc.quantitesMois[p]
      : (met ? calculerQteDuMoisMetre(met, p) : 0);
    cumulees[p] = ant + qMois;
  });

  let existing = DATA.constatsEnregistres.find(c => c.mois === mois && c.troncon === tr);
  if (existing) {
    existing.anterieures = { ...wc.anterieures };
    existing.observations = { ...wc.observations };
    existing.quantitesMois = { ...(wc.quantitesMois || {}) };
    existing.cumulees = cumulees;
    existing.metreNumero = met ? met.numero : existing.metreNumero;
    existing.metreRef = met ? met.id : existing.metreRef;
    existing.dateReference = getFinDeMois(mois);
    existing.updatedAt = new Date().toISOString();
    notifier(`💾 Constat N°${numero} — ${tr} mis à jour`, 'success');
  } else {
    DATA.constatsEnregistres.push({
      id: uidConstat(),
      numero, mois, troncon: tr,
      dateReference: getFinDeMois(mois),
      metreRef: met ? met.id : null,
      metreNumero: met ? met.numero : numero,
      anterieures: { ...wc.anterieures },
      observations: { ...wc.observations },
      quantitesMois: { ...(wc.quantitesMois || {}) },
      cumulees,
      createdAt: new Date().toISOString()
    });
    notifier(`💾 Constat N°${numero} — ${tr} enregistré`, 'success');
  }

  logHistorique('SAUVEGARDE CONSTAT', `Constat N°${numero} — ${tr} — ${formatMoisFR(mois)}`);
  sauvegarderDonnees(true);
  rendreConstatsEnregistres();
};

/* ═══ LISTE DES CONSTATS ENREGISTRÉS ═══ */
window.rendreConstatsEnregistres = function() {
  const filtreTR = document.getElementById('filtre-constat-troncon')?.value || '';
  const rech = (document.getElementById('filtre-constat-recherche')?.value || '').toLowerCase();
  const cont = document.getElementById('liste-constats-accordion');
  if (!cont) return;

  let list = DATA.constatsEnregistres.slice();
  list.forEach(c => { c._numero = numeroConstatPourMois(c.mois); });
  list.sort((a,b) => (b._numero - a._numero) || a.troncon.localeCompare(b.troncon));

  if (filtreTR) list = list.filter(c => c.troncon === filtreTR);
  if (rech) {
    list = list.filter(c =>
      [String(c._numero), c.dateReference, c.troncon, formatMoisFR(c.mois), String(c.metreNumero||'')]
        .join(' ').toLowerCase().includes(rech));
  }

  if (list.length === 0) {
    cont.innerHTML = '<p style="text-align:center;padding:20px;color:#64748b;">Aucun Constat enregistré.</p>';
    return;
  }

  cont.innerHTML = list.map(c => `
    <div class="cmd-item">
      <div class="cmd-item-header">
        <div class="cmd-item-title">
          <strong>Constat N°${c._numero}</strong>
          <span class="badge-tr badge-tr${(c.troncon||'TR1')[2]}">${c.troncon}</span>
          <span>📅 ${formatDateFR(c.dateReference)}</span>
          <span>🗓️ ${formatMoisFR(c.mois)}</span>
          <span>📋 Metré N°${c.metreNumero || '?'}</span>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn-icon" title="Charger dans la zone de travail"
                  onclick="chargerConstatArchive('${c.id}')">📂</button>
          <button class="btn-icon danger" title="Supprimer"
                  onclick="supprimerConstatArchive('${c.id}')">🗑️</button>
        </div>
      </div>
    </div>
  `).join('');
};

window.chargerConstatArchive = function(id) {
  const c = DATA.constatsEnregistres.find(x => x.id === id);
  if (!c) return;
  currentMoisConstat = c.mois;
  changerMoisConstat(c.mois);
  currentConstatTR = c.troncon;
  switchConstat(c.troncon);
  notifier(`📂 Constat N°${numeroConstatPourMois(c.mois)} — ${c.troncon} chargé`, 'success');
};

window.supprimerConstatArchive = function(id) {
  const c = DATA.constatsEnregistres.find(x => x.id === id);
  if (!c) return;
  const num = numeroConstatPourMois(c.mois);
  if (!confirm(`Supprimer Constat N°${num} — ${c.troncon} (${formatMoisFR(c.mois)}) ?`)) return;
  DATA.constatsEnregistres = DATA.constatsEnregistres.filter(x => x.id !== id);
  logHistorique('SUPPRESSION CONSTAT', `N°${num} — ${c.troncon} — ${formatMoisFR(c.mois)}`);
  sauvegarderDonnees(true);
  rendreConstatsEnregistres();
  notifier('🗑️ Constat supprimé', 'success');
};

/* ═══════════════════════════════════════════════════════════
   HISTORIQUE
   ═══════════════════════════════════════════════════════════ */
function rendreHistorique() {
  const tbody = document.getElementById('tbody-historique');
  if (DATA.historique.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#64748b;">Aucun historique.</td></tr>';
    return;
  }
  tbody.innerHTML = DATA.historique.map(h => `
    <tr>
      <td>${new Date(h.date).toLocaleString('fr-FR')}</td>
      <td><strong>${h.action}</strong></td>
      <td>${h.details}</td>
    </tr>`).join('');
}
document.getElementById('btn-vider-historique').addEventListener('click', () => {
  if (!confirm("Vider tout l'historique ?")) return;
  DATA.historique = [];
  sauvegarderDonnees(true);
  rendreHistorique();
  notifier('🗑️ Historique vidé', 'success');
});

/* ═══════════════════════════════════════════════════════════
   EN-TÊTE + TABLE HTML POUR EXPORT COMMANDE
   ═══════════════════════════════════════════════════════════ */
function genererEnteteHTML(cmd) {
  const p = DATA.parametres;
  const dateAffichage = cmd.date ? formatDateFR(cmd.date) : formatDateFR(new Date().toISOString());
  return `
    <div class="entete-commande">
      <div class="entete-ligne-unique">
        ${p.logo ? `<img src="${p.logo}" class="entete-logo" alt="Logo">` : ''}
        <div class="entete-titres">
          <span class="num">COMMANDE N° ${cmd.numero}</span>
          <span class="date">DU ${dateAffichage}</span>
        </div>
      </div>
      <table class="entete-infos">
        <tr>
          <td><span class="lbl">MAITRE D'OUVRAGE :</span> ${p.mo || ''}</td>
          <td><span class="lbl">MARCHE N° :</span> ${p.marche || ''}</td>
        </tr>
        <tr>
          <td><span class="lbl">MAITRE D'ŒUVRE :</span> ${p.moe || ''}</td>
          <td><span class="lbl">Objet :</span> ${p.objet || ''}</td>
        </tr>
        <tr>
          <td><span class="lbl">SECTION :</span> ${p.section || ''}</td>
          <td><span class="lbl">PRESTATAIRE :</span> ${p.prestataire || ''}</td>
        </tr>
      </table>
      <div class="entete-etat">Etat des travaux à réaliser à partir du ${dateAffichage}</div>
    </div>`;
}

function genererTableHTML(cmd) {
  return `
    <table class="commande-export-table" style="width:100%;border-collapse:collapse;font-size:11px;">
      <thead>
        <tr>
          <th style="border:1px solid #333;padding:5px;background:#1e3a8a;color:#fff;">Tronçon</th>
          <th style="border:1px solid #333;padding:5px;background:#1e3a8a;color:#fff;">PK</th>
          <th style="border:1px solid #333;padding:5px;background:#1e3a8a;color:#fff;">Sens</th>
          <th style="border:1px solid #333;padding:5px;background:#1e3a8a;color:#fff;">Côté</th>
          <th style="border:1px solid #333;padding:5px;background:#1e3a8a;color:#fff;">Désignation des travaux à réaliser</th>
          <th style="border:1px solid #333;padding:5px;background:#1e3a8a;color:#fff;">Observations</th>
          <th style="border:1px solid #333;padding:5px;background:#1e3a8a;color:#fff;">Qté</th>
          <th style="border:1px solid #333;padding:5px;background:#1e3a8a;color:#fff;">Type</th>
        </tr>
      </thead>
      <tbody>
        ${cmd.lignes.map(l => `
          <tr>
            <td style="border:1px solid #333;padding:5px;">${l.troncon}</td>
            <td style="border:1px solid #333;padding:5px;">${l.pk}</td>
            <td style="border:1px solid #333;padding:5px;">${l.sens}</td>
            <td style="border:1px solid #333;padding:5px;">${l.cote}</td>
            <td style="border:1px solid #333;padding:5px;">${l.designation}</td>
            <td style="border:1px solid #333;padding:5px;">${l.observations || ''}</td>
            <td style="border:1px solid #333;padding:5px;text-align:center;">${l.quantite}</td>
            <td style="border:1px solid #333;padding:5px;">${l.type}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}
/* ═══════════════════════════════════════════════════════════
   🎁 MODAL DE PRÉVISUALISATION UNIFIÉE
   Référence pour toutes les sections (Commandes, Metré, etc.)
   ═══════════════════════════════════════════════════════════
   @param {string} titre      → Titre affiché en haut du modal
   @param {string} htmlBody   → Contenu HTML à afficher
   @param {Function} onExcel  → Callback appelé au clic sur "Exporter Excel"
*/
window.ouvrirModalUnifie = function(titre, htmlBody, onExcel) {
  document.getElementById('apercu-titre').textContent = titre;
  document.getElementById('apercu-body').innerHTML = htmlBody;

  const actions = document.getElementById('modal-actions');
  actions.innerHTML = `
    <button class="btn btn-primary"   id="btn-unifie-excel">📥 Exporter Excel</button>
    <button class="btn btn-secondary" id="btn-unifie-pdf">🖨️ PDF</button>
    <button class="btn btn-ghost"     id="btn-unifie-annuler">✖ Annuler</button>
  `;

  /* Exporter Excel */
  document.getElementById('btn-unifie-excel').onclick = () => {
    if (typeof onExcel === 'function') onExcel();
  };

  /* PDF : impression isolée du modal uniquement */
  document.getElementById('btn-unifie-pdf').onclick = () => {
    document.body.classList.add('printing-modal');
    setTimeout(() => {
      window.print();
      setTimeout(() => document.body.classList.remove('printing-modal'), 500);
    }, 100);
  };

  /* Annuler */
  document.getElementById('btn-unifie-annuler').onclick = () => fermerModale();

  document.getElementById('modal-apercu').classList.add('open');
};

window.apercuCommande = function(cmdId) {
  const cmd = DATA.commandes.find(c => c.id === cmdId);
  if (!cmd) { notifier('⚠️ Commande introuvable', 'danger'); return; }

  const html = genererEnteteHTML(cmd) + genererTableHTML(cmd);

  ouvrirModalUnifie(
    `Aperçu — Commande ${cmd.numero}`,
    `<div class="commande-page">${html}</div>`,
    () => exporterCommandeDirect(cmd)
  );
};

document.getElementById('btn-generer-finale').addEventListener('click', () => {
  if (DATA.commandes.length === 0) { notifier('⚠️ Aucune commande', 'danger'); return; }
  afficherModalSelection();
});

function afficherModalSelection() {
  document.getElementById('apercu-titre').textContent = 'Aperçu & Export';
  const html = `
    <div class="no-print form-row" style="margin-bottom:20px;max-width:500px;">
      <label style="font-size:14px;font-weight:600;">Choisir la commande à exporter</label>
      <select id="finale-select" style="padding:10px;font-size:14px;border-radius:6px;">
        <option value="">-- Toutes les commandes --</option>
        ${DATA.commandes.map(c =>
          `<option value="${c.id}">${c.numero} — ${c.date} (${c.lignes.length} lignes)</option>`
        ).join('')}
      </select>
    </div>
    <div id="finale-preview" class="finale-preview-zone">
      ${DATA.commandes.map((c, i) =>
        `<div class="commande-page">${genererEnteteHTML(c)}${genererTableHTML(c)}</div>`
      ).join('')}
    </div>`;
  document.getElementById('apercu-body').innerHTML = html;
  const actions = document.getElementById('modal-actions');
  actions.innerHTML = `
    <button class="btn btn-secondary" id="btn-finale-excel">📥 Excel</button>
    <button class="btn btn-primary" id="btn-finale-pdf">🖨️ PDF</button>
    <button class="btn btn-ghost" id="btn-fermer-apercu">✖ Fermer</button>`;
  document.getElementById('btn-fermer-apercu').onclick = () => fermerModale();
  document.getElementById('btn-finale-excel').onclick = () => exporterToutesCommandes();
  document.getElementById('btn-finale-pdf').onclick = () => window.print();
  document.getElementById('finale-select').onchange = (e) => {
    const cmdId = e.target.value;
    const preview = document.getElementById('finale-preview');
    if (!cmdId) {
      preview.innerHTML = DATA.commandes.map(c =>
        `<div class="commande-page">${genererEnteteHTML(c)}${genererTableHTML(c)}</div>`
      ).join('');
      return;
    }
    const cmd = DATA.commandes.find(c => c.id === cmdId);
    preview.innerHTML = `<div class="commande-page">${genererEnteteHTML(cmd)}${genererTableHTML(cmd)}</div>`;
  };
  document.getElementById('modal-apercu').classList.add('open');
}



function fermerModale() {
  document.getElementById('modal-apercu').classList.remove('open');
  document.getElementById('modal-actions').innerHTML = `
    <button class="btn btn-primary" id="btn-imprimer">🖨️ Imprimer / PDF</button>
    <button class="btn btn-ghost" id="btn-fermer-apercu">✖ Fermer</button>`;
  document.getElementById('btn-fermer-apercu').onclick = () => document.getElementById('modal-apercu').classList.remove('open');
  document.getElementById('btn-imprimer').onclick = () => window.print();
}
function exporterToutesCommandes() {
  if (DATA.commandes.length === 0) { notifier('⚠️ Aucune commande', 'danger'); return; }

  const sel = document.getElementById('finale-select');
  const selectedId = sel ? sel.value : '';
  const cmds = selectedId
    ? [DATA.commandes.find(c => c.id === selectedId)].filter(Boolean)
    : DATA.commandes;

  const pages = cmds.map(c =>
    `<div style="page-break-after:always;">${genererEnteteHTML(c)}${genererTableHTML(c)}</div>`
  ).join('');

  const doc = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head>
    <meta charset="UTF-8">
    <style>
      body { font-family: 'Times New Roman', serif; font-size: 11pt; }
      .entete-commande { padding: 8px 14px; border: 1.5px solid #1e3a8a; margin-bottom: 4px; }
      .entete-ligne-unique { display: flex; align-items: center; gap: 12px; padding-bottom: 6px; border-bottom: 1px solid #cbd5e1; margin-bottom: 6px; }
      .entete-logo { max-height: 55px; max-width: 130px; }
      .entete-titres { display: flex; flex-direction: row; gap: 14px; align-items: baseline; }
      .entete-titres .num { font-size: 14pt; font-weight: bold; color: #1e3a8a; font-family: Tahoma; }
      .entete-titres .date { font-size: 11pt; color: #334155; font-family: Tahoma; }
      .entete-infos { width: 100%; border-collapse: collapse; font-size: 10pt; margin-bottom: 4px; }
      .entete-infos td { padding: 1px 6px; vertical-align: top; border: none; }
      .entete-etat { text-align: center; font-weight: bold; color: #1e3a8a; padding-top: 4px; border-top: 1px solid #cbd5e1; }
      table.commande-export-table { border-collapse: collapse; width: 100%; font-size: 10pt; }
      table.commande-export-table th { background: #1e3a8a; color: #fff; border: 1px solid #333; padding: 5px; }
      table.commande-export-table td { border: 1px solid #333; padding: 5px; }
    </style>
  </head><body>${pages}</body></html>`;

  const blob = new Blob(['\ufeff', doc], { type: 'application/vnd.ms-excel' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const nomFichier = selectedId
    ? `${cmds[0].numero}_du_${cmds[0].date}.xls`
    : `Toutes_Commandes_${new Date().toISOString().slice(0,10)}.xls`;
  a.download = nomFichier;
  a.click();
  URL.revokeObjectURL(a.href);
  notifier(`📥 ${cmds.length} commande(s) exportée(s)`, 'success');
}
function exporterCommandeDepuisModale() {
  const sel = document.getElementById('finale-select');
  if (!sel || !sel.value) { notifier('⚠️ Sélectionnez une commande', 'danger'); return; }
  const cmd = DATA.commandes.find(c => c.id === sel.value);
  if (!cmd) return;
  exporterCommandeDirect(cmd);
}

function exporterCommandeDirect(cmd) {
  const entete = genererEnteteHTML(cmd);
  const table = genererTableHTML(cmd);
  const doc = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head>
    <meta charset="UTF-8">
    <style>
      body { font-family: 'Times New Roman', serif; font-size: 11pt; direction: ltr; }
      .entete-commande { padding: 12px; margin-bottom: 12px; border: 2px solid #1e3a8a; }
      .entete-top { display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 12px; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px; }
      .entete-top .entete-num { text-align: right; font-family: Tahoma; }
      .entete-top .entete-num .num { font-size: 14pt; font-weight: bold; color: #1e3a8a; }
      .entete-top .entete-num .date { font-size: 11pt; margin-top: 4px; }
      .entete-top .entete-logo { max-height: 70px; max-width: 200px; }
      .entete-infos { width: 100%; font-size: 10pt; margin-bottom: 12px; }
      .entete-infos td { border: none; padding: 3px; vertical-align: top; }
      .entete-etat { text-align: center; font-weight: bold; margin: 10px 0 6px; color: #1e3a8a; }
      .entete-loc { text-align: center; font-weight: bold; color: #1e3a8a; margin: 6px 0; }
    </style>
  </head><body>${entete}${table}</body></html>`;
  const blob = new Blob(['\ufeff', doc], { type: 'application/vnd.ms-excel' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${cmd.numero} du ${cmd.date}.xls`;
  a.click();
  URL.revokeObjectURL(a.href);
  notifier('📥 Fichier Excel téléchargé', 'success');
}

/* ═══════════════════════════════════════════════════════════
   EXPORT (autres sections)
   ═══════════════════════════════════════════════════════════ */
document.querySelectorAll('[data-export]').forEach(b => {
  b.addEventListener('click', () => {
    const a = b.dataset.export;
    if (a === 'apercu-catalogue') ouvrirApercu('catalogue');
    else if (a === 'apercu-commandes') ouvrirApercu('commandes');
    else if (a === 'apercu-constat') ouvrirApercu('constat');
    else if (a === 'excel-catalogue') exporterExcel('catalogue');
    else if (a === 'excel-commandes') exporterExcel('commandes');
    else if (a === 'excel-constat') exporterExcel('constat');
    else if (a === 'reset') reinitialiser();
  });
});

function ouvrirApercu(type) {
  const titres = { catalogue: 'Catalogue DE', commandes: 'Commandes', constat: 'Constat' };
  document.getElementById('apercu-titre').textContent = 'Aperçu — ' + titres[type];
  document.getElementById('apercu-body').innerHTML = htmlApercu(type);
  document.getElementById('modal-apercu').classList.add('open');
}

function htmlApercu(type) {
  if (type === 'catalogue') return tableCatalogueHTML();
  if (type === 'commandes') return tablesCommandesHTML();
  if (type === 'constat') return tableConstatHTML();
}

function tableCatalogueHTML() {
  if (DATA.catalogue.length === 0) return '<p>Aucun prix.</p>';
  let h = `<table class="table"><thead><tr>
    <th>N°</th><th>Libellé</th><th>Unité</th>
    <th>Qts INITIALES</th><th>P.U (DH)</th><th>P.T (DH)</th>
  </tr></thead><tbody>`;
  DATA.catalogue.forEach(p => {
    const pt = p.prixTotal || p.qteInitiale * p.prixUnitaire;
    h += `<tr><td>${p.numero}</td><td>${p.libelle}</td><td>${p.unite}</td>
      <td>${p.qteInitiale}</td><td>${p.prixUnitaire}</td><td>${pt}</td></tr>`;
  });
  return h + '</tbody></table>';
}

function tablesCommandesHTML() {
  if (DATA.commandes.length === 0) return '<p>Aucune commande.</p>';
  return DATA.commandes.map(c => genererEnteteHTML(c) + genererTableHTML(c))
    .join('<div style="page-break-after:always;"></div>');
}

function tableConstatHTML() {
  return '<p>Utilisez les onglets Constat TR1→TR4 ou Constat consolidé pour l\'aperçu.</p>';
}

function exporterExcel(type) {
  const html = htmlApercu(type);
  const doc = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head>
    <meta charset="UTF-8"><style>
      table { border-collapse:collapse; font-family:Tahoma; font-size:11pt; }
      th { background:#1e3a8a; color:#fff; border:1px solid #333; padding:6px; }
      td { border:1px solid #333; padding:6px; }
    </style></head><body>${html}</body></html>`;
  const blob = new Blob(['\ufeff', doc], { type:'application/vnd.ms-excel' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${type}_${new Date().toISOString().slice(0,10)}.xls`;
  a.click();
  URL.revokeObjectURL(a.href);
  notifier('📥 Excel téléchargé', 'success');
}
/* ═══════════════════════════════════════════════════════════
   EXPORT / IMPRESSION DU CONSTAT ACTUEL (TR ou CONS)
   ═══════════════════════════════════════════════════════════ */
window.exporterConstatActuelExcel = function() {
  const el = document.querySelector('#constat-content .panel');
  if (!el) { notifier('⚠️ Rien à exporter', 'danger'); return; }

  const html = el.outerHTML;
  const mois = currentMoisConstat;
  const numero = numeroConstatPourMois(mois);
  const trLabel = currentConstatTR === 'CONS' ? 'Consolide' : currentConstatTR;

  const doc = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head>
    <meta charset="UTF-8">
    <style>
      body { font-family: Tahoma, Arial, sans-serif; font-size: 11pt; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #333; padding: 4px; }
      th { background: #d9e1f2; font-weight: bold; }
      .entete-commande { padding: 12px; margin-bottom: 12px; border: 2px solid #1e3a8a; }
      .entete-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
      .entete-top .entete-num { text-align: right; }
      .entete-top .entete-num .num { font-size: 14pt; font-weight: bold; color: #1e3a8a; }
      .entete-infos { width: 100%; font-size: 10pt; border: none; }
      .entete-infos td { border: none; padding: 3px; }
      .entete-loc { text-align: center; font-weight: bold; color: #1e3a8a; }
      .metre-toolbar, .btn, button { display: none !important; }
      input { border: none; background: transparent; font-size: 10pt; width: 100%; }
    </style>
  </head><body>${html}</body></html>`;

  const blob = new Blob(['\ufeff', doc], { type: 'application/vnd.ms-excel' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Constat_N${numero}_${trLabel}_${mois}.xls`;
  a.click();
  URL.revokeObjectURL(a.href);
  notifier('📥 Excel téléchargé', 'success');
};

window.imprimerConstatActuel = function() {
  window.print();
};
/* ═══════════════════════════════════════════════════════════
   JSON
   ═══════════════════════════════════════════════════════════ */
document.getElementById('btn-export-json').onclick = () => {
  const blob = new Blob([JSON.stringify(DATA, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sauvegarde_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
};
document.getElementById('btn-import-json').onclick = () => document.getElementById('file-json').click();
/* ═══════════════════════════════════════════════════════════
   📥 IMPORT JSON — Accepte l'ancien ET le nouveau format
   ═══════════════════════════════════════════════════════════ */
document.getElementById('file-json').onchange = (e) => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = (ev) => {
    try {
      const imported = JSON.parse(ev.target.result);

      let data = null;

      /* ─── Format 1 : Ancien (avec marcheActif/marches) ─── */
      if (imported.marches) {
        console.log('📁 Format ancien détecté (avec marches)');
        const idsPossibles = [
          ID_MARCHE,                    /* M0004-24 */
          ID_MARCHE.replace('-', '/'),  /* M0004/24 */
          'M0004/24',
          'M0004-24'
        ];
        for (const id of idsPossibles) {
          if (imported.marches[id]) {
            data = imported.marches[id];
            console.log('✅ Données extraites pour :', id);
            break;
          }
        }
        if (!data) {
          console.error('❌ Marchés disponibles :', Object.keys(imported.marches));
          notifier(`❌ Marché "${ID_MARCHE}" introuvable dans ce fichier`, 'danger');
          return;
        }
      }
      /* ─── Format 2 : Direct (nouveau système) ─── */
      else if (imported.parametres || imported.catalogue || imported.commandes) {
        console.log('✅ Format direct détecté');
        data = imported;
      }
      else {
        notifier('❌ Format de fichier non reconnu', 'danger');
        return;
      }

      /* Confirmation */
      const nbCmd = data.commandes?.length || 0;
      const nbCat = data.catalogue?.length || 0;
      const nbMet = data.metresEnregistres?.length || 0;
      if (!confirm(
        `⚠️ Remplacer les données actuelles de ${ID_MARCHE} ?\n\n` +
        `Nouveau contenu :\n` +
        `   • ${nbCmd} commande(s)\n` +
        `   • ${nbCat} prix\n` +
        `   • ${nbMet} metré(s)`
      )) return;

      /* Appliquer */
      DATA = data;
      if (!DATA.parametres) DATA.parametres = getDefaultParametres();
      if (!DATA.metresEnregistres) DATA.metresEnregistres = [];
      if (!DATA.constatsEnregistres) DATA.constatsEnregistres = [];
      initMetres(DATA);
      initConstats(DATA);
      sauvegarderDonnees(true);

      /* Redessiner tout */
      rendreDashboard();
      rendreCatalogue();
      rendreListeCommandes();
      rendreHistorique();
      chargerFormParametres();
      changerMoisMetre(currentMoisMetre);
      changerMoisConstat(currentMoisConstat);
      switchMetre(currentMetreTR);
      switchConstat(currentConstatTR);

      notifier(`✅ Import réussi — ${nbCmd} commande(s)`, 'success');
      console.log('🎉 Import terminé !');

    } catch (err) {
      console.error(err);
      notifier('❌ ' + err.message, 'danger');
    }
  };
  r.readAsText(f);
  e.target.value = '';
};
document.getElementById('btn-sauvegarder').onclick = () => sauvegarderDonnees();

function reinitialiser() {
  if (!confirm('⚠️ Effacer TOUTES les données du marché actif ?')) return;
  if (!confirm('Confirmer une seconde fois ?')) return;
  const id = DATA.marcheActif;
  DATA.marches[id] = {};
  initStructureMarche(DATA.marches[id]);
  Object.assign(DATA, DATA.marches[id]);
  sauvegarderDonnees(true);
  rafraichirTout();
  notifier('🗑️ Marché réinitialisé', 'success');
}

/* ═══════════════════════════════════════════════════════════
   💰 SUIVI DES PRIX — Version PÉRIODE (Du → Au)
   ═══════════════════════════════════════════════════════════ */
let currentSuiviDebut = new Date().toISOString().slice(0,7);
let currentSuiviFin   = new Date().toISOString().slice(0,7);

/* Numérotation basée sur la période (moisDebut_moisFin) */
function numeroSuiviPourPeriode(moisDebut, moisFin) {
  if (!moisDebut) return 1;
  const fin = moisFin || moisDebut;
  const key = `${moisDebut}_${fin}`;
  const list = [...new Set(DATA.suivisPrix.map(s => {
    const d = s.moisDebut || s.mois;
    const f = s.moisFin || s.mois;
    return `${d}_${f}`;
  }))];
  if (!list.includes(key)) list.push(key);
  list.sort();
  return list.indexOf(key) + 1;
}
/* Quantité d'un prix pour un TR donné, tirée des Metrés archivés du mois
   (utilisée par le module Équipements) */
function getQtePrixPourTR(mois, prix, tr) {
  let t = 0;
  DATA.metresEnregistres.forEach(m => {
    if (m.mois !== mois || m.troncon !== tr) return;
    Object.values(m.entrees || {}).forEach(row => {
      t += parseFloat(row[prix]) || 0;
    });
  });
  return t;
}

/* Quantité d'un prix pour un TR sur une PÉRIODE */
function getQtePrixPourTRPeriode(moisDebut, moisFin, prix, tr) {
  if (!moisDebut) return 0;
  const fin = moisFin || moisDebut;
  let t = 0;
  DATA.metresEnregistres.forEach(m => {
    if (!m.mois || m.mois < moisDebut || m.mois > fin) return;
    if (m.troncon !== tr) return;
    Object.values(m.entrees || {}).forEach(row => {
      t += parseFloat(row[prix]) || 0;
    });
  });
  return t;
}

/* ─── Changement de période ─── */
window.changerPeriodeSuivi = function() {
  const d = getMonthPickerValue('suivi-debut');
  const f = getMonthPickerValue('suivi-fin');
  if (!d || !f) return;
  if (f < d) { notifier('⚠️ La date de fin doit être ≥ au début', 'danger'); return; }
  currentSuiviDebut = d;
  currentSuiviFin = f;
  rendreSuiviPrix();
  rendreSuivisEnregistres();
};

/* ─── SWITCH TAB ─── */
window.switchSuivi = function() {
  rendreSuiviPrix();
  rendreSuivisEnregistres();
};

/* ─── RENDU PRINCIPAL ─── */
window.rendreSuiviPrix = function() {
  const cont = document.getElementById('suivi-content');
  if (!cont) return;
  const moisDebut = currentSuiviDebut;
  const moisFin   = currentSuiviFin;
  const numero    = numeroSuiviPourPeriode(moisDebut, moisFin);
  const periodeTxt = moisDebut === moisFin
    ? formatMoisFR(moisDebut)
    : `${formatMoisFR(moisDebut)} → ${formatMoisFR(moisFin)}`;
    const estMoisUnique = (moisDebut === moisFin);

   /* ─── Toolbar ─── */
  const toolbar = `
    <div class="metre-toolbar" style="background:#f0fdf4;padding:12px 16px;border-radius:8px;
         margin-bottom:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;
         border:2px solid #86efac;">
      <label style="font-weight:700;color:#15803d;">📅 Du :</label>
      ${htmlMonthPicker('suivi-debut', moisDebut, 'changerPeriodeSuivi')}
      <label style="font-weight:700;color:#15803d;">Au :</label>
      ${htmlMonthPicker('suivi-fin', moisFin, 'changerPeriodeSuivi')}
      <span style="font-weight:700;color:#15803d;font-size:13px;">${periodeTxt}</span>
      ${estMoisUnique
        ? `<span style="background:#15803d;color:#fff;padding:5px 14px;border-radius:12px;
                        font-weight:700;font-size:13px;">Suivi N°${numero}</span>`
        : `<span style="background:#f59e0b;color:#fff;padding:5px 14px;border-radius:12px;
                        font-weight:700;font-size:12px;">
             ⚠️ Période de plusieurs mois — aperçu seulement
           </span>`}
      <button class="btn btn-secondary btn-sm" onclick="apercuSuivi()"
              style="margin-left:auto;">👁️ Aperçu</button>
      ${estMoisUnique
        ? `<button class="btn btn-primary btn-sm" onclick="sauvegarderSuiviPeriode()">
             💾 Enregistrer ce Suivi
           </button>`
        : ``}
    </div>
  `;

  if (DATA.catalogue.length === 0) {
    cont.innerHTML = toolbar + `
      <div class="panel">
        <p style="text-align:center;padding:30px;color:#64748b;">
          Aucun prix dans le catalogue.<br>
          Importez d'abord le fichier <strong>DE.xlsx</strong> dans l'onglet 📚 Catalogue.
        </p>
      </div>`;
    return;
  }

  /* ─── Calcul des lignes ─── */
  let totalGeneral = 0;
  const lignes = DATA.catalogue.map(p => {
    const q1 = getQtePrixPourTRPeriode(moisDebut, moisFin, p.numero, 'TR1');
    const q2 = getQtePrixPourTRPeriode(moisDebut, moisFin, p.numero, 'TR2');
    const q3 = getQtePrixPourTRPeriode(moisDebut, moisFin, p.numero, 'TR3');
    const q4 = getQtePrixPourTRPeriode(moisDebut, moisFin, p.numero, 'TR4');
    const total = q1 + q2 + q3 + q4;
    const prixTotal = total * (p.prixUnitaire || 0);
    totalGeneral += prixTotal;
    return { p, q1, q2, q3, q4, total, prixTotal };
  });

  const filtered = lignes.filter(l => l.total > 0);

  if (filtered.length === 0) {
    cont.innerHTML = toolbar + `
      <div class="panel">
        <p style="text-align:center;padding:30px;color:#64748b;">
          Aucune quantité sur <strong>${periodeTxt}</strong>.<br>
          <span style="font-size:12px;">Enregistrez d'abord des Metrés pour cette période.</span>
        </p>
      </div>`;
    return;
  }

  /* ─── Tableau ─── */
  const html = toolbar + `
    <div class="panel">
      <div style="overflow-x:auto;">
        <table class="constat-table" style="font-size:12px;">
          <thead>
            <tr>
              <th style="width:55px;">N° Prix</th>
              <th>Libellé des prix</th>
              <th style="width:60px;">Unité</th>
              <th style="width:90px;">Qts INITIALES</th>
              <th style="width:90px;">P.U en DHs</th>
              <th style="width:110px;">P.T en DHs</th>
              <th style="width:80px;background:#1e3a8a;">TR1</th>
              <th style="width:80px;background:#1e3a8a;">TR2</th>
              <th style="width:80px;background:#1e3a8a;">TR3</th>
              <th style="width:80px;background:#1e3a8a;">TR4</th>
              <th style="width:130px;background:#15803d;">Prix Total</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(l => `
              <tr>
                <td style="text-align:center;font-weight:700;">${l.p.numero}</td>
                <td style="font-size:11px;">${l.p.libelle}</td>
                <td style="text-align:center;">${l.p.unite}</td>
                <td class="num">${(l.p.qteInitiale || 0).toLocaleString('fr-FR')}</td>
                <td class="num">${(l.p.prixUnitaire || 0).toLocaleString('fr-FR', {minimumFractionDigits:2})}</td>
                <td class="num">${(l.p.prixTotal || (l.p.qteInitiale * l.p.prixUnitaire) || 0).toLocaleString('fr-FR', {minimumFractionDigits:2})}</td>
                <td class="num" style="background:#eff6ff;">${l.q1 ? l.q1.toLocaleString('fr-FR', {minimumFractionDigits:2}) : '-'}</td>
                <td class="num" style="background:#eff6ff;">${l.q2 ? l.q2.toLocaleString('fr-FR', {minimumFractionDigits:2}) : '-'}</td>
                <td class="num" style="background:#eff6ff;">${l.q3 ? l.q3.toLocaleString('fr-FR', {minimumFractionDigits:2}) : '-'}</td>
                <td class="num" style="background:#eff6ff;">${l.q4 ? l.q4.toLocaleString('fr-FR', {minimumFractionDigits:2}) : '-'}</td>
                <td class="num" style="background:#dcfce7;font-weight:700;color:#15803d;">
                  ${l.prixTotal.toLocaleString('fr-FR', {minimumFractionDigits:2})}
                </td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="10" style="text-align:right;">TOTAL GÉNÉRAL (DH)</td>
              <td class="num" style="font-size:13px;color:#fbbf24;">
                ${totalGeneral.toLocaleString('fr-FR', {minimumFractionDigits:2})}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;
  cont.innerHTML = html;
};

/* ─── SAUVEGARDER ─── */
window.sauvegarderSuiviPeriode = function() {
  const moisDebut = currentSuiviDebut;
  const moisFin   = currentSuiviFin;
  if (!moisDebut || !moisFin) { notifier('⚠️ Sélectionnez une période', 'danger'); return; }
   /* 🛡️ Protection : enregistrement uniquement pour UN SEUL mois */
  if (moisDebut !== moisFin) {
    notifier('⚠️ Enregistrement possible uniquement pour un seul mois', 'danger');
    return;
  }

  const lignes = {};
  let nb = 0;
  DATA.catalogue.forEach(p => {
    const q1 = getQtePrixPourTRPeriode(moisDebut, moisFin, p.numero, 'TR1');
    const q2 = getQtePrixPourTRPeriode(moisDebut, moisFin, p.numero, 'TR2');
    const q3 = getQtePrixPourTRPeriode(moisDebut, moisFin, p.numero, 'TR3');
    const q4 = getQtePrixPourTRPeriode(moisDebut, moisFin, p.numero, 'TR4');
    const total = q1 + q2 + q3 + q4;
    if (total > 0) {
      lignes[p.numero] = { TR1: q1, TR2: q2, TR3: q3, TR4: q4 };
      nb++;
    }
  });

  const periodeTxt = moisDebut === moisFin
    ? formatMoisFR(moisDebut)
    : `${formatMoisFR(moisDebut)} → ${formatMoisFR(moisFin)}`;

  if (nb === 0) {
    if (!confirm(`Aucune quantité sur ${periodeTxt}. Enregistrer quand même ce Suivi vide ?`)) return;
  }

  const numero = numeroSuiviPourPeriode(moisDebut, moisFin);
  const dateReference = getFinDeMois(moisFin);

  let existing = DATA.suivisPrix.find(s => {
    const d = s.moisDebut || s.mois;
    const f = s.moisFin || s.mois;
    return d === moisDebut && f === moisFin;
  });

  if (existing) {
    existing.lignes = lignes;
    existing.moisDebut = moisDebut;
    existing.moisFin = moisFin;
    existing.dateReference = dateReference;
    existing.updatedAt = new Date().toISOString();
    delete existing.mois;    /* nettoyer l'ancien format */
    notifier(`💾 Suivi N°${numero} mis à jour (${nb} prix)`, 'success');
  } else {
    DATA.suivisPrix.push({
      id: uid(),
      numero,
      moisDebut, moisFin,
      dateReference, lignes,
      createdAt: new Date().toISOString()
    });
    notifier(`💾 Suivi N°${numero} enregistré (${nb} prix)`, 'success');
  }

  logHistorique('SAUVEGARDE SUIVI PRIX', `N°${numero} — ${periodeTxt} — ${nb} prix`);
  sauvegarderDonnees(true);
  rendreSuivisEnregistres();
};

/* ─── LISTE DES SUIVIS ENREGISTRÉS ─── */
window.rendreSuivisEnregistres = function() {
  const cont = document.getElementById('liste-suivis-accordion');
  if (!cont) return;

  /* Remplir le filtre avec les périodes enregistrées */
  const sel = document.getElementById('filtre-suivi-mois');
  if (sel) {
    const cur = sel.value;
    const periodes = [...new Set(DATA.suivisPrix.map(s => {
      const d = s.moisDebut || s.mois;
      const f = s.moisFin || s.mois;
      return `${d}|${f}`;
    }))];
    sel.innerHTML = '<option value="">Toutes les périodes</option>' +
      periodes.map(p => {
        const [d, f] = p.split('|');
        const label = d === f ? formatMoisFR(d) : `${formatMoisFR(d)} → ${formatMoisFR(f)}`;
        return `<option value="${p}">${label}</option>`;
      }).join('');
    sel.value = cur;
  }

  const filtre = sel?.value || '';
  const rech = (document.getElementById('filtre-suivi-recherche')?.value || '').toLowerCase();

  let list = DATA.suivisPrix.map(s => ({
    ...s,
    _moisDebut: s.moisDebut || s.mois,
    _moisFin: s.moisFin || s.mois,
    _numero: numeroSuiviPourPeriode(s.moisDebut || s.mois, s.moisFin || s.mois)
  }));

  if (filtre) {
    const [d, f] = filtre.split('|');
    list = list.filter(s => s._moisDebut === d && s._moisFin === f);
  }
  if (rech) {
    list = list.filter(s =>
      [String(s._numero), formatMoisFR(s._moisDebut), formatMoisFR(s._moisFin), s.dateReference]
        .join(' ').toLowerCase().includes(rech));
  }

  list.sort((a, b) => b._numero - a._numero);

  if (list.length === 0) {
    cont.innerHTML = '<p style="text-align:center;padding:20px;color:#64748b;">Aucun Suivi enregistré.</p>';
    return;
  }

  cont.innerHTML = list.map(s => {
    let total = 0, nb = 0;
    if (s.lignes) {
      Object.entries(s.lignes).forEach(([p, q]) => {
        const cat = DATA.catalogue.find(x => x.numero === parseInt(p));
        const pu = cat ? (cat.prixUnitaire || 0) : 0;
        const somme = (q.TR1 || 0) + (q.TR2 || 0) + (q.TR3 || 0) + (q.TR4 || 0);
        if (somme > 0) { total += somme * pu; nb++; }
      });
    }

    const periodeTxt = s._moisDebut === s._moisFin
      ? formatMoisFR(s._moisDebut)
      : `${formatMoisFR(s._moisDebut)} → ${formatMoisFR(s._moisFin)}`;

    return `
      <div class="cmd-item">
        <div class="cmd-item-header">
          <div class="cmd-item-title">
            <strong>Suivi N°${s._numero}</strong>
            <span style="background:#15803d;color:#fff;padding:2px 10px;border-radius:10px;font-size:11px;font-weight:600;">
              💰 Suivi des Prix
            </span>
            <span>📅 ${periodeTxt}</span>
            <span class="badge badge-tr1">${nb} prix</span>
            <span style="color:#15803d;font-weight:700;">
              Total : ${total.toLocaleString('fr-FR', {minimumFractionDigits:2})} DH
            </span>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="btn-icon" title="Charger"
                    onclick="chargerSuiviPeriode('${s.id}')">📂</button>
            <button class="btn-icon danger" title="Supprimer"
                    onclick="supprimerSuiviPeriode('${s.id}')">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
};

/* ─── Charger un Suivi ─── */
window.chargerSuiviPeriode = function(id) {
  const s = DATA.suivisPrix.find(x => x.id === id);
  if (!s) return;
  currentSuiviDebut = s.moisDebut || s.mois;
  currentSuiviFin = s.moisFin || s.mois;
  rendreSuiviPrix();
  rendreSuivisEnregistres();
  const label = currentSuiviDebut === currentSuiviFin
    ? formatMoisFR(currentSuiviDebut)
    : `${formatMoisFR(currentSuiviDebut)} → ${formatMoisFR(currentSuiviFin)}`;
  notifier(`📂 Suivi ${label} chargé`, 'success');
};

/* ─── Supprimer un Suivi ─── */
window.supprimerSuiviPeriode = function(id) {
  const s = DATA.suivisPrix.find(x => x.id === id);
  if (!s) return;
  const d = s.moisDebut || s.mois;
  const f = s.moisFin || s.mois;
  const numero = numeroSuiviPourPeriode(d, f);
  const label = d === f ? formatMoisFR(d) : `${formatMoisFR(d)} → ${formatMoisFR(f)}`;
  if (!confirm(`Supprimer Suivi N°${numero} (${label}) ?`)) return;
  DATA.suivisPrix = DATA.suivisPrix.filter(x => x.id !== id);
  logHistorique('SUPPRESSION SUIVI PRIX', `N°${numero} — ${label}`);
  sauvegarderDonnees(true);
  rendreSuivisEnregistres();
  notifier('🗑️ Suivi supprimé', 'success');
};

/* ─── 👁️ APERÇU SUIVI (modal unifié) ─── */
window.apercuSuivi = function() {
  const moisDebut = currentSuiviDebut;
  const moisFin   = currentSuiviFin;
  const numero = numeroSuiviPourPeriode(moisDebut, moisFin);
  const periodeTxt = moisDebut === moisFin
    ? formatMoisFR(moisDebut)
    : `${formatMoisFR(moisDebut)} → ${formatMoisFR(moisFin)}`;

  /* Construire les lignes */
  let totalGeneral = 0;
  const lignes = [];
  DATA.catalogue.forEach(p => {
    const q1 = getQtePrixPourTRPeriode(moisDebut, moisFin, p.numero, 'TR1');
    const q2 = getQtePrixPourTRPeriode(moisDebut, moisFin, p.numero, 'TR2');
    const q3 = getQtePrixPourTRPeriode(moisDebut, moisFin, p.numero, 'TR3');
    const q4 = getQtePrixPourTRPeriode(moisDebut, moisFin, p.numero, 'TR4');
    const total = q1 + q2 + q3 + q4;
    if (total > 0) {
      const prixTotal = total * (p.prixUnitaire || 0);
      totalGeneral += prixTotal;
      lignes.push({ p, q1, q2, q3, q4, total, prixTotal });
    }
  });

  if (lignes.length === 0) {
    notifier('⚠️ Aucune quantité sur cette période', 'danger');
    return;
  }

  /* Entête (style Metré) */
  const entete = `
    <div class="metre-entete-print">
      <div class="entete-ligne-unique">
        ${DATA.parametres.logo ? `<img src="${DATA.parametres.logo}" class="entete-logo" alt="Logo">` : ''}
        <div class="entete-titres">
          <span class="num">SUIVI DES PRIX N° ${numero}</span>
          <span class="date">${periodeTxt}</span>
        </div>
      </div>
      <table class="entete-infos">
        <tr>
          <td><span class="lbl">MAITRE D'OUVRAGE :</span> ${DATA.parametres.mo || ''}</td>
          <td><span class="lbl">MARCHE N° :</span> ${DATA.parametres.marche || ''}</td>
        </tr>
        <tr>
          <td><span class="lbl">MAITRE D'ŒUVRE :</span> ${DATA.parametres.moe || ''}</td>
          <td><span class="lbl">Objet :</span> ${DATA.parametres.objet || ''}</td>
        </tr>
        <tr>
          <td><span class="lbl">Période :</span> ${periodeTxt}</td>
          <td><span class="lbl">PRESTATAIRE :</span> ${DATA.parametres.prestataire || ''}</td>
        </tr>
      </table>
    </div>
  `;

  const fmt = v => v.toLocaleString('fr-FR', {minimumFractionDigits:2});

  /* Tableau */
  const table = `
    <table class="constat-table-print">
      <thead>
        <tr>
          <th style="width:45px;">N°</th>
          <th>Libellé des prix</th>
          <th style="width:42px;">Unité</th>
          <th style="width:65px;">Qts INIT</th>
          <th style="width:68px;">P.U (DH)</th>
          <th style="width:80px;">P.T (DH)</th>
          <th style="width:60px;background:#1e3a8a;">TR1</th>
          <th style="width:60px;background:#1e3a8a;">TR2</th>
          <th style="width:60px;background:#1e3a8a;">TR3</th>
          <th style="width:60px;background:#1e3a8a;">TR4</th>
          <th style="width:95px;background:#15803d;">Prix Total</th>
        </tr>
      </thead>
      <tbody>
        ${lignes.map(l => `
          <tr>
            <td style="text-align:center;font-weight:700;">${l.p.numero}</td>
            <td style="font-size:9px;">${l.p.libelle}</td>
            <td style="text-align:center;">${l.p.unite}</td>
            <td style="text-align:right;">${(l.p.qteInitiale||0).toLocaleString('fr-FR')}</td>
            <td style="text-align:right;">${(l.p.prixUnitaire||0).toLocaleString('fr-FR', {minimumFractionDigits:2})}</td>
            <td style="text-align:right;">${((l.p.prixTotal || l.p.qteInitiale * l.p.prixUnitaire)||0).toLocaleString('fr-FR', {minimumFractionDigits:2})}</td>
            <td style="text-align:right;">${l.q1 ? fmt(l.q1) : '-'}</td>
            <td style="text-align:right;">${l.q2 ? fmt(l.q2) : '-'}</td>
            <td style="text-align:right;">${l.q3 ? fmt(l.q3) : '-'}</td>
            <td style="text-align:right;">${l.q4 ? fmt(l.q4) : '-'}</td>
            <td style="text-align:right;font-weight:700;">${fmt(l.prixTotal)}</td>
          </tr>
        `).join('')}
      </tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="10" style="text-align:right;">TOTAL GÉNÉRAL (DH)</td>
          <td style="text-align:right;font-size:10px;">${fmt(totalGeneral)}</td>
        </tr>
      </tfoot>
    </table>
  `;

  const body = `
    <div class="metre-page-print">
      <div class="metre-entete-wrap">${entete}</div>
      <div class="metre-table-wrap">${table}</div>
    </div>
  `;

  ouvrirModalUnifie(
    `Aperçu — Suivi N°${numero}`,
    body,
    () => exporterSuiviPeriodeExcel()
  );
};

/* ─── EXPORT EXCEL ─── */
window.exporterSuiviPeriodeExcel = function() {
  const moisDebut = currentSuiviDebut;
  const moisFin   = currentSuiviFin;
  const numero = numeroSuiviPourPeriode(moisDebut, moisFin);
  const periodeTxt = moisDebut === moisFin
    ? formatMoisFR(moisDebut)
    : `${formatMoisFR(moisDebut)} → ${formatMoisFR(moisFin)}`;

  let totalGeneral = 0;
  const lignes = [];
  DATA.catalogue.forEach(p => {
    const q1 = getQtePrixPourTRPeriode(moisDebut, moisFin, p.numero, 'TR1');
    const q2 = getQtePrixPourTRPeriode(moisDebut, moisFin, p.numero, 'TR2');
    const q3 = getQtePrixPourTRPeriode(moisDebut, moisFin, p.numero, 'TR3');
    const q4 = getQtePrixPourTRPeriode(moisDebut, moisFin, p.numero, 'TR4');
    const total = q1 + q2 + q3 + q4;
    if (total > 0) {
      const pt = total * (p.prixUnitaire || 0);
      totalGeneral += pt;
      lignes.push({ p, q1, q2, q3, q4, total, pt });
    }
  });

  let html = `<h2>Suivi des Prix N°${numero} — ${periodeTxt}</h2>`;
  html += '<table border="1" style="border-collapse:collapse;font-family:Tahoma;font-size:9pt;width:100%;">';
  html += '<tr style="background:#1e3a8a;color:#fff;">';
  html += '<th>N°</th><th>Libellé</th><th>Unité</th><th>Qts INIT</th><th>P.U</th><th>P.T</th>';
  html += '<th>TR1</th><th>TR2</th><th>TR3</th><th>TR4</th><th>Total</th></tr>';
  lignes.forEach(l => {
    html += `<tr>
      <td>${l.p.numero}</td><td>${l.p.libelle}</td><td>${l.p.unite}</td>
      <td style="text-align:right;">${(l.p.qteInitiale||0)}</td>
      <td style="text-align:right;">${(l.p.prixUnitaire||0).toFixed(2)}</td>
      <td style="text-align:right;">${((l.p.prixTotal || l.p.qteInitiale * l.p.prixUnitaire)||0).toFixed(2)}</td>
      <td style="text-align:right;">${l.q1 ? l.q1.toFixed(2) : ''}</td>
      <td style="text-align:right;">${l.q2 ? l.q2.toFixed(2) : ''}</td>
      <td style="text-align:right;">${l.q3 ? l.q3.toFixed(2) : ''}</td>
      <td style="text-align:right;">${l.q4 ? l.q4.toFixed(2) : ''}</td>
      <td style="text-align:right;font-weight:700;">${l.pt.toFixed(2)}</td>
    </tr>`;
  });
  html += `<tr style="background:#15803d;color:#fff;font-weight:700;">
    <td colspan="10" style="text-align:right;">TOTAL GÉNÉRAL (DH)</td>
    <td style="text-align:right;">${totalGeneral.toFixed(2)}</td></tr>`;
  html += '</table>';

  const doc = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body>${html}</body></html>`;
  const blob = new Blob(['\ufeff', doc], { type: 'application/vnd.ms-excel' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Suivi_Prix_N${numero}_${moisDebut}_${moisFin}.xls`;
  a.click();
  URL.revokeObjectURL(a.href);
  notifier('📥 Excel téléchargé', 'success');
};

/* ─── Ajouter un Suivi manuellement ─── */
window.ajouterSuiviManuel = function() {
  const debut = prompt('Mois de début (YYYY-MM) :', new Date().toISOString().slice(0,7));
  if (!debut || !/^\d{4}-\d{2}$/.test(debut)) { notifier('⚠️ Format invalide (ex: 2026-09)', 'danger'); return; }
  const fin = prompt('Mois de fin (YYYY-MM) :', debut);
  if (!fin || !/^\d{4}-\d{2}$/.test(fin)) { notifier('⚠️ Format invalide', 'danger'); return; }
  if (fin < debut) { notifier('⚠️ Le mois de fin doit être ≥ début', 'danger'); return; }

  const exists = DATA.suivisPrix.find(s => {
    const d = s.moisDebut || s.mois;
    const f = s.moisFin || s.mois;
    return d === debut && f === fin;
  });
  if (exists) { notifier('⚠️ Ce Suivi existe déjà', 'danger'); return; }

  const numero = numeroSuiviPourPeriode(debut, fin);
  DATA.suivisPrix.push({
    id: uid(),
    numero,
    moisDebut: debut, moisFin: fin,
    dateReference: getFinDeMois(fin),
    lignes: {},
    createdAt: new Date().toISOString(),
    _manuel: true
  });
  logHistorique('CRÉATION SUIVI MANUEL', `N°${numero} — ${formatMoisFR(debut)} → ${formatMoisFR(fin)}`);
  sauvegarderDonnees(true);
  rendreSuivisEnregistres();
  notifier(`➕ Suivi N°${numero} ajouté`, 'success');
};

/* ═══════════════════════════════════════════════════════════
   🚨 SUIVI DES SINISTRES
   ═══════════════════════════════════════════════════════════ */
/* PHOTOS : maintenant stockées dans DATA.photoSinistres (base64, persistantes) */
let currentSinistreSubTab = 'sin-sinistres';
let currentMoisEtatSinistre = new Date().toISOString().slice(0,7);

/* ═══ SWITCH SUB-TABS ═══ */
window.switchSinistre = function(sub) {
  currentSinistreSubTab = sub;
  document.querySelectorAll('#subtabs-sinistres .sub-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.subtab === sub);
  });

  /* ✅ Liste complète avec 'sin-factures' */
  ['sin-sinistres','sin-photos','sin-gard','sin-etat','sin-factures'].forEach(s => {
    const el = document.getElementById('sin-content-' + s.replace('sin-',''));
    if (el) el.style.display = (s === sub) ? 'block' : 'none';
  });

  if (sub === 'sin-sinistres') rendreSinistresListe();
  if (sub === 'sin-photos')    { majSelectDatePhotos(); rendrePhotos(); }
  if (sub === 'sin-gard')      majSelectPageGarde();
  if (sub === 'sin-etat')      { initWorkingEtatIfNeeded(); rendreEtatSinistres(); rendreEtatsSinistresEnregistres(); }
  if (sub === 'sin-factures')  { initFactureIfNeeded(); rendreFacture(); rendreFacturesEnregistrees(); }
};

/* ═══════════════════════════════════════════════════════════
   🔍 EXTRACTION AUTOMATIQUE DES SINISTRES DEPUIS LES COMMANDES
   ═══════════════════════════════════════════════════════════ */
/* ═══ Normalise une date de n'importe quel format vers DD/MM/YYYY ═══ */
function normaliserDate(obs) {
  if (!obs) return '';
  const s = String(obs).trim();

  /* 1) ISO : 2025-10-03 ou 2025-10-03 00:00:00 */
  let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const [, yyyy, mm, dd] = m;
    return `${dd.padStart(2,'0')}/${mm.padStart(2,'0')}/${yyyy}`;
  }

  /* 2) FR / autres : 03/10/2025, 3/10/25, 03-10-2025, 03.10.2025 */
  m = s.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (m) {
    let [, dd, mm, yyyy] = m;
    if (yyyy.length === 2) {
      /* 25 → 2025, 99 → 1999 */
      yyyy = parseInt(yyyy, 10) < 50 ? '20' + yyyy : '19' + yyyy;
    }
    /* Sécurité : si dd > 12 et mm <= 12, ok. Si mm > 12, inverse. */
    let d = parseInt(dd, 10), mo = parseInt(mm, 10);
    if (mo > 12 && d <= 12) { [dd, mm] = [mm, dd]; }
    return `${dd.padStart(2,'0')}/${mm.padStart(2,'0')}/${yyyy}`;
  }

  return '';
}

/* Extrait YYYY-MM d'une date FR (DD/MM/YYYY) */
function moisDeDate(dateFR) {
  const parts = (dateFR || '').split('/');
  if (parts.length !== 3) return '';
  return `${parts[2]}-${parts[1]}`;
}

function extraireSinistres() {
  const rows = [];
  DATA.commandes.forEach(c => {
    c.lignes.forEach(l => {
      const obs = l.observations || '';
      const dateTrouvee = normaliserDate(obs);
      if (!dateTrouvee) return;

      rows.push({
        /* ✅ Identifiants uniques (plus de déduplication) */
        cmdId: c.id,
        ligneId: l.id,
        cmdNumero: c.numero,
        /* Champs affichés */
        troncon: l.troncon || '',
        pk: l.pk,
        sens: l.sens || '',
        cote: l.cote || '',
        designation: l.designation || '',
        observations: obs,
        date: dateTrouvee
      });
    });
  });
  /* Trier par date décroissante, puis par PK */
  rows.sort((a, b) => {
    const [da, ma, ya] = a.date.split('/');
    const [db, mb, yb] = b.date.split('/');
    const cmpDate = `${yb}${mb}${db}`.localeCompare(`${ya}${ma}${da}`);
    if (cmpDate !== 0) return cmpDate;
    return String(a.pk).localeCompare(String(b.pk));
  });
  return rows;
}

/* ═══ RENDU LISTE SINISTRES ═══ */
window.rendreSinistresListe = function() {
  const tbody = document.getElementById('tbody-sinistres');
  const count = document.getElementById('sin-count');
  if (!tbody) return;

  const filtreTR = document.getElementById('sin-filtre-troncon')?.value || '';
  const rech = (document.getElementById('sin-filtre-recherche')?.value || '').toLowerCase();

  let list = extraireSinistres();
  if (filtreTR) list = list.filter(s => s.troncon === filtreTR);
  if (rech) {
    list = list.filter(s =>
      [s.pk, s.sens, s.cote, s.designation, s.observations, s.date]
        .join(' ').toLowerCase().includes(rech));
  }

  if (count) count.textContent = `${list.length} sinistre(s)`;

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#64748b;">Aucun sinistre trouvé (recherche de dates dans les Observations).</td></tr>';
    return;
  }

   tbody.innerHTML = list.map(s => `
    <tr>
      <td><span class="badge-tr badge-tr${(s.troncon||'TR1')[2]}">${s.troncon}</span></td>
      <td style="font-family:Consolas,monospace;font-weight:600;">${s.pk}</td>
      <td>${s.sens}</td>
      <td>${s.cote}</td>
      <td style="font-size:11px;">${s.designation}</td>
      <td style="font-weight:700;color:#dc2626;text-align:center;">${s.date}</td>
      <td style="font-size:10px;color:#64748b;text-align:center;">${s.cmdNumero || ''}</td>
    </tr>
  `).join('');
};

/* 📥 Aperçu avant export — État des sinistres (liste extraite) */
window.exportSinistresExcel = function() {
  /* Récupérer la même liste que celle affichée (avec filtres) */
  const filtreTR = document.getElementById('sin-filtre-troncon')?.value || '';
  const rech = (document.getElementById('sin-filtre-recherche')?.value || '').toLowerCase();

  let list = extraireSinistres();
  if (filtreTR) list = list.filter(s => s.troncon === filtreTR);
  if (rech) {
    list = list.filter(s =>
      [s.pk, s.sens, s.cote, s.designation, s.observations, s.date]
        .join(' ').toLowerCase().includes(rech));
  }

  if (list.length === 0) {
    notifier('⚠️ Aucun sinistre à exporter', 'danger');
    return;
  }

  /* ═══ Construire le tableau pur ═══ */
  const html = `
    <div style="padding:10px;background:#fff;">
      <h3 style="text-align:center;margin:0 0 16px;color:#dc2626;font-size:16px;">
        🚨 Liste des sinistres
        ${filtreTR ? `— ${filtreTR}` : ''}
        ${rech ? `— filtre: "${rech}"` : ''}
        <br><span style="font-size:12px;color:#64748b;">${list.length} sinistre(s)</span>
      </h3>
      <table style="width:100%;border-collapse:collapse;font-size:11px;font-family:Tahoma,Arial,sans-serif;">
        <thead>
          <tr>
            <th style="border:1px solid #333;padding:6px;background:#d9e1f2;font-weight:700;">Tronçon</th>
            <th style="border:1px solid #333;padding:6px;background:#d9e1f2;font-weight:700;">PK</th>
            <th style="border:1px solid #333;padding:6px;background:#d9e1f2;font-weight:700;">Sens</th>
            <th style="border:1px solid #333;padding:6px;background:#d9e1f2;font-weight:700;">Côté</th>
            <th style="border:1px solid #333;padding:6px;background:#d9e1f2;font-weight:700;">Dégats infrastructure</th>
            <th style="border:1px solid #333;padding:6px;background:#d9e1f2;font-weight:700;">Date du sinistre</th>
            <th style="border:1px solid #333;padding:6px;background:#d9e1f2;font-weight:700;">Commande</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(s => `
              <tr>
                <td style="border:1px solid #333;padding:5px;text-align:center;">${s.troncon}</td>
                <td style="border:1px solid #333;padding:5px;text-align:center;font-family:Consolas,monospace;">${s.pk}</td>
                <td style="border:1px solid #333;padding:5px;text-align:center;">${s.sens}</td>
                <td style="border:1px solid #333;padding:5px;text-align:center;">${s.cote}</td>
                <td style="border:1px solid #333;padding:5px;">${(s.designation||'').replace(/</g,'&lt;')}</td>
                <td style="border:1px solid #333;padding:5px;text-align:center;font-weight:700;color:#dc2626;">${s.date}</td>
                <td style="border:1px solid #333;padding:5px;text-align:center;font-size:10px;color:#64748b;">${s.cmdNumero || ''}</td>
              </tr>
            `).join('')}
        </tbody>
      </table>
    </div>
  `;

  /* ═══ Utiliser la modale existante ═══ */
  document.getElementById('apercu-titre').textContent = 'Aperçu — Liste des sinistres';
  document.getElementById('apercu-body').innerHTML = html;

  const actions = document.getElementById('modal-actions');
  actions.innerHTML = `
    <button class="btn btn-primary" id="btn-confirm-export-sinistres">📥 Exporter Excel</button>
    <button class="btn btn-ghost" id="btn-cancel-export-sinistres">✖ Annuler</button>
  `;
  document.getElementById('btn-confirm-export-sinistres').onclick = () => confirmerExportSinistresExcel();
  document.getElementById('btn-cancel-export-sinistres').onclick = () => fermerModale();

  document.getElementById('modal-apercu').classList.add('open');
};

/* 📥 Téléchargement après confirmation */
window.confirmerExportSinistresExcel = function() {
  const filtreTR = document.getElementById('sin-filtre-troncon')?.value || '';
  const rech = (document.getElementById('sin-filtre-recherche')?.value || '').toLowerCase();

  let list = extraireSinistres();
  if (filtreTR) list = list.filter(s => s.troncon === filtreTR);
  if (rech) {
    list = list.filter(s =>
      [s.pk, s.sens, s.cote, s.designation, s.observations, s.date]
        .join(' ').toLowerCase().includes(rech));
  }

  let html = '<table border="1" style="border-collapse:collapse;font-family:Tahoma;font-size:11pt;">';
  html += '<tr style="background:#d9e1f2;">';
  ['Tronçon','PK','Sens','Côté','Dégats infrastructure','Date du sinistre','Commande']
    .forEach(h => html += `<th style="border:1px solid #333;padding:6px;">${h}</th>`);
  html += '</tr>';
  list.forEach(s => {
    html += `<tr>
      <td style="border:1px solid #333;padding:5px;">${s.troncon}</td>
      <td style="border:1px solid #333;padding:5px;">${s.pk}</td>
      <td style="border:1px solid #333;padding:5px;">${s.sens}</td>
      <td style="border:1px solid #333;padding:5px;">${s.cote}</td>
      <td style="border:1px solid #333;padding:5px;">${(s.designation||'').replace(/</g,'&lt;')}</td>
      <td style="border:1px solid #333;padding:5px;text-align:center;">${s.date}</td>
      <td style="border:1px solid #333;padding:5px;text-align:center;font-size:10px;">${s.cmdNumero || ''}</td>
    </tr>`;
  });
  html += '</table>';

  const doc = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body>${html}</body></html>`;
  const blob = new Blob(['\ufeff', doc], { type: 'application/vnd.ms-excel' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Sinistres_${new Date().toISOString().slice(0,10)}.xls`;
  a.click();
  URL.revokeObjectURL(a.href);
  fermerModale();
  notifier('📥 Excel téléchargé', 'success');
};

/* ═══════════════════════════════════════════════════════════
   📷 PHOTOS
   ═══════════════════════════════════════════════════════════ */
/* ═══ Compression d'image pour réduire la taille ═══ */
function compresserImage(file, maxWidth = 1000, quality = 0.75) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > maxWidth) {
          h = Math.round(h * maxWidth / w);
          w = maxWidth;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve('');
      img.src = e.target.result;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

document.getElementById('photos-folder-input')?.addEventListener('change', async (e) => {
  const files = e.target.files;
  if (!files || files.length === 0) return;

  /* Compter les fichiers valides */
  const validFiles = [];
  for (const f of files) {
    const m = f.name.match(/^(\d+)[\s_\-]+([A-Z]+)[\s_\-]*(\d+)\.(jpg|jpeg|png|gif|webp)$/i);
    if (m) validFiles.push({ file: f, pk: m[1], sens: m[2].toUpperCase(), num: m[3] });
  }

  if (validFiles.length === 0) {
    notifier('⚠️ Aucune photo reconnue — vérifiez les noms (ex: 240800 AM1.jpg)', 'danger');
    e.target.value = '';
    return;
  }

  notifier(`⏳ Compression de ${validFiles.length} photo(s)...`, 'info');
  let count = 0;

  for (const v of validFiles) {
    const compressed = await compresserImage(v.file, 1000, 0.75);
    if (compressed) {
      const key = `${v.pk}_${v.sens}_${v.num}`;
      DATA.photoSinistres[key] = compressed;
      count++;
    }
  }

  try {
    await sauvegarderDonnees(true);
    notifier(`✅ ${count} photo(s) chargée(s) et sauvegardée(s)`, 'success');
  } catch (err) {
    notifier('⚠️ Mémoire pleine — certaines photos non sauvegardées', 'danger');
  }

  rendrePhotos();
  e.target.value = '';
});

window.viderPhotos = function() {
  if (!confirm('Vider TOUTES les photos sauvegardées ?')) return;
  DATA.photoSinistres = {};
  sauvegarderDonnees(true);
  rendrePhotos();
  notifier('🗑️ Photos vidées', 'success');
};

/* ═══ Remplir la liste des dates disponibles ═══ */
window.majSelectDatePhotos = function() {
  const sel = document.getElementById('photos-select-date');
  if (!sel) return;
  const sinistres = extraireSinistres();
  const dates = [...new Set(sinistres.map(s => s.date))].sort((a, b) => {
    const [da, ma, ya] = a.split('/');
    const [db, mb, yb] = b.split('/');
    return `${yb}${mb}${db}`.localeCompare(`${ya}${ma}${da}`);
  });
  const cur = sel.value;
  sel.innerHTML = '<option value="">— Sélectionner une date —</option>' +
    dates.map(d => `<option value="${d}">${d}</option>`).join('');
  sel.value = cur;
  /* Aussi remplir le second select */
  majSelectPkPhotos();
};

/* ═══ Remplir la liste des PK selon la date choisie ═══ */
window.majSelectPkPhotos = function() {
  const selDate = document.getElementById('photos-select-date');
  const selPk = document.getElementById('photos-select-pk');
  if (!selDate || !selPk) return;

  const date = selDate.value;
  if (!date) {
    selPk.innerHTML = '<option value="">— Sélectionner un PK —</option>';
    rendrePhotos();
    return;
  }

  const sinistres = extraireSinistres();
  const duMois = sinistres.filter(s => s.date === date);

  selPk.innerHTML = '<option value="">— Sélectionner un PK —</option>' +
    duMois.map(s => `<option value="${s.pk}|${s.sens}">${s.pk} — ${s.sens} — ${s.cote}</option>`).join('');
  rendrePhotos();
};

/* ═══ Rendu des photos (vertical : Photo 1 → Photo 2) ═══ */
window.rendrePhotos = function() {
  const grid = document.getElementById('photos-grid');
  const count = document.getElementById('photos-count');
  if (!grid) return;

  const nbTotal = Object.keys(DATA.photoSinistres || {}).length;
  if (count) count.textContent = `${nbTotal} photo(s) sauvegardée(s)`;

  const dateVal = document.getElementById('photos-select-date')?.value || '';
  const pkVal = document.getElementById('photos-select-pk')?.value || '';

  if (!dateVal || !pkVal) {
    grid.innerHTML = `<p style="text-align:center;padding:40px;color:#94a3b8;">
      📅 Sélectionnez une <strong>date</strong>, puis un <strong>PK</strong> pour afficher les photos.
    </p>`;
    return;
  }

  const [pk, sens] = pkVal.split('|');
  const sinistres = extraireSinistres();
  const sin = sinistres.find(s => s.pk === pk && s.sens === sens && s.date === dateVal);

  const pkNorm = String(pk).replace(/[^0-9]/g, '');

  const findPhoto = (num) =>
    DATA.photoSinistres[`${pkNorm}_${sens}_${num}`]
    || DATA.photoSinistres[`${pk}_${sens}_${num}`]
    || DATA.photoSinistres[`${pkNorm.replace(/^0+/,'')}_${sens}_${num}`];

  const photo1 = findPhoto('1');
  const photo2 = findPhoto('2');

  const info = sin ? {
    date: sin.date, pk: sin.pk, sens: sin.sens, cote: sin.cote,
    designation: sin.designation, annee: (sin.date || '').split('/').pop()
  } : { date: dateVal, pk: pk, sens: sens, cote: '', designation: '', annee: '' };

  /* Sauvegarder l'info du sinistre courant pour l'aperçu */
  window._currentPhotoInfo = { ...info, photo1, photo2 };

  /* ═══ Une seule page contenant les 2 photos + infos ═══ */
  const pkClean = String(pk).replace(/\+/g, '-');
  grid.innerHTML = `
    <div class="no-print" style="margin-bottom:14px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
      <button class="btn btn-primary" onclick="apercuPhotoArchive()">
        🖨️ Aperçu & Imprimer / PDF
      </button>
    </div>

    <div class="photo-archive-page" id="photo-archive-preview">

      <!-- En-tête -->
      <div class="photo-archive-header">
        <h1>AUTOROUTE CASABLANCA-AGADIR</h1>
      </div>

      <!-- Photo 1 -->
      <div class="photo-archive-img">
        ${photo1
          ? `<img src="${photo1}" alt="Photo 1">`
          : `<div class="no-photo-large">📷<br>Photo 1 manquante<br><span style="font-size:12px;">(${pk} ${sens}1.jpg)</span></div>`}
      </div>

      <!-- Photo 2 -->
      <div class="photo-archive-img">
        ${photo2
          ? `<img src="${photo2}" alt="Photo 2">`
          : `<div class="no-photo-large">📷<br>Photo 2 manquante<br><span style="font-size:12px;">(${pk} ${sens}2.jpg)</span></div>`}
      </div>

      <!-- Informations -->
      <div class="photo-archive-info">
        <p><strong>Sinistre du :</strong> ${info.date}</p>
        <p><strong>PK :</strong> ${info.pk} &nbsp;&nbsp; <strong>Sens :</strong> ${info.sens} &nbsp;&nbsp; <strong>Côté :</strong> ${info.cote}</p>
        ${info.designation ? `<p style="font-size:12px;"><strong>Dégats infrastructure :</strong> ${info.designation}</p>` : ''}
      </div>

      <!-- Pied -->
      <div class="photo-archive-footer">
        <p><strong>Année : ${info.annee}</strong></p>
      </div>
    </div>
  `;
};

/* 🖨️ Aperçu & Impression */
window.apercuPhotoArchive = function() {
  const info = window._currentPhotoInfo;
  if (!info || !info.photo1 && !info.photo2) {
    notifier('⚠️ Aucune photo à imprimer', 'danger'); return;
  }

  const html = `
    <div class="photo-archive-page-print">
      <div class="photo-archive-header">
        <h1>AUTOROUTE CASABLANCA-AGADIR</h1>
      </div>

      <div class="photo-archive-img">
        ${info.photo1 ? `<img src="${info.photo1}">` : `<div class="no-photo-large">Photo 1 manquante</div>`}
      </div>

      <div class="photo-archive-img">
        ${info.photo2 ? `<img src="${info.photo2}">` : `<div class="no-photo-large">Photo 2 manquante</div>`}
      </div>

      <div class="photo-archive-info">
        <p><strong>Sinistre du :</strong> ${info.date}</p>
        <p><strong>PK :</strong> ${info.pk} &nbsp; <strong>Sens :</strong> ${info.sens} &nbsp; <strong>Côté :</strong> ${info.cote}</p>
        ${info.designation ? `<p style="font-size:12px;"><strong>Dégats :</strong> ${info.designation}</p>` : ''}
      </div>

      <div class="photo-archive-footer">
        <p><strong>Année : ${info.annee}</strong></p>
      </div>
    </div>
  `;

  document.getElementById('apercu-titre').textContent = `Aperçu Photos — PK ${info.pk}`;
  document.getElementById('apercu-body').innerHTML = html;
  const actions = document.getElementById('modal-actions');
  actions.innerHTML = `
    <button class="btn btn-primary" id="btn-print-photos">🖨️ Imprimer / PDF</button>
    <button class="btn btn-ghost" id="btn-close-photos">✖ Fermer</button>
  `;
  document.getElementById('btn-print-photos').onclick = () => imprimerPhotos();
  document.getElementById('btn-close-photos').onclick = () => fermerModale();
  document.getElementById('modal-apercu').classList.add('open');
};

/* ═══════════════════════════════════════════════════════════
   📄 PAGE DE GARDE
   ═══════════════════════════════════════════════════════════ */
window.majSelectPageGarde = function() {
  const sel = document.getElementById('gard-select-pk');
  if (!sel) return;
  const sinistres = extraireSinistres();
  const seen = new Set();
  const opts = [];
  sinistres.forEach(s => {
    const key = `${s.pk}|${s.sens}`;
    if (seen.has(key)) return;
    seen.add(key);
    opts.push(`<option value="${s.pk}|${s.sens}">${s.pk} — ${s.sens} — ${s.date}</option>`);
  });
  sel.innerHTML = '<option value="">— Sélectionner PK / Sens —</option>' + opts.join('');
  rendrePageDeGarde();
};

window.rendrePageDeGarde = function() {
  const cont = document.getElementById('gard-content');
  if (!cont) return;
  const sel = document.getElementById('gard-select-pk');
  const val = sel?.value || '';

  if (!val) {
    cont.innerHTML = '<p style="text-align:center;padding:40px;color:#94a3b8;">Sélectionnez un sinistre pour afficher la page de garde.</p>';
    return;
  }
  const [pk, sens] = val.split('|');
  const sinistres = extraireSinistres();
  const sin = sinistres.find(s => s.pk === pk && s.sens === sens);
  if (!sin) return;

  const annee = (sin.date || '').split('/').pop() || '';
  const trLabel = TRONCON_LABELS_LONG[sin.troncon] || '';

  cont.innerHTML = `
    <div class="page-garde-inner">
      <div class="page-garde-header">
        <h1>AUTOROUTE CASABLANCA-AGADIR</h1>
        <h2>BRIS ET DOMMAGES AUX GLISSIERES DE SECURITE</h2>
        <p style="margin-top:20px;font-size:14px;">${trLabel}</p>
      </div>

      <div class="page-garde-middle">
        <p class="pg-date">Sinistre du <strong>${sin.date}</strong></p>
        <p class="pg-pk">PK <strong>${sin.pk}</strong> &nbsp;&nbsp; Sens <strong>${sin.sens}</strong></p>
        <p class="pg-cote">Côté <strong>${sin.cote}</strong></p>
      </div>

      <div class="page-garde-footer">
        <p style="font-size:18px;font-weight:700;">Année : ${annee}</p>
      </div>
    </div>
  `;
};

/* ═══════════════════════════════════════════════════════════
   📋 ÉTAT DES SINISTRES (par PÉRIODE Du → Au)
   ═══════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════
   📋 ÉTAT DES SINISTRES (par PÉRIODE Du → Au)
   Working copy : rien n'est ajouté au registre tant qu'on n'a pas cliqué 💾
   ═══════════════════════════════════════════════════════════ */
let currentEtatDebut = new Date().toISOString().slice(0,7);
let currentEtatFin   = new Date().toISOString().slice(0,7);
let currentEtatTR    = '';   /* '' = Tous les tronçons */
let etatWorking = null;   /* État en cours d'édition (non sauvegardé) */
let etatEditingId = null; /* ID si on charge un État déjà enregistré */

function numeroEtatSinistrePourPeriode(moisDebut, moisFin, troncon) {
  if (!moisDebut) return 1;
  const key = `${moisDebut}_${moisFin || moisDebut}_${troncon || ''}`;
  const list = [...new Set(DATA.etatsSinistres.map(e => {
    const d = e.moisDebut || e.mois;
    const f = e.moisFin   || e.mois;
    const t = e.troncon   || '';
    return `${d}_${f}_${t}`;
  }))];
  if (!list.includes(key)) list.push(key);
  list.sort();
  return list.indexOf(key) + 1;
}

function extraireSinistresPourPeriode(moisDebut, moisFin) {
  if (!moisDebut) return [];
  const fin = moisFin || moisDebut;
  return extraireSinistres().filter(s => {
    const m = moisDeDate(s.date);
    return m >= moisDebut && m <= fin;
  });
}
/* Changer le filtre TR */
window.changerFiltreTR = function(val) {
  currentEtatTR = val || '';
  /* ✅ Forcer la reconstruction de la working copy */
  etatWorking = null;
  rendreEtatSinistres();
};
/* ═══ Construire une working copy pour la période courante ═══ */
function construireWorkingEtat(moisDebut, moisFin, troncon) {
  troncon = troncon || '';

  /* 1) Si un État existe déjà pour cette (période + tronçon) → on le charge */
  const existing = DATA.etatsSinistres.find(e =>
    (e.moisDebut || e.mois) === moisDebut &&
    (e.moisFin   || e.mois) === moisFin &&
    (e.troncon   || '') === troncon
  );

  const sinistresPeriodeBrut = extraireSinistresPourPeriode(moisDebut, moisFin);
  /* ✅ Filtrer selon le tronçon */
  const sinistresPeriode = troncon
    ? sinistresPeriodeBrut.filter(s => s.troncon === troncon)
    : sinistresPeriodeBrut;

  const savedMap = {};
  if (existing) {
    existing.lignes.forEach(l => {
      if (l._key) savedMap[l._key] = l;
    });
  }

  const lignes = [];
  const seenKeys = new Set();

   /* 2) Reconstruire depuis les sinistres + préserver facture/montant (état sauvé + cache global) */
  sinistresPeriode.forEach(s => {
    /* ✅ Clé unique par ligne de commande (autorise les doublons) */
    const key = `${s.cmdId}|${s.ligneId}`;
    const saved   = savedMap[key] || {};
    const cache   = DATA.facturesSinistres[key] || {};

    /* Priorité : état sauvegardé > cache global > vide */
    const facture = saved.facture || cache.facture || '';
    const montant = saved.montant || cache.montant || '';

    lignes.push({
      _key: key,
      troncon: s.troncon || '',
      date: s.date,
      pk: s.pk,
      sens: s.sens,
      cote: s.cote,
      degats: s.designation,
      facture,
      montant
    });
    seenKeys.add(key);
  });

  /* 3) Conserver les lignes manuelles de l'État existant */
  if (existing) {
    existing.lignes.forEach(l => {
      if (l._manuel && (!l._key || !seenKeys.has(l._key))) {
        lignes.push(l);
      }
    });
  }

  return {
    id: existing ? existing.id : null,
    moisDebut, moisFin,
    troncon,
    dateReference: getFinDeMois(moisFin),
    lignes,
    _existant: !!existing
  };
}

/* ═══ Changer la période ═══ */
window.changerPeriodeEtat = function() {
  const d = getMonthPickerValue('etat-mois-debut');
  const f = getMonthPickerValue('etat-mois-fin');
  if (!d || !f) return;
  if (f < d) {
    notifier('⚠️ La date de fin doit être ≥ au début', 'danger');
    return;
  }
  currentEtatDebut = d;
  currentEtatFin = f;
  etatWorking = construireWorkingEtat(d, f);
  etatEditingId = etatWorking.id;
  rendreEtatSinistres();
  rendreEtatsSinistresEnregistres();
};

/* ═══ RENDU PRINCIPAL ═══ */
window.rendreEtatSinistres = function() {
  const cont = document.getElementById('etat-sinistres-content');
  if (!cont) return;
  const moisDebut = currentEtatDebut;
  const moisFin   = currentEtatFin;
  const numero = numeroEtatSinistrePourPeriode(moisDebut, moisFin);

  /* Si working copy absente ou période changée → construire */
   if (!etatWorking ||
      etatWorking.moisDebut !== moisDebut ||
      etatWorking.moisFin   !== moisFin ||
      (etatWorking.troncon || '') !== (currentEtatTR || '')) {
    etatWorking = construireWorkingEtat(moisDebut, moisFin, currentEtatTR);
    etatEditingId = etatWorking.id;
  }

  const etat = etatWorking;
  const sinistresPeriode = extraireSinistresPourPeriode(moisDebut, moisFin);

  /* Indicateur d'état : nouveau vs chargé vs modifié */
  const isNew = !etat._existant;
  const statusBadge = isNew
    ? '<span style="background:#f59e0b;color:#fff;padding:2px 10px;border-radius:10px;font-size:11px;font-weight:600;">⚠️ Non enregistré</span>'
    : '<span style="background:#16a34a;color:#fff;padding:2px 10px;border-radius:10px;font-size:11px;font-weight:600;">✅ Enregistré</span>';

  const toolbar = `
    <div class="metre-toolbar" style="background:#fef2f2;padding:12px 16px;border-radius:8px;
         margin-bottom:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;
         border:2px solid #fecaca;">
      <label style="font-weight:700;color:#b91c1c;">Du :</label>
      ${htmlMonthPicker('etat-mois-debut', moisDebut, 'changerPeriodeEtat')}
      <label style="font-weight:700;color:#b91c1c;">Au :</label>
      <label style="font-weight:700;color:#b91c1c;">Tronçon :</label>
      <select onchange="changerFiltreTR(this.value)"
              style="padding:6px 10px;border-radius:6px;border:1px solid #cbd5e1;font-weight:600;font-size:13px;">
        <option value=""      ${currentEtatTR === ''    ? 'selected' : ''}>Tous</option>
        <option value="TR1"   ${currentEtatTR === 'TR1' ? 'selected' : ''}>TR1</option>
        <option value="TR2"   ${currentEtatTR === 'TR2' ? 'selected' : ''}>TR2</option>
        <option value="TR3"   ${currentEtatTR === 'TR3' ? 'selected' : ''}>TR3</option>
        <option value="TR4"   ${currentEtatTR === 'TR4' ? 'selected' : ''}>TR4</option>
      </select>
      ${htmlMonthPicker('etat-mois-fin', moisFin, 'changerPeriodeEtat')}
      <span style="font-weight:700;color:#b91c1c;font-size:14px;">
        ${formatMoisFR(moisDebut)} → ${formatMoisFR(moisFin)}
      </span>
      <span style="background:#b91c1c;color:#fff;padding:5px 14px;border-radius:12px;
                   font-weight:700;">État N°${numero}</span>
      ${statusBadge}
      <span style="font-size:12px;color:#64748b;">
        ${etat.lignes.filter(l => !currentEtatTR || l.troncon === currentEtatTR).length} sinistre(s)
        ${currentEtatTR ? `— filtre: ${currentEtatTR}` : ''}
      </span>
      <button class="btn btn-secondary btn-sm" onclick="rafraichirEtatDepuisSinistres()"
              style="margin-left:auto;">🔄 Rafraîchir</button>
      <button class="btn btn-primary btn-sm" onclick="ajouterLigneEtatSinistre()">➕ Ajouter ligne</button>
      <button class="btn btn-primary btn-sm" onclick="sauvegarderEtatSinistre()"
              ${isNew ? '' : 'style="background:#16a34a;"'}>
        💾 ${isNew ? 'Enregistrer' : 'Mettre à jour'}
      </button>
      ${!isNew
        ? `<button class="btn btn-danger btn-sm" onclick="supprimerEtatSinistre('${etat.id}')">🗑️ Supprimer</button>`
        : ''}
      <button class="btn btn-secondary btn-sm" onclick="exporterEtatSinistre()">📥 Excel</button>
    </div>
  `;

  const html = toolbar + `
    <div class="panel">
      <table class="constat-table" style="font-size:12px;">
        <thead>
          <tr>
            <th style="width:110px;">Date du sinistre</th>
            <th style="width:90px;">PK</th>
            <th style="width:60px;">Sens</th>
            <th style="width:70px;">Côté</th>
            <th>Dégats infrastructure selon constat</th>
            <th style="width:170px;background:#dc2626;">N° Facture</th>
            <th style="width:130px;background:#dc2626;">Montant facture TTC</th>
            <th style="width:50px;"></th>
          </tr>
        </thead>
        <tbody id="tbody-etat-sinistre">
           ${(() => {
            const lignesAffichees = etat.lignes
              .map((l, realIndex) => ({ l, realIndex }))
              .filter(({ l }) => !currentEtatTR || l.troncon === currentEtatTR);

            if (lignesAffichees.length === 0) {
              return `<tr><td colspan="8" style="text-align:center;padding:30px;color:#64748b;">
                Aucun sinistre ${currentEtatTR ? `<strong>pour ${currentEtatTR}</strong> ` : ''}entre <strong>${formatMoisFR(moisDebut)}</strong> et <strong>${formatMoisFR(moisFin)}</strong>.<br>
                <span style="font-size:12px;">Les sinistres apparaissent automatiquement selon leur date (dans Observations des Commandes).</span>
              </td></tr>`;
            }

            return lignesAffichees.map(({ l, realIndex }) => `
              <tr${l._manuel ? ' style="background:#fff7ed;"' : ''}>
                <td>
                  ${l.troncon ? `<span class="badge-tr badge-tr${(l.troncon||'TR1')[2]}" style="margin-right:4px;">${l.troncon}</span>` : ''}
                  <input type="text" value="${l.date||''}" onchange="majLigneEtat(${realIndex},'date',this.value)" placeholder="JJ/MM/AAAA">
                </td>
                <td><input type="text" value="${l.pk||''}" onchange="majLigneEtat(${realIndex},'pk',this.value)" placeholder="PK" style="font-family:Consolas,monospace;"></td>
                <td><input type="text" value="${l.sens||''}" onchange="majLigneEtat(${realIndex},'sens',this.value)"></td>
                <td><input type="text" value="${l.cote||''}" onchange="majLigneEtat(${realIndex},'cote',this.value)"></td>
                <td><input type="text" value="${(l.degats||'').replace(/"/g,'&quot;')}" onchange="majLigneEtat(${realIndex},'degats',this.value)" style="font-size:11px;"></td>
                ${(() => {
                  const fInfo = getFactureInfoForKey(l._key);
                  return `
                    <td style="text-align:center;white-space:nowrap;">
                      <span style="font-weight:700;color:${fInfo.exists ? '#16a34a' : '#f59e0b'};font-size:11px;">
                        ${fInfo.numero || '—'}
                      </span>
                      <button class="btn-icon" onclick="ouvrirFactureDepuisEtat('${l._key}')"
                              title="Ouvrir la facture" style="font-size:11px;">🧾</button>
                    </td>
                    <td style="text-align:right;font-weight:600;color:${fInfo.exists ? '#16a34a' : '#94a3b8'};">
                      ${fInfo.totalTTC ? fInfo.totalTTC.toLocaleString('fr-FR', {minimumFractionDigits:2}) : '—'}
                    </td>
                  `;
                })()}
                <td><button class="btn-icon danger" onclick="supprimerLigneEtat(${realIndex})">🗑️</button></td>
              </tr>
            `).join('');
          })()}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="6" style="text-align:right;">TOTAL (DH)</td>
            <td class="num" style="font-weight:700;font-size:13px;color:#fbbf24;">
              ${etat.lignes
                .filter(l => !currentEtatTR || l.troncon === currentEtatTR)
                .reduce((s,l) => s + (parseFloat(l.montant)||0), 0)
                .toLocaleString('fr-FR', {minimumFractionDigits:2})}
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
  cont.innerHTML = html;
};

window.ouvrirFactureDepuisEtat = function(ligneKey) {
  switchSinistre('sin-factures');
  const list = getListeFacturesDisponibles();
  factureSelectionnee = list.find(f => f.ligneKey === ligneKey) || null;
  rendreFacture();
  rendreFacturesEnregistrees();
};

/* 🔄 Rafraîchir : reconstruire depuis les sinistres (préserve facture/montant de la working copy) */
window.rafraichirEtatDepuisSinistres = function() {
  /* Récupérer les valeurs saisies dans la working copy actuelle */
  const currentMap = {};
  if (etatWorking) {
    etatWorking.lignes.forEach(l => {
      if (l._key) currentMap[l._key] = { facture: l.facture, montant: l.montant };
    });
  }
  /* Reconstruire */
  etatWorking = construireWorkingEtat(currentEtatDebut, currentEtatFin);
  /* Restaurer les valeurs saisies (non encore sauvegardées) */
  etatWorking.lignes.forEach(l => {
    if (l._key && currentMap[l._key]) {
      l.facture = currentMap[l._key].facture;
      l.montant = currentMap[l._key].montant;
    }
  });
  rendreEtatSinistres();
  const nb = extraireSinistresPourPeriode(currentEtatDebut, currentEtatFin).length;
  notifier(`🔄 ${nb} sinistre(s) rafraîchi(s)`, 'success');
};

/* ➕ Ajouter ligne manuelle */
window.ajouterLigneEtatSinistre = function() {
  if (!etatWorking) return;
  etatWorking.lignes.push({
    _manuel: true,
    troncon: currentEtatTR || '',
    date: '', pk: '', sens: '', cote: '', degats: '', facture: '', montant: ''
  });
  rendreEtatSinistres();
};

/* Maj d'une cellule (working copy seulement) */
window.majLigneEtat = function(i, field, val) {
  if (!etatWorking || !etatWorking.lignes[i]) return;
  etatWorking.lignes[i][field] = val;

  /* ✅ Si c'est facture ou montant → sauvegarder dans le CACHE GLOBAL
     (partagé entre toutes les périodes qui contiennent ce sinistre) */
  if (field === 'facture' || field === 'montant') {
    const l = etatWorking.lignes[i];
    if (l._key) {
      if (!DATA.facturesSinistres[l._key]) DATA.facturesSinistres[l._key] = {};
      DATA.facturesSinistres[l._key][field] = val;
      sauvegarderDonnees(true);
    }
  }

  if (field === 'montant') rendreEtatSinistres();
};

/* Supprimer une ligne (working copy) */
window.supprimerLigneEtat = function(i) {
  if (!etatWorking) return;
  if (!confirm('Supprimer cette ligne ?')) return;
  etatWorking.lignes.splice(i, 1);
  rendreEtatSinistres();
};

/* 💾 Enregistrer / Mettre à jour — seul moment où on touche DATA */
window.sauvegarderEtatSinistre = function() {
  if (!etatWorking) { notifier('⚠️ Rien à enregistrer', 'danger'); return; }
  const moisDebut = currentEtatDebut;
  const moisFin   = currentEtatFin;
  const troncon   = currentEtatTR || '';
  const numero = numeroEtatSinistrePourPeriode(moisDebut, moisFin, troncon);
  const trLabel = troncon || 'Tous';

  /* Chercher si un État existe déjà pour (période + tronçon) */
  let existing = DATA.etatsSinistres.find(e =>
    (e.moisDebut || e.mois) === moisDebut &&
    (e.moisFin   || e.mois) === moisFin &&
    (e.troncon   || '') === troncon
  );

  if (existing) {
    existing.lignes = JSON.parse(JSON.stringify(etatWorking.lignes));
    existing.moisDebut = moisDebut;
    existing.moisFin = moisFin;
    existing.troncon = troncon;
    existing.dateReference = getFinDeMois(moisFin);
    existing.updatedAt = new Date().toISOString();
    etatWorking.id = existing.id;
    etatWorking._existant = true;
    logHistorique('MISE À JOUR ÉTAT SINISTRES',
      `N°${numero} — ${formatMoisFR(moisDebut)} → ${formatMoisFR(moisFin)} [${trLabel}] — ${existing.lignes.length} ligne(s)`);
    notifier(`💾 État N°${numero} (${trLabel}) mis à jour`, 'success');
  } else {
    const nv = {
      id: uid(),
      moisDebut, moisFin, troncon,
      dateReference: getFinDeMois(moisFin),
      lignes: JSON.parse(JSON.stringify(etatWorking.lignes)),
      createdAt: new Date().toISOString()
    };
    DATA.etatsSinistres.push(nv);
    etatWorking.id = nv.id;
    etatWorking._existant = true;
    etatEditingId = nv.id;
    logHistorique('CRÉATION ÉTAT SINISTRES',
      `N°${numero} — ${formatMoisFR(moisDebut)} → ${formatMoisFR(moisFin)} [${trLabel}] — ${nv.lignes.length} ligne(s)`);
    notifier(`💾 État N°${numero} (${trLabel}) enregistré`, 'success');
  }

  sauvegarderDonnees(true);
  rendreEtatSinistres();
  rendreEtatsSinistresEnregistres();
};

/* 📥 Ouvre la prévisualisation avant export */
window.exporterEtatSinistre = function() {
  if (!etatWorking || etatWorking.lignes.length === 0) {
    notifier('⚠️ Rien à exporter — aucune ligne', 'danger');
    return;
  }

  const moisDebut = currentEtatDebut;
  const moisFin   = currentEtatFin;
  const numero = numeroEtatSinistrePourPeriode(moisDebut, moisFin, currentEtatTR);

  /* ✅ Filtrer selon le TR sélectionné */
  const lignesFiltrees = etatWorking.lignes.filter(l =>
    !currentEtatTR || l.troncon === currentEtatTR
  );

  if (lignesFiltrees.length === 0) {
    notifier('⚠️ Aucune ligne à exporter pour ce filtre', 'danger');
    return;
  }

  const total = lignesFiltrees.reduce((s,l) => s + (parseFloat(l.montant)||0), 0);

  /* ═══ Tableau pur (sans toolbar, sans inputs) ═══ */
  const html = `
    <div style="padding:10px;background:#fff;">
      <h3 style="text-align:center;margin:0 0 16px;color:#b91c1c;font-size:16px;">
        État des sinistres N°${numero} — ${formatMoisFR(moisDebut)} → ${formatMoisFR(moisFin)}
        ${currentEtatTR ? `— <span style="color:#dc2626;">${currentEtatTR}</span>` : '— Tous les tronçons'}
      </h3>
      <table style="width:100%;border-collapse:collapse;font-size:11px;font-family:Tahoma,Arial,sans-serif;">
        <thead>
          <tr>
            <th style="border:1px solid #333;padding:6px;background:#d9e1f2;font-weight:700;">Date du sinistre</th>
            <th style="border:1px solid #333;padding:6px;background:#d9e1f2;font-weight:700;">PK</th>
            <th style="border:1px solid #333;padding:6px;background:#d9e1f2;font-weight:700;">Sens</th>
            <th style="border:1px solid #333;padding:6px;background:#d9e1f2;font-weight:700;">Côté</th>
            <th style="border:1px solid #333;padding:6px;background:#d9e1f2;font-weight:700;">Dégats infrastructure selon constat</th>
            <th style="border:1px solid #333;padding:6px;background:#d9e1f2;font-weight:700;">N° Facture</th>
            <th style="border:1px solid #333;padding:6px;background:#d9e1f2;font-weight:700;">Montant facture TTC</th>
          </tr>
        </thead>
        <tbody>
          ${lignesFiltrees.map(l => `
            <tr>
              <td style="border:1px solid #333;padding:5px;text-align:center;">${l.date || ''}</td>
              <td style="border:1px solid #333;padding:5px;font-family:Consolas,monospace;text-align:center;">${l.pk || ''}</td>
              <td style="border:1px solid #333;padding:5px;text-align:center;">${l.sens || ''}</td>
              <td style="border:1px solid #333;padding:5px;text-align:center;">${l.cote || ''}</td>
              <td style="border:1px solid #333;padding:5px;">${(l.degats||'').replace(/</g,'&lt;')}</td>
              <td style="border:1px solid #333;padding:5px;text-align:center;">${l.facture || ''}</td>
              <td style="border:1px solid #333;padding:5px;text-align:right;font-weight:600;">
                ${l.montant ? parseFloat(l.montant).toLocaleString('fr-FR', {minimumFractionDigits:2}) : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr style="background:#1e3a8a;color:#fff;">
            <td colspan="6" style="border:1px solid #333;padding:7px;text-align:right;font-weight:700;">TOTAL (DH)</td>
            <td style="border:1px solid #333;padding:7px;text-align:right;font-weight:700;font-size:12px;">
              ${total.toLocaleString('fr-FR', {minimumFractionDigits:2})}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;

  /* ═══ Utiliser la modale existante ═══ */
  document.getElementById('apercu-titre').textContent = `Aperçu — État N°${numero}`;
  document.getElementById('apercu-body').innerHTML = html;

  const actions = document.getElementById('modal-actions');
  actions.innerHTML = `
    <button class="btn btn-primary" id="btn-confirm-export-etat">📥 Exporter Excel</button>
    <button class="btn btn-ghost" id="btn-cancel-export-etat">✖ Annuler</button>
  `;
  document.getElementById('btn-confirm-export-etat').onclick = () => confirmerExportEtatSinistre();
  document.getElementById('btn-cancel-export-etat').onclick = () => fermerModale();

  document.getElementById('modal-apercu').classList.add('open');
};

/* 📥 Confirme et télécharge le fichier Excel */
window.confirmerExportEtatSinistre = function() {
  if (!etatWorking) return;
  const numero = numeroEtatSinistrePourPeriode(currentEtatDebut, currentEtatFin);
  const moisDebut = currentEtatDebut;
  const moisFin   = currentEtatFin;

  /* ✅ Filtrer selon le TR sélectionné */
  const lignesFiltrees = etatWorking.lignes.filter(l =>
    !currentEtatTR || l.troncon === currentEtatTR
  );

  const total = lignesFiltrees.reduce((s,l) => s + (parseFloat(l.montant)||0), 0);

  const html = `
    <h2 style="color:#b91c1c;">État des sinistres N°${numero}</h2>
    <h3>Période : ${formatMoisFR(moisDebut)} → ${formatMoisFR(moisFin)}${currentEtatTR ? ` — ${currentEtatTR}` : ' — Tous les tronçons'}</h3>
    <table border="1" style="border-collapse:collapse;font-family:Tahoma;font-size:11pt;">
      <thead>
        <tr style="background:#d9e1f2;">
          <th style="border:1px solid #333;padding:6px;">Date du sinistre</th>
          <th style="border:1px solid #333;padding:6px;">PK</th>
          <th style="border:1px solid #333;padding:6px;">Sens</th>
          <th style="border:1px solid #333;padding:6px;">Côté</th>
          <th style="border:1px solid #333;padding:6px;">Dégats infrastructure selon constat</th>
          <th style="border:1px solid #333;padding:6px;">N° Facture</th>
          <th style="border:1px solid #333;padding:6px;">Montant facture TTC</th>
        </tr>
      </thead>
      <tbody>
        ${lignesFiltrees.map(l => `
          <tr>
            <td style="border:1px solid #333;padding:5px;">${l.date || ''}</td>
            <td style="border:1px solid #333;padding:5px;">${l.pk || ''}</td>
            <td style="border:1px solid #333;padding:5px;">${l.sens || ''}</td>
            <td style="border:1px solid #333;padding:5px;">${l.cote || ''}</td>
            <td style="border:1px solid #333;padding:5px;">${(l.degats||'').replace(/</g,'&lt;')}</td>
            <td style="border:1px solid #333;padding:5px;">${l.facture || ''}</td>
            <td style="border:1px solid #333;padding:5px;text-align:right;">${l.montant || ''}</td>
          </tr>
        `).join('')}
      </tbody>
      <tfoot>
        <tr style="background:#1e3a8a;color:#fff;">
          <td colspan="6" style="border:1px solid #333;padding:7px;text-align:right;font-weight:700;">TOTAL (DH)</td>
          <td style="border:1px solid #333;padding:7px;text-align:right;font-weight:700;">
            ${total.toFixed(2)}
          </td>
        </tr>
      </tfoot>
    </table>
  `;

  const doc = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body>${html}</body></html>`;
  const blob = new Blob(['\ufeff', doc], { type: 'application/vnd.ms-excel' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Etat_Sinistres_N${numero}_${moisDebut}_${moisFin}.xls`;
  a.click();
  URL.revokeObjectURL(a.href);
  fermerModale();
  notifier('📥 Excel téléchargé', 'success');
};

/* ═══ LISTE DES ÉTATS ENREGISTRÉS ═══ */
window.rendreEtatsSinistresEnregistres = function() {
  const cont = document.getElementById('liste-etats-accordion');
  if (!cont) return;

  const sel = document.getElementById('filtre-etat-mois');
  if (sel) {
    const cur = sel.value;
    const periodes = [...new Set(DATA.etatsSinistres.map(e => {
      const d = e.moisDebut || e.mois;
      const f = e.moisFin   || e.mois;
      return `${d}|${f}`;
    }))];
    sel.innerHTML = '<option value="">Toutes les périodes</option>' +
      periodes.map(p => {
        const [d, f] = p.split('|');
        return `<option value="${p}">${formatMoisFR(d)} → ${formatMoisFR(f)}</option>`;
      }).join('');
    sel.value = cur;
  }

  const filtre = sel?.value || '';
  let list = DATA.etatsSinistres.slice();
  list.forEach(e => {
    e._moisDebut = e.moisDebut || e.mois;
    e._moisFin   = e.moisFin   || e.mois;
    e._numero = numeroEtatSinistrePourPeriode(e._moisDebut, e._moisFin, e.troncon || '');
  });
  list.sort((a, b) => b._numero - a._numero);

  if (filtre) {
    const [d, f] = filtre.split('|');
    list = list.filter(e => e._moisDebut === d && e._moisFin === f);
  }

  if (list.length === 0) {
    cont.innerHTML = '<p style="text-align:center;padding:20px;color:#64748b;">Aucun État enregistré.</p>';
    return;
  }

    cont.innerHTML = list.map(e => {
    const total = e.lignes.reduce((s,l) => s + (parseFloat(l.montant)||0), 0);
    const periodeTxt = e._moisDebut === e._moisFin
      ? formatMoisFR(e._moisDebut)
      : `${formatMoisFR(e._moisDebut)} → ${formatMoisFR(e._moisFin)}`;
    const trLabel = e.troncon || 'Tous';
    const trBadge = e.troncon
      ? `<span class="badge-tr badge-tr${e.troncon[2]}" style="font-weight:700;">${e.troncon}</span>`
      : `<span style="background:#64748b;color:#fff;padding:2px 10px;border-radius:10px;font-size:11px;font-weight:600;">Tous</span>`;
    const isActive = (etatWorking && etatWorking.id === e.id);
    return `
      <div class="cmd-item">
        <div class="cmd-item-header">
          <div class="cmd-item-title">
            <strong>État N°${e._numero}</strong>
            <span style="background:#b91c1c;color:#fff;padding:2px 10px;border-radius:10px;font-size:11px;font-weight:600;">
              📋 État des sinistres
            </span>
            ${trBadge}
            <span>📅 ${periodeTxt}</span>
            <span class="badge badge-tr1">${e.lignes.length} ligne(s)</span>
            <span style="color:#b91c1c;font-weight:700;">
              Total : ${total.toLocaleString('fr-FR', {minimumFractionDigits:2})} DH
            </span>
            ${isActive ? '<span style="color:#16a34a;font-weight:700;">● ACTIF</span>' : ''}
          </div>
          <div style="display:flex;gap:6px;">
            <button class="btn-icon" title="Charger"
                    onclick="chargerEtatSinistre('${e.id}')">📂</button>
            <button class="btn-icon danger" title="Supprimer"
                    onclick="supprimerEtatSinistre('${e.id}')">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
};

window.chargerEtatSinistre = function(id) {
  const e = DATA.etatsSinistres.find(x => x.id === id);
  if (!e) return;
  currentEtatDebut = e.moisDebut || e.mois;
  currentEtatFin   = e.moisFin   || e.mois;
  currentEtatTR    = e.troncon   || '';
  /* Charger en working copy */
  etatWorking = construireWorkingEtat(currentEtatDebut, currentEtatFin, currentEtatTR);
  etatWorking._existant = true;
  etatWorking.id = e.id;
  etatEditingId = e.id;
  rendreEtatSinistres();
  const trLabel = currentEtatTR || 'Tous';
  notifier(`📂 État N°${numeroEtatSinistrePourPeriode(currentEtatDebut, currentEtatFin, currentEtatTR)} (${trLabel}) chargé`, 'success');
};

window.supprimerEtatSinistre = function(id) {
  const e = DATA.etatsSinistres.find(x => x.id === id);
  if (!e) return;
  const d = e.moisDebut || e.mois;
  const f = e.moisFin   || e.mois;
  const numero = numeroEtatSinistrePourPeriode(d, f);
  if (!confirm(`Supprimer État N°${numero} (${formatMoisFR(d)} → ${formatMoisFR(f)}) ?`)) return;
  DATA.etatsSinistres = DATA.etatsSinistres.filter(x => x.id !== id);
  /* Si c'était l'État actif → repasser en mode "nouveau" */
  if (etatWorking && etatWorking.id === id) {
    etatWorking = construireWorkingEtat(currentEtatDebut, currentEtatFin);
    etatWorking._existant = false;
    etatWorking.id = null;
  }
  logHistorique('SUPPRESSION ÉTAT SINISTRES', `N°${numero}`);
  sauvegarderDonnees(true);
  rendreEtatSinistres();
  rendreEtatsSinistresEnregistres();
  notifier('🗑️ État supprimé', 'success');
};

/* ═══ INIT working copy au premier accès ═══ */
function initWorkingEtatIfNeeded() {
  if (!etatWorking) {
    etatWorking = construireWorkingEtat(currentEtatDebut, currentEtatFin);
    etatEditingId = etatWorking.id;
  }
}


/* 🛠️ أداة تشخيص : افتح Console واكتب debugSinistres() */
window.debugSinistres = function() {
  console.log('═══════ DEBUG SINISTRES ═══════');
  const all = extraireSinistres();
  console.log(`📊 Total sinistres extraits : ${all.length}`);

  const parMois = {};
  all.forEach(s => {
    const m = moisDeDate(s.date);
    parMois[m] = (parMois[m] || 0) + 1;
  });
  console.log('📅 Répartition par mois :');
  console.table(parMois);

  console.log(`🎯 Mois courant (État) : ${currentMoisEtatSinistre}`);
  const duMois = extraireSinistresPourMois(currentMoisEtatSinistre);
  console.log(`✅ Sinistres du mois courant : ${duMois.length}`);
  if (duMois.length > 0) {
    console.table(duMois.map(s => ({ pk: s.pk, date: s.date, sens: s.sens })));
  }

  console.log('\n💡 Astuce : pour voir tous les mois disponibles, tapez :');
  console.log('   Object.keys(debugSinistres())');
  return parMois;
};


/* ═══════════════════════════════════════════════════════════
   📅 SÉLECTEUR DE MOIS (Année + Mois) — Anti-erreur de saisie
   ═══════════════════════════════════════════════════════════ */
function htmlMonthPicker(id, value, onchangeFn) {
  const [year, month] = (value || '').split('-');
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear - 5; y <= currentYear + 5; y++) years.push(y);

  const mois = [
    {n:'01', l:'Janvier'},  {n:'02', l:'Février'}, {n:'03', l:'Mars'},
    {n:'04', l:'Avril'},    {n:'05', l:'Mai'},     {n:'06', l:'Juin'},
    {n:'07', l:'Juillet'},  {n:'08', l:'Août'},    {n:'09', l:'Septembre'},
    {n:'10', l:'Octobre'},  {n:'11', l:'Novembre'},{n:'12', l:'Décembre'}
  ];

  return `
    <select id="${id}-year" onchange="${onchangeFn}()"
            style="padding:6px 8px;border-radius:6px;border:1px solid #cbd5e1;font-weight:600;font-size:13px;">
      ${years.map(y => `<option value="${y}" ${String(y) === year ? 'selected' : ''}>${y}</option>`).join('')}
    </select>
    <select id="${id}-month" onchange="${onchangeFn}()"
            style="padding:6px 8px;border-radius:6px;border:1px solid #cbd5e1;font-weight:600;font-size:13px;">
      ${mois.map(m => `<option value="${m.n}" ${m.n === month ? 'selected' : ''}>${m.l}</option>`).join('')}
    </select>
  `;
}

function getMonthPickerValue(id) {
  const y = document.getElementById(id + '-year')?.value;
  const m = document.getElementById(id + '-month')?.value;
  if (!y || !m) return '';
  return `${y}-${m}`;
}

/* ═══════════════════════════════════════════════════════════
   🖨️ IMPRESSION — UNIQUEMENT LE MODAL (1 seule page)
   ═══════════════════════════════════════════════════════════ */
window.imprimerPhotos = function() {
  /* Ajouter la classe "printing-modal" au body */
  document.body.classList.add('printing-modal');
  /* Attendre un tick pour que le CSS s'applique */
  setTimeout(() => {
    window.print();
    /* Retirer la classe après l'impression */
    setTimeout(() => {
      document.body.classList.remove('printing-modal');
    }, 500);
  }, 100);
};


/* ═══════════════════════════════════════════════════════════
   📄 APERÇU PAGE DE GARDE — 1 seule page, isolée
   ═══════════════════════════════════════════════════════════ */
window.apercuPageDeGarde = function() {
  const sel = document.getElementById('gard-select-pk');
  const val = sel?.value || '';

  if (!val) { notifier('⚠️ Sélectionnez un sinistre', 'danger'); return; }

  const [pk, sens] = val.split('|');
  const sinistres = extraireSinistres();
  const sin = sinistres.find(s => s.pk === pk && s.sens === sens);
  if (!sin) { notifier('⚠️ Sinistre introuvable', 'danger'); return; }

  const annee = (sin.date || '').split('/').pop() || '';
  const trLabel = TRONCON_LABELS_LONG[sin.troncon] || '';

  const html = `
    <div class="page-garde-print">
      <div class="page-garde-inner">
        <div class="page-garde-header">
          <h1>AUTOROUTE CASABLANCA - AGADIR</h1>
          <p style="margin-top:20px;font-size:14px;">${trLabel}</p>
        </div>

        <div class="page-garde-middle">
          <p class="pg-date">Sinistre du <strong>${sin.date}</strong></p>
          <p class="pg-pk">PK <strong>${sin.pk}</strong> &nbsp;&nbsp; Sens <strong>${sin.sens}</strong></p>
          <p class="pg-cote">Côté <strong>${sin.cote}</strong></p>
        </div>

        <div class="page-garde-footer">
          <p style="font-size:18px;font-weight:700;">Année : ${annee}</p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('apercu-titre').textContent = `Aperçu Page de garde — PK ${sin.pk}`;
  document.getElementById('apercu-body').innerHTML = html;
  const actions = document.getElementById('modal-actions');
  actions.innerHTML = `
    <button class="btn btn-primary" id="btn-print-gard">🖨️ Imprimer / PDF</button>
    <button class="btn btn-ghost" id="btn-close-gard">✖ Fermer</button>
  `;
  document.getElementById('btn-print-gard').onclick = () => imprimerPageDeGarde();
  document.getElementById('btn-close-gard').onclick = () => fermerModale();
  document.getElementById('modal-apercu').classList.add('open');
};

/* ═══ Impression isolée — 1 seule page ═══ */
window.imprimerPageDeGarde = function() {
  document.body.classList.add('printing-modal', 'printing-gard');
  setTimeout(() => {
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-modal', 'printing-gard');
    }, 500);
  }, 100);
};

/* ═══════════════════════════════════════════════════════════
   🏗️ ÉQUIPEMENTS — Version PÉRIODE (Du → Au)
   ═══════════════════════════════════════════════════════════ */
let currentEquipDebut = new Date().toISOString().slice(0,7);
let currentEquipFin   = new Date().toISOString().slice(0,7);

/* Prix du GMS (à exclure de l'Entretien courant) */
const GMS_PRIX_LIST = [12, 13, 30, 31, 36];

/* Numérotation par période */
function numeroEquipementPourPeriode(moisDebut, moisFin) {
  if (!moisDebut) return 1;
  const fin = moisFin || moisDebut;
  const key = `${moisDebut}_${fin}`;
  const list = [...new Set(DATA.equipementsEnregistres.map(e => {
    const d = e.moisDebut || e.mois;
    const f = e.moisFin || e.mois;
    return `${d}_${f}`;
  }))];
  if (!list.includes(key)) list.push(key);
  list.sort();
  return list.indexOf(key) + 1;
}

/* Détermine la catégorie d'un prix */
function getCategoriePrix(num) {
  if (GMS_PRIX_LIST.includes(num)) return 'gms';
  if (num >= 1 && num <= 132)      return 'entretien';
  if (num >= 133 && num <= 155)    return 'fournitures';
  if (num >= 156 && num <= 206)    return 'peage';
  return null;
}

/* Calcul des montants sur une PÉRIODE */
function calculerEquipementsPeriode(moisDebut, moisFin) {
  const fin = moisFin || moisDebut;
  const result = {};
  ['TR1','TR2','TR3','TR4'].forEach(tr => {
    result[tr] = { entretien: 0, gms: 0, fournitures: 0, peage: 0 };
    DATA.catalogue.forEach(p => {
      const cat = getCategoriePrix(p.numero);
      if (!cat) return;
      const qte = getQtePrixPourTRPeriode(moisDebut, fin, p.numero, tr);
      if (qte <= 0) return;
      result[tr][cat] += qte * (p.prixUnitaire || 0);
    });
  });
  return result;
}

/* ─── Changement de période ─── */
window.changerPeriodeEquipement = function() {
  const d = getMonthPickerValue('equip-debut');
  const f = getMonthPickerValue('equip-fin');
  if (!d || !f) return;
  if (f < d) { notifier('⚠️ La date de fin doit être ≥ au début', 'danger'); return; }
  currentEquipDebut = d;
  currentEquipFin = f;
  rendreEquipements();
  rendreEquipementsEnregistres();
};

/* ─── SWITCH TAB ─── */
window.switchEquipements = function() {
  rendreEquipements();
  rendreEquipementsEnregistres();
};

/* ─── RENDU PRINCIPAL ─── */
window.rendreEquipements = function() {
  const cont = document.getElementById('equipements-content');
  if (!cont) return;
  const moisDebut = currentEquipDebut;
  const moisFin   = currentEquipFin;
  const numero = numeroEquipementPourPeriode(moisDebut, moisFin);
  const periodeTxt = moisDebut === moisFin
    ? formatMoisFR(moisDebut)
    : `${formatMoisFR(moisDebut)} → ${formatMoisFR(moisFin)}`;
  const estMoisUnique = (moisDebut === moisFin);

  const toolbar = `
    <div class="metre-toolbar" style="background:#f5f3ff;padding:12px 16px;border-radius:8px;
         margin-bottom:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;
         border:2px solid #c4b5fd;">
      <label style="font-weight:700;color:#5b21b6;">📅 Du :</label>
      ${htmlMonthPicker('equip-debut', moisDebut, 'changerPeriodeEquipement')}
      <label style="font-weight:700;color:#5b21b6;">Au :</label>
      ${htmlMonthPicker('equip-fin', moisFin, 'changerPeriodeEquipement')}
      <span style="font-weight:700;color:#5b21b6;font-size:13px;">${periodeTxt}</span>
      ${estMoisUnique
        ? `<span style="background:#5b21b6;color:#fff;padding:5px 14px;border-radius:12px;
                        font-weight:700;">Équipements N°${numero}</span>`
        : `<span style="background:#f59e0b;color:#fff;padding:5px 14px;border-radius:12px;
                        font-weight:700;font-size:12px;">
             ⚠️ Période de plusieurs mois — aperçu seulement
           </span>`}
      <button class="btn btn-secondary btn-sm" onclick="apercuEquipement()"
              style="margin-left:auto;">👁️ Aperçu</button>
      ${estMoisUnique
        ? `<button class="btn btn-primary btn-sm" onclick="sauvegarderEquipementPeriode()">
             💾 Enregistrer
           </button>`
        : ``}
    </div>
  `;

  const data = calculerEquipementsPeriode(moisDebut, moisFin);

  /* Totaux */
  const totaux = { entretien:0, gms:0, fournitures:0, peage:0,
                   parTR:{TR1:0,TR2:0,TR3:0,TR4:0}, general:0 };
  ['TR1','TR2','TR3','TR4'].forEach(tr => {
    const d = data[tr];
    totaux.entretien += d.entretien;
    totaux.gms += d.gms;
    totaux.fournitures += d.fournitures;
    totaux.peage += d.peage;
    totaux.parTR[tr] = d.entretien + d.gms + d.fournitures + d.peage;
    totaux.general += totaux.parTR[tr];
  });

  const fmt = v => (v || 0).toLocaleString('fr-FR', {minimumFractionDigits:2, maximumFractionDigits:2});

  const rowTotalMois = (label) => `
    <tr style="background:#5b21b6;color:#fff;font-weight:700;">
      <td style="padding:10px;border:1px solid #333;">${label}</td>
      <td style="padding:10px;border:1px solid #333;text-align:right;">${fmt(totaux.parTR.TR1)}</td>
      <td style="padding:10px;border:1px solid #333;text-align:right;">${fmt(totaux.parTR.TR2)}</td>
      <td style="padding:10px;border:1px solid #333;text-align:right;">${fmt(totaux.parTR.TR3)}</td>
      <td style="padding:10px;border:1px solid #333;text-align:right;">${fmt(totaux.parTR.TR4)}</td>
      <td style="padding:10px;border:1px solid #333;text-align:right;font-size:14px;">${fmt(totaux.general)}</td>
    </tr>`;

  const catRow = (key, label) => `
    <tr>
      <td style="padding:10px;border:1px solid #333;">${label}</td>
      <td style="padding:10px;border:1px solid #333;text-align:right;">${fmt(data.TR1[key])}</td>
      <td style="padding:10px;border:1px solid #333;text-align:right;">${fmt(data.TR2[key])}</td>
      <td style="padding:10px;border:1px solid #333;text-align:right;">${fmt(data.TR3[key])}</td>
      <td style="padding:10px;border:1px solid #333;text-align:right;">${fmt(data.TR4[key])}</td>
      <td style="padding:10px;border:1px solid #333;text-align:right;font-weight:600;">${fmt(totaux[key])}</td>
    </tr>`;

  cont.innerHTML = toolbar + `
    <div class="panel">
      <div style="overflow-x:auto;">
        <table class="constat-table" style="font-size:13px;">
          <thead>
            <tr>
              <th style="width:340px;background:#5b21b6;color:#fff;text-align:left;padding:10px;">Tronçon</th>
              <th style="width:130px;background:#5b21b6;color:#fff;">TR1</th>
              <th style="width:130px;background:#5b21b6;color:#fff;">TR2</th>
              <th style="width:130px;background:#5b21b6;color:#fff;">TR3</th>
              <th style="width:130px;background:#5b21b6;color:#fff;">TR4</th>
              <th style="width:150px;background:#5b21b6;color:#fff;">Total des TR</th>
            </tr>
          </thead>
          <tbody>
            ${catRow('entretien', 'Entretien courant de la signalisation verticale et dispositifs de sécurité')}
            ${catRow('gms', 'GMS')}
            ${catRow('fournitures', 'Fournitures de viabilité')}
            ${catRow('peage', 'Matériel de péage')}
            ${rowTotalMois('Total Mois')}
          </tbody>
        </table>
      </div>
    </div>
  `;
};

/* ─── SAUVEGARDER (un seul mois) ─── */
window.sauvegarderEquipementPeriode = function() {
  const moisDebut = currentEquipDebut;
  const moisFin   = currentEquipFin;
  if (!moisDebut || !moisFin) { notifier('⚠️ Sélectionnez une période', 'danger'); return; }

  /* 🛡️ Protection : un seul mois uniquement */
  if (moisDebut !== moisFin) {
    notifier('⚠️ Enregistrement possible uniquement pour un seul mois', 'danger');
    return;
  }

  const data = calculerEquipementsPeriode(moisDebut, moisFin);
  let hasData = false;
  ['TR1','TR2','TR3','TR4'].forEach(tr => {
    const d = data[tr];
    if (d.entretien || d.gms || d.fournitures || d.peage) hasData = true;
  });
  if (!hasData) { notifier('⚠️ Aucune donnée pour ce mois', 'danger'); return; }

  const numero = numeroEquipementPourPeriode(moisDebut, moisFin);
  const dateReference = getFinDeMois(moisFin);

  let existing = DATA.equipementsEnregistres.find(e => {
    const d = e.moisDebut || e.mois;
    const f = e.moisFin || e.mois;
    return d === moisDebut && f === moisFin;
  });

  if (existing) {
    existing.data = JSON.parse(JSON.stringify(data));
    existing.moisDebut = moisDebut;
    existing.moisFin = moisFin;
    existing.dateReference = dateReference;
    existing.updatedAt = new Date().toISOString();
    delete existing.mois;
    notifier(`💾 Équipements N°${numero} mis à jour`, 'success');
  } else {
    DATA.equipementsEnregistres.push({
      id: uid(),
      numero,
      moisDebut, moisFin,
      dateReference,
      data: JSON.parse(JSON.stringify(data)),
      createdAt: new Date().toISOString()
    });
    notifier(`💾 Équipements N°${numero} enregistré`, 'success');
  }

  logHistorique('SAUVEGARDE ÉQUIPEMENTS', `N°${numero} — ${formatMoisFR(moisDebut)}`);
  sauvegarderDonnees(true);
  rendreEquipementsEnregistres();
};

/* ─── EXPORT EXCEL (avec aperçu modale) ─── */
window.exporterEquipementExcel = function() {
  const moisDebut = currentEquipDebut;
  const moisFin   = currentEquipFin;
  const numero = numeroEquipementPourPeriode(moisDebut, moisFin);
  const periodeTxt = moisDebut === moisFin
    ? formatMoisFR(moisDebut)
    : `${formatMoisFR(moisDebut)} → ${formatMoisFR(moisFin)}`;

  const el = document.querySelector('#equipements-content .panel');
  if (!el) { notifier('⚠️ Rien à exporter', 'danger'); return; }

  const html = `
    <div style="padding:10px;background:#fff;">
      <h3 style="text-align:center;margin:0 0 16px;color:#5b21b6;font-size:16px;">
        Équipements N°${numero} — ${periodeTxt}
      </h3>
      ${el.outerHTML}
    </div>`;

  document.getElementById('apercu-titre').textContent = `Aperçu — Équipements N°${numero}`;
  document.getElementById('apercu-body').innerHTML = html;
  const actions = document.getElementById('modal-actions');
  actions.innerHTML = `
    <button class="btn btn-primary" id="btn-confirm-equip">📥 Exporter Excel</button>
    <button class="btn btn-ghost" id="btn-cancel-equip">✖ Annuler</button>`;
  document.getElementById('btn-confirm-equip').onclick = () => confirmerExportEquipement();
  document.getElementById('btn-cancel-equip').onclick = () => fermerModale();
  document.getElementById('modal-apercu').classList.add('open');
};

window.confirmerExportEquipement = function() {
  const moisDebut = currentEquipDebut;
  const moisFin   = currentEquipFin;
  const numero = numeroEquipementPourPeriode(moisDebut, moisFin);
  const periodeTxt = moisDebut === moisFin
    ? formatMoisFR(moisDebut)
    : `${formatMoisFR(moisDebut)} → ${formatMoisFR(moisFin)}`;

  const data = calculerEquipementsPeriode(moisDebut, moisFin);

  const totaux = { entretien:0, gms:0, fournitures:0, peage:0,
                   parTR:{TR1:0,TR2:0,TR3:0,TR4:0}, general:0 };
  ['TR1','TR2','TR3','TR4'].forEach(tr => {
    const d = data[tr];
    totaux.entretien += d.entretien;
    totaux.gms += d.gms;
    totaux.fournitures += d.fournitures;
    totaux.peage += d.peage;
    totaux.parTR[tr] = d.entretien + d.gms + d.fournitures + d.peage;
    totaux.general += totaux.parTR[tr];
  });

  const fmt = v => (v || 0).toFixed(2);

  let html = `<h2>Équipements N°${numero} — ${periodeTxt}</h2>`;
  html += '<table border="1" style="border-collapse:collapse;font-family:Tahoma;font-size:11pt;">';
  html += '<tr style="background:#5b21b6;color:#fff;">';
  ['Tronçon','TR1','TR2','TR3','TR4','Total des TR'].forEach(h =>
    html += `<th style="padding:6px;border:1px solid #333;">${h}</th>`);
  html += '</tr>';

  const cats = [
    { key:'entretien', label:'Entretien courant de la signalisation verticale et dispositifs de sécurité' },
    { key:'gms', label:'GMS' },
    { key:'fournitures', label:'Fournitures de viabilité' },
    { key:'peage', label:'Matériel de péage' }
  ];
  cats.forEach(c => {
    html += `<tr>
      <td style="padding:6px;border:1px solid #333;">${c.label}</td>
      <td style="padding:6px;border:1px solid #333;text-align:right;">${fmt(data.TR1[c.key])}</td>
      <td style="padding:6px;border:1px solid #333;text-align:right;">${fmt(data.TR2[c.key])}</td>
      <td style="padding:6px;border:1px solid #333;text-align:right;">${fmt(data.TR3[c.key])}</td>
      <td style="padding:6px;border:1px solid #333;text-align:right;">${fmt(data.TR4[c.key])}</td>
      <td style="padding:6px;border:1px solid #333;text-align:right;font-weight:600;">${fmt(totaux[c.key])}</td>
    </tr>`;
  });

  html += `<tr style="background:#5b21b6;color:#fff;font-weight:700;">
    <td style="padding:6px;border:1px solid #333;">Total Mois</td>
    <td style="padding:6px;border:1px solid #333;text-align:right;">${fmt(totaux.parTR.TR1)}</td>
    <td style="padding:6px;border:1px solid #333;text-align:right;">${fmt(totaux.parTR.TR2)}</td>
    <td style="padding:6px;border:1px solid #333;text-align:right;">${fmt(totaux.parTR.TR3)}</td>
    <td style="padding:6px;border:1px solid #333;text-align:right;">${fmt(totaux.parTR.TR4)}</td>
    <td style="padding:6px;border:1px solid #333;text-align:right;">${fmt(totaux.general)}</td>
  </tr></table>`;

  const doc = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body>${html}</body></html>`;
  const blob = new Blob(['\ufeff', doc], { type: 'application/vnd.ms-excel' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Equipements_N${numero}_${moisDebut}_${moisFin}.xls`;
  a.click();
  URL.revokeObjectURL(a.href);
  fermerModale();
  notifier('📥 Excel téléchargé', 'success');
};

/* ─── LISTE DES ÉQUIPEMENTS ENREGISTRÉS ─── */
window.rendreEquipementsEnregistres = function() {
  const cont = document.getElementById('liste-equipements-accordion');
  if (!cont) return;

  const sel = document.getElementById('filtre-equip-mois');
  if (sel) {
    const periodes = [...new Set(DATA.equipementsEnregistres.map(e => {
      const d = e.moisDebut || e.mois;
      const f = e.moisFin || e.mois;
      return `${d}|${f}`;
    }))].sort().reverse();
    const cur = sel.value;
    sel.innerHTML = '<option value="">Toutes les périodes</option>' +
      periodes.map(p => {
        const [d, f] = p.split('|');
        const label = d === f ? formatMoisFR(d) : `${formatMoisFR(d)} → ${formatMoisFR(f)}`;
        return `<option value="${p}">${label}</option>`;
      }).join('');
    sel.value = cur;
  }

  const filtre = sel?.value || '';
  const rech = (document.getElementById('filtre-equip-recherche')?.value || '').toLowerCase();

  let list = DATA.equipementsEnregistres.map(e => ({
    ...e,
    _moisDebut: e.moisDebut || e.mois,
    _moisFin: e.moisFin || e.mois,
    _numero: numeroEquipementPourPeriode(e.moisDebut || e.mois, e.moisFin || e.mois)
  }));

  list.sort((a,b) => b._numero - a._numero);
  if (filtre) {
    const [d, f] = filtre.split('|');
    list = list.filter(e => e._moisDebut === d && e._moisFin === f);
  }
  if (rech) {
    list = list.filter(e =>
      [String(e._numero), e.dateReference, formatMoisFR(e._moisDebut), formatMoisFR(e._moisFin)]
        .join(' ').toLowerCase().includes(rech));
  }

  if (list.length === 0) {
    cont.innerHTML = '<p style="text-align:center;padding:20px;color:#64748b;">Aucun Équipement enregistré.</p>';
    return;
  }

  cont.innerHTML = list.map(e => {
    let total = 0;
    if (e.data) {
      ['TR1','TR2','TR3','TR4'].forEach(tr => {
        const d = e.data[tr];
        if (d) total += (d.entretien||0) + (d.gms||0) + (d.fournitures||0) + (d.peage||0);
      });
    }
    const periodeTxt = e._moisDebut === e._moisFin
      ? formatMoisFR(e._moisDebut)
      : `${formatMoisFR(e._moisDebut)} → ${formatMoisFR(e._moisFin)}`;
    return `
      <div class="cmd-item">
        <div class="cmd-item-header">
          <div class="cmd-item-title">
            <strong>Équipements N°${e._numero}</strong>
            <span style="background:#5b21b6;color:#fff;padding:2px 10px;border-radius:10px;font-size:11px;font-weight:600;">🏗️ Équipements</span>
            <span>📅 ${periodeTxt}</span>
            <span style="color:#5b21b6;font-weight:700;">
              Total : ${total.toLocaleString('fr-FR',{minimumFractionDigits:2})} DH
            </span>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="btn-icon" title="Charger" onclick="chargerEquipement('${e.id}')">📂</button>
            <button class="btn-icon danger" title="Supprimer" onclick="supprimerEquipement('${e.id}')">🗑️</button>
          </div>
        </div>
      </div>`;
  }).join('');
};

window.chargerEquipement = function(id) {
  const e = DATA.equipementsEnregistres.find(x => x.id === id);
  if (!e) return;
  currentEquipDebut = e.moisDebut || e.mois;
  currentEquipFin = e.moisFin || e.mois;
  rendreEquipements();
  rendreEquipementsEnregistres();
  const label = currentEquipDebut === currentEquipFin
    ? formatMoisFR(currentEquipDebut)
    : `${formatMoisFR(currentEquipDebut)} → ${formatMoisFR(currentEquipFin)}`;
  notifier(`📂 Équipements N°${numeroEquipementPourPeriode(currentEquipDebut, currentEquipFin)} (${label}) chargé`, 'success');
};

window.supprimerEquipement = function(id) {
  const e = DATA.equipementsEnregistres.find(x => x.id === id);
  if (!e) return;
  const d = e.moisDebut || e.mois;
  const f = e.moisFin || e.mois;
  const num = numeroEquipementPourPeriode(d, f);
  const label = d === f ? formatMoisFR(d) : `${formatMoisFR(d)} → ${formatMoisFR(f)}`;
  if (!confirm(`Supprimer Équipements N°${num} (${label}) ?`)) return;
  DATA.equipementsEnregistres = DATA.equipementsEnregistres.filter(x => x.id !== id);
  logHistorique('SUPPRESSION ÉQUIPEMENTS', `N°${num} — ${label}`);
  sauvegarderDonnees(true);
  rendreEquipementsEnregistres();
  notifier('🗑️ Équipements supprimés', 'success');
};

/* ═══════════════════════════════════════════════════════════
   🧾 FACTURES — Générées depuis État des sinistres + Metré + DE
   ═══════════════════════════════════════════════════════════ */
let factureSelectionnee = null;   // { numero, date, pk, sens, cote, degats, ligneKey }

/* Génère un N° facture auto disponible : F-001, F-002, ... */
function genererNumeroFactureAuto() {
  if (!DATA.factureAutoNumbers) DATA.factureAutoNumbers = {};
  const existing = Object.values(DATA.factureAutoNumbers);
  let n = 1;
  while (existing.includes(`F-${String(n).padStart(3,'0')}`)) n++;
  return `F-${String(n).padStart(3,'0')}`;
}

/* Retourne TOUS les sinistres de État des sinistres sous forme de factures
   - Si N° Facture existe → l'utiliser
   - Sinon → attribuer un N° auto stable (F-XXX) */
function getListeFacturesDisponibles() {
  const list = [];
  const seen = new Set();
  if (!DATA.factureAutoNumbers) DATA.factureAutoNumbers = {};

  DATA.etatsSinistres.forEach(e => {
    (e.lignes || []).forEach(l => {
      if (!l._key) return;
      if (seen.has(l._key)) return;
      seen.add(l._key);

      const factureEtat = String(l.facture || '').trim();
      let numero, isAuto;

      if (factureEtat) {
        numero = factureEtat;
        isAuto = false;
      } else {
        /* Attribuer un N° auto si pas encore fait */
        if (!DATA.factureAutoNumbers[l._key]) {
          DATA.factureAutoNumbers[l._key] = genererNumeroFactureAuto();
        }
        numero = DATA.factureAutoNumbers[l._key];
        isAuto = true;
      }

      list.push({
        numero,
        isAuto,
        date: l.date || '',
        pk: l.pk || '',
        sens: l.sens || '',
        cote: l.cote || '',
        degats: l.degats || '',
        montant: parseFloat(l.montant) || 0,
        ligneKey: l._key,
        troncon: l.troncon || ''
      });
    });
  });

  /* Tri : manuelles d'abord (alphabétique), puis auto (F-XXX) */
  list.sort((a, b) => {
    if (a.isAuto !== b.isAuto) return a.isAuto ? 1 : -1;
    return String(a.numero).localeCompare(String(b.numero));
  });

  /* Persister les nouveaux auto-numéros */
  sauvegarderDonnees(true);
  return list;
}

/* Helper : retourne les infos facture pour une ligneKey */
function getFactureInfoForKey(ligneKey) {
  if (!ligneKey) return { numero: '', totalTTC: 0, exists: false };

  /* 1) Facture enregistrée → elle est la source */
  const saved = DATA.facturesEnregistrees.find(f => f.ligneKey === ligneKey);
  if (saved) {
    return { numero: saved.numero, totalTTC: saved.totalTTC || 0, exists: true };
  }

  /* 2) Pas enregistrée → utiliser/créer un N° auto */
  if (!DATA.factureAutoNumbers) DATA.factureAutoNumbers = {};
  if (!DATA.factureAutoNumbers[ligneKey]) {
    DATA.factureAutoNumbers[ligneKey] = genererNumeroFactureAuto();
  }
  return { numero: DATA.factureAutoNumbers[ligneKey], totalTTC: 0, exists: false };
}

/* Récupérer les quantités réalisées d'une ligne de sinistre depuis les Metrés */
function getQtesRealiseesPourLigne(ligneKey, pk, sens, cote) {
  const result = {};

  /* Construire la liste des clés possibles */
  const keysToTry = [];
  if (ligneKey) keysToTry.push(ligneKey);                 /* Nouveau : cmdId|ligneId */
  if (pk && sens && cote) {
    keysToTry.push(`${pk}|${sens}|${cote}`);               /* Ancien : pk|sens|cote */
    keysToTry.push(`${pk}|${sens}|${cote}|${sens}`);       /* Variante */
  }
  if (keysToTry.length === 0) return result;

  DATA.metresEnregistres.forEach(m => {
    if (!m.entrees) return;
    keysToTry.forEach(k => {
      if (m.entrees[k]) {
        Object.entries(m.entrees[k]).forEach(([prixNum, qte]) => {
          const p = parseInt(prixNum);
          const q = parseFloat(qte) || 0;
          if (q > 0) {
            if (!result[p]) result[p] = 0;
            result[p] += q;
          }
        });
      }
    });
  });
  return result;
}

/* Init */
window.initFactureIfNeeded = function() {
  if (!factureSelectionnee) {
    const list = getListeFacturesDisponibles();
    if (list.length > 0) factureSelectionnee = list[0];
  }
};

/* Change la facture sélectionnée */
window.changerFactureSelectionnee = function(ligneKey) {
  const list = getListeFacturesDisponibles();
  const found = list.find(f => f.ligneKey === ligneKey);
  factureSelectionnee = found || null;
  rendreFacture();
};
/* ✏️ Renommer une facture auto → écrit le N° dans État des sinistres */
window.renommerFactureAuto = function() {
  if (!factureSelectionnee || !factureSelectionnee.isAuto) return;

  const nouveau = prompt(
    `Renommer la facture auto "${factureSelectionnee.numero}" :\n` +
    `(l'ancien numéro sera remplacé et écrit dans État des sinistres)`,
    factureSelectionnee.numero
  );
  if (!nouveau || !nouveau.trim()) return;

  const num = nouveau.trim();
  const key = factureSelectionnee.ligneKey;

  /* Écrire dans la ligne correspondante de État des sinistres */
  let found = false;
  DATA.etatsSinistres.forEach(e => {
    (e.lignes || []).forEach(l => {
      if (l._key === key) {
        l.facture = num;
        found = true;
      }
    });
  });

  if (!found) { notifier('⚠️ Ligne introuvable dans État des sinistres', 'danger'); return; }

  /* Supprimer l'auto-number attribué */
  if (DATA.factureAutoNumbers && DATA.factureAutoNumbers[key]) {
    delete DATA.factureAutoNumbers[key];
  }

  logHistorique('RENOMMAGE FACTURE', `${factureSelectionnee.numero} → ${num}`);
  sauvegarderDonnees(true);

  /* Recharger */
  const list = getListeFacturesDisponibles();
  factureSelectionnee = list.find(f => f.ligneKey === key) || null;
  rendreFacture();
  rendreFacturesEnregistrees();
  notifier(`✅ Facture renommée : ${num}`, 'success');
};
/* ═══ RENDU FACTURE ═══ */
window.rendreFacture = function() {
  const cont = document.getElementById('factures-content');
  if (!cont) return;

  const list = getListeFacturesDisponibles();

  /* Remplir le select — différencier les auto */
  const options = list.map(f => {
    const badge = f.isAuto ? ' ⚠️ auto' : '';
    const sel = factureSelectionnee?.ligneKey === f.ligneKey ? 'selected' : '';
    return `<option value="${f.ligneKey}" ${sel}>
      ${f.numero}${badge} — PK ${f.pk} ${f.sens} — ${f.date}
    </option>`;
  }).join('');

  const toolbar = `
    <div class="metre-toolbar" style="background:#eff6ff;padding:12px 16px;border-radius:8px;
         margin-bottom:14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;
         border:2px solid #93c5fd;">
      <label style="font-weight:700;color:#1e40af;">🧾 N° Facture :</label>
      <select id="facture-select-num" onchange="changerFactureSelectionnee(this.value)"
              style="padding:6px 10px;border-radius:6px;border:1px solid #cbd5e1;font-weight:600;min-width:320px;">
        <option value="">— Sélectionner une facture —</option>
        ${options}
      </select>
      ${factureSelectionnee?.isAuto ? `
        <button class="btn btn-secondary btn-sm" onclick="renommerFactureAuto()">
          ✏️ Renommer
        </button>
      ` : ''}
      <button class="btn btn-primary btn-sm" onclick="sauvegarderFacture()"
              style="margin-left:auto;">💾 Enregistrer cette facture</button>
      <button class="btn btn-secondary btn-sm" onclick="exporterFactureExcel()">📥 Excel</button>
      <button class="btn btn-secondary btn-sm" onclick="imprimerFacture()">🖨️ PDF</button>
    </div>
  `;

  if (!factureSelectionnee) {
    cont.innerHTML = toolbar + `
      <div class="panel"><p style="text-align:center;padding:30px;color:#64748b;">
        Aucune facture disponible.<br>
        <span style="font-size:12px;">Remplissez le champ <strong>N° Facture</strong> dans l'onglet 📋 État des sinistres.</span>
      </p></div>`;
    return;
  }

  const f = factureSelectionnee;
  const qtes = getQtesRealiseesPourLigne(f.ligneKey, f.pk, f.sens, f.cote);

  /* Sauvegarder l'info pour l'aperçu */
  window._currentFactureInfo = { ...f, qtes };

  /* Construire les lignes (seulement Qts > 0) */
  let totalHT = 0;
  const lignes = [];
  DATA.catalogue.forEach(p => {
    const q = qtes[p.numero] || 0;
    if (q <= 0) return;
    const pu = parseFloat(p.prixUnitaire) || 0;
    const pt = q * pu;
    totalHT += pt;
    lignes.push({
      prix: p.numero,
      libelle: p.libelle,
      unite: p.unite,
      pu: pu,
      qte: q,
      pt: pt
    });
  });

  const tva = totalHT * 0.20;
  const totalTTC = totalHT + tva;
  const fmt = v => v.toLocaleString('fr-FR', {minimumFractionDigits:2, maximumFractionDigits:2});

  const html = toolbar + `
    <div class="panel">
      <div class="entete-commande" style="margin-bottom:14px;">
        <div style="text-align:center;font-size:15px;color:#1e3a8a;font-family:'Times New Roman',serif;">
          <h2 style="margin:0 0 8px;color:#1e3a8a;font-size:18px;">
            Facture <strong>${f.numero}</strong>
          </h2>
          <p style="margin:4px 0;font-size:13px;">
            Sinistre du <strong>${f.date}</strong>
            &nbsp;|&nbsp; PK <strong>${f.pk}</strong>
            &nbsp;|&nbsp; Sens <strong>${f.sens}</strong>
            &nbsp;|&nbsp; Côté <strong>${f.cote}</strong>
          </p>
          ${f.degats ? `<p style="margin:4px 0;font-size:12px;color:#475569;">${f.degats}</p>` : ''}
        </div>
      </div>

      <div style="overflow-x:auto;">
        <table class="constat-table" style="font-size:12px;">
          <thead>
            <tr>
              <th style="width:70px;">N° du Prix</th>
              <th>Libellé des prix</th>
              <th style="width:70px;">Unité</th>
              <th style="width:110px;">P.U en DHs</th>
              <th style="width:110px;">Qts Réalisé</th>
              <th style="width:130px;">P.T en DHs</th>
            </tr>
          </thead>
          <tbody>
            ${lignes.length === 0
              ? `<tr><td colspan="6" style="text-align:center;padding:30px;color:#64748b;">
                  Aucune quantité réalisée pour PK ${f.pk} ${f.sens} dans les Metrés.<br>
                  <span style="font-size:12px;">Vérifiez que le Metré contenant ce PK est bien enregistré.</span>
                </td></tr>`
              : lignes.map(l => `
                <tr>
                  <td style="text-align:center;font-weight:700;">${l.prix}</td>
                  <td style="font-size:11.5px;">${l.libelle}</td>
                  <td style="text-align:center;">${l.unite}</td>
                  <td class="num">${fmt(l.pu)}</td>
                  <td class="num" style="font-weight:600;color:#1e3a8a;">${l.qte.toLocaleString('fr-FR', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                  <td class="num" style="font-weight:700;">${fmt(l.pt)}</td>
                </tr>
              `).join('')}
          </tbody>
          <tfoot>
            <tr style="background:#1e3a8a;color:#fff;">
              <td colspan="5" style="text-align:right;font-weight:700;">Total HT</td>
              <td class="num" style="font-weight:700;">${fmt(totalHT)}</td>
            </tr>
            <tr style="background:#3b82f6;color:#fff;">
              <td colspan="5" style="text-align:right;font-weight:700;">TVA 20%</td>
              <td class="num" style="font-weight:700;">${fmt(tva)}</td>
            </tr>
            <tr style="background:#16a34a;color:#fff;">
              <td colspan="5" style="text-align:right;font-weight:700;font-size:14px;">Total TTC</td>
              <td class="num" style="font-weight:700;font-size:14px;">${fmt(totalTTC)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;

  cont.innerHTML = html;
};

/* ═══ SAUVEGARDER ═══ */
window.sauvegarderFacture = function() {
  if (!factureSelectionnee) { notifier('⚠️ Sélectionnez une facture', 'danger'); return; }
  const f = factureSelectionnee;
  const qtes = getQtesRealiseesPourLigne(f.ligneKey, f.pk, f.sens, f.cote);

  let totalHT = 0;
  const lignes = [];
  DATA.catalogue.forEach(p => {
    const q = qtes[p.numero] || 0;
    if (q <= 0) return;
    const pu = parseFloat(p.prixUnitaire) || 0;
    const pt = q * pu;
    totalHT += pt;
    lignes.push({
      prix: p.numero, libelle: p.libelle, unite: p.unite,
      pu, qte: q, pt
    });
  });

  if (lignes.length === 0) {
    notifier('⚠️ Aucune quantité réalisée à facturer', 'danger'); return;
  }

  const tva = totalHT * 0.20;
  const totalTTC = totalHT + tva;

   /* 🔄 Synchroniser le N° facture dans État des sinistres */
  DATA.etatsSinistres.forEach(e => {
    (e.lignes || []).forEach(l => {
      if (l._key === f.ligneKey) {
        l.facture = f.numero;                /* Écrire le N° de la facture */
        l.montant = totalTTC;                /* Écrire le Total TTC */
      }
    });
  });

  /* Identifier par ligneKey (unique) */
  let existing = DATA.facturesEnregistrees.find(x => x.ligneKey === f.ligneKey);

  const data = {
    numero: f.numero,
    date: f.date,
    pk: f.pk,
    sens: f.sens,
    cote: f.cote,
    degats: f.degats,
    ligneKey: f.ligneKey,
    lignes: JSON.parse(JSON.stringify(lignes)),
    totalHT, tva, totalTTC,
    updatedAt: new Date().toISOString()
  };

  if (existing) {
    Object.assign(existing, data);
    notifier(`💾 Facture ${f.numero} mise à jour`, 'success');
    logHistorique('MISE À JOUR FACTURE', `${f.numero} — PK ${f.pk}`);
  } else {
    DATA.facturesEnregistrees.push({
      id: uid(),
      ...data,
      createdAt: new Date().toISOString()
    });
    notifier(`💾 Facture ${f.numero} enregistrée`, 'success');
    logHistorique('CRÉATION FACTURE', `${f.numero} — PK ${f.pk}`);
  }

  sauvegarderDonnees(true);
  rendreFacturesEnregistrees();
};

/* ═══ LISTE DES FACTURES ENREGISTRÉES ═══ */
window.rendreFacturesEnregistrees = function() {
  const cont = document.getElementById('liste-factures-accordion');
  if (!cont) return;

  const rech = (document.getElementById('filtre-facture-recherche')?.value || '').toLowerCase();
  const dispo = getListeFacturesDisponibles();
  const savedKeys = new Set(DATA.facturesEnregistrees.map(f => f.ligneKey));

  let list = dispo.map(f => ({
    ...f,
    _saved: savedKeys.has(f.ligneKey)
  }));

  if (rech) {
    list = list.filter(f =>
      [f.numero, f.pk, f.sens, f.cote, f.date]
        .join(' ').toLowerCase().includes(rech));
  }

  if (list.length === 0) {
    cont.innerHTML = '<p style="text-align:center;padding:20px;color:#64748b;">Aucun sinistre dans État des sinistres.</p>';
    return;
  }

  const fmt = v => (v || 0).toLocaleString('fr-FR', {minimumFractionDigits:2, maximumFractionDigits:2});

  cont.innerHTML = list.map(f => {
    const badge = f.isAuto
      ? '<span style="background:#f59e0b;color:#fff;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;">⚠️ Auto</span>'
      : '<span style="background:#1e40af;color:#fff;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;">🧾 Manuel</span>';
    const saved = f._saved
      ? '<span style="color:#16a34a;font-weight:700;font-size:11px;">● Enregistrée</span>'
      : '<span style="color:#94a3b8;font-weight:700;font-size:11px;">○ Non enregistrée</span>';
    const total = f.montant || 0;
    return `
      <div class="cmd-item">
        <div class="cmd-item-header">
          <div class="cmd-item-title">
            <strong>${f.numero}</strong>
            ${badge}
            <span>📅 ${f.date}</span>
            <span>PK ${f.pk} — ${f.sens} — ${f.cote}</span>
            ${total > 0 ? `<span style="color:#1e40af;font-weight:700;">TTC : ${fmt(total)} DH</span>` : ''}
            ${saved}
          </div>
          <div style="display:flex;gap:6px;">
            <button class="btn-icon" title="Charger" onclick="chargerFactureArchive('${f.ligneKey}')">📂</button>
            <button class="btn-icon" title="Renommer" onclick="renommerFactureAutoById('${f.ligneKey}')">✏️</button>
            <button class="btn-icon danger" title="Supprimer" onclick="supprimerFactureEntierement('${f.ligneKey}')">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
};

/* 🗑️ Supprime la facture entièrement (registre + N° auto + État) */
window.supprimerFactureEntierement = function(ligneKey) {
  const saved = DATA.facturesEnregistrees.find(f => f.ligneKey === ligneKey);
  const autoNum = DATA.factureAutoNumbers?.[ligneKey];
  const label = saved?.numero || autoNum || 'cette facture';

  if (!confirm(`Supprimer ${label} entièrement ?\n(N° facture, montants et enregistrement)`)) return;

  /* 1) Retirer du registre des factures enregistrées */
  DATA.facturesEnregistrees = DATA.facturesEnregistrees.filter(f => f.ligneKey !== ligneKey);

  /* 2) Retirer le N° auto */
  if (DATA.factureAutoNumbers && DATA.factureAutoNumbers[ligneKey]) {
    delete DATA.factureAutoNumbers[ligneKey];
  }

  /* 3) Nettoyer État des sinistres */
  DATA.etatsSinistres.forEach(e => {
    (e.lignes || []).forEach(l => {
      if (l._key === ligneKey) { l.facture = ''; l.montant = ''; }
    });
  });

  /* 4) Si c'était la facture sélectionnée → désélectionner */
  if (factureSelectionnee?.ligneKey === ligneKey) factureSelectionnee = null;

  logHistorique('SUPPRESSION FACTURE COMPLÈTE', `${label}`);
  sauvegarderDonnees(true);
  rendreFacture();
  rendreFacturesEnregistrees();
  notifier('🗑️ Facture supprimée entièrement', 'success');
};



/* Wrapper pour renommer depuis la liste */
window.renommerFactureAutoById = function(ligneKey) {
  const list = getListeFacturesDisponibles();
  const found = list.find(x => x.ligneKey === ligneKey);
  if (!found) return;
  factureSelectionnee = found;
  renommerFactureAuto();
};

window.chargerFactureArchive = function(ligneKey) {
  const list = getListeFacturesDisponibles();
  const found = list.find(x => x.ligneKey === ligneKey);
  if (!found) {
    notifier('⚠️ Facture introuvable dans État des sinistres', 'danger');
    return;
  }
  factureSelectionnee = found;
  rendreFacture();
  notifier(`📂 Facture ${found.numero} chargée`, 'success');
};

window.supprimerFactureArchive = function(ligneKey) {
  const saved = DATA.facturesEnregistrees.find(x => x.ligneKey === ligneKey);
  if (!saved) { notifier('⚠️ Aucune facture enregistrée à supprimer', 'danger'); return; }
  if (!confirm(`Supprimer la facture enregistrée "${saved.numero}" (PK ${saved.pk}) du registre ?`)) return;
  DATA.facturesEnregistrees = DATA.facturesEnregistrees.filter(x => x.ligneKey !== ligneKey);
  logHistorique('SUPPRESSION FACTURE', `${saved.numero} — PK ${saved.pk}`);
  sauvegarderDonnees(true);
  rendreFacturesEnregistrees();
  notifier('🗑️ Facture supprimée du registre', 'success');
};

/* ═══ EXPORT EXCEL (avec aperçu) ═══ */
window.exporterFactureExcel = function() {
  if (!factureSelectionnee) { notifier('⚠️ Sélectionnez une facture', 'danger'); return; }
  const f = factureSelectionnee;
  const qtes = getQtesRealiseesPourLigne(f.ligneKey, f.pk, f.sens, f.cote);

  let totalHT = 0;
  const lignes = [];
  DATA.catalogue.forEach(p => {
    const q = qtes[p.numero] || 0;
    if (q <= 0) return;
    const pu = parseFloat(p.prixUnitaire) || 0;
    const pt = q * pu;
    totalHT += pt;
    lignes.push({ prix: p.numero, libelle: p.libelle, unite: p.unite, pu, qte: q, pt });
  });

  if (lignes.length === 0) { notifier('⚠️ Aucune ligne à exporter', 'danger'); return; }

  const tva = totalHT * 0.20;
  const totalTTC = totalHT + tva;
  const fmt = v => v.toFixed(2);

  const html = `
    <div style="padding:10px;background:#fff;">
      <h3 style="text-align:center;margin:0 0 12px;color:#1e40af;font-size:16px;">
        Facture <strong>${f.numero}</strong> — ${f.date}
      </h3>
      <p style="text-align:center;margin:0 0 16px;font-size:13px;">
        PK <strong>${f.pk}</strong> &nbsp; Sens <strong>${f.sens}</strong> &nbsp; Côté <strong>${f.cote}</strong>
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:11px;font-family:Tahoma,Arial,sans-serif;">
        <thead>
          <tr>
            <th style="border:1px solid #333;padding:6px;background:#d9e1f2;font-weight:700;">N° du Prix</th>
            <th style="border:1px solid #333;padding:6px;background:#d9e1f2;font-weight:700;">Libellé des prix</th>
            <th style="border:1px solid #333;padding:6px;background:#d9e1f2;font-weight:700;">Unité</th>
            <th style="border:1px solid #333;padding:6px;background:#d9e1f2;font-weight:700;">P.U en DHs</th>
            <th style="border:1px solid #333;padding:6px;background:#d9e1f2;font-weight:700;">Qts Réalisé</th>
            <th style="border:1px solid #333;padding:6px;background:#d9e1f2;font-weight:700;">P.T en DHs</th>
          </tr>
        </thead>
        <tbody>
          ${lignes.map(l => `
            <tr>
              <td style="border:1px solid #333;padding:5px;text-align:center;">${l.prix}</td>
              <td style="border:1px solid #333;padding:5px;">${l.libelle}</td>
              <td style="border:1px solid #333;padding:5px;text-align:center;">${l.unite}</td>
              <td style="border:1px solid #333;padding:5px;text-align:right;">${fmt(l.pu)}</td>
              <td style="border:1px solid #333;padding:5px;text-align:right;">${l.qte}</td>
              <td style="border:1px solid #333;padding:5px;text-align:right;font-weight:600;">${fmt(l.pt)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr style="background:#1e3a8a;color:#fff;">
            <td colspan="5" style="border:1px solid #333;padding:6px;text-align:right;font-weight:700;">Total HT</td>
            <td style="border:1px solid #333;padding:6px;text-align:right;font-weight:700;">${fmt(totalHT)}</td>
          </tr>
          <tr style="background:#3b82f6;color:#fff;">
            <td colspan="5" style="border:1px solid #333;padding:6px;text-align:right;font-weight:700;">TVA 20%</td>
            <td style="border:1px solid #333;padding:6px;text-align:right;font-weight:700;">${fmt(tva)}</td>
          </tr>
          <tr style="background:#16a34a;color:#fff;">
            <td colspan="5" style="border:1px solid #333;padding:6px;text-align:right;font-weight:700;">Total TTC</td>
            <td style="border:1px solid #333;padding:6px;text-align:right;font-weight:700;">${fmt(totalTTC)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;

  document.getElementById('apercu-titre').textContent = `Aperçu — Facture ${f.numero}`;
  document.getElementById('apercu-body').innerHTML = html;
  const actions = document.getElementById('modal-actions');
  actions.innerHTML = `
    <button class="btn btn-primary" id="btn-confirm-facture">📥 Exporter Excel</button>
    <button class="btn btn-ghost" id="btn-cancel-facture">✖ Annuler</button>
  `;
  document.getElementById('btn-confirm-facture').onclick = () => confirmerExportFacture();
  document.getElementById('btn-cancel-facture').onclick = () => fermerModale();
  document.getElementById('modal-apercu').classList.add('open');
};

window.confirmerExportFacture = function() {
  if (!factureSelectionnee) return;
  const f = factureSelectionnee;
  const qtes = getQtesRealiseesPourLigne(f.ligneKey);

  let totalHT = 0;
  const lignes = [];
  DATA.catalogue.forEach(p => {
    const q = qtes[p.numero] || 0;
    if (q <= 0) return;
    const pu = parseFloat(p.prixUnitaire) || 0;
    const pt = q * pu;
    totalHT += pt;
    lignes.push({ prix: p.numero, libelle: p.libelle, unite: p.unite, pu, qte: q, pt });
  });
  const tva = totalHT * 0.20;
  const totalTTC = totalHT + tva;
  const fmt = v => v.toFixed(2);

  let html = `<h2>Facture ${f.numero}</h2>`;
  html += `<h3>Sinistre du ${f.date} — PK ${f.pk} ${f.sens} ${f.cote}</h3>`;
  html += '<table border="1" style="border-collapse:collapse;font-family:Tahoma;font-size:11pt;">';
  html += '<tr style="background:#d9e1f2;">';
  ['N° du Prix','Libellé des prix','Unité','P.U en DHs','Qts Réalisé','P.T en DHs']
    .forEach(h => html += `<th style="border:1px solid #333;padding:6px;">${h}</th>`);
  html += '</tr>';
  lignes.forEach(l => {
    html += `<tr>
      <td style="border:1px solid #333;padding:5px;text-align:center;">${l.prix}</td>
      <td style="border:1px solid #333;padding:5px;">${l.libelle}</td>
      <td style="border:1px solid #333;padding:5px;text-align:center;">${l.unite}</td>
      <td style="border:1px solid #333;padding:5px;text-align:right;">${fmt(l.pu)}</td>
      <td style="border:1px solid #333;padding:5px;text-align:right;">${l.qte}</td>
      <td style="border:1px solid #333;padding:5px;text-align:right;">${fmt(l.pt)}</td>
    </tr>`;
  });
  html += `<tr style="background:#1e3a8a;color:#fff;">
    <td colspan="5" style="border:1px solid #333;padding:6px;text-align:right;font-weight:700;">Total HT</td>
    <td style="border:1px solid #333;padding:6px;text-align:right;font-weight:700;">${fmt(totalHT)}</td>
  </tr>`;
  html += `<tr style="background:#3b82f6;color:#fff;">
    <td colspan="5" style="border:1px solid #333;padding:6px;text-align:right;font-weight:700;">TVA 20%</td>
    <td style="border:1px solid #333;padding:6px;text-align:right;font-weight:700;">${fmt(tva)}</td>
  </tr>`;
  html += `<tr style="background:#16a34a;color:#fff;">
    <td colspan="5" style="border:1px solid #333;padding:6px;text-align:right;font-weight:700;">Total TTC</td>
    <td style="border:1px solid #333;padding:6px;text-align:right;font-weight:700;">${fmt(totalTTC)}</td>
  </tr>`;
  html += '</table>';

  const doc = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body>${html}</body></html>`;
  const blob = new Blob(['\ufeff', doc], { type: 'application/vnd.ms-excel' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Facture_${f.numero.replace(/[^A-Za-z0-9]/g, '_')}.xls`;
  a.click();
  URL.revokeObjectURL(a.href);
  fermerModale();
  notifier('📥 Excel téléchargé', 'success');
};

/* 🖨️ Aperçu avant impression */
window.imprimerFacture = function() {
  if (!factureSelectionnee) { notifier('⚠️ Sélectionnez une facture', 'danger'); return; }

  const f = factureSelectionnee;
  const qtes = getQtesRealiseesPourLigne(f.ligneKey, f.pk, f.sens, f.cote);

  let totalHT = 0;
  const lignes = [];
  DATA.catalogue.forEach(p => {
    const q = qtes[p.numero] || 0;
    if (q <= 0) return;
    const pu = parseFloat(p.prixUnitaire) || 0;
    const pt = q * pu;
    totalHT += pt;
    lignes.push({ prix: p.numero, libelle: p.libelle, unite: p.unite, pu, qte: q, pt });
  });

  if (lignes.length === 0) { notifier('⚠️ Aucune ligne à imprimer', 'danger'); return; }

  const tva = totalHT * 0.20;
  const totalTTC = totalHT + tva;
  const fmt = v => v.toFixed(2);

  const html = `
    <div style="padding:10px;background:#fff;">
      <h3 style="text-align:center;margin:0 0 8px;color:#1e40af;font-size:16px;">
        Facture <strong>${f.numero}</strong>
      </h3>
      <p style="text-align:center;margin:0 0 4px;font-size:13px;">
        Sinistre du <strong>${f.date}</strong> &nbsp;|&nbsp; PK <strong>${f.pk}</strong>
        &nbsp;|&nbsp; Sens <strong>${f.sens}</strong> &nbsp;|&nbsp; Côté <strong>${f.cote}</strong>
      </p>
      ${f.degats ? `<p style="text-align:center;margin:4px 0 16px;font-size:11px;color:#475569;">${f.degats}</p>` : '<div style="height:12px;"></div>'}
      <table style="width:100%;border-collapse:collapse;font-size:11px;font-family:Tahoma,Arial,sans-serif;">
        <thead>
          <tr>
            <th style="border:1px solid #333;padding:6px;background:#d9e1f2;font-weight:700;">N° du Prix</th>
            <th style="border:1px solid #333;padding:6px;background:#d9e1f2;font-weight:700;">Libellé des prix</th>
            <th style="border:1px solid #333;padding:6px;background:#d9e1f2;font-weight:700;">Unité</th>
            <th style="border:1px solid #333;padding:6px;background:#d9e1f2;font-weight:700;">P.U en DHs</th>
            <th style="border:1px solid #333;padding:6px;background:#d9e1f2;font-weight:700;">Qts Réalisé</th>
            <th style="border:1px solid #333;padding:6px;background:#d9e1f2;font-weight:700;">P.T en DHs</th>
          </tr>
        </thead>
        <tbody>
          ${lignes.map(l => `
            <tr>
              <td style="border:1px solid #333;padding:5px;text-align:center;">${l.prix}</td>
              <td style="border:1px solid #333;padding:5px;">${l.libelle}</td>
              <td style="border:1px solid #333;padding:5px;text-align:center;">${l.unite}</td>
              <td style="border:1px solid #333;padding:5px;text-align:right;">${fmt(l.pu)}</td>
              <td style="border:1px solid #333;padding:5px;text-align:right;">${l.qte}</td>
              <td style="border:1px solid #333;padding:5px;text-align:right;font-weight:600;">${fmt(l.pt)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr style="background:#1e3a8a;color:#fff;">
            <td colspan="5" style="border:1px solid #333;padding:6px;text-align:right;font-weight:700;">Total HT</td>
            <td style="border:1px solid #333;padding:6px;text-align:right;font-weight:700;">${fmt(totalHT)}</td>
          </tr>
          <tr style="background:#3b82f6;color:#fff;">
            <td colspan="5" style="border:1px solid #333;padding:6px;text-align:right;font-weight:700;">TVA 20%</td>
            <td style="border:1px solid #333;padding:6px;text-align:right;font-weight:700;">${fmt(tva)}</td>
          </tr>
          <tr style="background:#16a34a;color:#fff;">
            <td colspan="5" style="border:1px solid #333;padding:6px;text-align:right;font-weight:700;">Total TTC</td>
            <td style="border:1px solid #333;padding:6px;text-align:right;font-weight:700;">${fmt(totalTTC)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;

  document.getElementById('apercu-titre').textContent = `Aperçu — Facture ${f.numero}`;
  document.getElementById('apercu-body').innerHTML = html;
  const actions = document.getElementById('modal-actions');
  actions.innerHTML = `
    <button class="btn btn-primary" id="btn-print-facture">🖨️ Imprimer / PDF</button>
    <button class="btn btn-ghost" id="btn-close-facture-print">✖ Fermer</button>
  `;
  document.getElementById('btn-print-facture').onclick = () => {
    document.body.classList.add('printing-modal');
    setTimeout(() => {
      window.print();
      setTimeout(() => document.body.classList.remove('printing-modal'), 500);
    }, 100);
  };
  document.getElementById('btn-close-facture-print').onclick = () => fermerModale();
  document.getElementById('modal-apercu').classList.add('open');
};

/* ═══════════════════════════════════════════════════════════
   ⚙️ MENU SETTINGS (Header)
   ═══════════════════════════════════════════════════════════ */
window.toggleSettingsMenu = function(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('settings-dropdown');
  if (menu) menu.classList.toggle('open');
};

/* Fermer le menu si on clique ailleurs */
document.addEventListener('click', (e) => {
  const menu = document.getElementById('settings-dropdown');
  const btn = document.getElementById('btn-settings-menu');
  if (menu && btn && !menu.contains(e.target) && !btn.contains(e.target)) {
    menu.classList.remove('open');
  }
});

/* ═══════════════════════════════════════════════════════════
   📁 MARCHÉS (Sidebar)
   ═══════════════════════════════════════════════════════════ */
/* Dans le nouveau système, la sélection se fait via la page Marches.html */
window.selectMarche = function(id) {
  /* Rediriger vers la page du marché */
  window.location.href = './' + id + '/index.html';
};




/* ═══════════════════════════════════════════════════════════
   📁 SIDEBAR TOGGLE (Réduire / Agrandir)
   ═══════════════════════════════════════════════════════════ */
window.toggleSidebar = function() {
  const sidebar = document.querySelector('.sidebar');
  const btn = document.getElementById('btn-toggle-sidebar');
  if (!sidebar) return;

  sidebar.classList.toggle('collapsed');

  /* Changer la flèche */
  if (btn) {
    btn.textContent = sidebar.classList.contains('collapsed') ? '▶' : '◀';
  }

  /* Sauvegarder l'état (optionnel) */
  try {
    localStorage.setItem('sidebar_collapsed', sidebar.classList.contains('collapsed') ? '1' : '0');
  } catch(e) {}
};

/* Restaurer l'état au chargement */
function restaurerSidebar() {
  try {
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved === '1') {
      const sidebar = document.querySelector('.sidebar');
      const btn = document.getElementById('btn-toggle-sidebar');
      if (sidebar) sidebar.classList.add('collapsed');
      if (btn) btn.textContent = '▶';
    }
  } catch(e) {}
}


/* ═══════════════════════════════════════════════════════════
   📁 GESTION MULTI-MARCHÉS
   ═══════════════════════════════════════════════════════════ */




/* Applique la visibilité des tabs */
function appliquerSectionsVisibles(id) {
  const config = DATA.configsMarches[id] || MARCHES_CONFIGS[id];
  if (!config || !config.sections) return;

  document.querySelectorAll('.tabs .tab').forEach(tab => {
    const key = tab.dataset.tab;
    const visible = config.sections[key];
    tab.style.display = visible ? '' : 'none';
  });

  /* Si l'onglet actif est caché → basculer vers dashboard */
  const actif = document.querySelector('.tabs .tab.active');
  if (actif && actif.style.display === 'none') {
    const dash = document.querySelector('.tabs .tab[data-tab="dashboard"]');
    if (dash) dash.click();
  }
}

/* Réinitialise les états UI après bascule */
function resetUIStates() {
  currentMetreTR = 'TR1';
  currentConstatTR = 'TR1';
  currentMoisMetre = new Date().toISOString().slice(0,7);
  currentMoisConstat = new Date().toISOString().slice(0,7);
  currentSuiviDebut = new Date().toISOString().slice(0,7);
  currentSuiviFin = new Date().toISOString().slice(0,7);
  currentEquipDebut = new Date().toISOString().slice(0,7);
  currentEquipFin   = new Date().toISOString().slice(0,7);
  currentEtatDebut = new Date().toISOString().slice(0,7);
  currentEtatFin = new Date().toISOString().slice(0,7);
  currentEtatTR = '';
  etatWorking = null;
  factureSelectionnee = null;
}

/* Rafraîchit tous les rendus */
function rafraichirTout() {
  try { rendreDashboard(); } catch(e){}
  try { chargerFormParametres(); } catch(e){}
  try { rendreCatalogue(); } catch(e){}
  try { rendreListeCommandes(); } catch(e){}
  try { rendreHistorique(); } catch(e){}
  try { changerMoisMetre(currentMoisMetre); } catch(e){}
  try { changerMoisConstat(currentMoisConstat); } catch(e){}
  try { switchMetre('TR1'); } catch(e){}
  try { switchConstat('TR1'); } catch(e){}
  try { rendreSuiviPrix && rendreSuiviPrix(); } catch(e){}
  try { rendreSuivisEnregistres && rendreSuivisEnregistres(); } catch(e){}
  try { rendreEquipements && rendreEquipements(); } catch(e){}
  try { rendreEquipementsEnregistres && rendreEquipementsEnregistres(); } catch(e){}
}


/* ═══════════════════════════════════════════════════════════
   🖋️ PIED DE PAGE — Signatures (Metré & Constat)
   ═══════════════════════════════════════════════════════════ */
function genererPiedDePageHTML(tr) {
  /* Si pas de TR fourni → valeurs par défaut (rétro-compatibilité) */
  const p = DATA.parametres;
  let sig;

  if (tr && (p.signatures || p.ingenieurs || p.entreprise)) {
    sig = getSignaturesPourTR(tr);
  } else {
    /* Ancien comportement */
    sig = {
      dressePar:   p.dressePar || '',
      dresseNom:   p.dresseNom || '',
      validePar:   p.validePar || '',
      valideNom:   p.valideNom || '',
      acceptePar:  p.acceptePar || '',
      accepteNom:  p.accepteNom || '',
      accepteDate: p.accepteDate || ''
    };
  }

  const dateAccepte = sig.accepteDate ? formatDateFR(sig.accepteDate) : '';

  return `
    <div class="pied-signatures">
      <div class="sig-col sig-left">
        <div class="sig-bloc">
          <p class="sig-titre"><strong>Dressé par :</strong> ${sig.dressePar || '________________'}</p>
          <p class="sig-nom">Nom : ${sig.dresseNom || '________________'}${sig.enConge ? ' <span style="color:#f59e0b;font-size:10px;">(remplaçant)</span>' : ''}</p>
          <div class="sig-ligne-bleue"></div>
        </div>

        <div class="sig-bloc" style="margin-top:24px;">
          <p class="sig-titre"><strong>Validé par :</strong> ${sig.validePar || '________________'}</p>
          <p class="sig-nom">Nom : ${sig.valideNom || '________________'}</p>
          <div class="sig-ligne-bleue"></div>
        </div>

        <p class="sig-date">Le : ......................................</p>
        <p class="sig-date">Signature :</p>
      </div>

      <div class="sig-separateur"></div>

      <div class="sig-col sig-right">
        <div class="sig-bloc">
          <p class="sig-titre"><strong>Accepté par le représentant de l'entreprise :</strong></p>
          <p class="sig-titre" style="margin-top:4px;">${sig.acceptePar || '________________'}</p>
          <p class="sig-nom">Nom : ${sig.accepteNom || '________________'}</p>
          <div class="sig-ligne-bleue"></div>
        </div>

        <p class="sig-date" style="margin-top:24px;">Le : <strong>${dateAccepte || '....................'}</strong></p>
        <p class="sig-date">Signature :</p>
        <div class="sig-zone-signature"></div>
      </div>
    </div>
  `;
}


/* ═══════════════════════════════════════════════════════════
   📅 Month picker helper
   ═══════════════════════════════════════════════════════════ */
window.changerMoisMetrePicker = function() {
  const v = getMonthPickerValue('metre-mois');
  if (v) changerMoisMetre(v);
};

/* ═══════════════════════════════════════════════════════════
   ⌨️ Navigation clavier dans le tableau Metré
   ═══════════════════════════════════════════════════════════ */
function setupMetreKeyboard() {
  document.querySelectorAll('.metre-table input[type="number"]').forEach(input => {
    input.addEventListener('keydown', (e) => {
      const navKeys = ['Enter', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'];
      if (!navKeys.includes(e.key)) return;

      const cell = input.closest('td');
      const row = input.closest('tr');
      const tbody = row?.closest('tbody');
      if (!cell || !row || !tbody) return;

      /* Capturer la position AVANT re-render */
      const rowIdx  = Array.from(tbody.children).indexOf(row);
      const cellIdx = Array.from(row.children).indexOf(cell);
      const totalRows = tbody.children.length;

      e.preventDefault();

      /* Sauvegarder (déclenche change → re-render) */
      input.dispatchEvent(new Event('change', { bubbles: true }));

      /* Calculer la cible */
      let targetRowIdx  = rowIdx;
      let targetCellIdx = cellIdx;

      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        targetRowIdx = (rowIdx + 1) % totalRows;      /* boucle */
      } else if (e.key === 'ArrowUp') {
        targetRowIdx = (rowIdx - 1 + totalRows) % totalRows;
      } else if (e.key === 'ArrowRight') {
        targetCellIdx = cellIdx + 1;
      } else if (e.key === 'ArrowLeft') {
        targetCellIdx = cellIdx - 1;
      }

      /* Naviguer APRÈS re-render */
      setTimeout(() => {
        const newTbody = document.querySelector('.metre-table tbody');
        if (!newTbody) return;
        const rows = Array.from(newTbody.children);
        const targetRow = rows[targetRowIdx];
        if (!targetRow) return;

        const cells = Array.from(targetRow.children);
        let targetInput = null;

        /* Chercher le champ numérique le plus proche */
        if (targetCellIdx >= 0 && targetCellIdx < cells.length) {
          targetInput = cells[targetCellIdx]?.querySelector('input[type="number"]');
        }
        /* Si pas trouvé, chercher dans les cellules suivantes/précédentes */
        if (!targetInput) {
          const dir = (e.key === 'ArrowLeft') ? -1 : 1;
          let i = targetCellIdx + dir;
          while (i >= 0 && i < cells.length) {
            const inp = cells[i].querySelector('input[type="number"]');
            if (inp) { targetInput = inp; break; }
            i += dir;
          }
        }

        if (targetInput) {
          targetInput.focus();
          targetInput.select();
        }
      }, 80);
    });
  });
}

/* ═══════════════════════════════════════════════════════════
   📥 Import Excel → Metré
   Nom attendu : "Metré TR1.xlsx" pour TR1, etc.
   ═══════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════
   🔍 Helper : trouver un prix du catalogue par description
   ═══════════════════════════════════════════════════════════ */
function trouverPrixParDescription(desc) {
  if (!desc) return null;
  const nettoyer = (s) => String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\wàâäéèêëïîôöùûüç\s\-]/gi, '')
    .trim();
  const d = nettoyer(desc);
  if (d.length < 8) return null;

  /* 1. مطابقة تامة */
  let found = DATA.catalogue.find(p => nettoyer(p.libelle) === d);
  if (found) return found;

  /* 2. مطابقة بالبداية (أول 40 حرف) */
  const prefix = d.slice(0, 40);
  found = DATA.catalogue.find(p => nettoyer(p.libelle).startsWith(prefix));
  if (found) return found;

  /* 3. مطابقة جزئية قوية */
  found = DATA.catalogue.find(p => {
    const lib = nettoyer(p.libelle);
    return lib.includes(prefix) || d.includes(lib.slice(0, 40));
  });
  if (found) return found;

  /* 4. مطابقة كلمات مفتاحية (على الأقل 60% تشابه) */
  const motsDesc = d.split(' ').filter(m => m.length > 4);
  if (motsDesc.length === 0) return null;
  let best = null, bestScore = 0;
  DATA.catalogue.forEach(p => {
    const lib = nettoyer(p.libelle);
    const motsLib = lib.split(' ').filter(m => m.length > 4);
    const communs = motsDesc.filter(m => motsLib.some(ml => ml.includes(m) || m.includes(ml)));
    const score = communs.length / motsDesc.length;
    if (score > bestScore && score >= 0.6) {
      best = p;
      bestScore = score;
    }
  });
  return best;
}

/* ═══════════════════════════════════════════════════════════
   📥 Import Excel → Metré
   Structure attendue :
     Ligne 1 : PK | Sens | Côté | n° col1 | n° col2 | ...
     Ligne 2 : (vide) | (vide) | (vide) | Description1 | Description2 | ...
     Ligne 3+ : données
   Mapping par DESCRIPTION (pas par numéro de colonne)
   ═══════════════════════════════════════════════════════════ */
document.getElementById('file-metre-import').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const tr = currentMetreTR;
  const mois = currentMoisMetre;

  /* ─── 1. Vérifier le nom du fichier ─── */
  const baseName = file.name.replace(/\.(xlsx|xls)$/i, '').trim().toLowerCase();
  const trLower = tr.toLowerCase();
  if (!baseName.includes(trLower)) {
    notifier(`⚠️ Nom attendu : "Metré ${tr}.xlsx" — reçu : "${file.name}"`, 'danger');
    e.target.value = '';
    return;
  }

  if (DATA.catalogue.length === 0) {
    notifier('⚠️ Importez d\'abord le catalogue DE.xlsx', 'danger');
    e.target.value = '';
    return;
  }

  try {
    /* ─── 2. Lire le fichier ─── */
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true, blankrows: false });

    if (raw.length < 2) throw new Error('Fichier vide');

    /* ─── 3. Trouver la ligne d'en-tête (col0 === "PK") ─── */
    let headerIdx = -1;
    for (let i = 0; i < Math.min(raw.length, 8); i++) {
      const c0 = String(raw[i][0] || '').trim().toUpperCase();
      if (c0 === 'PK') { headerIdx = i; break; }
    }
    if (headerIdx === -1) throw new Error('Ligne d\'en-tête "PK" introuvable');

    const headerRow = raw[headerIdx];

    /* ─── 4. Détecter si la ligne suivante est une ligne de descriptions ─── */
    const nextRow = raw[headerIdx + 1] || [];
    const isDescRow = nextRow.slice(3).some(v => String(v || '').trim().length > 10);

    const descRow = isDescRow ? nextRow : [];
    const dataStart = isDescRow ? headerIdx + 2 : headerIdx + 1;
    const dataRows = raw.slice(dataStart).filter(r => {
      const pk = String(r[0] || '').trim();
      return pk && pk !== 'PK';
    });

    /* ─── 5. Construire le mapping colIndex → prix numéro du catalogue ─── */
    const colMap = {};   /* { colIndex: priceNumero } */
    const unmatched = []; /* descriptions sans correspondance */

    headerRow.forEach((h, idx) => {
      if (idx < 3) return;   /* Ignorer PK, Sens, Côté */

      /* Priorité 1 : la description (ligne suivante) */
      const desc = String(descRow[idx] || '').trim();
      if (desc) {
        const prix = trouverPrixParDescription(desc);
        if (prix) {
          colMap[idx] = prix.numero;
          return;
        } else {
          unmatched.push({ col: idx, desc: desc.slice(0, 80) });
          return;
        }
      }

      /* Priorité 2 : fallback sur l'entête numérique */
      const n = parseInt(h, 10);
      if (!isNaN(n) && n > 0 && n < 1000 && String(n) === String(h).trim()) {
        const exists = DATA.catalogue.find(p => p.numero === n);
        if (exists) colMap[idx] = n;
      }
    });

    if (Object.keys(colMap).length === 0) {
      throw new Error('Aucune colonne de prix n\'a pu être associée au catalogue');
    }

    /* ─── 6. Comparer avec les lignes du Metré (ordre Excel préservé) ─── */
    const lignes = getLignesMetre(tr, mois);
    if (lignes.length === 0) throw new Error(`Aucune ligne dans Metré ${tr} pour ce mois`);

    const maxRows = Math.min(dataRows.length, lignes.length);
    if (dataRows.length !== lignes.length) {
      if (!confirm(`⚠️ Le fichier contient ${dataRows.length} ligne(s), le Metré ${tr} a ${lignes.length}.\n\nContinuer avec ${maxRows} ligne(s) ?`)) {
        e.target.value = '';
        return;
      }
    }

    /* ─── 7. Remplir DATA.metres[tr].entrees ─── */
    if (!DATA.metres[tr].entrees) DATA.metres[tr].entrees = {};

    let filled = 0;
    const reportByPrice = {};   /* { priceNumero: total } */

    for (let i = 0; i < maxRows; i++) {
      const row = dataRows[i];
      const key = lignes[i].key;
      if (!DATA.metres[tr].entrees[key]) DATA.metres[tr].entrees[key] = {};

      Object.entries(colMap).forEach(([colIdxStr, prixNum]) => {
        const colIdx = parseInt(colIdxStr, 10);
        const rawVal = String(row[colIdx] ?? '').replace(/\s/g, '').replace(',', '.');
        const val = parseFloat(rawVal) || 0;
        if (val > 0) {
          DATA.metres[tr].entrees[key][prixNum] = val;
          filled++;
          reportByPrice[prixNum] = (reportByPrice[prixNum] || 0) + val;
        } else {
          delete DATA.metres[tr].entrees[key][prixNum];
        }
      });
    }

    sauvegarderDonnees(true);
    rendreMetre(tr);

    /* ─── 8. Rapport détaillé ─── */
    const nbPrix = Object.keys(reportByPrice).length;
    let msg = `✅ ${filled} valeur(s) importée(s) — ${nbPrix} prix concerné(s)`;
    if (unmatched.length > 0) {
      msg += ` — ⚠️ ${unmatched.length} colonne(s) non associée(s)`;
      console.warn('Colonnes non associées :', unmatched);
    }
    notifier(msg, 'success');

    /* Détail dans la console pour vérification */
    console.log('📊 Détail de l\'import :', reportByPrice);
    console.log('🗺️ Mapping colonnes → prix :', colMap);

  } catch (err) {
    console.error(err);
    notifier('❌ ' + err.message, 'danger');
  }
  e.target.value = '';
});

/* ═══════════════════════════════════════════════════════════
   👁️ APERÇU METRÉ (modal unifié)
   ═══════════════════════════════════════════════════════════ */
window.apercuMetre = function(tr) {
  const mois = currentMoisMetre;
  const numero = numeroMetrePourMois(mois);
  const m = DATA.metres[tr];
  const rows = getLignesMetre(tr, mois);

  if (rows.length === 0) {
    notifier('⚠️ Aucune ligne à afficher', 'danger');
    return;
  }

  /* ─── Entête ─── */
  const dateAffichage = formatDateFR(getFinDeMois(mois));
  const entete = `
    <div class="metre-entete-print">
      <div class="entete-ligne-unique">
        ${DATA.parametres.logo ? `<img src="${DATA.parametres.logo}" class="entete-logo" alt="Logo">` : ''}
        <div class="entete-titres">
          <span class="num">METRÉ N° ${numero}</span>
          <span class="date">Au ${dateAffichage}</span>
        </div>
      </div>
      <table class="entete-infos">
        <tr>
          <td><span class="lbl">MAITRE D'OUVRAGE :</span> ${DATA.parametres.mo || ''}</td>
          <td><span class="lbl">MARCHE N° :</span> ${DATA.parametres.marche || ''}</td>
        </tr>
        <tr>
          <td><span class="lbl">MAITRE D'ŒUVRE :</span> ${DATA.parametres.moe || ''}</td>
          <td><span class="lbl">Objet :</span> ${DATA.parametres.objet || ''}</td>
        </tr>
        <tr>
          <td><span class="lbl">Entité :</span> ${TRONCON_LABELS_LONG[tr]}</td>
          <td><span class="lbl">PRESTATAIRE :</span> ${DATA.parametres.prestataire || ''}</td>
        </tr>
      </table>
    </div>
  `;

  /* ─── Colonnes visibles (total > 0) ─── */
  const prixData = DATA.catalogue.filter(p => p.numero)
    .sort((a, b) => a.numero - b.numero)
    .map(p => ({ numero: p.numero, libelle: p.libelle || '', unite: p.unite || '' }));

  const totals = {};
  prixData.forEach(p => { totals[p.numero] = 0; });
  Object.values(m.entrees).forEach(row => {
    prixData.forEach(p => { totals[p.numero] += (parseFloat(row[p.numero]) || 0); });
  });
  const visiblePrix = prixData.filter(p => totals[p.numero] > 0);

  /* ─── Tableau : SANS colonne Commande ─── */
  const table = `
    <table class="metre-table-print">
      <thead>
        <tr>
          <th rowspan="2">PK</th>
          <th rowspan="2">Sens</th>
          <th rowspan="2">Côté</th>
          ${visiblePrix.map(p => `<th class="prix-num">${p.numero}</th>`).join('')}
          <th rowspan="2">Sinistre</th>
          <th rowspan="2">Fax</th>
          <th rowspan="2">Prest.</th>
        </tr>
        <tr>
          ${visiblePrix.map(p => `<th class="prix-desc"><div class="vtext">${p.libelle}</div></th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td class="pk-cell">${r.pk}</td>
            <td>${r.sens}</td>
            <td>${r.cote}</td>
            ${visiblePrix.map(p => {
              const v = (m.entrees[r.key]?.[p.numero]);
              return `<td class="prix-cell">${v ? v : ''}</td>`;
            }).join('')}
            <td>${m.sinistres[r.key] !== undefined ? m.sinistres[r.key] : (r.sinistreAuto || '')}</td>
            <td>${m.fax[r.key] || ''}</td>
            <td>${m.prestations[r.key] || ''}</td>
          </tr>
        `).join('')}
      </tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="3" style="text-align:right;">Total</td>
          ${visiblePrix.map(p => `<td class="prix-total">${totals[p.numero] ? totals[p.numero].toFixed(2) : ''}</td>`).join('')}
          <td colspan="3"></td>
        </tr>
        <tr class="unite-row">
          <td colspan="3" style="text-align:right;">Unité</td>
          ${visiblePrix.map(p => `<td>${p.unite}</td>`).join('')}
          <td colspan="3"></td>
        </tr>
      </tfoot>
    </table>
  `;

  const pied = genererPiedDePageHTML(tr);   /* ← مرّر TR */

  const body = `
    <div class="metre-page-print">
      <div class="metre-entete-wrap">${entete}</div>
      <div class="metre-table-wrap">${table}</div>
      <div class="metre-pied-wrap">${pied}</div>
    </div>
  `;

  ouvrirModalUnifie(
    `Aperçu — Metré N°${numero} ${tr}`,
    body,
    () => exporterMetreExcel(tr)
  );
};

/* ═══════════════════════════════════════════════════════════
   📥 Export Excel du Metré
   ═══════════════════════════════════════════════════════════ */
window.exporterMetreExcel = function(tr) {
  const mois = currentMoisMetre;
  const numero = numeroMetrePourMois(mois);
  const m = DATA.metres[tr];
  const rows = getLignesMetre(tr, mois);

  const prixData = DATA.catalogue.filter(p => p.numero)
    .sort((a, b) => a.numero - b.numero)
    .map(p => ({ numero: p.numero, libelle: p.libelle || '', unite: p.unite || '' }));

  const totals = {};
  prixData.forEach(p => { totals[p.numero] = 0; });
  Object.values(m.entrees).forEach(row => {
    prixData.forEach(p => { totals[p.numero] += (parseFloat(row[p.numero]) || 0); });
  });
  const visiblePrix = prixData.filter(p => totals[p.numero] > 0);

  const dateAffichage = formatDateFR(getFinDeMois(mois));
  const entete = `
    <div class="metre-entete-print">
      <div class="entete-ligne-unique">
        ${DATA.parametres.logo ? `<img src="${DATA.parametres.logo}" class="entete-logo">` : ''}
        <div class="entete-titres">
          <span class="num">METRÉ N° ${numero}</span>
          <span class="date">Au ${dateAffichage}</span>
        </div>
      </div>
      <table class="entete-infos">
        <tr><td><b>MAITRE D'OUVRAGE :</b> ${DATA.parametres.mo || ''}</td><td><b>MARCHE N° :</b> ${DATA.parametres.marche || ''}</td></tr>
        <tr><td><b>MAITRE D'ŒUVRE :</b> ${DATA.parametres.moe || ''}</td><td><b>Objet :</b> ${DATA.parametres.objet || ''}</td></tr>
        <tr><td><b>Entité :</b> ${TRONCON_LABELS_LONG[tr]}</td><td><b>PRESTATAIRE :</b> ${DATA.parametres.prestataire || ''}</td></tr>
      </table>
    </div>`;

  let table = '<table border="1" style="border-collapse:collapse;font-family:Tahoma;font-size:9pt;width:100%;">';
  table += '<tr style="background:#1e3a8a;color:#fff;">';
  table += '<th>PK</th><th>Sens</th><th>Côté</th><th>Commande</th>';
  visiblePrix.forEach(p => table += `<th>${p.numero}</th>`);
  table += '<th>Sinistre</th><th>Fax</th><th>Prest.</th></tr>';

  table += '<tr style="background:#e8eefc;font-size:8pt;font-style:italic;">';
  table += '<td></td><td></td><td></td><td></td>';
  visiblePrix.forEach(p => table += `<td>${p.libelle}</td>`);
  table += '<td></td><td></td><td></td></tr>';

  rows.forEach(r => {
    table += '<tr>';
    table += `<td>${r.pk}</td><td>${r.sens}</td><td>${r.cote}</td><td>${r.cmdNumero || ''}</td>`;
    visiblePrix.forEach(p => {
      const v = m.entrees[r.key]?.[p.numero];
      table += `<td style="text-align:center;">${v || ''}</td>`;
    });
    table += `<td>${m.sinistres[r.key] !== undefined ? m.sinistres[r.key] : (r.sinistreAuto || '')}</td>`;
    table += `<td>${m.fax[r.key] || ''}</td><td>${m.prestations[r.key] || ''}</td>`;
    table += '</tr>';
  });

  table += '<tr style="background:#1e3a8a;color:#fff;font-weight:700;">';
  table += '<td colspan="4" style="text-align:right;">Total</td>';
  visiblePrix.forEach(p => table += `<td style="text-align:center;">${totals[p.numero] ? totals[p.numero].toFixed(2) : ''}</td>`);
  table += '<td colspan="3"></td></tr>';
  table += '</table>';

  const pied = genererPiedDePageHTML();

  const doc = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8">
    <style>
      body { font-family: Tahoma; font-size: 10pt; }
      table { border-collapse: collapse; }
      th, td { border: 1px solid #333; padding: 3px 5px; }
      .entete-ligne-unique { display: flex; align-items: center; gap: 10px; padding-bottom: 6px; border-bottom: 1px solid #cbd5e1; margin-bottom: 6px; }
      .entete-logo { max-height: 55px; }
      .entete-titres .num { font-size: 14pt; font-weight: bold; color: #1e3a8a; margin-right: 15px; }
      .entete-titres .date { font-size: 11pt; }
    </style>
  </head><body>${entete}${table}${pied}</body></html>`;

  const blob = new Blob(['\ufeff', doc], { type: 'application/vnd.ms-excel' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Metre_${tr}_N${numero}_${mois}.xls`;
  a.click();
  URL.revokeObjectURL(a.href);
  notifier('📥 Excel téléchargé', 'success');
};


/* ═══════════════════════════════════════════════════════════
   📥 Import Excel → Constat
   Structure : N° Prix | Libellé des prix | Unité | Quantité du mois
   ═══════════════════════════════════════════════════════════ */
document.getElementById('file-constat-import').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const tr = currentConstatTR;
  const mois = currentMoisConstat;

  /* 🛡️ Protection : refuser l'import pour CONS */
  if (tr === 'CONS') {
    notifier('⚠️ Le Constat consolidé est calculé automatiquement — aucun import nécessaire', 'danger');
    e.target.value = '';
    return;
  }

  /* Vérification du nom */
  const baseName = file.name.replace(/\.(xlsx|xls)$/i, '').trim().toLowerCase();
  const key = (tr === 'CONS') ? ['cons', 'consolidé', 'consolide'] : [tr.toLowerCase()];
  const ok = key.some(k => baseName.includes(k));
  if (!ok) {
    const attendu = tr === 'CONS' ? 'Constat CONS.xlsx' : `Constat ${tr}.xlsx`;
    notifier(`⚠️ Nom attendu : "${attendu}" — reçu : "${file.name}"`, 'danger');
    e.target.value = '';
    return;
  }

  try {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true, blankrows: false });

    if (raw.length < 2) throw new Error('Fichier vide');

    /* Trouver la ligne d'en-tête */
    let headerIdx = -1;
    for (let i = 0; i < Math.min(raw.length, 10); i++) {
      const line = raw[i].map(v => normaliserEntete(v));
      if (line.some(c => c.includes('prix'))) { headerIdx = i; break; }
    }
    if (headerIdx === -1) throw new Error("Ligne d'en-tête introuvable");

    const idx = construireIndexColonnes(raw[headerIdx]);
    const colPrix = trouverColonne(idx, ['N° Prix', 'N du Prix', 'Numero', 'N°', 'N']);
    const colQte  = trouverColonne(idx, ['Quantité du mois', 'Quantite du mois', 'Qte mois', 'Qte', 'Quantité mois']);

    if (colPrix < 0 || colQte < 0) {
      throw new Error('Colonnes obligatoires introuvables (N° Prix + Quantité du mois)');
    }

    /* Import : N° Prix → Quantité du mois */
    const quantites = {};
    let count = 0;
    for (let i = headerIdx + 1; i < raw.length; i++) {
      const r = raw[i];
      if (!r) continue;
      const prixNum = parseInt(String(r[colPrix] || '').replace(/[^\d]/g, ''), 10);
      if (!prixNum) continue;
      const rawVal = String(r[colQte] ?? '').replace(/\s/g, '').replace(',', '.');
      const qte = parseFloat(rawVal) || 0;
      if (qte > 0) {
        quantites[prixNum] = qte;
        count++;
      }
    }

    if (count === 0) throw new Error('Aucune quantité > 0 trouvée');

    /* Stocker */
    if (!DATA.constats[tr]) {
      DATA.constats[tr] = { date: '', anterieures: {}, observations: {}, quantitesMois: {} };
    }
    DATA.constats[tr].quantitesMois = quantites;

    sauvegarderDonnees(true);
    rendreConstatTR(tr);
    notifier(`✅ ${count} quantité(s) importée(s) pour ${tr}`, 'success');

  } catch (err) {
    console.error(err);
    notifier('❌ ' + err.message, 'danger');
  }
  e.target.value = '';
});


/* ═══════════════════════════════════════════════════════════
   👁️ APERÇU CONSTAT (modal unifié, entête + tableau + pied)
   ═══════════════════════════════════════════════════════════ */
window.apercuConstat = function(tr) {
  const mois = currentMoisConstat;
  const numero = numeroConstatPourMois(mois);
  const c = DATA.constats[tr];
  if (!c) { notifier('⚠️ Aucune donnée', 'danger'); return; }

  const dateAffichage = formatDateFR(getFinDeMois(mois));

  /* ─── Entête (style Metré) ─── */
  const titreConstat = tr === 'CONS' ? 'CONSTAT CONSOLIDÉ' : `CONSTAT N° ${numero}`;
  const entete = `
    <div class="metre-entete-print">
      <div class="entete-ligne-unique">
        ${DATA.parametres.logo ? `<img src="${DATA.parametres.logo}" class="entete-logo" alt="Logo">` : ''}
        <div class="entete-titres">
          <span class="num">${titreConstat}</span>
          <span class="date">Au ${dateAffichage}</span>
        </div>
      </div>
      <table class="entete-infos">
        <tr>
          <td><span class="lbl">MAITRE D'OUVRAGE :</span> ${DATA.parametres.mo || ''}</td>
          <td><span class="lbl">MARCHE N° :</span> ${DATA.parametres.marche || ''}</td>
        </tr>
        <tr>
          <td><span class="lbl">MAITRE D'ŒUVRE :</span> ${DATA.parametres.moe || ''}</td>
          <td><span class="lbl">Objet :</span> ${DATA.parametres.objet || ''}</td>
        </tr>
        <tr>
          <td><span class="lbl">SECTION :</span> ${SECTION_LABELS[tr] || ''}</td>
          <td><span class="lbl">PRESTATAIRE :</span> ${DATA.parametres.prestataire || ''}</td>
        </tr>
      </table>
    </div>
  `;

  /* ─── Recalculer les lignes (même logique que rendreConstatTR) ─── */
  const trs = tr === 'CONS' ? ['TR1','TR2','TR3','TR4'] : [tr];
  const prixSet = new Set();
  trs.forEach(t => {
    const met = DATA.metresEnregistres.find(m => m.mois === mois && m.troncon === t);
    if (met) {
      Object.values(met.entrees || {}).forEach(row => {
        Object.keys(row).forEach(p => { if (parseFloat(row[p])) prixSet.add(parseInt(p)); });
      });
    }
    if (DATA.constats[t]?.anterieures) Object.keys(DATA.constats[t].anterieures).forEach(p => prixSet.add(parseInt(p)));
    if (DATA.constats[t]?.observations) Object.keys(DATA.constats[t].observations).forEach(p => prixSet.add(parseInt(p)));
    if (DATA.constats[t]?.quantitesMois) Object.keys(DATA.constats[t].quantitesMois).forEach(p => prixSet.add(parseInt(p)));
  });

  const prixList = [...prixSet].sort((a, b) => a - b);

  let totalAnt = 0, totalMois = 0, totalCum = 0;
  const lignes = prixList.map(p => {
    const cat = DATA.catalogue.find(x => x.numero === p);
    let qteMois = 0;
    if (c.quantitesMois && c.quantitesMois[p] !== undefined) {
      qteMois = c.quantitesMois[p];
    } else {
      trs.forEach(t => {
        const met = DATA.metresEnregistres.find(m => m.mois === mois && m.troncon === t);
        if (met) qteMois += calculerQteDuMoisMetre(met, p);
      });
    }
    let qteAnt = 0;
    if (tr === 'CONS') {
      qteAnt = trs.reduce((s, t) => s + (parseFloat(DATA.constats[t].anterieures[p]) || 0), 0);
    } else {
      qteAnt = parseFloat(c.anterieures[p]) || 0;
    }
    const qteCum = qteAnt + qteMois;
    totalAnt += qteAnt; totalMois += qteMois; totalCum += qteCum;
    return {
      prix: p,
      libelle: cat ? cat.libelle : '',
      unite: cat ? cat.unite : '',
      qteAnt, qteMois, qteCum,
      observations: (tr !== 'CONS') ? (c.observations[p] || '') : ''
    };
  });

  const fmt = v => v ? v.toLocaleString('fr-FR', {minimumFractionDigits:2}) : '-';

  const table = `
    <table class="constat-table-print">
      <thead>
        <tr>
          <th style="width:55px;">N° Prix</th>
          <th>Libellé des prix</th>
          <th style="width:55px;">Unité</th>
          <th style="width:100px;">Quantité antérieure</th>
          <th style="width:100px;">Quantité du mois</th>
          <th style="width:100px;">Quantité cumulée</th>
          <th style="width:150px;">Observations</th>
        </tr>
      </thead>
      <tbody>
        ${lignes.map(l => `
          <tr>
            <td style="text-align:center;font-weight:700;">${l.prix}</td>
            <td style="font-size:9px;">${l.libelle}</td>
            <td style="text-align:center;">${l.unite}</td>
            <td style="text-align:right;">${fmt(l.qteAnt)}</td>
            <td style="text-align:right;font-weight:700;color:#1e3a8a;">${fmt(l.qteMois)}</td>
            <td style="text-align:right;font-weight:700;">${fmt(l.qteCum)}</td>
            <td style="font-size:9px;">${l.observations}</td>
          </tr>
        `).join('')}
      </tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="3" style="text-align:right;">TOTAL</td>
          <td style="text-align:right;">${totalAnt.toLocaleString('fr-FR', {minimumFractionDigits:2})}</td>
          <td style="text-align:right;">${totalMois.toLocaleString('fr-FR', {minimumFractionDigits:2})}</td>
          <td style="text-align:right;">${totalCum.toLocaleString('fr-FR', {minimumFractionDigits:2})}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>
  `;

  const pied = genererPiedDePageHTML(tr);   /* ← مرّر TR */

  const body = `
    <div class="metre-page-print">
      <div class="metre-entete-wrap">${entete}</div>
      <div class="metre-table-wrap">${table}</div>
      <div class="metre-pied-wrap">${pied}</div>
    </div>
  `;

  ouvrirModalUnifie(
    `Aperçu — ${titreConstat}`,
    body,
    () => exporterConstatExcel(tr)
  );
};


/* ═══════════════════════════════════════════════════════════
   📥 Export Excel du Constat
   ═══════════════════════════════════════════════════════════ */
window.exporterConstatExcel = function(tr) {
  const mois = currentMoisConstat;
  const numero = numeroConstatPourMois(mois);
  const c = DATA.constats[tr];
  const dateAffichage = formatDateFR(getFinDeMois(mois));

  const trs = tr === 'CONS' ? ['TR1','TR2','TR3','TR4'] : [tr];
  const prixSet = new Set();
  trs.forEach(t => {
    const met = DATA.metresEnregistres.find(m => m.mois === mois && m.troncon === t);
    if (met) {
      Object.values(met.entrees || {}).forEach(row => {
        Object.keys(row).forEach(p => { if (parseFloat(row[p])) prixSet.add(parseInt(p)); });
      });
    }
    if (DATA.constats[t]?.anterieures) Object.keys(DATA.constats[t].anterieures).forEach(p => prixSet.add(parseInt(p)));
    if (DATA.constats[t]?.quantitesMois) Object.keys(DATA.constats[t].quantitesMois).forEach(p => prixSet.add(parseInt(p)));
  });

  const prixList = [...prixSet].sort((a, b) => a - b);
  let tAnt = 0, tMois = 0, tCum = 0;

  let html = `<h2>${tr === 'CONS' ? 'CONSTAT CONSOLIDÉ' : 'CONSTAT N° ' + numero}</h2>`;
  html += `<h3>Au ${dateAffichage}</h3>`;
  html += '<table border="1" style="border-collapse:collapse;font-family:Tahoma;font-size:9pt;width:100%;">';
  html += '<tr style="background:#d9e1f2;"><th>N° Prix</th><th>Libellé</th><th>Unité</th><th>Qté ant.</th><th>Qté mois</th><th>Qté cum.</th><th>Observations</th></tr>';

  prixList.forEach(p => {
    const cat = DATA.catalogue.find(x => x.numero === p);
    let qMois = 0;
    if (c.quantitesMois?.[p] !== undefined) qMois = c.quantitesMois[p];
    else trs.forEach(t => {
      const met = DATA.metresEnregistres.find(m => m.mois === mois && m.troncon === t);
      if (met) qMois += calculerQteDuMoisMetre(met, p);
    });
    let qAnt = 0;
    if (tr === 'CONS') qAnt = trs.reduce((s, t) => s + (parseFloat(DATA.constats[t].anterieures[p]) || 0), 0);
    else qAnt = parseFloat(c.anterieures[p]) || 0;
    const qCum = qAnt + qMois;
    tAnt += qAnt; tMois += qMois; tCum += qCum;
    const obs = (tr !== 'CONS') ? (c.observations[p] || '') : '';
    html += `<tr>
      <td>${p}</td><td>${cat?.libelle || ''}</td><td>${cat?.unite || ''}</td>
      <td style="text-align:right;">${qAnt || ''}</td>
      <td style="text-align:right;font-weight:700;">${qMois || ''}</td>
      <td style="text-align:right;font-weight:700;">${qCum || ''}</td>
      <td>${obs}</td></tr>`;
  });

  html += `<tr style="background:#1e3a8a;color:#fff;font-weight:700;">
    <td colspan="3" style="text-align:right;">TOTAL</td>
    <td style="text-align:right;">${tAnt.toFixed(2)}</td>
    <td style="text-align:right;">${tMois.toFixed(2)}</td>
    <td style="text-align:right;">${tCum.toFixed(2)}</td>
    <td></td></tr></table>`;

  const doc = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body>${html}</body></html>`;
  const blob = new Blob(['\ufeff', doc], { type: 'application/vnd.ms-excel' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Constat_${tr}_N${numero}_${mois}.xls`;
  a.click();
  URL.revokeObjectURL(a.href);
  notifier('📥 Excel téléchargé', 'success');
};

/* ═══════════════════════════════════════════════════════════
   👁️ APERÇU ÉQUIPEMENTS (modal unifié)
   ═══════════════════════════════════════════════════════════ */
window.apercuEquipement = function() {
  const moisDebut = currentEquipDebut;
  const moisFin   = currentEquipFin;
  const numero = numeroEquipementPourPeriode(moisDebut, moisFin);
  const periodeTxt = moisDebut === moisFin
    ? formatMoisFR(moisDebut)
    : `${formatMoisFR(moisDebut)} → ${formatMoisFR(moisFin)}`;

  const data = calculerEquipementsPeriode(moisDebut, moisFin);

  /* Vérifier s'il y a des données */
  let hasData = false;
  ['TR1','TR2','TR3','TR4'].forEach(tr => {
    const d = data[tr];
    if (d.entretien || d.gms || d.fournitures || d.peage) hasData = true;
  });
  if (!hasData) {
    notifier('⚠️ Aucune donnée sur cette période', 'danger');
    return;
  }

  /* ─── Entête (style Metré) ─── */
  const entete = `
    <div class="metre-entete-print">
      <div class="entete-ligne-unique">
        ${DATA.parametres.logo ? `<img src="${DATA.parametres.logo}" class="entete-logo" alt="Logo">` : ''}
        <div class="entete-titres">
          <span class="num">ÉQUIPEMENTS N° ${numero}</span>
          <span class="date">${periodeTxt}</span>
        </div>
      </div>
      <table class="entete-infos">
        <tr>
          <td><span class="lbl">MAITRE D'OUVRAGE :</span> ${DATA.parametres.mo || ''}</td>
          <td><span class="lbl">MARCHE N° :</span> ${DATA.parametres.marche || ''}</td>
        </tr>
        <tr>
          <td><span class="lbl">MAITRE D'ŒUVRE :</span> ${DATA.parametres.moe || ''}</td>
          <td><span class="lbl">Objet :</span> ${DATA.parametres.objet || ''}</td>
        </tr>
        <tr>
          <td><span class="lbl">Période :</span> ${periodeTxt}</td>
          <td><span class="lbl">PRESTATAIRE :</span> ${DATA.parametres.prestataire || ''}</td>
        </tr>
      </table>
    </div>
  `;

  /* ─── Totaux ─── */
  const totaux = { entretien:0, gms:0, fournitures:0, peage:0,
                   parTR:{TR1:0,TR2:0,TR3:0,TR4:0}, general:0 };
  ['TR1','TR2','TR3','TR4'].forEach(tr => {
    const d = data[tr];
    totaux.entretien += d.entretien;
    totaux.gms += d.gms;
    totaux.fournitures += d.fournitures;
    totaux.peage += d.peage;
    totaux.parTR[tr] = d.entretien + d.gms + d.fournitures + d.peage;
    totaux.general += totaux.parTR[tr];
  });

  const fmt = v => (v || 0).toLocaleString('fr-FR', {minimumFractionDigits:2, maximumFractionDigits:2});

  /* ─── Tableau ─── */
  const table = `
    <table class="constat-table-print">
      <thead>
        <tr>
          <th style="width:340px;text-align:left;">Tronçon</th>
          <th style="width:110px;">TR1</th>
          <th style="width:110px;">TR2</th>
          <th style="width:110px;">TR3</th>
          <th style="width:110px;">TR4</th>
          <th style="width:130px;">Total des TR</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="text-align:left;">Entretien courant de la signalisation verticale et dispositifs de sécurité</td>
          <td style="text-align:right;">${fmt(data.TR1.entretien)}</td>
          <td style="text-align:right;">${fmt(data.TR2.entretien)}</td>
          <td style="text-align:right;">${fmt(data.TR3.entretien)}</td>
          <td style="text-align:right;">${fmt(data.TR4.entretien)}</td>
          <td style="text-align:right;font-weight:600;">${fmt(totaux.entretien)}</td>
        </tr>
        <tr>
          <td style="text-align:left;">GMS</td>
          <td style="text-align:right;">${fmt(data.TR1.gms)}</td>
          <td style="text-align:right;">${fmt(data.TR2.gms)}</td>
          <td style="text-align:right;">${fmt(data.TR3.gms)}</td>
          <td style="text-align:right;">${fmt(data.TR4.gms)}</td>
          <td style="text-align:right;font-weight:600;">${fmt(totaux.gms)}</td>
        </tr>
        <tr>
          <td style="text-align:left;">Fournitures de viabilité</td>
          <td style="text-align:right;">${fmt(data.TR1.fournitures)}</td>
          <td style="text-align:right;">${fmt(data.TR2.fournitures)}</td>
          <td style="text-align:right;">${fmt(data.TR3.fournitures)}</td>
          <td style="text-align:right;">${fmt(data.TR4.fournitures)}</td>
          <td style="text-align:right;font-weight:600;">${fmt(totaux.fournitures)}</td>
        </tr>
        <tr>
          <td style="text-align:left;">Matériel de péage</td>
          <td style="text-align:right;">${fmt(data.TR1.peage)}</td>
          <td style="text-align:right;">${fmt(data.TR2.peage)}</td>
          <td style="text-align:right;">${fmt(data.TR3.peage)}</td>
          <td style="text-align:right;">${fmt(data.TR4.peage)}</td>
          <td style="text-align:right;font-weight:600;">${fmt(totaux.peage)}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr class="total-row">
          <td style="text-align:right;font-weight:700;">Total Période</td>
          <td style="text-align:right;font-weight:700;">${fmt(totaux.parTR.TR1)}</td>
          <td style="text-align:right;font-weight:700;">${fmt(totaux.parTR.TR2)}</td>
          <td style="text-align:right;font-weight:700;">${fmt(totaux.parTR.TR3)}</td>
          <td style="text-align:right;font-weight:700;">${fmt(totaux.parTR.TR4)}</td>
          <td style="text-align:right;font-weight:700;font-size:11px;">${fmt(totaux.general)}</td>
        </tr>
      </tfoot>
    </table>
  `;

  const body = `
    <div class="metre-page-print">
      <div class="metre-entete-wrap">${entete}</div>
      <div class="metre-table-wrap">${table}</div>
    </div>
  `;

  ouvrirModalUnifie(
    `Aperçu — Équipements N°${numero}`,
    body,
    () => exporterEquipementExcelDirect()
  );
};


/* ═══════════════════════════════════════════════════════════
   📥 EXPORT EXCEL DIRECT (appelé depuis le modal unifié)
   (différente de l'ancienne exporterEquipementExcel qui ouvre son propre modal)
   ═══════════════════════════════════════════════════════════ */
window.exporterEquipementExcelDirect = function() {
  const moisDebut = currentEquipDebut;
  const moisFin   = currentEquipFin;
  const numero = numeroEquipementPourPeriode(moisDebut, moisFin);
  const periodeTxt = moisDebut === moisFin
    ? formatMoisFR(moisDebut)
    : `${formatMoisFR(moisDebut)} → ${formatMoisFR(moisFin)}`;

  const data = calculerEquipementsPeriode(moisDebut, moisFin);

  const totaux = { entretien:0, gms:0, fournitures:0, peage:0,
                   parTR:{TR1:0,TR2:0,TR3:0,TR4:0}, general:0 };
  ['TR1','TR2','TR3','TR4'].forEach(tr => {
    const d = data[tr];
    totaux.entretien += d.entretien;
    totaux.gms += d.gms;
    totaux.fournitures += d.fournitures;
    totaux.peage += d.peage;
    totaux.parTR[tr] = d.entretien + d.gms + d.fournitures + d.peage;
    totaux.general += totaux.parTR[tr];
  });

  const fmt = v => (v || 0).toFixed(2);

  let html = `<h2>Équipements N°${numero} — ${periodeTxt}</h2>`;
  html += '<table border="1" style="border-collapse:collapse;font-family:Tahoma;font-size:11pt;">';
  html += '<tr style="background:#5b21b6;color:#fff;">';
  ['Tronçon','TR1','TR2','TR3','TR4','Total des TR'].forEach(h =>
    html += `<th style="padding:6px;border:1px solid #333;">${h}</th>`);
  html += '</tr>';

  const cats = [
    { key:'entretien', label:'Entretien courant de la signalisation verticale et dispositifs de sécurité' },
    { key:'gms', label:'GMS' },
    { key:'fournitures', label:'Fournitures de viabilité' },
    { key:'peage', label:'Matériel de péage' }
  ];
  cats.forEach(c => {
    html += `<tr>
      <td style="padding:6px;border:1px solid #333;">${c.label}</td>
      <td style="padding:6px;border:1px solid #333;text-align:right;">${fmt(data.TR1[c.key])}</td>
      <td style="padding:6px;border:1px solid #333;text-align:right;">${fmt(data.TR2[c.key])}</td>
      <td style="padding:6px;border:1px solid #333;text-align:right;">${fmt(data.TR3[c.key])}</td>
      <td style="padding:6px;border:1px solid #333;text-align:right;">${fmt(data.TR4[c.key])}</td>
      <td style="padding:6px;border:1px solid #333;text-align:right;font-weight:600;">${fmt(totaux[c.key])}</td>
    </tr>`;
  });

  html += `<tr style="background:#5b21b6;color:#fff;font-weight:700;">
    <td style="padding:6px;border:1px solid #333;">Total Période</td>
    <td style="padding:6px;border:1px solid #333;text-align:right;">${fmt(totaux.parTR.TR1)}</td>
    <td style="padding:6px;border:1px solid #333;text-align:right;">${fmt(totaux.parTR.TR2)}</td>
    <td style="padding:6px;border:1px solid #333;text-align:right;">${fmt(totaux.parTR.TR3)}</td>
    <td style="padding:6px;border:1px solid #333;text-align:right;">${fmt(totaux.parTR.TR4)}</td>
    <td style="padding:6px;border:1px solid #333;text-align:right;">${fmt(totaux.general)}</td>
  </tr></table>`;

  const doc = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body>${html}</body></html>`;
  const blob = new Blob(['\ufeff', doc], { type: 'application/vnd.ms-excel' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Equipements_N${numero}_${moisDebut}_${moisFin}.xls`;
  a.click();
  URL.revokeObjectURL(a.href);
  fermerModale();
  notifier('📥 Excel téléchargé', 'success');
};

/* ═══════════════════════════════════════════════════════════
   📤 CENTRE D'EXPORT & IMPRESSION
   ═══════════════════════════════════════════════════════════ */
let exportFilterDebut = new Date().toISOString().slice(0,7);
let exportFilterFin   = new Date().toISOString().slice(0,7);
let exportFilterTR    = '';

/* ─── SWITCH TAB ─── */
window.switchExport = function() {
  const pd = document.getElementById('export-picker-debut');
  const pf = document.getElementById('export-picker-fin');
  if (pd && !pd.innerHTML.trim()) {
    pd.innerHTML = htmlMonthPicker('export-debut', exportFilterDebut, 'appliquerFiltresExport');
    pf.innerHTML = htmlMonthPicker('export-fin', exportFilterFin, 'appliquerFiltresExport');
  } else if (pd) {
    const yD = document.getElementById('export-debut-year');
    const mD = document.getElementById('export-debut-month');
    const yF = document.getElementById('export-fin-year');
    const mF = document.getElementById('export-fin-month');
    if (yD) yD.value = exportFilterDebut.slice(0,4);
    if (mD) mD.value = exportFilterDebut.slice(5,7);
    if (yF) yF.value = exportFilterFin.slice(0,4);
    if (mF) mF.value = exportFilterFin.slice(5,7);
  }
  const sel = document.getElementById('export-filter-troncon');
  if (sel) sel.value = exportFilterTR;
  rendreExportCentre();
};

/* ─── APPLIQUER FILTRES ─── */
window.appliquerFiltresExport = function() {
  const d = getMonthPickerValue('export-debut');
  const f = getMonthPickerValue('export-fin');
  if (!d || !f) return;
  if (f < d) { notifier('⚠️ La date de fin doit être ≥ au début', 'danger'); return; }
  exportFilterDebut = d;
  exportFilterFin = f;
  exportFilterTR = document.getElementById('export-filter-troncon')?.value || '';
  rendreExportCentre();
  notifier('🔄 Filtres appliqués', 'info');
};

/* ─── RENDRE LES CARTES ─── */
function rendreExportCentre() {
  const cont = document.getElementById('export-grid-center');
  if (!cont) return;
  const d = exportFilterDebut, f = exportFilterFin, tr = exportFilterTR;

  const nbCat = DATA.catalogue.length;
  const nbCmd = DATA.commandes.filter(c => {
    const m = (c.date || '').slice(0,7);
    return m >= d && m <= f;
  }).length;
  const nbMetre = DATA.metresEnregistres.filter(m =>
    m.mois >= d && m.mois <= f && (!tr || m.troncon === tr)
  ).length;
  const nbConstat = DATA.constatsEnregistres.filter(c =>
    c.mois >= d && c.mois <= f && (!tr || c.troncon === tr)
  ).length;
  const nbSuivi = DATA.suivisPrix.filter(s => {
    const dd = s.moisDebut || s.mois;
    return dd >= d && dd <= f;
  }).length;
  const nbEquip = DATA.equipementsEnregistres.filter(e => {
    const dd = e.moisDebut || e.mois;
    return dd >= d && dd <= f;
  }).length;
  const nbSin = extraireSinistres().filter(s => {
    const m = moisDeDate(s.date);
    return m >= d && m <= f && (!tr || s.troncon === tr);
  }).length;
  const nbFac = DATA.facturesEnregistrees.filter(x => {
    const m = moisDeDate(x.date);
    return m >= d && m <= f;
  }).length;

  const cards = [
    { key:'catalogue',   icon:'📚', titre:'Catalogue (DE)', count:`${nbCat} prix`,                color:'#1e3a8a' },
    { key:'commandes',   icon:'📝', titre:'Commandes',      count:`${nbCmd} commande(s)`,         color:'#0891b2' },
    { key:'metre',       icon:'📑', titre:'Metré',          count:`${nbMetre} enregistré(s)`,     color:'#3b82f6' },
    { key:'constat',     icon:'📋', titre:'Constats',       count:`${nbConstat} enregistré(s)`,   color:'#f59e0b' },
    { key:'suivi',       icon:'💰', titre:'Suivi des Prix', count:`${nbSuivi} suivi(s)`,          color:'#16a34a' },
    { key:'equipements', icon:'🏗️', titre:'Équipements',    count:`${nbEquip} enregistré(s)`,     color:'#5b21b6' },
    { key:'sinistres',   icon:'🚨', titre:'Sinistres',      count:`${nbSin} sinistre(s)`,         color:'#b91c1c' },
    { key:'factures',    icon:'🧾', titre:'Factures',       count:`${nbFac} facture(s)`,          color:'#dc2626' }
  ];

  cont.innerHTML = cards.map(c => `
    <div class="export-card-modern" style="border-top-color:${c.color}">
      <div class="export-card-icon">${c.icon}</div>
      <div class="export-card-title">${c.titre}</div>
      <div class="export-card-count">${c.count}</div>
      <button class="btn btn-primary btn-sm" onclick="apercuExport('${c.key}')"
              style="width:100%;margin-top:10px;">👁️ Aperçu & Export</button>
    </div>
  `).join('');
}

/* ─── HELPERS DE FILTRAGE ─── */
function getCommandesExport(d, f) {
  return DATA.commandes.filter(c => {
    const m = (c.date || '').slice(0,7);
    return m >= d && m <= f;
  });
}

function getSinistresExport(d, f, tr) {
  return extraireSinistres().filter(s => {
    const m = moisDeDate(s.date);
    return m >= d && m <= f && (!tr || s.troncon === tr);
  });
}

function getFacturesExport(d, f) {
  return DATA.facturesEnregistrees.filter(x => {
    const m = moisDeDate(x.date);
    return m >= d && m <= f;
  });
}

/* ─── EXPORT EXCEL GÉNÉRIQUE ─── */
function exporterContenuExcel(html, nomFichier) {
  const doc = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head>
    <meta charset="UTF-8">
    <style>
      body { font-family: Tahoma, Arial, sans-serif; font-size: 10pt; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #333; padding: 4px 6px; }
      th { background: #d9e1f2; font-weight: bold; }
      .entete-commande { padding: 8px 14px; border: 1.5px solid #1e3a8a; margin-bottom: 6px; }
      .entete-ligne-unique { display: flex; align-items: center; gap: 10px; padding-bottom: 6px; border-bottom: 1px solid #cbd5e1; margin-bottom: 6px; }
      .entete-logo { max-height: 55px; }
      .entete-titres { display: flex; flex-direction: row; gap: 14px; align-items: baseline; }
      .entete-titres .num { font-size: 14pt; font-weight: bold; color: #1e3a8a; }
      .entete-titres .date { font-size: 11pt; }
      .metre-entete-print { padding: 8px; border: 1px solid #1e3a8a; margin-bottom: 6px; }
      .constat-table-print { border-collapse: collapse; width: 100%; }
      .constat-table-print th, .constat-table-print td { border: 1px solid #333; padding: 3px 5px; }
      .constat-table-print thead th { background: #d9e1f2; }
    </style>
  </head><body>${html}</body></html>`;

  const blob = new Blob(['\ufeff', doc], { type: 'application/vnd.ms-excel' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nomFichier;
  a.click();
  URL.revokeObjectURL(a.href);
  notifier('📥 Excel téléchargé', 'success');
}

/* ─── ROUTEUR D'APERÇU ─── */
window.apercuExport = function(key) {
  const d = exportFilterDebut, f = exportFilterFin, tr = exportFilterTR;
  const periode = formatMoisFR(d) + (d === f ? '' : ' → ' + formatMoisFR(f));
  const trLabel = tr || 'Tous';

  let titre = '', html = '', nomFichier = '';

  /* ═══ 1. CATALOGUE ═══ */
  if (key === 'catalogue') {
    if (DATA.catalogue.length === 0) { notifier('⚠️ Catalogue vide', 'danger'); return; }
    titre = `Catalogue DE — ${DATA.catalogue.length} prix`;
    html = tableCatalogueHTML();
    nomFichier = `Catalogue_${d}.xls`;
  }

  /* ═══ 2. COMMANDES ═══ */
  else if (key === 'commandes') {
    const cmds = getCommandesExport(d, f);
    if (cmds.length === 0) { notifier('⚠️ Aucune commande dans cette période', 'danger'); return; }
    titre = `${cmds.length} commande(s) — ${periode}`;
    html = cmds.map(c =>
      `<div class="commande-page">${genererEnteteHTML(c)}${genererTableHTML(c)}</div>`
    ).join('');
    nomFichier = `Commandes_${d}_${f}.xls`;
  }

  /* ═══ 3. METRÉ (agrégé par prix) ═══ */
  else if (key === 'metre') {
    const metList = DATA.metresEnregistres.filter(m =>
      m.mois >= d && m.mois <= f && (!tr || m.troncon === tr)
    );
    if (metList.length === 0) { notifier('⚠️ Aucun Metré dans cette période', 'danger'); return; }

    /* Agrégation par prix */
    const agg = {};
    metList.forEach(m => {
      Object.values(m.entrees || {}).forEach(row => {
        Object.entries(row).forEach(([p, q]) => {
          const pn = parseInt(p);
          agg[pn] = (agg[pn] || 0) + (parseFloat(q) || 0);
        });
      });
    });

    const prixList = Object.keys(agg).map(p => parseInt(p)).sort((a,b) => a-b);
    let total = 0;
    prixList.forEach(p => {
      const cat = DATA.catalogue.find(x => x.numero === p);
      total += agg[p] * (cat?.prixUnitaire || 0);
    });

    titre = `Metré récapitulatif — ${periode}${tr ? ' — ' + tr : ''}`;
    html = `
      <h3 style="text-align:center;color:#1e3a8a;">METRÉ RÉCAPITULATIF</h3>
      <p style="text-align:center;">Période : <b>${periode}</b> — Tronçon : <b>${trLabel}</b></p>
      <table class="constat-table-print">
        <thead><tr>
          <th style="width:60px;">N° Prix</th><th>Libellé</th>
          <th style="width:70px;">Unité</th><th style="width:100px;">Qté totale</th>
          <th style="width:100px;">P.U (DH)</th><th style="width:120px;">Montant (DH)</th>
        </tr></thead>
        <tbody>
          ${prixList.map(p => {
            const cat = DATA.catalogue.find(x => x.numero === p);
            const q = agg[p];
            const pu = cat?.prixUnitaire || 0;
            return `<tr>
              <td style="text-align:center;">${p}</td>
              <td style="font-size:9px;">${cat?.libelle || ''}</td>
              <td style="text-align:center;">${cat?.unite || ''}</td>
              <td style="text-align:right;font-weight:700;">${q.toFixed(2)}</td>
              <td style="text-align:right;">${pu.toFixed(2)}</td>
              <td style="text-align:right;font-weight:700;">${(q*pu).toFixed(2)}</td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot><tr style="background:#1e3a8a;color:#fff;">
          <td colspan="5" style="text-align:right;font-weight:700;">TOTAL</td>
          <td style="text-align:right;font-weight:700;">${total.toFixed(2)}</td>
        </tr></tfoot>
      </table>
    `;
    nomFichier = `Metre_${d}_${f}${tr ? '_' + tr : ''}.xls`;
  }

  /* ═══ 4. CONSTAT (agrégé) ═══ */
  else if (key === 'constat') {
    const cstList = DATA.constatsEnregistres.filter(c =>
      c.mois >= d && c.mois <= f && (!tr || c.troncon === tr)
    );
    if (cstList.length === 0) { notifier('⚠️ Aucun Constat dans cette période', 'danger'); return; }

    /* Fusionner les cumulées */
    const agg = {};
    cstList.forEach(c => {
      /* Prendre le plus récent par prix */
      Object.entries(c.cumulees || {}).forEach(([p, v]) => {
        const pn = parseInt(p);
        if (!agg[pn] || (v > agg[pn])) agg[pn] = parseFloat(v) || 0;
      });
    });

    const prixList = Object.keys(agg).map(p => parseInt(p)).sort((a,b) => a-b);
    titre = `Constats récapitulatifs — ${periode}${tr ? ' — ' + tr : ''}`;
    html = `
      <h3 style="text-align:center;color:#c2410c;">CONSTATS RÉCAPITULATIFS</h3>
      <p style="text-align:center;">Période : <b>${periode}</b> — Tronçon : <b>${trLabel}</b></p>
      <table class="constat-table-print">
        <thead><tr>
          <th style="width:60px;">N° Prix</th><th>Libellé</th>
          <th style="width:70px;">Unité</th><th style="width:120px;">Qté cumulée</th>
        </tr></thead>
        <tbody>
          ${prixList.map(p => {
            const cat = DATA.catalogue.find(x => x.numero === p);
            return `<tr>
              <td style="text-align:center;">${p}</td>
              <td style="font-size:9px;">${cat?.libelle || ''}</td>
              <td style="text-align:center;">${cat?.unite || ''}</td>
              <td style="text-align:right;font-weight:700;">${agg[p].toFixed(2)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
    nomFichier = `Constat_${d}_${f}${tr ? '_' + tr : ''}.xls`;
  }

  /* ═══ 5. SUIVI DES PRIX ═══ */
  else if (key === 'suivi') {
    /* Utiliser la période du Suivi */
    currentSuiviDebut = d;
    currentSuiviFin = f;
    apercuSuivi();
    return;
  }

  /* ═══ 6. ÉQUIPEMENTS ═══ */
  else if (key === 'equipements') {
    currentEquipDebut = d;
    currentEquipFin = f;
    apercuEquipement();
    return;
  }

  /* ═══ 7. SINISTRES ═══ */
  else if (key === 'sinistres') {
    const sin = getSinistresExport(d, f, tr);
    if (sin.length === 0) { notifier('⚠️ Aucun sinistre dans cette période', 'danger'); return; }
    titre = `${sin.length} sinistre(s) — ${periode}`;
    html = `
      <h3 style="text-align:center;color:#b91c1c;">LISTE DES SINISTRES</h3>
      <p style="text-align:center;">Période : <b>${periode}</b> — Tronçon : <b>${trLabel}</b></p>
      <table class="constat-table-print">
        <thead><tr>
          <th style="width:60px;">Tronçon</th><th style="width:80px;">PK</th>
          <th style="width:50px;">Sens</th><th style="width:60px;">Côté</th>
          <th>Dégâts</th><th style="width:80px;">Date</th><th style="width:70px;">Cmd</th>
        </tr></thead>
        <tbody>
          ${sin.map(s => `<tr>
            <td style="text-align:center;">${s.troncon}</td>
            <td style="text-align:center;font-family:Consolas;">${s.pk}</td>
            <td style="text-align:center;">${s.sens}</td>
            <td style="text-align:center;">${s.cote}</td>
            <td style="font-size:9px;">${s.designation || ''}</td>
            <td style="text-align:center;color:#b91c1c;font-weight:700;">${s.date}</td>
            <td style="text-align:center;font-size:8px;">${s.cmdNumero || ''}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    `;
    nomFichier = `Sinistres_${d}_${f}${tr ? '_' + tr : ''}.xls`;
  }

  /* ═══ 8. FACTURES ═══ */
  else if (key === 'factures') {
    const fac = getFacturesExport(d, f);
    if (fac.length === 0) { notifier('⚠️ Aucune facture dans cette période', 'danger'); return; }
    const totalTTC = fac.reduce((s, x) => s + (x.totalTTC || 0), 0);
    titre = `${fac.length} facture(s) — ${periode}`;
    html = `
      <h3 style="text-align:center;color:#dc2626;">LISTE DES FACTURES</h3>
      <p style="text-align:center;">Période : <b>${periode}</b></p>
      <table class="constat-table-print">
        <thead><tr>
          <th style="width:80px;">N° Facture</th><th style="width:80px;">Date</th>
          <th style="width:80px;">PK</th><th style="width:50px;">Sens</th>
          <th style="width:60px;">Côté</th><th>Dégâts</th>
          <th style="width:100px;">Total TTC (DH)</th>
        </tr></thead>
        <tbody>
          ${fac.map(f => `<tr>
            <td style="text-align:center;font-weight:700;">${f.numero}</td>
            <td style="text-align:center;">${f.date}</td>
            <td style="text-align:center;font-family:Consolas;">${f.pk}</td>
            <td style="text-align:center;">${f.sens}</td>
            <td style="text-align:center;">${f.cote}</td>
            <td style="font-size:9px;">${f.degats || ''}</td>
            <td style="text-align:right;font-weight:700;">${(f.totalTTC || 0).toFixed(2)}</td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr style="background:#dc2626;color:#fff;">
          <td colspan="6" style="text-align:right;font-weight:700;">TOTAL GÉNÉRAL</td>
          <td style="text-align:right;font-weight:700;">${totalTTC.toFixed(2)}</td>
        </tr></tfoot>
      </table>
    `;
    nomFichier = `Factures_${d}_${f}.xls`;
  }

  if (!html) { notifier('⚠️ Rien à afficher', 'danger'); return; }

  ouvrirModalUnifie(titre, html, () => exporterContenuExcel(html, nomFichier));
};
/* ═══════════════════════════════════════════════════════════
   🖋️ RÉCUPÉRATION AUTOMATIQUE DES SIGNATURES PAR TR
   ═══════════════════════════════════════════════════════════ */
function getSignaturesPourTR(tr) {
  const p = DATA.parametres;
  const sig = (p.signatures || {})[tr] || {};
  const ing1 = (p.ingenieurs && p.ingenieurs.ing1) || {};
  const ing2 = (p.ingenieurs && p.ingenieurs.ing2) || {};
  const ent  = p.entreprise || {};

  /* Si le titulaire est en congé → utiliser le remplaçant */
  const techNom      = sig.enConge && sig.remplacant ? sig.remplacant : (sig.nom || '');
  const techFonction = sig.fonction || '';

  /* Ingénieur selon le TR */
  const ing = (tr === 'TR1' || tr === 'TR2') ? ing1 : ing2;

  return {
    dressePar:   techFonction,
    dresseNom:   techNom,
    dresseNomOrigine: sig.nom || '',
    enConge:     !!sig.enConge,
    validePar:   ing.fonction || '',
    valideNom:   ing.nom || '',
    acceptePar:  ent.texte || '',
    accepteNom:  ent.nom || '',
    accepteDate: ent.date || ''
  };
}

/* ═══════════════════════════════════════════════════════════
   📁 SIDEBAR MARCHÉS — Reconstruction dynamique
   ═══════════════════════════════════════════════════════════ */


/* ─── Supprimer un marché (avec protection) ─── */
window.supprimerMarche = function(id) {
  if (!id) return;

  /* Protection : ne pas supprimer le dernier marché */
  if (Object.keys(DATA.configsMarches).length <= 1) {
    notifier('⚠️ Impossible de supprimer le dernier marché', 'danger');
    return;
  }

  /* Protection : ne pas supprimer le marché actif s'il y a des données */
  if (id === DATA.marcheActif) {
    notifier('⚠️ Basculez d\'abord vers un autre marché', 'danger');
    return;
  }

  const cfg = DATA.configsMarches[id] || {};
  const nbCmd = (DATA.marches[id]?.commandes || []).length;
  const nbMetre = (DATA.marches[id]?.metresEnregistres || []).length;

  const msg = `Supprimer le marché "${id}" ?\n\n` +
              `⚠️ Cela effacera TOUTES ses données :\n` +
              `   • ${nbCmd} commande(s)\n` +
              `   • ${nbMetre} metré(s)\n\n` +
              `Cette action est irréversible.`;

  if (!confirm(msg)) return;
  if (!confirm('Confirmer une seconde fois ?')) return;

  delete DATA.configsMarches[id];
  delete DATA.marches[id];
  logHistorique('SUPPRESSION MARCHÉ', id);
  sauvegarderDonnees(true);
  rebuildSidebarMarches();
  notifier(`🗑️ Marché ${id} supprimé`, 'success');
};



/* ═══════════════════════════════════════════════════════════
   🚀 INITIALISATION
   ═══════════════════════════════════════════════════════════ */

/* Période large par défaut : toute l'année en cours + suivante */
(function initPeriodeDefaut() {
  const y = new Date().getFullYear();
  if (!currentDashDebut || currentDashDebut === y + '-' + String(new Date().getMonth()+1).padStart(2,'0')) {
    currentDashDebut = `${y}-01`;
    currentDashFin   = `${y}-12`;
  }
  if (!currentMoisMetre)    currentMoisMetre    = new Date().toISOString().slice(0,7);
  if (!currentMoisConstat)  currentMoisConstat  = new Date().toISOString().slice(0,7);
  if (typeof currentSuiviDebut !== 'undefined' && !currentSuiviDebut) currentSuiviDebut = new Date().toISOString().slice(0,7);
  if (typeof currentSuiviFin !== 'undefined' && !currentSuiviFin) currentSuiviFin = new Date().toISOString().slice(0,7);
  if (typeof currentEquipDebut !== 'undefined' && !currentEquipDebut) currentEquipDebut = new Date().toISOString().slice(0,7);
  if (typeof currentEquipFin !== 'undefined' && !currentEquipFin) currentEquipFin = new Date().toISOString().slice(0,7);
  if (typeof currentEtatDebut !== 'undefined' && !currentEtatDebut) currentEtatDebut = new Date().toISOString().slice(0,7);
  if (typeof currentEtatFin !== 'undefined' && !currentEtatFin) currentEtatFin = new Date().toISOString().slice(0,7);
})();

/* Date d'import par défaut */
const importDateEl = document.getElementById('import-date');
if (importDateEl) importDateEl.valueAsDate = new Date();

/* Affichage du nom du marché dans le header */
const headerNom = document.getElementById('header-marche-nom');
if (headerNom && window.MARCHE_NOM) {
  headerNom.textContent = ID_MARCHE + ' — ' + window.MARCHE_NOM;
}

/* ═══════════════════════════════════════════════════════════
   🚀 INITIALISATION ASYNC
   ═══════════════════════════════════════════════════════════ */
(async function initApp() {
  console.log('🚀 Démarrage de l\'application...');

  try {
    DATA = await chargerDonneesAsync();
  } catch (e) {
    console.error('❌ Erreur chargement:', e);
    console.warn('⚠️ Utilisation des données par défaut');
  }

  /* Période */
  const y = new Date().getFullYear();
  if (!currentDashDebut) currentDashDebut = `${y}-01`;
  if (!currentDashFin) currentDashFin = `${y}-12`;
  if (!currentMoisMetre) currentMoisMetre = new Date().toISOString().slice(0,7);
  if (!currentMoisConstat) currentMoisConstat = new Date().toISOString().slice(0,7);
  if (typeof currentSuiviDebut !== 'undefined' && !currentSuiviDebut) currentSuiviDebut = new Date().toISOString().slice(0,7);
  if (typeof currentSuiviFin !== 'undefined' && !currentSuiviFin) currentSuiviFin = new Date().toISOString().slice(0,7);
  if (typeof currentEquipDebut !== 'undefined' && !currentEquipDebut) currentEquipDebut = new Date().toISOString().slice(0,7);
  if (typeof currentEquipFin !== 'undefined' && !currentEquipFin) currentEquipFin = new Date().toISOString().slice(0,7);
  if (typeof currentEtatDebut !== 'undefined' && !currentEtatDebut) currentEtatDebut = new Date().toISOString().slice(0,7);
  if (typeof currentEtatFin !== 'undefined' && !currentEtatFin) currentEtatFin = new Date().toISOString().slice(0,7);

  const importDateEl = document.getElementById('import-date');
  if (importDateEl) importDateEl.valueAsDate = new Date();

  const headerNom = document.getElementById('header-marche-nom');
  if (headerNom && window.MARCHE_NOM) {
    headerNom.textContent = ID_MARCHE + ' — ' + window.MARCHE_NOM;
  }

  const tasks = [
    ['Dashboard',             () => rendreDashboard()],
    ['Formulaire paramètres', () => chargerFormParametres()],
    ['Catalogue',             () => rendreCatalogue()],
    ['Commandes',             () => rendreListeCommandes()],
    ['Historique',            () => rendreHistorique()],
    ['Mois Metré',            () => changerMoisMetre(currentMoisMetre)],
    ['Mois Constat',          () => changerMoisConstat(currentMoisConstat)],
    ['Switch Metré',          () => switchMetre('TR1')],
    ['Switch Constat',        () => switchConstat('TR1')]
  ];

  tasks.forEach(([nom, fn]) => {
    try { fn(); }
    catch(e) { console.error(`❌ Init ${nom} :`, e); }
  });

  console.log('✅ Prête —', ID_MARCHE);
  console.log('   • Commandes:', DATA.commandes.length);
  console.log('   • Catalogue:', DATA.catalogue.length);
  console.log('   • Metrés:', DATA.metresEnregistres.length);
  console.log('   • PAT configuré:', ghHasToken ? ghHasToken() : false);
})();