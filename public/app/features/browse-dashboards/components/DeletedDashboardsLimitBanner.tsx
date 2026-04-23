import { useState } from 'react';
import { useAsync } from 'react-use';

import { store } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

import { deletedDashboardsCache } from '../../search/service/deletedDashboardsCache';

export const DELETED_DASHBOARDS_LIMIT = 1000;
export const DELETED_DASHBOARDS_WARNING_THRESHOLD = 0.85;
export const DISMISS_STORAGE_KEY = 'grafana.recently-deleted-limit-banner.dismissed';

type LimitState = 'nearing' | 'at_limit';
type DismissedMap = Partial<Record<LimitState, boolean>>;

interface Props {
  /**
   * Trigger used to re-read the cache after mutations. Pass the page's
   * `searchState.result` so the banner refreshes whenever a completed
   * search replaces the reference (which happens after every delete / restore
   * cycle that invalidates the cache).
   */
  resultToken: unknown;
}

export function DeletedDashboardsLimitBanner({ resultToken }: Props) {
  const { value: data } = useAsync(() => deletedDashboardsCache.getAsResourceList(), [resultToken]);
  const [dismissed, setDismissed] = useState<DismissedMap>(
    () => store.getObject<DismissedMap>(DISMISS_STORAGE_KEY) ?? {}
  );

  if (!data) {
    return null;
  }

  const count = data.items.length;
  const lowerBoundOfMissing = data.metadata.remainingItemCount ?? (data.metadata.continue ? 1 : 0);
  const lowerBoundOfTotal = count + lowerBoundOfMissing;

  let state: LimitState | null;
  if (lowerBoundOfTotal >= DELETED_DASHBOARDS_LIMIT) {
    state = 'at_limit';
  } else if (lowerBoundOfTotal >= DELETED_DASHBOARDS_LIMIT * DELETED_DASHBOARDS_WARNING_THRESHOLD) {
    state = 'nearing';
  } else {
    state = null;
  }

  if (!state || dismissed[state]) {
    return null;
  }

  const activeState = state;
  const handleDismiss = () => {
    const next = { ...dismissed, [activeState]: true };
    store.setObject(DISMISS_STORAGE_KEY, next);
    setDismissed(next);
  };

  if (state === 'at_limit') {
    return (
      <Alert
        severity="warning"
        title={t('recently-deleted.limit-banner.at-limit-title', 'Deleted dashboards limit reached')}
        onRemove={handleDismiss}
      >
        <Trans i18nKey="recently-deleted.limit-banner.at-limit-body" values={{ limit: DELETED_DASHBOARDS_LIMIT }}>
          You have reached the retention limit of {'{{limit}}'} deleted dashboards. Older deleted dashboards will be
          permanently removed to make room for new ones.
        </Trans>
      </Alert>
    );
  }

  return (
    <Alert
      severity="warning"
      title={t('recently-deleted.limit-banner.nearing-title', "You're nearing the deleted dashboards limit")}
      onRemove={handleDismiss}
    >
      <Trans i18nKey="recently-deleted.limit-banner.nearing-body" values={{ count, limit: DELETED_DASHBOARDS_LIMIT }}>
        {'{{count}}'} of {'{{limit}}'} deleted dashboards retained. Once the limit is reached, the oldest deleted
        dashboards will be permanently removed.
      </Trans>
    </Alert>
  );
}
