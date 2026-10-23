(() => {
  const button = document.querySelector('#install-app');
  const guidance = document.querySelector('#install-guidance');
  if (!button || !guidance) return;
  let promptEvent = null;
  const copy = {
    en: {
      install: 'Install TranslateOCR', installed: 'TranslateOCR is installed on this device.',
      ios: 'On iPhone or iPad, open this hosted app in Safari, tap Share, then Add to Home Screen. A hosted HTTPS server is required; this local computer address cannot run on your phone.',
      android: 'On Android, use your browser menu and choose Install app or Add to Home screen. For phone use, the app must be deployed to a private HTTPS server.',
      desktop: 'Use Install in Chrome or Edge, or Add to Dock in Safari on macOS. For this local version, keep the TranslateOCR service running; an installed icon does not start the local Node service.',
      ready: 'Choose Install to add TranslateOCR to your device.'
    },
    de: {
      install: 'TranslateOCR installieren', installed: 'TranslateOCR ist auf diesem Gerät installiert.',
      ios: 'Auf iPhone oder iPad: die gehostete App in Safari öffnen, Teilen antippen und „Zum Home-Bildschirm“ wählen. Für das Telefon ist ein gehosteter HTTPS-Server nötig; die lokale Computeradresse funktioniert dort nicht.',
      android: 'Auf Android im Browsermenü „App installieren“ oder „Zum Startbildschirm hinzufügen“ wählen. Für die Nutzung am Telefon muss die App auf einem privaten HTTPS-Server laufen.',
      desktop: 'In Chrome oder Edge „Installieren“ wählen; unter macOS in Safari „Zum Dock hinzufügen“. Bei dieser lokalen Version muss der TranslateOCR-Dienst laufen; das App-Symbol startet den lokalen Node-Dienst nicht.',
      ready: 'Mit „Installieren“ TranslateOCR zum Gerät hinzufügen.'
    },
    ar: {
      install: 'تثبيت TranslateOCR', installed: 'تم تثبيت TranslateOCR على هذا الجهاز.',
      ios: 'على iPhone أو iPad: افتح التطبيق المستضاف في Safari، واضغط «مشاركة» ثم «إضافة إلى الشاشة الرئيسية». يتطلب الهاتف خادماً خاصاً عبر HTTPS؛ عنوان الكمبيوتر المحلي لا يعمل على الهاتف.',
      android: 'على Android افتح قائمة المتصفح واختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية». يلزم خادم خاص عبر HTTPS لاستخدام التطبيق على الهاتف.',
      desktop: 'اختر «تثبيت» في Chrome أو Edge، أو «إضافة إلى Dock» في Safari على macOS. في النسخة المحلية يجب أن تعمل خدمة TranslateOCR؛ الأيقونة لا تشغّل خدمة Node المحلية.',
      ready: 'اختر «تثبيت» لإضافة TranslateOCR إلى جهازك.'
    }
  };
  function render() {
    const language = window.currentInterfaceLanguage || 'en';
    const text = copy[language] || copy.en;
    const ua = navigator.userAgent;
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    guidance.textContent = standalone ? text.installed : /iPad|iPhone|iPod/.test(ua) ? text.ios : /Android/.test(ua) ? text.android : promptEvent ? text.ready : text.desktop;
    button.textContent = text.install;
    button.hidden = standalone || !promptEvent;
  }
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); promptEvent = event; render(); });
  window.addEventListener('appinstalled', () => { promptEvent = null; render(); });
  button.addEventListener('click', async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    promptEvent = null;
    render();
  });
  document.querySelector('#ui-language')?.addEventListener('change', render);
  if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  render();
})();
