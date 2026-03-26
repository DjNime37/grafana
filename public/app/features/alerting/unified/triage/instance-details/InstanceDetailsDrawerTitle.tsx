import { useMemo } from 'react';

import { AlertLabels, StateText } from '@grafana/alerting/unstable';
import { Labels } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Box, Dropdown, LinkButton, Menu, Stack, Text } from '@grafana/ui';
import { GrafanaAlertState, GrafanaRuleDefinition } from 'app/types/unified-alerting-dto';

import MoreButton from '../../components/MoreButton';
import { DeclareIncidentMenuItem } from '../../components/bridges/DeclareIncidentButton';
import { stringifyFolder, useFolder } from '../../hooks/useFolder';
import { useIrmPlugin } from '../../hooks/usePluginBridge';
import { SupportedPlugin } from '../../types/pluginBridges';
import { MATCHER_ALERT_RULE_UID } from '../../utils/constants';
import { isLocalDevEnv, isOpenSourceEdition, makeLabelBasedSilenceLink } from '../../utils/misc';

import { InstanceLocation } from './InstanceDetailsDrawer';

type StateTextState = 'normal' | 'firing' | 'pending' | 'recovering' | 'unknown';
type StateTextHealth = 'ok' | 'nodata' | 'error';

function grafanaAlertStateToStateTextProps(state: GrafanaAlertState): {
  state?: StateTextState;
  health?: StateTextHealth;
} {
  switch (state) {
    case GrafanaAlertState.Alerting:
      return { state: 'firing' };
    case GrafanaAlertState.Pending:
      return { state: 'pending' };
    case GrafanaAlertState.Normal:
      return { state: 'normal' };
    case GrafanaAlertState.Recovering:
      return { state: 'recovering' };
    case GrafanaAlertState.NoData:
      return { health: 'nodata' };
    case GrafanaAlertState.Error:
      return { health: 'error' };
    default:
      return { state: 'unknown' };
  }
}

interface InstanceDetailsDrawerTitleProps {
  instanceLabels: Labels;
  commonLabels?: Labels;
  alertState?: GrafanaAlertState | null;
  rule?: GrafanaRuleDefinition;
}

export function InstanceDetailsDrawerTitle({
  instanceLabels,
  commonLabels,
  alertState,
  rule,
}: InstanceDetailsDrawerTitleProps) {
  const { folder } = useFolder(rule?.namespace_uid);
  const { installed: irmInstalled, settings: irmSettings } = useIrmPlugin(SupportedPlugin.Incident);

  const silenceLink = useMemo(() => {
    if (!rule) {
      return undefined;
    }
    const baseLink = makeLabelBasedSilenceLink('grafana', instanceLabels);
    const separator = baseLink.includes('?') ? '&' : '?';
    return `${baseLink}${separator}matcher=${encodeURIComponent(`${MATCHER_ALERT_RULE_UID}=${rule.uid}`)}`;
  }, [instanceLabels, rule]);

  const shouldShowDeclareIncident = (!isOpenSourceEdition() || isLocalDevEnv()) && irmInstalled && irmSettings;

  const moreMenu = (
    <Menu>
      <DeclareIncidentMenuItem title={rule?.title ?? ''} />
    </Menu>
  );

  return (
    <Stack direction="column" gap={2}>
      {folder && rule && (
        <InstanceLocation
          folderTitle={stringifyFolder(folder)}
          groupName={rule.rule_group}
          ruleName={rule.title}
          namespaceUid={rule.namespace_uid}
          ruleUid={rule.uid}
        />
      )}
      <Stack direction="column" gap={0.5}>
        <Text variant="bodySmall" color="secondary">
          <Trans i18nKey="alerting.triage.instance-details-drawer.alert-instance-label">Alert Instance</Trans>
        </Text>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
          <Stack direction="row" alignItems="center" gap={1} minWidth={0}>
            <Text variant="h3" element="h3" truncate>
              {rule?.title ?? (
                <Trans i18nKey="alerting.triage.instance-details-drawer.instance-details">Instance details</Trans>
              )}
            </Text>
            {alertState && <StateText type="alerting" {...grafanaAlertStateToStateTextProps(alertState)} />}
          </Stack>
          <Stack direction="row" gap={1} alignItems="center">
            {silenceLink && (
              <LinkButton
                href={silenceLink}
                icon="bell-slash"
                variant="secondary"
                size="sm"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Trans i18nKey="alerting.triage.instance-details-drawer.silence-button">Silence</Trans>
              </LinkButton>
            )}
            {shouldShowDeclareIncident && (
              <Dropdown overlay={moreMenu} placement="bottom-end">
                <MoreButton />
              </Dropdown>
            )}
          </Stack>
        </Stack>
      </Stack>
      <Box>
        {Object.keys(instanceLabels).length > 0 ? (
          <AlertLabels
            labels={instanceLabels}
            displayCommonLabels={commonLabels !== undefined}
            labelSets={commonLabels !== undefined ? [instanceLabels, commonLabels] : undefined}
            commonLabelsMode="tooltip"
          />
        ) : (
          <Text color="secondary">{t('alerting.triage.no-labels', 'No labels')}</Text>
        )}
      </Box>
    </Stack>
  );
}
