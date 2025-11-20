/**
 * Pantalla de historial de predicciones
 */
import { View, StyleSheet, FlatList } from 'react-native';
import { Card, Text, Button, Divider } from 'react-native-paper';
import { usePredictionStore } from '../src/store/predictionStore';

export default function HistoryScreen() {
  const { history, clearHistory } = usePredictionStore();

  const renderItem = ({ item }: { item: any }) => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.row}>
          <View style={styles.mainInfo}>
            <Text variant="headlineSmall" style={styles.prediction}>
              {item.prediction}
            </Text>
            <Text variant="bodyMedium" style={styles.confidence}>
              {(item.confidence * 100).toFixed(1)}% confianza
            </Text>
          </View>
          <Text variant="bodySmall" style={styles.timestamp}>
            {new Date(item.timestamp).toLocaleTimeString('es-CO', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
        
        <Divider style={styles.divider} />
        
        <Text variant="bodySmall" style={styles.topLabel}>Top 3:</Text>
        {item.top_3.map((pred: any, idx: number) => (
          <Text key={idx} variant="bodySmall" style={styles.topItem}>
            {idx + 1}. {pred.label} ({(pred.confidence * 100).toFixed(1)}%)
          </Text>
        ))}
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      {history.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text variant="bodyLarge" style={styles.emptyText}>
            No hay predicciones en el historial
          </Text>
        </View>
      ) : (
        <>
          <FlatList
            data={history}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
          />
          <Button 
            mode="outlined" 
            onPress={clearHistory}
            style={styles.clearButton}
          >
            Limpiar Historial
          </Button>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  mainInfo: {
    flex: 1,
  },
  prediction: {
    fontWeight: 'bold',
    color: '#6200ee',
  },
  confidence: {
    marginTop: 4,
  },
  timestamp: {
    color: '#666',
  },
  divider: {
    marginVertical: 12,
  },
  topLabel: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  topItem: {
    marginLeft: 8,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
  },
  clearButton: {
    margin: 16,
    borderColor: '#f44336',
  },
});
