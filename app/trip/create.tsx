import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { Colors, Spacing, Radii, Shadows } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';
import { tripEvents } from '@/utils/events';

export default function CreateTripScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [name,        setName]        = useState('');
  const [destination, setDestination] = useState('');
  const [startDate,   setStartDate]   = useState('');
  const [endDate,     setEndDate]     = useState('');
  const [coverUri,    setCoverUri]    = useState<string | null>(null);
  const [loading,     setLoading]     = useState(false);

  const canCreate = name.trim().length > 0 && destination.trim().length > 0;

  const handlePickCover = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', "Autorise l'accès à ta galerie.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled) setCoverUri(result.assets[0].uri);
  };

  /** Parse JJ/MM/AAAA → YYYY-MM-DD, null si invalide */
  const parseDate = (s: string): string | null => {
    if (!s.trim()) return null;
    const parts = s.trim().split('/');
    if (parts.length !== 3) return null;
    const [d, m, y] = parts;
    if (y.length !== 4) return null;
    const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    if (isNaN(new Date(iso).getTime())) return null;
    return iso;
  };

  const handleCreate = async () => {
    const parsedStart = parseDate(startDate);
    const parsedEnd   = parseDate(endDate);

    if (startDate && !parsedStart) {
      Alert.alert('Date invalide', 'Format attendu : JJ/MM/AAAA pour la date de départ.');
      return;
    }
    if (endDate && !parsedEnd) {
      Alert.alert('Date invalide', 'Format attendu : JJ/MM/AAAA pour la date de retour.');
      return;
    }

    try {
      setLoading(true);
      const userId = session!.user.id;
      console.log('USER ID:', userId);

      // 1. Upload cover si sélectionnée
      let coverUrl: string | null = null;
      if (coverUri) {
        const ext      = coverUri.split('.').pop() ?? 'jpg';
        const filePath = `${userId}/${Date.now()}.${ext}`;
        const formData = new FormData();
        formData.append('file', { uri: coverUri, name: `cover.${ext}`, type: `image/${ext}` } as any);

        const { error: uploadError } = await supabase.storage
          .from('covers')
          .upload(filePath, formData, { upsert: true, contentType: `image/${ext}` });
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('covers').getPublicUrl(filePath);
        coverUrl = publicUrl;
      }

      // 2. Créer le voyage
      const insertData = {
        name:            name.trim(),
        destination:     destination.trim(),
        start_date:      parsedStart,
        end_date:        parsedEnd,
        cover_image_url: coverUrl,
        owner_id:        userId,
      };
      console.log('INSERT DATA:', JSON.stringify(insertData));

      const { data: tripData, error: tripError } = await supabase
        .from('trips')
        .insert(insertData)
        .select('id');
      console.log('TRIPS INSERT ERROR:', JSON.stringify(tripError));
      console.log('TRIPS INSERT DATA:', JSON.stringify(tripData));
      if (tripError) throw new Error(`trips: ${tripError.message}`);

      // 3. Ajouter le créateur comme membre owner
      const memberPayload = { trip_id: tripData?.[0]?.id, user_id: userId, role: 'owner' };
      console.log('MEMBER PAYLOAD:', JSON.stringify(memberPayload));

      const { data: memberData, error: memberError } = await supabase
        .from('trip_members')
        .insert(memberPayload);
      console.log('MEMBER INSERT ERROR:', JSON.stringify(memberError));
      console.log('MEMBER INSERT DATA:', JSON.stringify(memberData));
      if (memberError) throw new Error(`trip_members: ${memberError.message}`);

      tripEvents.emit();
      router.back();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erreur lors de la création.';
      Alert.alert('Erreur', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Handle bar */}
      <View style={styles.handleBar} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Nouveau voyage</Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.closeBtn}
            activeOpacity={0.7}
            disabled={loading}
          >
            <Ionicons name="close" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Cover picker */}
        <TouchableOpacity
          style={styles.coverPicker}
          activeOpacity={0.8}
          onPress={handlePickCover}
          disabled={loading}
        >
          {coverUri ? (
            <>
              <Image
                source={{ uri: coverUri }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
              <View style={styles.coverOverlay}>
                <Ionicons name="camera" size={22} color={Colors.white} />
              </View>
            </>
          ) : (
            <>
              <Ionicons name="image-outline" size={36} color={Colors.textTertiary} />
              <Text style={styles.coverPickerText}>Ajouter une photo de couverture</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Fields */}
        <View style={styles.form}>
          <Field
            label="Nom du voyage"
            placeholder="Ex : Road trip Italie"
            value={name}
            onChangeText={setName}
            editable={!loading}
          />
          <Field
            label="Destination"
            placeholder="Ex : Italie"
            value={destination}
            onChangeText={setDestination}
            editable={!loading}
          />
          <View style={styles.dateRow}>
            <Field
              label="Départ"
              placeholder="JJ/MM/AAAA"
              value={startDate}
              onChangeText={setStartDate}
              style={{ flex: 1 }}
              editable={!loading}
            />
            <Field
              label="Retour"
              placeholder="JJ/MM/AAAA"
              value={endDate}
              onChangeText={setEndDate}
              style={{ flex: 1 }}
              editable={!loading}
            />
          </View>
        </View>

        {/* Invite section (placeholder) */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Inviter des amis</Text>
          <TouchableOpacity style={styles.inviteBtn} activeOpacity={0.8} disabled={loading}>
            <Ionicons name="person-add-outline" size={18} color={Colors.primary} />
            <Text style={styles.inviteBtnText}>Inviter par lien ou email</Text>
          </TouchableOpacity>
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.createBtn, (!canCreate || loading) && styles.createBtnDisabled]}
          onPress={handleCreate}
          disabled={!canCreate || loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.createBtnText}>Créer le voyage</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChangeText,
  style,
  editable = true,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  style?: object;
  editable?: boolean;
}) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={Colors.textTertiary}
        value={value}
        onChangeText={onChangeText}
        editable={editable}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  handleBar: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  scroll: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  coverPicker: {
    height: 160,
    borderRadius: Radii.xl,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  coverPickerText: {
    fontSize: 14,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  coverOverlay: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  dateRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  field: {
    gap: Spacing.xs,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md - 2,
    fontSize: 15,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  section: {
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md - 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inviteBtnText: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '500',
  },
  createBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.full,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    ...Shadows.md,
  },
  createBtnDisabled: {
    opacity: 0.4,
  },
  createBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
