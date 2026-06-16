import { Stack } from 'expo-router';

export default function SuperviseurLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: 'Suivi des chauffeurs',
          headerStyle: { backgroundColor: '#6d4aff' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
    </Stack>
  );
}
