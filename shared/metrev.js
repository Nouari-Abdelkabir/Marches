/* ═══════════════════════════════════════════════════════════
   📐 METREV.JS — Metré Bâtiment (Gares / Sites)
   Version : Novembre 2025
   ═══════════════════════════════════════════════════════════ */

/* ─── État ─── */
let currentMetreVTR = 'TR1';
let currentMoisMetreV = new Date().toISOString().slice(0,7);

/* ═══════════════════════════════════════════════════════════
   1. TABLE GARES → TR
   ═══════════════════════════════════════════════════════════ */
const GARES_PAR_TR = {
  'TR1': [
    'Gare de BERRECHID SUD',
    'Gare de BERRECHID PK 34',
    'PDV ADS TOTAL',
    'Gare de SETTAT NORD',
    'Gare de SETTAT CENTRE'
  ],
  'TR2': [
    'Gare de la Palmeraie',
    'Gare de Bengrir',
    'Gare de Skhour'
  ],
  'TR3': [
    'Gare de Targa',
    'Gare de Chichaoua',
    'Gare de Tamnsourt',
    'Gare de Loudaya'
  ],
  'TR4': [
    'Gare de imintanout',
    'Gare de argana',
    'Tunnel',
    'Gare de péage BPV Amskroud',
    'Gare sur échangeur 77',
    'Gare sur échangeur 78'
  ]
};

/* ═══════════════════════════════════════════════════════════
   2. SWITCH TR
   ═══════════════════════════════════════════════════════════ */
window.switchMetreV = function(tr) {
  currentMetreVTR = tr;
  document.querySelectorAll('#subtabs-metrev .sub-tab').forEach(t => {
    t.classList.toggle('active', t.textContent.includes(tr));
  });
  rendreMetreV(tr);
  rendreMetreVEnregistres();
};

/* ═══════════════════════════════════════════════════════════
   3. RENDU PRINCIPAL
   ═══════════════════════════════════════════════════════════ */
