// Service worker بسيط لتثبيت التطبيق (PWA) فقط.
// بدون fetch handler: كل الطلبات تروح للشبكة مباشرة بدون ما تمر عبر الـ SW
// (المرور الإجباري كان يبطّئ أول فتح على الموبايل والمتصفحات البطيئة).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
