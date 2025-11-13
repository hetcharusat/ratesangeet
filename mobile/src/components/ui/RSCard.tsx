import React from 'react';
import { Card, CardProps } from 'react-native-paper';
import { Shape } from '../../theme/tokens';

type Props = CardProps & { radius?: number };

export default function RSCard({ style, radius = Shape.radius.md, ...rest }: Props) {
  return <Card style={[{ borderRadius: radius }, style]} {...(rest as any)} />;
}
