/* Точка входа: монтирует экраны и компоненты, подгружает справочники и счётчики, запускает роутер.
   Подключается последним — к этому моменту все модули и экраны уже зарегистрированы. */
async function bootstrap() {
  mountViews();
  $('resetDemoBtn').classList.toggle('hidden', !api.sync.enabled());
  mountDrawer();
  mountModal();
  mountMenu();
  renderSuperNav();
  window.addEventListener('hashchange', renderRoute);
  await Promise.all([
    api.dictionaries.get().then(d => { state.dict = d; }).catch(() => { /* справочники подгрузятся при следующем заходе */ }),
    refreshAttention()
  ]);
  renderRoute();
}

// Глобальный поиск в шапке (заглушка: реальный поиск пойдёт через api)
function handleGlobalSearch(query) {
  if (query.length > 2) {
    showToast('Поиск: ' + query, 'info');
  }
}

bootstrap();
