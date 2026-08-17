"use client";

import { useAppState } from "./app-state";
import type { Bi } from "./data";

export type Locale = "ru" | "tg";

/**
 * Only strings actually reused across multiple places live here (keyed).
 * One-off copy is passed straight to `t()` as a literal {ru,tg} object at
 * the call site — no need to register every microcopy string here.
 */
export const UI_STRINGS: Record<string, Bi> = {
  // nav
  "nav.home": { ru: "Главная", tg: "Асосӣ" },
  "nav.search": { ru: "Поиск", tg: "Ҷустуҷӯ" },
  "nav.vacancies": { ru: "Вакансии", tg: "Ҷойҳои холӣ" },
  "nav.about": { ru: "О нас", tg: "Дар бораи мо" },
  "nav.categories": { ru: "Типы учреждений", tg: "Намудҳои муассиса" },
  "nav.guides": { ru: "Руководства", tg: "Дастурҳо" },
  "nav.gps": { ru: "Определить по GPS", tg: "Тавассути GPS муайян кардан" },
  "nav.gpsLocating": { ru: "Определяем…", tg: "Муайян мекунем…" },
  "nav.guide.parents": { ru: "Родителям", tg: "Ба волидайн" },
  "nav.guide.students": { ru: "Ученикам", tg: "Ба хонандагон" },
  "nav.guide.institutions": { ru: "Учреждениям", tg: "Ба муассисаҳо" },
  "nav.cabinet": { ru: "Кабинет", tg: "Кабинет" },
  "nav.login": { ru: "Войти", tg: "Ворид шудан" },
  "nav.logout": { ru: "Выйти", tg: "Баромадан" },
  "nav.allRegions": { ru: "Все регионы", tg: "Ҳама минтақаҳо" },
  "nav.role.user": { ru: "Обычный пользователь", tg: "Истифодабарандаи оддӣ" },
  "nav.role.parent": { ru: "Родитель", tg: "Волидайн" },
  "nav.role.institution": { ru: "Учреждение", tg: "Муассиса" },
  "nav.role.applicant": { ru: "Соискатель", tg: "Ҷуяндаи кор" },
  "nav.guide.applicants": { ru: "Соискателям", tg: "Ба ҷуяндагони кор" },

  // common
  "common.openProfile": { ru: "Открыть профиль", tg: "Профилро кушоед" },
  "common.open": { ru: "Открыть", tg: "Кушодан" },
  "common.save": { ru: "Сохранить изменения", tg: "Тағйиротро нигоҳ доред" },
  "common.saved": { ru: "Изменения сохранены", tg: "Тағйирот нигоҳ дошта шуд" },
  "common.cancel": { ru: "Отмена", tg: "Бекор кардан" },
  "common.add": { ru: "Добавить", tg: "Илова кардан" },
  "common.edit": { ru: "Редактировать", tg: "Таҳрир кардан" },
  "common.delete": { ru: "Удалить", tg: "Нест кардан" },
  "common.reply": { ru: "Ответить", tg: "Ҷавоб додан" },
  "common.send": { ru: "Отправить", tg: "Фиристодан" },
  "common.readMore": { ru: "Читать полностью…", tg: "Пурра хондан…" },
  "common.collapse": { ru: "Свернуть", tg: "Пӯшидан" },
  "common.reset": { ru: "Сбросить", tg: "Тоза кардан" },
  "common.clearAll": { ru: "Очистить всё", tg: "Ҳамаро тоза кардан" },
  "common.back": { ru: "Назад", tg: "Бозгашт" },
  "common.reviews": { ru: "отзывов", tg: "шарҳ" },
  "common.perMonth": { ru: "сом/мес", tg: "сомонӣ/моҳ" },
  "common.verified": { ru: "МОН РТ", tg: "ВМО ҶТ" },
  "common.months": {
    ru: "янв,фев,мар,апр,май,июн,июл,авг,сен,окт,ноя,дек",
    tg: "янв,фев,мар,апр,май,июн,июл,авг,сен,окт,ноя,дек",
  },
  "common.messageEllipsis": { ru: "Сообщение…", tg: "Паём…" },
  "common.writeInChat": { ru: "Написать в чат", tg: "Дар чат нависед" },
  "common.write": { ru: "Написать", tg: "Навиштан" },

  // dashboard
  "dash.overview": { ru: "Обзор", tg: "Хулоса" },
  "dash.settings": { ru: "Настройки", tg: "Танзимот" },

  // tabs (institution profile)
  "tab.about": { ru: "О нас", tg: "Дар бораи мо" },
  "tab.staff": { ru: "Персонал", tg: "Кормандон" },
  "tab.gallery": { ru: "Галерея", tg: "Галерея" },
  "tab.achievements": { ru: "Достижения", tg: "Дастовардҳо" },
  "tab.menu": { ru: "Питание", tg: "Ғизо" },
  "tab.reviews": { ru: "Отзывы", tg: "Шарҳҳо" },
  "tab.news": { ru: "Новости", tg: "Хабарҳо" },
  "tab.contacts": { ru: "Контакты", tg: "Тамос" },
  "tab.alumni": { ru: "Выпускники", tg: "Хатмкунандагон" },
  "tab.vacancies": { ru: "Вакансии", tg: "Ҷойҳои холӣ" },

  // empty states
  "empty.staff": { ru: "Персонал не добавлен", tg: "Кормандон илова нашудаанд" },
  "empty.reviews": { ru: "Отзывов пока нет", tg: "Ҳанӯз шарҳе нест" },
  "empty.news": { ru: "Новостей пока нет", tg: "Ҳанӯз хабаре нест" },
  "empty.achievements": { ru: "Достижения не добавлены", tg: "Дастовардҳо илова нашудаанд" },
  "empty.notifications": { ru: "Уведомлений пока нет", tg: "Ҳанӯз огоҳиномае нест" },
  "empty.notFound": { ru: "Ничего не найдено", tg: "Ҳеҷ чиз ёфт нашуд" },
  "empty.vacancies": { ru: "Вакансий пока нет", tg: "Ҷойҳои холӣ ҳанӯз нестанд" },

  // geo
  "geo.region": { ru: "Регион", tg: "Минтақа" },
  "geo.city": { ru: "Город", tg: "Шаҳр" },
  "geo.district": { ru: "Район", tg: "Ноҳия" },
  "geo.street": { ru: "Улица", tg: "Кӯча" },

  // metric labels (used as keys directly via inst.metrics[].label)
  "Качество обучения": { ru: "Качество обучения", tg: "Сифати таълим" },
  "Условия и помещения": { ru: "Условия и помещения", tg: "Шароит ва биноҳо" },
  "Безопасность": { ru: "Безопасность", tg: "Бехатарӣ" },
  "Питание": { ru: "Питание", tg: "Ғизо" },
  "Развозка": { ru: "Развозка", tg: "Расонидан" },
  "Цена/качество": { ru: "Цена/качество", tg: "Нарх/сифат" },
  "Участие родителей": { ru: "Участие родителей", tg: "Иштироки волидайн" },
  "Инклюзивность": { ru: "Инклюзивность", tg: "Фарогирӣ" },

  // work hours (fallback, same across institutions)
  "hours.weekdays": { ru: "Пн–Пт", tg: "Дш–Ҷм" },
  "hours.saturday": { ru: "Суббота", tg: "Шанбе" },
  "hours.sunday": { ru: "Воскресенье", tg: "Якшанбе" },
  "hours.dayoff": { ru: "Выходной", tg: "Рӯзи истироҳат" },

  // fallback menu (shown when an institution has no custom foodMenu)
  "menu.mon": { ru: "Понедельник", tg: "Душанбе" },
  "menu.tue": { ru: "Вторник", tg: "Сешанбе" },
  "menu.wed": { ru: "Среда", tg: "Чоршанбе" },
  "menu.thu": { ru: "Четверг", tg: "Панҷшанбе" },
  "menu.fri": { ru: "Пятница", tg: "Ҷумъа" },
  "menu.breakfast": { ru: "Завтрак", tg: "Ноништа" },
  "menu.lunch": { ru: "Обед", tg: "Хӯроки нисфирӯзӣ" },
  "menu.snack": { ru: "Полдник", tg: "Насри" },
  "menu.breakfastTxt": { ru: "Каша + чай", tg: "Оши сершир + чой" },
  "menu.lunchTxt": { ru: "Суп + плов", tg: "Шӯрбо + палов" },
  "menu.snackTxt": { ru: "Фрукты", tg: "Мева" },

  // achievement category groupings
  "ach.institution": { ru: "Достижения учреждения", tg: "Дастовардҳои муассиса" },
  "ach.student": { ru: "Достижения учеников", tg: "Дастовардҳои хонандагон" },
  "ach.teacher": { ru: "Достижения педагогов", tg: "Дастовардҳои омӯзгорон" },
};

export function translate(x: string | Bi, locale: Locale): string {
  if (typeof x === "string") {
    const entry = UI_STRINGS[x];
    return entry ? entry[locale] : x;
  }
  return x[locale];
}

export function useT() {
  const { locale } = useAppState();
  return (x: string | Bi) => translate(x, locale);
}

export function useLocale() {
  const { locale, setLocale } = useAppState();
  return { locale, setLocale };
}
