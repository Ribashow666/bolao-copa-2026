// Service worker mínimo: só existe pra o site poder ser instalado como app (e virar APK).
// Não guarda cache de propósito: o bolão é ao vivo, e cache velho mostraria placar/palpite desatualizado.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
