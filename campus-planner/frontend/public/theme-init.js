// Runs before first paint (kept as a file because the production CSP forbids inline scripts).
try {
  var t = localStorage.getItem('cp_theme')
  if (t !== 'light' && t !== 'dark') t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  document.documentElement.dataset.theme = t
  var l = localStorage.getItem('cp_lang')
  if (l === 'bn' || l === 'en') document.documentElement.lang = l
} catch (e) {}