function rendreMetreV(tr) {
  const cont = document.getElementById('metrev-content');
  if (!cont) return;

  const mois = currentMoisMetreV;
  const numero = numeroMetreVPourMois(mois, tr);
  const m = DATA.metreV?.[tr]?.[mois];

  /* ─── Toolbar ─── */
  const toolbar = `
    <div class="metre-toolbar" style="background:#fef2f2;padding:12px 16px;border-radius:8px;
         margin-bottom:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;
         border:2px solid #fecaca;">
      <label style="font-weight:700;color:#b91c1c;">📅 Mois :</label>
      ${htmlMonthPicker('metrev-mois', mois, 'changerMoisMetreVPicker')}
      <span style="font-weight:700;color:#b91c1c;">${formatMoisFR(mois)}</span>
      <span style="background:#b91c1c;color:#fff;padding:5px 14px;border-radius:12px;
                   font-weight:700;font-size:13px;">MetréV N°${numero}</span>
      <span style="font-size:12px;color:#64748b;">Tronçon ${tr}</span>
      <input type="file" id="file-metrev-import" accept=".xlsx,.xls" hidden>
      <button class="btn btn-primary btn-sm"
              onclick="document.getElementById('file-metrev-import').click()"
              style="margin-left:auto;">📥 Importer Excel</button>
      <button class="btn btn-secondary btn-sm" onclick="apercuMetreV('${tr}')">
        👁️ Aperçu
      </button>
      <button class="btn btn-primary btn-sm" onclick="sauvegarderMetreVMois()">
        💾 Enregistrer
      </button>
    </div>
  `;

  /* ─── Si pas de données ─── */
  if (!m || !m.colonnes || m.colonnes.length === 0) {
    cont.innerHTML = toolbar + `
      <div class="panel">
        <p style="text-align:center;padding:30px;color:#64748b;">
          Aucune donnée pour <strong>${formatMoisFR(mois)}</strong>.<br>
          <small>Importez un fichier Excel (Metré ${tr}.xlsx) qui contient les gares de ${tr}.</small>
        </p>
      </div>`;
    return;
  }

  /* ─── Tableau ─── */
  const html = toolbar + `
    <div class="panel">
      <div class="metre-scroll">
        <table class="metre-table">
          <thead>
            <tr>
              <th rowspan="2" style="width:45px;">N°</th>
              <th rowspan="2">Désignation</th>
              <th rowspan="2" style="width:40px;">U</th>
              <th rowspan="2" style="width:60px;">PU</th>
              ${m.colonnes.map(c =>
                `<th style="background:#1e3a8a;color:#fff;font-size:9px;">${c.gare}</th>`
              ).join('')}
              <th rowspan="2" style="width:80px;background:#c2410c;color:#fff;">Total</th>
            </tr>
            <tr>
              ${m.colonnes.map(c =>
                `<th style="background:#3b82f6;color:#fff;font-size:8px;">${c.sousElement || ''}</th>`
              ).join('')}
            </tr>
          </thead>
          <tbody>
            ${DATA.catalogue.map(p => {
              const total = getTotalLigneMetreV(tr, mois, p.numero);
              return `
                <tr${total > 0 ? ' style="background:#fff9c4;"' : ''}>
                  <td style="text-align:center;font-weight:700;">${p.numero}</td>
                  <td style="font-size:10px;">${p.libelle}</td>
                  <td style="text-align:center;">${p.unite}</td>
                  <td style="text-align:right;">${p.prixUnitaire.toFixed(2)}</td>
                  ${m.colonnes.map(c => {
                    const q = getQteMetreV(tr, mois, p.numero, c.id);
                    return `<td style="padding:0;">
                      <input type="number" min="0" step="0.01" value="${q || ''}"
                        onchange="setQteMetreV('${tr}', '${mois}', ${p.numero}, '${c.id}', this.value)"
                        style="width:100%;border:1px solid transparent;text-align:center;font-size:10px;padding:2px;">
                    </td>`;
                  }).join('')}
                  <td style="text-align:right;font-weight:700;background:#fef3c7;padding:4px;">
                    ${total > 0 ? total.toFixed(2) : ''}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="4" style="text-align:right;">TOTAL</td>
              ${m.colonnes.map(c => {
                const total = getTotalColonneMetreV(tr, mois, c.id);
                return `<td style="text-align:center;">${total > 0 ? total.toFixed(2) : ''}</td>`;
              }).join('')}
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;
  cont.innerHTML = html;

  /* Initialiser l'import */
  cont.innerHTML = html;
}

/* ═══════════════════════════════════════════════════════════
   4. CHANGER LE MOIS
   ═══════════════════════════════════════════════════════════ */
window.changerMoisMetreVPicker = function() {
  const v = getMonthPickerValue('metrev-mois');
  if (v) {
    currentMoisMetreV = v;
    rendreMetreV(currentMetreVTR);
    rendreMetreVEnregistres();
  }
};

/* ═══════════════════════════════════════════════════════════
   5. IMPORT EXCEL
   ═══════════════════════════════════════════════════════════ */
