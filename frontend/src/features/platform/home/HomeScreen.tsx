/* Экран «Главная» платформы (PLT-DSH-010). Прототип: src/js/views/platform/home.js. */
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { ActivityTable } from './ActivityTable'
import { AttentionWidget } from './AttentionWidget'
import { ConnectionsChart } from './ConnectionsChart'
import { KpiTiles } from './KpiTiles'

export function HomeScreen() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('screens.platform.home')}
        subtitle={t('home.subtitle')}
        actions={
          <Button asChild size="lg">
            <Link to="/platform/centers/new">
              <Plus aria-hidden />
              {t('home.connectCenter')}
            </Link>
          </Button>
        }
      />
      <KpiTiles />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <ConnectionsChart />
        <AttentionWidget />
      </div>
      <ActivityTable />
    </div>
  )
}
