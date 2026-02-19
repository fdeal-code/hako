import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Spacing, Radii, Shadows } from '@/constants/theme';
import { TripDocument, DocumentType } from '@/constants/types';

const DOC_ICONS: Record<DocumentType, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  ticket: { icon: 'airplane-outline', color: '#5C6BC0' },
  reservation: { icon: 'bed-outline', color: '#26A69A' },
  insurance: { icon: 'shield-checkmark-outline', color: '#66BB6A' },
  passport: { icon: 'id-card-outline', color: '#FFA726' },
  other: { icon: 'document-outline', color: Colors.textSecondary },
};

const MOCK_DOCS: TripDocument[] = [
  { id: 'd1', trip_id: '1', uploaded_by: 'u1', name: 'Billet_Paris-Rome.pdf', type: 'ticket', file_url: '', file_size: 245000, created_at: '' },
  { id: 'd2', trip_id: '1', uploaded_by: 'u2', name: 'Hotel_Roma_Centrale.pdf', type: 'reservation', file_url: '', file_size: 180000, created_at: '' },
  { id: 'd3', trip_id: '1', uploaded_by: 'u1', name: 'Assurance_voyage.pdf', type: 'insurance', file_url: '', file_size: 320000, created_at: '' },
];

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function DocumentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Documents</Text>
        <TouchableOpacity style={styles.addBtn} activeOpacity={0.8}>
          <Ionicons name="cloud-upload-outline" size={20} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={MOCK_DOCS}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const meta = DOC_ICONS[item.type];
          return (
            <TouchableOpacity style={styles.card} activeOpacity={0.8}>
              <View style={[styles.iconBox, { backgroundColor: meta.color + '20' }]}>
                <Ionicons name={meta.icon} size={22} color={meta.color} />
              </View>
              <View style={styles.info}>
                <Text style={styles.docName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.docMeta}>
                  {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                  {item.file_size ? ` · ${formatFileSize(item.file_size)}` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  backBtn: { padding: 4 },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xxl,
    gap: Spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  docName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  docMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
});
