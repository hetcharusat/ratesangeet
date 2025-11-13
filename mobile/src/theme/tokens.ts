import { Easing } from 'react-native';

// Motion & Animation tokens based on MD3
export const Motion = {
  duration: {
    emphasized: 500,
    emphasizedDecelerate: 400,
    emphasizedAccelerate: 200,
    standard: 300,
    skeletonPulse: 1200,
  },
  easing: {
    emphasized: Easing.bezier(0.2, 0, 0, 1),
    emphasizedDecelerate: Easing.bezier(0, 0, 0, 1),
    emphasizedAccelerate: Easing.bezier(0.3, 0, 1, 1),
    standard: Easing.bezier(0.2, 0, 0, 1),
  },
};

// Elevation tiers (semantic references)
export const Elevation = {
  level0: 0,
  level1: 1,
  level2: 2,
  level3: 3,
};

// Shape tokens per design guide
export const Shape = {
  radius: {
    none: 0,
    sm: 4, // chips/buttons
    md: 8, // cards
  },
};
