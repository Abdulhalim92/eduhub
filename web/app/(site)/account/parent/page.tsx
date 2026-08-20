import { redirect } from "next/navigation";

// "Родитель" — не отдельная роль/кабинет (модель B), а факт о пользователе.
// Единый кабинет теперь на /account, эта страница оставлена как редирект для старых ссылок.
export default function ParentAccountPage() {
  redirect("/account");
}
