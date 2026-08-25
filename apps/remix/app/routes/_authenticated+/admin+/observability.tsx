import { getConversionObservability } from '@documenso/lib/server-only/admin/get-conversion-observability';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { AlertTriangle, FileCheck, FileX, Gauge, Timer } from 'lucide-react';

import { CardMetric } from '~/components/general/metric-card';
import type { Route } from './+types/observability';

export async function loader() {
  const data = await getConversionObservability();

  return data;
}

export default function AdminObservabilityPage({ loaderData }: Route.ComponentProps) {
  const { _ } = useLingui();

  const { today, month, recentFailures, credit } = loaderData;

  const successRate =
    month.attempts > 0 ? `${(((month.attempts - month.failures) / month.attempts) * 100).toFixed(1)}%` : '—';

  return (
    <div>
      <h2 className="font-semibold text-4xl">
        <Trans>Observability</Trans>
      </h2>

      <div className="mt-8 grid flex-1 grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <CardMetric icon={Timer} title={_(msg`Conversions (today)`)} value={today.attempts} />
        <CardMetric icon={AlertTriangle} title={_(msg`Failures (today)`)} value={today.failures} />
        <CardMetric icon={FileCheck} title={_(msg`Conversions (this month)`)} value={month.attempts} />
        <CardMetric icon={FileX} title={_(msg`Failures (this month)`)} value={month.failures} />
      </div>

      <div className="mt-4 mb-8 grid flex-1 grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <CardMetric icon={Gauge} title={_(msg`Monthly success rate`)} value={successRate} />
        <CardMetric
          icon={Gauge}
          title={_(msg`Avg conversion time (today)`)}
          value={today.avgDurationMs ? `${Math.round(today.avgDurationMs)} ms` : '—'}
        />
        <CardMetric
          icon={Gauge}
          title={_(msg`trigger.dev credits used (month)`)}
          value={`$${(credit.usedCents / 100).toFixed(2)}`}
        />
        <CardMetric
          icon={Gauge}
          title={_(msg`trigger.dev credits remaining`)}
          value={`$${(credit.remainingCents / 100).toFixed(2)}`}
        />
      </div>

      <div className="mt-16">
        <h3 className="font-semibold text-3xl">
          <Trans>Recent conversion failures</Trans>
        </h3>

        {recentFailures.length === 0 ? (
          <p className="mt-4 text-muted-foreground">
            <Trans>No recent failures.</Trans>
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">
                    <Trans>When</Trans>
                  </th>
                  <th className="px-4 py-2 font-medium">
                    <Trans>Transport</Trans>
                  </th>
                  <th className="px-4 py-2 font-medium">
                    <Trans>Error</Trans>
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentFailures.map((failure) => (
                  <tr key={failure.id} className="border-t">
                    <td className="px-4 py-2">{new Date(failure.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-2">{failure.transport}</td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {failure.errorCode} {failure.errorMessage}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
