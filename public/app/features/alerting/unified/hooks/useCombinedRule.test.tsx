import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { API_GROUP, API_VERSION } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { config } from '@grafana/runtime';
import { AppNotificationList } from 'app/core/components/AppNotifications/AppNotificationList';
import { K8sRuleLabels } from 'app/features/alerting/unified/utils/k8s/constants';
import { AccessControlAction } from 'app/types/accessControl';
import { GrafanaRuleIdentifier } from 'app/types/unified-alerting';

import { setupMswServer } from '../mockApi';
import { grantUserPermissions } from '../mocks';
import { grafanaRulerNamespace, grafanaRulerRule } from '../mocks/grafanaRulerApi';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

import { useCombinedRule } from './useCombinedRule';

const RULES_API_BASE = `/apis/${API_GROUP}/${API_VERSION}`;

const server = setupMswServer();

beforeAll(() => {
  grantUserPermissions([AccessControlAction.AlertingRuleExternalRead, AccessControlAction.AlertingRuleRead]);
});

// Test component that uses useCombinedRule hook
const UseCombinedRuleTestComponent = ({ ruleIdentifier }: { ruleIdentifier: GrafanaRuleIdentifier }) => {
  const { loading, error, result } = useCombinedRule({ ruleIdentifier });

  return (
    <>
      <AppNotificationList />
      <div data-testid="loading">{loading ? 'loading' : 'not-loading'}</div>
      <div data-testid="error">{error ? 'has-error' : 'no-error'}</div>
      <div data-testid="result">{result ? 'has-result' : 'no-result'}</div>
    </>
  );
};

const ruleIdentifier: GrafanaRuleIdentifier = {
  ruleSourceName: GRAFANA_RULES_SOURCE_NAME,
  uid: grafanaRulerRule.grafana_alert.uid,
};

const commonHandlers = [
  // Ruler group returns 404 (simulating a new or deleted group)
  http.get('/api/ruler/grafana/api/v1/rules/:namespace/:group', () => {
    return HttpResponse.json({ error: 'rule group does not exist' }, { status: 404 });
  }),
  http.get('/api/prometheus/grafana/api/v1/rules', () => {
    return HttpResponse.json({ status: 'success', data: { groups: [] } });
  }),
  http.get('/api/folders/:uid', () => {
    return HttpResponse.json({ uid: grafanaRulerNamespace.uid, title: grafanaRulerNamespace.name });
  }),
];

describe('useCombinedRule', () => {
  describe('when rule group returns 404', () => {
    describe('with kubernetesAlertingRules feature toggle enabled', () => {
      beforeEach(() => {
        config.featureToggles.kubernetesAlertingRules = true;
      });

      afterEach(() => {
        config.featureToggles.kubernetesAlertingRules = false;
      });

      it('should not show error notification when rule group does not exist', async () => {
        server.use(
          http.get(`${RULES_API_BASE}/namespaces/:namespace/alertrules/:name`, ({ params }) => {
            const uid = params.name as string;
            if (uid !== grafanaRulerRule.grafana_alert.uid) {
              return new HttpResponse(null, { status: 404 });
            }
            return HttpResponse.json({
              apiVersion: `${API_GROUP}/${API_VERSION}`,
              kind: 'AlertRule',
              metadata: {
                name: uid,
                uid,
                namespace: 'default',
                labels: {
                  [K8sRuleLabels.RuleGroup]: grafanaRulerRule.grafana_alert.rule_group,
                  [K8sRuleLabels.FolderUID]: grafanaRulerRule.grafana_alert.namespace_uid,
                },
              },
              spec: {
                title: grafanaRulerRule.grafana_alert.title,
                noDataState: grafanaRulerRule.grafana_alert.no_data_state ?? 'NoData',
                execErrState: grafanaRulerRule.grafana_alert.exec_err_state ?? 'Error',
                for: grafanaRulerRule.for ?? '0s',
                expressions: {},
                trigger: { interval: '1m' },
              },
            });
          }),
          ...commonHandlers
        );

        render(<UseCombinedRuleTestComponent ruleIdentifier={ruleIdentifier} />);

        await waitFor(() => {
          expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
        });

        expect(screen.getByTestId('error')).toHaveTextContent('has-error');
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });
    });

    describe('with kubernetesAlertingRules feature toggle disabled', () => {
      beforeEach(() => {
        config.featureToggles.kubernetesAlertingRules = false;
      });

      it('should not show error notification when rule group does not exist', async () => {
        server.use(
          http.get('/api/ruler/grafana/api/v1/rule/:uid', () => {
            return HttpResponse.json(grafanaRulerRule);
          }),
          ...commonHandlers
        );

        render(<UseCombinedRuleTestComponent ruleIdentifier={ruleIdentifier} />);

        await waitFor(() => {
          expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
        });

        expect(screen.getByTestId('error')).toHaveTextContent('has-error');
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });
    });
  });
});
