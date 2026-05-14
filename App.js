import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      {/* give header */}
      <View style={styles.header}>
         
        
      </View>
      <Text>Aiza Chisti Malang</Text>
      <Text>Aliza Malangi dogar</Text>
      <Text>Ali Meetha </Text>
      
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