function initImportMetreV() {
  const input = document.getElementById('file-metrev-import');
  if (!input) return;

  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const tr = currentMetreVTR;
    const mois = currentMoisMetreV;

    try {
      notifier('⏳ Analyse du fichier...', 'info');

      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

      /* ─── Trouver la ligne d'en-tête (contient "N°") ─── */
      let headerIdx = -1;
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const r = rows[i];
        if (r.some(c => String(c).trim().toUpperCase() === 'N°')) {
          headerIdx = i;
          break;
        }
      }
      if (headerIdx === -1) throw new Error('En-tête "N°" introuvable');

      /* ─── La ligne AVANT = Gares ─── */
      const ligneGares = headerIdx > 0 ? rows[headerIdx - 1] : [];
      const ligneSousElements = rows[headerIdx];

      /* ─── Nombre de colonnes fixes (N°, DESIGNATION, U, P.U.) ─── */
      let nbColonnesFixes = 4;
      for (let i = 0; i < ligneSousElements.length; i++) {
        const val = String(ligneSousElements[i] || '').trim().toUpperCase();
        if (val === 'P.U.' || val === 'P.U' || val === 'PU') {
          nbColonnesFixes = i + 1;
          break;
        }
      }

      /* ─── Construire les colonnes dynamiques ─── */
      const colonnes = [];
      let derniereGare = '';

      for (let i = nbColonnesFixes; i < ligneSousElements.length; i++) {
        const sousElem = String(ligneSousElements[i] || '').trim();
        const gare = String(ligneGares[i] || '').trim();

        /* Ignorer les colonnes de totaux */
        if (/quantit|montant|total/i.test(sousElem)) break;
        if (!sousElem) continue;

        /* Mettre à jour la gare courante */
        if (gare) derniereGare = gare;

        colonnes.push({
          id: 'c_' + (i - nbColonnesFixes + 1),
          index: i,
          gare: derniereGare || `Colonne ${i}`,
          sousElement: sousElem
        });
      }

      if (colonnes.length === 0) throw new Error('Aucune colonne de données trouvée');

      /* ─── Filtrer : garder seulement les gares du TR ─── */
      const garesTR = GARES_PAR_TR[tr] || [];
      const colonnesFiltrees = colonnes.filter(c => {
        const gareNorm = c.gare.toLowerCase().replace(/gare de\s*/i, '').trim();
        return garesTR.some(g => {
          const gNorm = g.toLowerCase().replace(/gare de\s*/i, '').trim();
          return gareNorm.includes(gNorm) || gNorm.includes(gareNorm);
        });
      });

      if (colonnesFiltrees.length === 0) {
        throw new Error(
          `Aucune gare de ${tr} trouvée.\n` +
          `Gares détectées : ${[...new Set(colonnes.map(c => c.gare))].join(', ')}\n` +
          `Gares attendues : ${garesTR.join(', ')}`
        );
      }

      /* Réindexer les IDs après filtrage */
      colonnesFiltrees.forEach((c, i) => { c.id = 'c_' + (i + 1); });

      console.log(`✅ ${colonnesFiltrees.length} colonnes gardées sur ${colonnes.length}`);
      console.log('Gares gardées :', [...new Set(colonnesFiltrees.map(c => c.gare))]);

      /* ─── Extraire les lignes ─── */
      const lignes = {};
      let nbLignes = 0;

      for (let i = headerIdx + 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[0]) continue;

        const n = parseFloat(String(r[0]).replace(/[^\d.]/g, ''));
        if (!n) continue;

        lignes[n] = {};
        let hasData = false;

        colonnesFiltrees.forEach(c => {
          const rawVal = String(r[c.index] ?? '').replace(/\s/g, '').replace(',', '.');
          const q = parseFloat(rawVal) || 0;
          if (q > 0) {
            lignes[n][c.id] = q;
            hasData = true;
          }
        });

        if (hasData || DATA.catalogue.some(p => p.numero === n)) {
          nbLignes++;
        }
      }

      /* ─── Confirmation ─── */
      const resume = 
        `📊 STRUCTURE DÉTECTÉE\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `🎯 Tronçon : ${tr}\n` +
        `📋 Gares : ${[...new Set(colonnesFiltrees.map(c => c.gare))].length}\n` +
        `📋 Sous-éléments : ${colonnesFiltrees.length}\n` +
        `📝 Prix : ${Object.keys(lignes).length}\n` +
        `📝 Lignes avec données : ${nbLignes}\n\n` +
        `Gares retenues :\n` +
        [...new Set(colonnesFiltrees.map(c => c.gare))]
          .map(g => `  • ${g}`).join('\n') + '\n\n' +
        `━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Continuer l'import ?`;

      if (!confirm(resume)) {
        e.target.value = '';
        return;
      }

      /* ─── Sauvegarder ─── */
      if (!DATA.metreV) DATA.metreV = {};
      if (!DATA.metreV[tr]) DATA.metreV[tr] = {};

      DATA.metreV[tr][mois] = {
        numero: numeroMetreVPourMois(mois, tr),
        colonnes: colonnesFiltrees,
        lignes: lignes,
        dateImport: new Date().toISOString()
      };

      sauvegarderDonnees(true);
      rendreMetreV(tr);

      notifier(
        `✅ Import réussi — ${colonnesFiltrees.length} colonnes, ${Object.keys(lignes).length} prix`,
        'success'
      );

    } catch (err) {
      console.error(err);
      notifier('❌ ' + err.message, 'danger');
    }

    e.target.value = '';
  };
}

