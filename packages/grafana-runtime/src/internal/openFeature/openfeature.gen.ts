import {
  type ReactFlagEvaluationOptions,
  useFlag,
} from "@openfeature/react-sdk";

// Flag key constants for programmatic access
export const FlagKeys = {
  /** Flag key for Enables new analytics framework */
  AnalyticsFramework: "analyticsFramework",
  /** Flag key for Enables the created by me search filter on the browse dashboards page */
  CreatedByMeSearchFilter: "createdByMeSearchFilter",
  /** Flag key for Enables support for section level variables (rows and tabs) */
  DashboardSectionVariables: "dashboardSectionVariables",
  /** Flag key for Enables the Assistant button in the dashboard templates card */
  DashboardTemplatesAssistantButton: "dashboardTemplatesAssistantButton",
  /** Flag key for Enables the new Flame Graph UI containing the Call Tree view */
  FlameGraphWithCallTree: "flameGraphWithCallTree",
  /** Flag key for Whether to use the new SharedPreferences functional component */
  FunctionalSharedPreferences: "functionalSharedPreferences",
  /** Flag key for Enables an inline version of Log Details that creates no new scrolls */
  InlineLogDetailsNoScrolls: "inlineLogDetailsNoScrolls",
  /** Flag key for Enables a control component for the logs panel in Explore */
  LogsPanelControls: "logsPanelControls",
  /** Flag key for Use stream shards to split queries into smaller subqueries */
  LokiShardSplitting: "lokiShardSplitting",
  /** Flag key for New Log Context component */
  NewLogContext: "newLogContext",
  /** Flag key for Enables the new logs panel */
  NewLogsPanel: "newLogsPanel",
  /** Flag key for Applies OTel formatting templates to displayed logs */
  OtelLogsFormatting: "otelLogsFormatting",
  /** Flag key for Allow setting folder metadata for provisioned folders */
  ProvisioningFolderMetadata: "provisioningFolderMetadata",
  /** Flag key for Enables next generation query editor experience */
  QueryEditorNext: "queryEditorNext",
  /** Flag key for Enables recently viewed dashboards section in the browsing dashboard page */
  RecentlyViewedDashboards: "recentlyViewedDashboards",
  /** Flag key for Enables the splash screen modal for introducing new Grafana features on first session */
  SplashScreen: "splashScreen",
  /** Flag key for Enables the 'Customize with Assistant' button on suggested dashboard cards */
  SuggestedDashboardsAssistantButton: "suggestedDashboardsAssistantButton",
} as const;


/**
* Enables new analytics framework
*
* **Details:**
* - flag key: `analyticsFramework`
* - default value: `false`
*/
export const useFlagAnalyticsFramework = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("analyticsFramework", false, options).value;
};


/**
* Enables the created by me search filter on the browse dashboards page
*
* **Details:**
* - flag key: `createdByMeSearchFilter`
* - default value: `false`
*/
export const useFlagCreatedByMeSearchFilter = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("createdByMeSearchFilter", false, options).value;
};


/**
* Enables support for section level variables (rows and tabs)
*
* **Details:**
* - flag key: `dashboardSectionVariables`
* - default value: `false`
*/
export const useFlagDashboardSectionVariables = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("dashboardSectionVariables", false, options).value;
};


/**
* Enables the Assistant button in the dashboard templates card
*
* **Details:**
* - flag key: `dashboardTemplatesAssistantButton`
* - default value: `false`
*/
export const useFlagDashboardTemplatesAssistantButton = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("dashboardTemplatesAssistantButton", false, options).value;
};


/**
* Enables the new Flame Graph UI containing the Call Tree view
*
* **Details:**
* - flag key: `flameGraphWithCallTree`
* - default value: `false`
*/
export const useFlagFlameGraphWithCallTree = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("flameGraphWithCallTree", false, options).value;
};


/**
* Whether to use the new SharedPreferences functional component
*
* **Details:**
* - flag key: `functionalSharedPreferences`
* - default value: `false`
*/
export const useFlagFunctionalSharedPreferences = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("functionalSharedPreferences", false, options).value;
};


/**
* Enables an inline version of Log Details that creates no new scrolls
*
* **Details:**
* - flag key: `inlineLogDetailsNoScrolls`
* - default value: `false`
*/
export const useFlagInlineLogDetailsNoScrolls = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("inlineLogDetailsNoScrolls", false, options).value;
};


/**
* Enables a control component for the logs panel in Explore
*
* **Details:**
* - flag key: `logsPanelControls`
* - default value: `true`
*/
export const useFlagLogsPanelControls = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("logsPanelControls", true, options).value;
};


/**
* Use stream shards to split queries into smaller subqueries
*
* **Details:**
* - flag key: `lokiShardSplitting`
* - default value: `false`
*/
export const useFlagLokiShardSplitting = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("lokiShardSplitting", false, options).value;
};


/**
* New Log Context component
*
* **Details:**
* - flag key: `newLogContext`
* - default value: `false`
*/
export const useFlagNewLogContext = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("newLogContext", false, options).value;
};


/**
* Enables the new logs panel
*
* **Details:**
* - flag key: `newLogsPanel`
* - default value: `true`
*/
export const useFlagNewLogsPanel = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("newLogsPanel", true, options).value;
};


/**
* Applies OTel formatting templates to displayed logs
*
* **Details:**
* - flag key: `otelLogsFormatting`
* - default value: `false`
*/
export const useFlagOtelLogsFormatting = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("otelLogsFormatting", false, options).value;
};


/**
* Allow setting folder metadata for provisioned folders
*
* **Details:**
* - flag key: `provisioningFolderMetadata`
* - default value: `false`
*/
export const useFlagProvisioningFolderMetadata = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("provisioningFolderMetadata", false, options).value;
};


/**
* Enables next generation query editor experience
*
* **Details:**
* - flag key: `queryEditorNext`
* - default value: `false`
*/
export const useFlagQueryEditorNext = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("queryEditorNext", false, options).value;
};


/**
* Enables recently viewed dashboards section in the browsing dashboard page
*
* **Details:**
* - flag key: `recentlyViewedDashboards`
* - default value: `false`
*/
export const useFlagRecentlyViewedDashboards = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("recentlyViewedDashboards", false, options).value;
};


/**
* Enables the splash screen modal for introducing new Grafana features on first session
*
* **Details:**
* - flag key: `splashScreen`
* - default value: `false`
*/
export const useFlagSplashScreen = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("splashScreen", false, options).value;
};


/**
* Enables the 'Customize with Assistant' button on suggested dashboard cards
*
* **Details:**
* - flag key: `suggestedDashboardsAssistantButton`
* - default value: `false`
*/
export const useFlagSuggestedDashboardsAssistantButton = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("suggestedDashboardsAssistantButton", false, options).value;
};


