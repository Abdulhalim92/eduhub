/* Точка входа кабинета центра (eduhub.html): монтирует экраны, строит меню, запускает роутер.
   Подключается последним — к этому моменту все экраны уже зарегистрированы. */
function bootstrap() {
  mountViews();
  mountModal();
  mountMenu();
  $('resetDemoBtn').classList.toggle('hidden', !api.sync.enabled());
  window.addEventListener('hashchange', renderRoute);
  window.addEventListener('liniya:sync', () => renderRoute());   // кабинет платформы (другая вкладка) изменил данные
  renderRoute();
}

bootstrap();
