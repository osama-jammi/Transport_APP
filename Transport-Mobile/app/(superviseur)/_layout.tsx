import { Stack } from 'expo-router';
import { COLORS } from '@/constants/theme';

export default function SuperviseurLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: 'Suivi des chauffeurs',
          headerStyle: { backgroundColor: COLORS.brown },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
    </Stack>
  );
}
