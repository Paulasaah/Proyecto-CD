/**
 * Layout principal de la aplicación con Expo Router
 */
import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';

export default function RootLayout() {
  return (
    <PaperProvider>
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#6200ee',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen 
          name="index" 
          options={{ 
            title: 'LSC - Reconocimiento de Señas',
            headerShown: true,
          }} 
        />
        <Stack.Screen 
          name="history" 
          options={{ 
            title: 'Historial',
            presentation: 'modal',
          }} 
        />
      </Stack>
    </PaperProvider>
  );
}