/* ═══════════════════════════════════════════════════════════
   6. HELPERS CALCUL
   ═══════════════════════════════════════════════════════════ */
function numeroMetreVPourMois(mois, tr) {
  if (!DATA.metreVEnregistres) DATA.metreVEnregistres = [];
  const list = [...new Set(
    DATA.metreVEnregistres
      .filter(m => m.troncon === tr)
      .map(m => m.mois)
  )];
  if (!list.includes(mois)) list.push(mois);
  list.sort();
  return list.indexOf(mois) + 1;
}

window.getQteMetreV = function(tr, mois, prix, colId) {
  return DATA.metreV?.[tr]?.[mois]?.lignes?.[prix]?.[colId] || 0;
};

window.getTotalLigneMetreV = function(tr, mois, prix) {
  const qtes = DATA.metreV?.[tr]?.[mois]?.lignes?.[prix] || {};
  return Object.values(qtes).reduce((s, q) => s + (parseFloat(q) || 0), 0);
};

window.getTotalColonneMetreV = function(tr, mois, colId) {
  const lignes = DATA.metreV?.[tr]?.[mois]?.lignes || {};
  let total = 0;
  Object.values(lignes).forEach(qtes => {
    total += parseFloat(qtes[colId]) || 0;
  });
  return total;
};

/* ═══════════════════════════════════════════════════════════
   7. HANDLER : MODIFIER UNE QUANTITÉ
   ═══════════════════════════════════════════════════════════ */
window.setQteMetreV = function(tr, mois, prix, colId, value) {
  const q = parseFloat(value) || 0;

  if (!DATA.metreV) DATA.metreV = {};
  if (!DATA.metreV[tr]) DATA.metreV[tr] = {};
  if (!DATA.metreV[tr][mois]) DATA.metreV[tr][mois] = { lignes: {} };
  if (!DATA.metreV[tr][mois].lignes) DATA.metreV[tr][mois].lignes = {};
  if (!DATA.metreV[tr][mois].lignes[prix]) DATA.metreV[tr][mois].lignes[prix] = {};

  if (q > 0) {
    DATA.metreV[tr][mois].lignes[prix][colId] = q;
  } else {
    delete DATA.metreV[tr][mois].lignes[prix][colId];
  }

  sauvegarderDonnees(true);
  rendreMetreV(tr);
};

/* ═══════════════════════════════════════════════════════════
   8. SAUVEGARDER
   ═══════════════════════════════════════════════════════════ */
window.sauvegarderMetreVMois = function() {
  const tr = currentMetreVTR;
  const mois = currentMoisMetreV;

  const m = DATA.metreV?.[tr]?.[mois];
  if (!m || !m.colonnes || m.colonnes.length === 0) {
    notifier('⚠️ Aucune donnée à sauvegarder', 'danger');
    return;
  }

  /* Construire totauxParPrix (pour le Constat) */
  const totauxParPrix = {};
  DATA.catalogue.forEach(p => {
    const total = getTotalLigneMetreV(tr, mois, p.numero);
    if (total > 0) totauxParPrix[p.numero] = total;
  });

  const numero = numeroMetreVPourMois(mois, tr);

  /* Sauvegarder dans metreVEnregistres */
  if (!DATA.metreVEnregistres) DATA.metreVEnregistres = [];

  let existing = DATA.metreVEnregistres.find(x =>
    x.mois === mois && x.troncon === tr
  );

  const data = {
    id: existing?.id || ('mv_' + Date.now()),
    numero,
    mois,
    troncon: tr,
    colonnes: JSON.parse(JSON.stringify(m.colonnes)),
    lignes: JSON.parse(JSON.stringify(m.lignes)),
    totauxParPrix,
    dateReference: getFinDeMois(mois),
    updatedAt: new Date().toISOString()
  };

  if (existing) {
    Object.assign(existing, data);
    notifier(`💾 MetréV N°${numero} — ${tr} mis à jour`, 'success');
  } else {
    DATA.metreVEnregistres.push({ ...data, createdAt: new Date().toISOString() });
    notifier(`💾 MetréV N°${numero} — ${tr} enregistré`, 'success');
  }

  logHistorique('SAUVEGARDE METREV', `N°${numero} — ${tr} — ${formatMoisFR(mois)}`);
  sauvegarderDonnees(true);
  rendreMetreVEnregistres();
};

