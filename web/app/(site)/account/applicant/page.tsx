import { redirect } from "next/navigation";

// "Соискатель" — не отдельный кабинет, а вкладка «Профиль» единого кабинета
// пользователя (/account). Эта страница оставлена как редирект для старых ссылок.
export default function ApplicantAccountPage() {
  redirect("/account");
}
