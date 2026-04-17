import { useEffect, useState } from 'react';

import {
  onUpdateDatasourceJsonDataOption,
  onUpdateDatasourceSecureJsonDataOption,
  updateDatasourcePluginResetOption,
} from '@grafana/data';
import { Input, SecretInput, Field, Space, Box } from '@grafana/ui';

import {
  trackInfluxDBConfigV2FluxDBDetailsDefaultBucketInputField,
  trackInfluxDBConfigV2FluxDBDetailsOrgInputField,
  trackInfluxDBConfigV2FluxDBDetailsTokenInputField,
} from './tracking';
import { type Props } from './types';

export const FluxDbConnection = (props: Props) => {
  const {
    options: { jsonData, secureJsonData, secureJsonFields },
    validation,
  } = props;

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const tokenConfigured = Boolean(secureJsonFields?.token);
  const tokenEntered = Boolean(secureJsonData?.token);

  const validateField = (field: string, hasValue: boolean, errorMsg: string) => {
    if (!validation) {
      return;
    }
    if (!hasValue) {
      setFieldErrors((prev) => ({ ...prev, [field]: errorMsg }));
      validation.setError(field, errorMsg);
    } else {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
      validation.clearError(field);
    }
  };

  useEffect(() => {
    if (!validation) {
      return;
    }
    if (jsonData.organization) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.organization;
        return next;
      });
      validation.clearError('organization');
    }
    if (jsonData.defaultBucket) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.defaultBucket;
        return next;
      });
      validation.clearError('defaultBucket');
    }
    if (tokenConfigured || tokenEntered) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.token;
        return next;
      });
      validation.clearError('token');
    }
    return validation.registerValidation(() => {
      const errors: Record<string, string> = {};
      if (!jsonData.organization) {
        errors.organization = 'Organization is required';
      }
      if (!jsonData.defaultBucket) {
        errors.defaultBucket = 'Default bucket is required';
      }
      if (!tokenConfigured && !tokenEntered) {
        errors.token = 'Token is required';
      }
      setFieldErrors(errors);
      Object.entries(errors).forEach(([field, msg]) => validation.setError(field, msg));
      if (!errors.organization) {
        validation.clearError('organization');
      }
      if (!errors.defaultBucket) {
        validation.clearError('defaultBucket');
      }
      if (!errors.token) {
        validation.clearError('token');
      }
      return Object.keys(errors).length === 0;
    });
  }, [jsonData.organization, jsonData.defaultBucket, tokenConfigured, tokenEntered, validation]);

  return (
    <Box width="50%">
      <Field
        label="Organization"
        required
        noMargin
        invalid={!!fieldErrors.organization}
        error={fieldErrors.organization}
      >
        <Input
          id="organization"
          placeholder="myorg"
          onBlur={(e) => {
            trackInfluxDBConfigV2FluxDBDetailsOrgInputField();
            validateField('organization', !!e.target.value, 'Organization is required');
          }}
          onChange={onUpdateDatasourceJsonDataOption(props, 'organization')}
          value={jsonData.organization || ''}
        />
      </Field>
      <Space v={2} />
      <Field
        label="Default bucket"
        required
        noMargin
        invalid={!!fieldErrors.defaultBucket}
        error={fieldErrors.defaultBucket}
      >
        <Input
          id="default-bucket"
          onBlur={(e) => {
            trackInfluxDBConfigV2FluxDBDetailsDefaultBucketInputField();
            validateField('defaultBucket', !!e.target.value, 'Default bucket is required');
          }}
          onChange={onUpdateDatasourceJsonDataOption(props, 'defaultBucket')}
          placeholder="mybucket"
          value={jsonData.defaultBucket || ''}
        />
      </Field>
      <Space v={2} />
      <Field label="Token" required noMargin invalid={!!fieldErrors.token} error={fieldErrors.token}>
        <SecretInput
          id="token"
          isConfigured={tokenConfigured}
          onBlur={(e) => {
            trackInfluxDBConfigV2FluxDBDetailsTokenInputField();
            validateField('token', tokenConfigured || !!e.target.value, 'Token is required');
          }}
          onChange={onUpdateDatasourceSecureJsonDataOption(props, 'token')}
          onReset={() => updateDatasourcePluginResetOption(props, 'token')}
          value={secureJsonData?.token || ''}
        />
      </Field>
    </Box>
  );
};
