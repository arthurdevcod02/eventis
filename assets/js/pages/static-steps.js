// static-steps.js — montage commun des pages statiques (comment-ca-marche, mentions
// légales, 404) : navbar, footer et révélations au scroll. La clé du lien actif est
// lue sur <body data-nav-active="…"> (vide ou absente = aucun lien actif).
import { mountNavbar } from '../components/navbar.js';
import { mountFooter } from '../components/footer.js';
import { initReveal } from '../core/ui.js';

const active = document.body?.dataset.navActive ?? '';
mountNavbar(active);
mountFooter();
initReveal();
