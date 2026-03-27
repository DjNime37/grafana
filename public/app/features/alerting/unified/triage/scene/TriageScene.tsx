import { DashboardCursorSync } from '@grafana/data';
import {
  AdHocFiltersVariable,
  GroupByVariable,
  SceneControlsSpacer,
  SceneFlexLayout,
  SceneReactObject,
  SceneTimePicker,
  SceneTimeRange,
  SceneVariableSet,
  VariableValueSelectors,
  behaviors,
} from '@grafana/scenes';
import { EmbeddedSceneWithContext } from '@grafana/scenes-react';

import { DATASOURCE_UID } from '../constants';

import { TriageSavedSearchesControl } from './TriageSavedSearchesControl';
import { WorkbenchSceneObject } from './Workbench';
import { prometheusExpressionBuilder } from './expressionBuilder';
import { getAdHocTagKeysProvider, getAdHocTagValuesProvider, getGroupByTagKeysProvider } from './tagKeysProviders';
import { defaultTimeRange } from './utils';

const cursorSync = new behaviors.CursorSync({ key: 'triage-cursor-sync', sync: DashboardCursorSync.Crosshair });

export const triageScene = new EmbeddedSceneWithContext({
  // this will allow us to share the cursor between all vizualizations
  $behaviors: [cursorSync],
  controls: [
    new VariableValueSelectors({}),
    new TriageSavedSearchesControl({}),
    new SceneControlsSpacer(),
    // Fixed 160px left margin (theme.spacing(20) = 8px × 20) before the time picker
    new SceneReactObject({ component: () => <div style={{ width: '160px' }} /> }),
    new SceneTimePicker({}),
  ],
  $timeRange: new SceneTimeRange(defaultTimeRange),
  $variables: new SceneVariableSet({
    variables: [
      new AdHocFiltersVariable({
        name: 'filters',
        label: 'Filters',
        datasource: {
          type: 'prometheus',
          uid: DATASOURCE_UID,
        },
        applyMode: 'manual', // we will construct the label matchers for the PromQL queries ourselves
        allowCustomValue: true,
        useQueriesAsFilterForOptions: true,
        supportsMultiValueOperators: true,
        filters: [],
        baseFilters: [],
        layout: 'combobox',
        expressionBuilder: prometheusExpressionBuilder,
        getTagKeysProvider: getAdHocTagKeysProvider,
        getTagValuesProvider: getAdHocTagValuesProvider,
      }),
      new GroupByVariable({
        name: 'groupBy',
        label: 'Group by',
        datasource: {
          type: 'prometheus',
          uid: DATASOURCE_UID,
        },
        allowCustomValue: true,
        applyMode: 'manual',
        getTagKeysProvider: getGroupByTagKeysProvider,
      }),
    ],
  }),
  body: new SceneFlexLayout({
    direction: 'column',
    children: [new WorkbenchSceneObject({})],
  }),
});

export const TriageScene = () => <triageScene.Component model={triageScene} />;
