import { useEffect, useState } from 'react';

import {
  onUpdateDatasourceJsonDataOption,
  onUpdateDatasourceOption,
  onUpdateDatasourceSecureJsonDataOption,
  updateDatasourcePluginResetOption,
} from '@grafana/data';
import { Input, SecretInput, Field, Space, Box } from '@grafana/ui';

import {
  trackInfluxDBConfigV2InfluxQLDBDetailsDatabaseInputField,
  trackInfluxDBConfigV2InfluxQLDBDetailsPasswordInputField,
  trackInfluxDBConfigV2InfluxQLDBDetailsUserInputField,
} from './tracking';
import { type Props } from './types';

export const InfluxInfluxQLDBConnection = (props: Props) => {
  const { options, validation } = props;
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const passwordConfigured = Boolean(options.secureJsonFields?.password);
  const passwordEntered = Boolean(options.secureJsonData?.password);

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
    if (options.jsonData.dbName) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.dbName;
        return next;
      });
      validation.clearError('dbName');
    }
    if (options.user) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.user;
        return next;
      });
      validation.clearError('user');
    }
    if (passwordConfigured || passwordEntered) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.password;
        return next;
      });
      validation.clearError('password');
    }
    return validation.registerValidation(() => {
      const errors: Record<string, string> = {};
      if (!options.jsonData.dbName) {
        errors.dbName = 'Database is required';
      }
      if (!options.user) {
        errors.user = 'User is required';
      }
      if (!passwordConfigured && !passwordEntered) {
        errors.password = 'Password is required';
      }
      setFieldErrors(errors);
      Object.entries(errors).forEach(([field, msg]) => validation.setError(field, msg));
      if (!errors.dbName) {
        validation.clearError('dbName');
      }
      if (!errors.user) {
        validation.clearError('user');
      }
      if (!errors.password) {
        validation.clearError('password');
      }
      return Object.keys(errors).length === 0;
    });
  }, [options.jsonData.dbName, options.user, passwordConfigured, passwordEntered, validation]);

  return (
    <Box width="50%">
      <Field label="Database" required noMargin invalid={!!fieldErrors.dbName} error={fieldErrors.dbName}>
        <Input
          id="database"
          placeholder="mydb"
          value={options.jsonData.dbName}
          onChange={onUpdateDatasourceJsonDataOption(props, 'dbName')}
          onBlur={(e) => {
            trackInfluxDBConfigV2InfluxQLDBDetailsDatabaseInputField();
            validateField('dbName', !!e.target.value, 'Database is required');
          }}
        />
      </Field>
      <Space v={2} />
      <Field label="User" required noMargin invalid={!!fieldErrors.user} error={fieldErrors.user}>
        <Input
          id="user"
          placeholder="myuser"
          value={options.user || ''}
          onChange={onUpdateDatasourceOption(props, 'user')}
          onBlur={(e) => {
            trackInfluxDBConfigV2InfluxQLDBDetailsUserInputField();
            validateField('user', !!e.target.value, 'User is required');
          }}
        />
      </Field>
      <Space v={2} />
      <Field label="Password" required noMargin invalid={!!fieldErrors.password} error={fieldErrors.password}>
        <SecretInput
          id="password"
          isConfigured={passwordConfigured}
          value={options.secureJsonData?.password || ''}
          onReset={() => updateDatasourcePluginResetOption(props, 'password')}
          onChange={onUpdateDatasourceSecureJsonDataOption(props, 'password')}
          onBlur={(e) => {
            trackInfluxDBConfigV2InfluxQLDBDetailsPasswordInputField();
            validateField('password', passwordConfigured || !!e.target.value, 'Password is required');
          }}
        />
      </Field>
    </Box>
  );
};
