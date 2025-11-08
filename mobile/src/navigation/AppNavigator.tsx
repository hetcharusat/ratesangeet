import React from 'react';
import { Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';

// Screens
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
// import ExploreScreen from '../screens/ExploreScreen';
import ActivityScreen from '../screens/ActivityScreen';
import AddReviewScreen from '../screens/AddReviewScreen';
import HistoryScreen from '../screens/HistoryScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ReviewDetailScreen from '../screens/ReviewDetailScreen';
import ArtistScreen from '../screens/ArtistScreen';
import AlbumDetailScreen from '../screens/AlbumDetailScreen';

// Navigation types
export type RootStackParamList = {
  Login: undefined;
  MainTabs: undefined;
  Search: undefined;
  AddReview: { 
    itemId: string; 
    itemType: 'album' | 'track'; 
    itemName: string; 
    itemArtist: string; 
    itemImage?: string;
  };
  ReviewDetail: { reviewId: string };
  Artist: { artistId: string; artistName: string };
  Profile: { userId: string };
  AlbumDetail: {
    albumId?: string;
    albumName: string;
    artistName: string;
    albumArt?: string;
    listenedTracks?: number;
    totalTracks?: number;
    completionPercent?: number;
    listenedTrackIds?: string[];
  };
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

const MainTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#191414',
          borderTopColor: '#282828',
        },
        tabBarActiveTintColor: '#1DB954',
        tabBarInactiveTintColor: '#B3B3B3',
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>🏠</Text>,
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarLabel: 'History',
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>📜</Text>,
        }}
      />
      <Tab.Screen
        name="Activity"
        component={ActivityScreen}
        options={{
          tabBarLabel: 'Activity',
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>👥</Text>,
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          tabBarLabel: 'Search',
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>🔍</Text>,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>👤</Text>,
        }}
      />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const { accessToken, isLoading } = useAuth();

  if (isLoading) {
    return null; // Or a loading screen
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!accessToken ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen
              name="AddReview"
              component={AddReviewScreen}
              options={{
                headerShown: true,
                headerStyle: { backgroundColor: '#191414' },
                headerTintColor: '#FFFFFF',
                headerTitle: 'Add Review',
              }}
            />
            <Stack.Screen
              name="ReviewDetail"
              component={ReviewDetailScreen}
              options={{
                headerShown: true,
                headerStyle: { backgroundColor: '#191414' },
                headerTintColor: '#FFFFFF',
                headerTitle: 'Review',
              }}
            />
            <Stack.Screen
              name="Artist"
              component={ArtistScreen}
              options={{
                headerShown: true,
                headerStyle: { backgroundColor: '#191414' },
                headerTintColor: '#FFFFFF',
                headerTitle: 'Artist',
              }}
            />
            <Stack.Screen
              name="AlbumDetail"
              component={AlbumDetailScreen}
              options={{
                headerShown: true,
                headerStyle: { backgroundColor: '#191414' },
                headerTintColor: '#FFFFFF',
                headerTitle: 'Album',
              }}
            />
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{
                headerShown: true,
                headerStyle: { backgroundColor: '#191414' },
                headerTintColor: '#FFFFFF',
                headerTitle: 'Profile',
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
