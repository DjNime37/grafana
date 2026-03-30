import { AlertmanagerAlert } from 'app/plugins/datasource/alertmanager/types';

import { alertmanagerApi } from '../api/alertmanagerApi';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

/**
 * Fetches the full list of currently inhibited alerts from the Grafana Alertmanager.
 *
 * This is intentionally unfilterd so the result is shared via RTK Query's cache
 * across all consumers, avoiding per-rule network requests.
 *
 * Only runs for the Grafana-managed alertmanager.
 */
export function useInhibitedAlerts(): {
  inhibitedAlerts: AlertmanagerAlert[];
  isLoading: boolean;
} {
  const { data, isLoading } = alertmanagerApi.useGetAlertmanagerAlertsQuery(
    {
      amSourceName: GRAFANA_RULES_SOURCE_NAME,
      filter: { inhibited: true, active: false, silenced: false },
      showErrorAlert: false,
    },
    // This query is always enabled — the result is shared across all rule viewers on the page
    { skip: false }
  );

  return {
    inhibitedAlerts: data ?? [],
    isLoading,
  };
}
