// theme-bootstrap.js — applique le thème enregistré avant que le corps de la page soit peint.
//
// Cette ligne vivait en `<script>` inline dans les 28 pages. Une CSP qui protège vraiment
// interdit `'unsafe-inline'` dans `script-src` — sinon n'importe quel script injecté par une
// faille XSS s'exécute. Le code est donc passé dans un fichier, et la CSP du site peut
// dire `script-src 'self'` sans exception.
//
// Chargé SANS `defer` : un script classique du `<head>` s'exécute avant que le parseur
// n'atteigne `<body>`, ce qui évite le flash de thème du premier affichage.
try {
  document.documentElement.dataset.theme = localStorage.getItem('eventis_theme') || '';
} catch (e) {
  // localStorage peut être inaccessible (navigation privée, restrictions de site) :
  // le thème par défaut reste celui de la feuille de style.
}
