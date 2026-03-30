import { HttpResponse, http } from 'msw';

import { API_GROUP, API_VERSION, AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { grafanaRulerRule, rulerTestDb } from 'app/features/alerting/unified/mocks/grafanaRulerApi';
import { K8sRuleLabels } from 'app/features/alerting/unified/utils/k8s/constants';

const RULES_API_SERVER_BASE_URL = `/apis/${API_GROUP}/${API_VERSION}`;

/** Converts a RulerGrafanaRuleDTO to a k8s AlertRule object */
function rulerRuleToK8sAlertRule(uid: string, folderUid: string, groupName: string): AlertRule {
  const rulerRule = grafanaRulerRule;

  return {
    apiVersion: `${API_GROUP}/${API_VERSION}`,
    kind: 'AlertRule',
    metadata: {
      name: uid,
      uid,
      namespace: 'default',
      labels: {
        [K8sRuleLabels.RuleGroup]: groupName,
        [K8sRuleLabels.FolderUID]: folderUid,
      },
    },
    spec: {
      title: rulerRule.grafana_alert.title,
      noDataState: rulerRule.grafana_alert.no_data_state ?? 'NoData',
      execErrState: rulerRule.grafana_alert.exec_err_state ?? 'Error',
      for: rulerRule.for ?? '0s',
      paused: rulerRule.grafana_alert.is_paused,
      expressions: Object.fromEntries(
        rulerRule.grafana_alert.data.map((q) => [
          q.refId,
          {
            datasourceUID: q.datasourceUid,
            model: q.model,
            queryType: q.queryType,
            relativeTimeRange: q.relativeTimeRange
              ? { from: String(q.relativeTimeRange.from), to: String(q.relativeTimeRange.to) }
              : undefined,
          },
        ])
      ),
      trigger: { interval: '1m' },
    },
  };
}

const getNamespacedAlertRuleHandler = () =>
  http.get<{ namespace: string; name: string }>(
    `${RULES_API_SERVER_BASE_URL}/namespaces/:namespace/alertrules/:name`,
    ({ params }) => {
      const { name: uid } = params;

      // Look up the rule in rulerTestDb by UID
      const rulerConfig = rulerTestDb.getRulerConfig();
      for (const [, groups] of Object.entries(rulerConfig)) {
        for (const group of groups) {
          const matchingRule = group.rules.find((rule) => {
            if ('grafana_alert' in rule) {
              return rule.grafana_alert.uid === uid;
            }
            return false;
          });
          if (matchingRule && 'grafana_alert' in matchingRule) {
            const folderUid = matchingRule.grafana_alert.namespace_uid;
            const groupName = matchingRule.grafana_alert.rule_group;
            return HttpResponse.json(rulerRuleToK8sAlertRule(uid, folderUid, groupName));
          }
        }
      }

      // Fall back to the default grafanaRulerRule fixture
      if (uid === grafanaRulerRule.grafana_alert.uid) {
        return HttpResponse.json(
          rulerRuleToK8sAlertRule(
            uid,
            grafanaRulerRule.grafana_alert.namespace_uid,
            grafanaRulerRule.grafana_alert.rule_group
          )
        );
      }

      return new HttpResponse(null, { status: 404 });
    }
  );

const handlers = [getNamespacedAlertRuleHandler()];
export default handlers;

export { getNamespacedAlertRuleHandler, RULES_API_SERVER_BASE_URL };
