declare module 'react-native-star-rating-widget' {
  import { ComponentType } from 'react';
  import { ViewStyle, TextStyle } from 'react-native';

  export interface StarRatingProps {
    rating: number;
    onChange?: (rating: number) => void;
    starSize?: number;
    color?: string;
    emptyColor?: string;
    starStyle?: ViewStyle | TextStyle;
    enableHalfStar?: boolean;
    enableSwiping?: boolean;
    maxStars?: number;
    style?: ViewStyle;
  }

  const StarRating: ComponentType<StarRatingProps>;
  export default StarRating;
}
