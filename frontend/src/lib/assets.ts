/* Картинки из данных: mock отдаёт пути прототипа («src/assets/centers/logo-1.svg»), файлы лежат в public/assets/.
   Настоящий бэкенд отдаст полный URL — он проходит без изменений. */
export function assetUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined
  if (/^(https?:|data:|\/)/.test(path)) return path
  return '/' + path.replace(/^src\/assets\//, 'assets/')
}
