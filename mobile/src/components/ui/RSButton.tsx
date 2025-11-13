import React from 'react';
import { Button, ButtonProps } from 'react-native-paper';
import { Shape } from '../../theme/tokens';

type Props = ButtonProps & { radius?: number };

export default function RSButton({ style, radius = Shape.radius.sm, ...rest }: Props) {
  return <Button style={[{ borderRadius: radius }, style]} {...(rest as any)} />;
}
