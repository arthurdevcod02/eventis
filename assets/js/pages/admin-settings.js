// Page « Paramètres du site » — mode maintenance. Cette page écrit le drapeau dans
// la table site_settings ; ce n'est PAS elle qui ferme le site. Le blocage réel est
// appliqué par la edge function Netlify (netlify/edge-functions/maintenance.js), qui
// relit ce drapeau à chaque demande de page. En dessous, RLS : seule une session
// d'admin peut écrire, un visiteur non connecté se heurte à une politique refusée.
import { db } from '../core/db.js';
import { toast } from '../core/ui.js';
import { isDemoMode } from '../core/config.js';
import { bootAdminPage, runAdminAction, confirmAction } from '../components/admin-actions.js';

bootAdminPage(init);

// Les 500 caractères sont imposés deux fois, nulle part ici : maxlength sur le
// champ (HTML) et contrainte CHECK sur la colonne (supabase/maintenance.sql).
const $ = id => document.getElementById(id);
const dateTime = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' });

// Le réglage réellement EN REGISTRE — seul point de référence du badge
// « non enregistré » : la case à cocher, elle, porte l'intention de l'admin.
let saved = { maintenanceEnabled: false, maintenanceMessage: '', updatedAt: null };

const readForm = () => ({
  maintenanceEnabled: $('s-maintenance').checked,
  maintenanceMessage: $('s-message').value.trim(),
});

const ON_COPY = 'Mode maintenance activé : les visiteurs reçoivent la page de maintenance.';
const OFF_COPY = 'Mode maintenance désactivé : le site est de nouveau accessible au public.';

function paintState() {
  const on = $('s-maintenance').checked;
  const el = $('s-state');
  el.textContent = on ? 'Activé' : 'Désactivé';
  // L'état écrit n'est jamais le seul porteur de l'information : la case est
  // cochée ou non, et le badge change de fond en plus de son texte.
  el.className = `badge badge--${on ? 'accepted' : 'closed'}`;
  const form = readForm();
  $('s-dirty').hidden = form.maintenanceEnabled === saved.maintenanceEnabled
    && form.maintenanceMessage === saved.maintenanceMessage;
}

function paintUpdated() {
  const when = saved.updatedAt ? new Date(saved.updatedAt) : null;
  $('s-updated').textContent = when && !Number.isNaN(when.getTime())
    ? `Dernière modification : ${dateTime.format(when)}.`
    : 'Aucune modification enregistrée pour l’instant.';
}

async function refresh() {
  saved = await db.getSiteSettings();
  $('s-maintenance').checked = saved.maintenanceEnabled;
  $('s-message').value = saved.maintenanceMessage;
  paintState();
  paintUpdated();
}

$('settings-form').addEventListener('submit', async e => {
  e.preventDefault();
  const next = readForm();
  const sameState = next.maintenanceEnabled === saved.maintenanceEnabled;
  const successMessage = (sameState ? 'Réglages enregistrés.'
    : next.maintenanceEnabled ? ON_COPY : OFF_COPY)
    // En démonstration, promettre « les visiteurs reçoivent la page de maintenance »
    // serait faux : l'écriture est locale et rien ne ferme. Le dire dans le toast.
    + (isDemoMode() ? ' (mode démo : enregistré sur cet appareil, aucune page fermée.)' : '');

  if (next.maintenanceEnabled && !saved.maintenanceEnabled) {
    // Action visible par tous les visiteurs : confirmée avant d'écrire.
    confirmAction({
      title: 'Activer le mode maintenance',
      question: 'Fermer temporairement l’accès public du site ?',
      bodyHTML: '<p>Les visiteurs ne verront plus les pages publiques. <strong>Vous gardez l’accès à cette page</strong>,'
        + ' ainsi qu’aux pages de connexion, à la page de maintenance et à la page de contact :'
        + ' rien ne peut enfermer un administrateur hors de son administration.</p>'
        + (isDemoMode()
          ? '<p>Mode démonstration : seule l’enregistrement local est écrit, aucune page ne se ferme réellement.</p>'
          : '<p>Le réglage est relu par l’hébergeur au plus toutes les 10 secondes.</p>'),
      confirmLabel: 'Activer la maintenance',
      run: () => db.saveSiteSettings(next),
      successMessage,
      reload: refresh,
    });
    return;
  }

  const btn = $('s-save');
  btn.disabled = true;
  try {
    await runAdminAction({
      run: () => db.saveSiteSettings(next),
      successMessage,
      reload: refresh,
    });
  } catch (err) {
    toast(err?.message || 'Enregistrement impossible, veuillez réessayer.', 'error');
  } finally {
    btn.disabled = false;
  }
});

async function init() {
  if (isDemoMode()) $('settings-demo').hidden = false;
  $('s-maintenance').addEventListener('change', paintState);
  $('s-message').addEventListener('input', paintState);
  await refresh();
  $('settings-skeleton').hidden = true;
  $('settings-form').hidden = false;
}