/* ═══════════════════════════════════════════════════════════
   9. LISTE DES METREV ENREGISTRÉS
   ═══════════════════════════════════════════════════════════ */
window.rendreMetreVEnregistres = function() {
  const cont = document.getElementById('liste-metrev-accordion');
  if (!cont) return;

  const filtreTR = document.getElementById('filtre-metrev-troncon')?.value || '';
  const rech = (document.getElementById('filtre-metrev-recherche')?.value || '').toLowerCase();

  let list = (DATA.metreVEnregistres || []).slice();
  list.forEach(m => { m._numero = numeroMetreVPourMois(m.mois, m.troncon); });
  list.sort((a, b) => (b._numero - a._numero) || a.troncon.localeCompare(b.troncon));

  if (filtreTR) list = list.filter(m => m.troncon === filtreTR);
  if (rech) {
    list = list.filter(m =>
      [String(m._numero), m.dateReference, m.troncon, formatMoisFR(m.mois)]
        .join(' ').toLowerCase().includes(rech));
  }

  if (list.length === 0) {
    cont.innerHTML = '<p style="text-align:center;padding:20px;color:#64748b;">Aucun MetréV enregistré.</p>';
    return;
  }

  cont.innerHTML = list.map(m => {
    /* Compter les prix avec quantité */
    let nbPrix = 0;
    Object.values(m.lignes || {}).forEach(qtes => {
      if (Object.keys(qtes).length > 0) nbPrix++;
    });

    return `
      <div class="cmd-item">
        <div class="cmd-item-header">
          <div class="cmd-item-title">
            <strong>MetréV N°${m._numero}</strong>
            <span class="badge-tr badge-tr${(m.troncon||'TR1')[2]}">${m.troncon}</span>
            <span>📅 ${formatDateFR(m.dateReference)}</span>
            <span>🗓️ ${formatMoisFR(m.mois)}</span>
            <span class="badge badge-tr1">${(m.colonnes||[]).length} colonnes</span>
            <span class="badge badge-tr1">${nbPrix} prix</span>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="btn-icon" title="Charger"
                    onclick="chargerMetreVArchive('${m.id}')">📂</button>
            <button class="btn-icon danger" title="Supprimer"
                    onclick="supprimerMetreVArchive('${m.id}')">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
};

window.chargerMetreVArchive = function(id) {
  const m = DATA.metreVEnregistres.find(x => x.id === id);
  if (!m) return;
  currentMoisMetreV = m.mois;
  currentMetreVTR = m.troncon;
  switchMetreV(m.troncon);
  notifier(`📂 MetréV N°${m.numero} — ${m.troncon} chargé`, 'success');
};

window.supprimerMetreVArchive = function(id) {
  const m = DATA.metreVEnregistres.find(x => x.id === id);
  if (!m) return;
  if (!confirm(`Supprimer MetréV N°${m.numero} — ${m.troncon} (${formatMoisFR(m.mois)}) ?`)) return;
  DATA.metreVEnregistres = DATA.metreVEnregistres.filter(x => x.id !== id);
  logHistorique('SUPPRESSION METREV', `N°${m.numero} — ${m.troncon}`);
  sauvegarderDonnees(true);
  rendreMetreVEnregistres();
  notifier('🗑️ MetréV supprimé', 'success');
};

/* ═══════════════════════════════════════════════════════════
   10. APERÇU + EXPORT EXCEL
   ═══════════════════════════════════════════════════════════ */
window.apercuMetreV = function(tr) {
  const mois = currentMoisMetreV;
  const m = DATA.metreV?.[tr]?.[mois];
  if (!m || !m.colonnes) {
    notifier('⚠️ Aucune donnée à afficher', 'danger');
    return;
  }

  const numero = numeroMetreVPourMois(mois, tr);
  const dateAffichage = formatDateFR(getFinDeMois(mois));

  /* Entête */
  const entete = `
    <div class="metre-entete-print">
      <div class="entete-ligne-unique">
        ${DATA.parametres?.logo ? `<img src="${DATA.parametres.logo}" class="entete-logo">` : ''}
        <div class="entete-titres">
          <span class="num">METRÉV N° ${numero}</span>
          <span class="date">Au ${dateAffichage}</span>
        </div>
      </div>
      <table class="entete-infos">
        <tr>
          <td><span class="lbl">MAITRE D'OUVRAGE :</span> ${DATA.parametres?.mo || ''}</td>
          <td><span class="lbl">MARCHE N° :</span> ${DATA.parametres?.marche || ''}</td>
        </tr>
        <tr>
          <td><span class="lbl">MAITRE D'ŒUVRE :</span> ${DATA.parametres?.moe || ''}</td>
          <td><span class="lbl">Objet :</span> ${DATA.parametres?.objet || ''}</td>
        </tr>
        <tr>
          <td><span class="lbl">Tronçon :</span> ${tr}</td>
          <td><span class="lbl">PRESTATAIRE :</span> ${DATA.parametres?.prestataire || ''}</td>
        </tr>
      </table>
    </div>
  `;

  /* Tableau */
  const table = `
    <table class="constat-table-print" style="font-size:8px;">
      <thead>
        <tr>
          <th rowspan="2" style="width:35px;">N°</th>
          <th rowspan="2">Désignation</th>
          <th rowspan="2" style="width:35px;">U</th>
          <th rowspan="2" style="width:55px;">PU</th>
          ${m.colonnes.map(c => `<th style="font-size:7px;background:#1e3a8a;color:#fff;">${c.gare}</th>`).join('')}
          <th rowspan="2" style="width:65px;background:#c2410c;color:#fff;">Total</th>
        </tr>
        <tr>
          ${m.colonnes.map(c => `<th style="font-size:6px;background:#3b82f6;color:#fff;">${c.sousElement || ''}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${DATA.catalogue.map(p => {
          const total = getTotalLigneMetreV(tr, mois, p.numero);
          if (total === 0) return '';
          return `
            <tr>
              <td style="text-align:center;font-weight:700;">${p.numero}</td>
              <td style="font-size:7px;">${p.libelle}</td>
              <td style="text-align:center;">${p.unite}</td>
              <td style="text-align:right;">${p.prixUnitaire.toFixed(2)}</td>
              ${m.colonnes.map(c => {
                const q = getQteMetreV(tr, mois, p.numero, c.id);
                return `<td style="text-align:center;">${q || ''}</td>`;
              }).join('')}
              <td style="text-align:right;font-weight:700;">${total.toFixed(2)}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;

  const pied = typeof genererPiedDePageHTML === 'function' 
    ? genererPiedDePageHTML(tr) 
    : '';

  const body = `
    <div class="metre-page-print">
      <div class="metre-entete-wrap">${entete}</div>
      <div class="metre-table-wrap">${table}</div>
      ${pied ? `<div class="metre-pied-wrap">${pied}</div>` : ''}
    </div>
  `;

  /* Utiliser modal unifié si disponible */
  if (typeof ouvrirModalUnifie === 'function') {
    ouvrirModalUnifie(
      `Aperçu — MetréV N°${numero} ${tr}`,
      body,
      () => exporterMetreVExcel(tr)
    );
  } else {
    document.getElementById('apercu-titre').textContent = `Aperçu — MetréV N°${numero}`;
    document.getElementById('apercu-body').innerHTML = body;
    document.getElementById('modal-actions').innerHTML = `
      <button class="btn btn-primary" onclick="window.print()">🖨️ Imprimer</button>
      <button class="btn btn-ghost" onclick="fermerModale()">✖ Fermer</button>
    `;
    document.getElementById('modal-apercu').classList.add('open');
  }
};

window.exporterMetreVExcel = function(tr) {
  const mois = currentMoisMetreV;
  const m = DATA.metreV?.[tr]?.[mois];
  if (!m) return;

  const numero = numeroMetreVPourMois(mois, tr);

  let html = `<h2>METRÉV N° ${numero} — ${tr}</h2>`;
  html += '<table border="1" style="border-collapse:collapse;font-family:Tahoma;font-size:9pt;">';
  html += '<tr style="background:#1e3a8a;color:#fff;">';
  html += '<th>N°</th><th>Désignation</th><th>U</th><th>PU</th>';
  m.colonnes.forEach(c => {
    html += `<th>${c.gare} / ${c.sousElement}</th>`;
  });
  html += '<th>Total</th></tr>';

  DATA.catalogue.forEach(p => {
    const total = getTotalLigneMetreV(tr, mois, p.numero);
    if (total === 0) return;
    html += '<tr>';
    html += `<td>${p.numero}</td>`;
    html += `<td>${p.libelle}</td>`;
    html += `<td>${p.unite}</td>`;
    html += `<td>${p.prixUnitaire.toFixed(2)}</td>`;
    m.colonnes.forEach(c => {
      const q = getQteMetreV(tr, mois, p.numero, c.id);
      html += `<td style="text-align:center;">${q || ''}</td>`;
    });
    html += `<td style="text-align:right;font-weight:700;">${total.toFixed(2)}</td>`;
    html += '</tr>';
  });

  html += '</table>';

  const doc = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body>${html}</body></html>`;
  const blob = new Blob(['\ufeff', doc], { type: 'application/vnd.ms-excel' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `MetreV_${tr}_N${numero}_${mois}.xls`;
  a.click();
  URL.revokeObjectURL(a.href);
  notifier('📥 Excel téléchargé', 'success');
};

/* ═══════════════════════════════════════════════════════════
   11. INIT — Attacher l'import UNE SEULE FOIS (délégation)
   ═══════════════════════════════════════════════════════════ */

/**
 * Écouteur global délégué :
 * intercepte le changement sur #file-metrev-import
 * quel que soit le moment où il est créé dans le DOM.
 */
document.addEventListener('change', (e) => {
  if (e.target && e.target.id === 'file-metrev-import') {
    traiterImportMetreV(e);
  }
});

/**
 * Traite un fichier Excel importé pour MetréV.
 */
async function traiterImportMetreV(e) {
  const file = e.target.files[0];
  if (!file) return;

  const tr = currentMetreVTR;
  const mois = currentMoisMetreV;

  try {
    notifier('⏳ Analyse du fichier...', 'info');

    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

    /* ─── Trouver la ligne d'en-tête (contient "N°") ─── */
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const r = rows[i];
      if (r.some(c => String(c).trim().toUpperCase() === 'N°')) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) throw new Error('En-tête "N°" introuvable dans le fichier');

    /* ─── La ligne AVANT = Gares ─── */
    const ligneGares = headerIdx > 0 ? rows[headerIdx - 1] : [];
    const ligneSousElements = rows[headerIdx];

    /* ─── Nombre de colonnes fixes (N°, DESIGNATION, U, P.U.) ─── */
    let nbColonnesFixes = 4;
    for (let i = 0; i < ligneSousElements.length; i++) {
      const val = String(ligneSousElements[i] || '').trim().toUpperCase();
      if (val === 'P.U.' || val === 'P.U' || val === 'PU') {
        nbColonnesFixes = i + 1;
        break;
      }
    }

    /* ─── Construire les colonnes dynamiques ─── */
    const colonnes = [];
    let derniereGare = '';

    for (let i = nbColonnesFixes; i < ligneSousElements.length; i++) {
      const sousElem = String(ligneSousElements[i] || '').trim();
      const gare = String(ligneGares[i] || '').trim();

      /* Ignorer les colonnes de totaux */
      if (/quantit|montant|total/i.test(sousElem)) break;
      if (!sousElem) continue;

      if (gare) derniereGare = gare;

      colonnes.push({
        id: 'c_' + (i - nbColonnesFixes + 1),
        index: i,
        gare: derniereGare || `Colonne ${i}`,
        sousElement: sousElem
      });
    }

    if (colonnes.length === 0) throw new Error('Aucune colonne de données trouvée');

    /* ─── Filtrer : garder seulement les gares du TR ─── */
    const garesTR = GARES_PAR_TR[tr] || [];
    const colonnesFiltrees = colonnes.filter(c => {
      const gareNorm = c.gare.toLowerCase().replace(/gare de\s*/i, '').trim();
      return garesTR.some(g => {
        const gNorm = g.toLowerCase().replace(/gare de\s*/i, '').trim();
        return gareNorm.includes(gNorm) || gNorm.includes(gareNorm);
      });
    });

    if (colonnesFiltrees.length === 0) {
      const garesDetectees = [...new Set(colonnes.map(c => c.gare))];
      throw new Error(
        `Aucune gare de ${tr} trouvée.\n\n` +
        `Gares dans le fichier : ${garesDetectees.join(', ')}\n\n` +
        `Gares attendues pour ${tr} : ${garesTR.join(', ')}`
      );
    }

    /* Réindexer les IDs après filtrage */
    colonnesFiltrees.forEach((c, i) => { c.id = 'c_' + (i + 1); });

    /* ─── Extraire les lignes ─── */
    const lignes = {};
    let nbLignes = 0;

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r[0]) continue;

      const n = parseFloat(String(r[0]).replace(/[^\d.]/g, ''));
      if (!n) continue;

      lignes[n] = {};
      let hasData = false;

      colonnesFiltrees.forEach(c => {
        const rawVal = String(r[c.index] ?? '').replace(/\s/g, '').replace(',', '.');
        const q = parseFloat(rawVal) || 0;
        if (q > 0) {
          lignes[n][c.id] = q;
          hasData = true;
        }
      });

      if (hasData || (DATA.catalogue || []).some(p => p.numero === n)) {
        nbLignes++;
      }
    }

    /* ─── Confirmation ─── */
    const resume =
      `📊 STRUCTURE DÉTECTÉE\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🎯 Tronçon : ${tr}\n` +
      `📋 Gares : ${[...new Set(colonnesFiltrees.map(c => c.gare))].length}\n` +
      `📋 Sous-éléments : ${colonnesFiltrees.length}\n` +
      `📝 Prix : ${Object.keys(lignes).length}\n` +
      `📝 Lignes avec données : ${nbLignes}\n\n` +
      `Gares retenues :\n` +
      [...new Set(colonnesFiltrees.map(c => c.gare))]
        .map(g => `  • ${g}`).join('\n') + '\n\n' +
      `━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Continuer l'import ?`;

    if (!confirm(resume)) {
      e.target.value = '';
      return;
    }

    /* ─── Sauvegarder ─── */
    if (!DATA.metreV) DATA.metreV = {};
    if (!DATA.metreV[tr]) DATA.metreV[tr] = {};

    DATA.metreV[tr][mois] = {
      numero: numeroMetreVPourMois(mois, tr),
      colonnes: colonnesFiltrees,
      lignes: lignes,
      dateImport: new Date().toISOString()
    };

    sauvegarderDonnees(true);
    rendreMetreV(tr);

    notifier(
      `✅ Import réussi — ${colonnesFiltrees.length} colonnes, ${Object.keys(lignes).length} prix`,
      'success'
    );

  } catch (err) {
    console.error('❌ Erreur import MetréV :', err);
    notifier('❌ ' + err.message, 'danger');
    alert('❌ Erreur lors de l\'import :\n\n' + err.message);
  }

  e.target.value = '';
}

console.log('📐 metrev.js chargé (v2 — import délégué)');