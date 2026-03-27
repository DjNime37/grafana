import { css } from '@emotion/react';

export const BORDER_ANGLE_PROPERTY = '--border-angle';
export const BORDER_OPACITY_PROPERTY = '--border-opacity';

export function getAnimatedBorderPropertyStyles() {
  return css({
    [`@property ${BORDER_ANGLE_PROPERTY}`]: {
      syntax: '"<angle>"',
      initialValue: '0deg',
      inherits: 'false',
    },
    [`@property ${BORDER_OPACITY_PROPERTY}`]: {
      syntax: '"<number>"',
      initialValue: '1',
      inherits: 'false',
    },
  });
}
