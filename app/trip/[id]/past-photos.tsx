import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Image, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { Colors, Spacing, Radii } from '@/constants/theme';
import { NavButton } from '@/components/ui/NavButton';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface Photo {
  id: string;
  photo_url: string;
  uploaded_by: string;
  uploader_name?: string;
}

export default function PastPhotosScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  const [photos,    setPhotos]    = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [viewer,    setViewer]    = useState<Photo | null>(null);

  const loadPhotos = useCallback(async () => {
    const { data } = await supabase
      .from('trip_photos')
      .select('id, photo_url, uploaded_by')
      .eq('trip_id', id)
      .order('created_at', { ascending: false });

    const enriched = await Promise.all((data ?? []).map(async p => {
      const { data: prof } = await supabase
        .from('profiles').select('nickname').eq('id', p.uploaded_by).single();
      return { ...p, uploader_name: prof?.nickname ?? 'Membre' } as Photo;
    }));
    setPhotos(enriched);
    setLoading(false);
  }, [id]);

  useEffect(() => { loadPhotos(); }, [loadPhotos]);

  const handleUpload = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled) return;
    setUploading(true);
    try {
      for (const asset of result.assets) {
        const ext = asset.uri.split('.').pop() ?? 'jpg';
        const filePath = `${id}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
        const formData = new FormData();
        formData.append('file', { uri: asset.uri, name: `photo.${ext}`, type: `image/${ext}` } as any);
        await supabase.storage.from('photos').upload(filePath, formData, { upsert: true });
        const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(filePath);
        await supabase.from('trip_photos').insert({
          trip_id: id,
          uploaded_by: session?.user?.id,
          photo_url: publicUrl,
        });
      }
      await loadPhotos();
    } catch {
      Alert.alert('Erreur', "Impossible d'envoyer les photos.");
    }
    setUploading(false);
  };

  const leftCol  = photos.filter((_, i) => i % 2 === 0);
  const rightCol = photos.filter((_, i) => i % 2 !== 0);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Photos du voyage</Text>
        <Text style={s.sub}>{photos.length} photo{photos.length > 1 ? 's' : ''}</Text>
      </View>

      {/* Content */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={Colors.textSecondary} />
        </View>
      ) : photos.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyEmoji}>📸</Text>
          <Text style={s.emptyTitle}>Partagez vos souvenirs !</Text>
          <Text style={s.emptySub}>Ajoutez des photos de votre voyage</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.grid, { paddingBottom: insets.bottom + 110 }]}
        >
          <View style={s.gridRow}>
            <View style={s.col}>
              {leftCol.map(photo => (
                <TouchableOpacity key={photo.id} style={s.photoItem} onPress={() => setViewer(photo)} activeOpacity={0.9}>
                  <Image source={{ uri: photo.photo_url }} style={s.photoImg} resizeMode="cover" />
                  <Text style={s.photoBy} numberOfLines={1}>par {photo.uploader_name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={s.col}>
              {rightCol.map(photo => (
                <TouchableOpacity key={photo.id} style={s.photoItem} onPress={() => setViewer(photo)} activeOpacity={0.9}>
                  <Image source={{ uri: photo.photo_url }} style={s.photoImg} resizeMode="cover" />
                  <Text style={s.photoBy} numberOfLines={1}>par {photo.uploader_name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      )}

      {/* Bottom nav */}
      <View style={[s.bottomNav, { bottom: Math.max(insets.bottom, 10) + 16 }]} pointerEvents="box-none">
        <NavButton icon="arrow-back-outline" onPress={() => router.back()} />
        {uploading
          ? <NavButton icon="hourglass-outline" onPress={() => {}} />
          : <NavButton icon="add" iconSize={28} onPress={handleUpload} />
        }
      </View>

      {/* Photo viewer plein écran avec zoom */}
      {viewer && (
        <Modal visible animationType="fade" transparent onRequestClose={() => setViewer(null)}>
          <View style={pv.root}>
            <TouchableOpacity
              style={[pv.closeBtn, { top: insets.top + 8 }]}
              onPress={() => setViewer(null)}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={pv.imgWrap}
              maximumZoomScale={4}
              minimumZoomScale={1}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              centerContent
            >
              <Image source={{ uri: viewer.photo_url }} style={pv.img} resizeMode="contain" />
            </ScrollView>
            <Text style={[pv.caption, { bottom: insets.bottom + 16 }]}>
              par {viewer.uploader_name ?? 'Membre'}
            </Text>
          </View>
        </Modal>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: Colors.background },
  header:     { paddingHorizontal: Spacing.md, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title:      { fontSize: 28, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.5 },
  sub:        { fontSize: 14, color: Colors.textSecondary, fontWeight: '500', marginTop: 4 },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  emptySub:   { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 },
  grid:       { padding: 16 },
  gridRow:    { flexDirection: 'row', gap: 8 },
  col:        { flex: 1, gap: 8 },
  photoItem:  { borderRadius: Radii.md, overflow: 'hidden' },
  photoImg:   { width: '100%', aspectRatio: 0.85, borderRadius: Radii.md },
  photoBy:    { fontSize: 11, color: Colors.textSecondary, marginTop: 4, paddingHorizontal: 2 },
  bottomNav:  { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 14 },
});

const pv = StyleSheet.create({
  root:     { flex: 1, backgroundColor: '#000' },
  closeBtn: { position: 'absolute', right: 16, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  imgWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: '100%' },
  img:      { width: '100%', aspectRatio: 1 },
  caption:  { position: 'absolute', left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '500' },
});
