// HAKO — Création · étape 4 « Qui embarque ? » (maquette « V2 · 3 Qui embarque »)
// Tuiles SOLO / ENTRE AMIS, liste d'amis cochables, invitation par e-mail.
// Le lien WhatsApp se partage depuis le voyage une fois créé (InviteSheet).

import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Radii, Spacing, Typography } from '@/constants/theme';
import { CreateTripForm } from '@/hooks/useCreateTripForm';
import { SectionLabel, StepTitle, createCardStyles as card } from '@/components/createTrip/CreateTripChrome';
import { MemberAvatar } from '@/components/ui/MemberAvatar';

const TILE_HEIGHT = 110;
const ROW_HEIGHT = 64;
const AVATAR_SIZE = 42;
const CHECK_SIZE = 24;

export function TravelersStep({ form }: { form: CreateTripForm }) {
  const [email, setEmail] = useState('');
  const isFriends = form.travelMode === 'friends';

  const submitEmail = () => {
    if (form.addEmail(email)) setEmail('');
  };

  return (
    <View>
      <StepTitle title="Qui embarque ?" subtitle="Tes amis recevront une invitation." />

      <View style={styles.modes}>
        <TouchableOpacity
          style={[isFriends ? card.creamTile : card.darkTile, styles.tile]}
          onPress={() => form.setTravelMode('solo')}
          activeOpacity={0.85}
          accessibilityState={{ selected: !isFriends }}
        >
          <Ionicons name="person" size={24} color={isFriends ? Colors.textInk : Colors.textInverted} />
          <View style={styles.tileText}>
            <Text style={[styles.tileLabel, !isFriends && styles.onDark]}>SOLO</Text>
            <Text style={[styles.tileSub, !isFriends && styles.tileSubAccent]}>Juste moi</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[isFriends ? card.darkTile : card.creamTile, styles.tile]}
          onPress={() => form.setTravelMode('friends')}
          activeOpacity={0.85}
          accessibilityState={{ selected: isFriends }}
        >
          <Ionicons name="people" size={24} color={isFriends ? Colors.textInverted : Colors.textInk} />
          <View style={styles.tileText}>
            <Text style={[styles.tileLabel, isFriends && styles.onDark]}>ENTRE AMIS</Text>
            <Text style={[styles.tileSub, isFriends && styles.tileSubAccent]}>
              {form.guestCount > 0 ? `${form.guestCount} invité${form.guestCount > 1 ? 's' : ''}` : 'Invite la bande'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {isFriends && (
        <View style={styles.section}>
          <SectionLabel>Tes amis</SectionLabel>
          {form.loadingFriends && <ActivityIndicator color={Colors.primary} />}
          {!form.loadingFriends && form.friends.length === 0 && (
            <Text style={styles.empty}>Pas encore d’amis sur Hako ? Invite-les par e-mail.</Text>
          )}
          {form.friends.map(friend => {
            const selected = form.selectedFriendIds.has(friend.id);
            return (
              <TouchableOpacity
                key={friend.id}
                style={[card.whiteCard, styles.row]}
                onPress={() => form.toggleFriend(friend.id)}
                activeOpacity={0.85}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
              >
                <MemberAvatar member={friend} size={AVATAR_SIZE} index={0} />
                <View style={styles.rowText}>
                  <Text style={card.cardTitle} numberOfLines={1}>{friend.nickname ?? 'Ami'}</Text>
                  {friend.email ? <Text style={card.cardSub} numberOfLines={1}>{friend.email}</Text> : null}
                </View>
                <View style={[styles.check, selected && styles.checkOn]}>
                  {selected && <Ionicons name="checkmark" size={15} color={Colors.textInverted} />}
                </View>
              </TouchableOpacity>
            );
          })}

          <View style={[card.whiteCard, styles.emailRow]}>
            <Ionicons name="mail-outline" size={20} color={Colors.textInk} />
            <TextInput
              style={styles.emailInput}
              placeholder="Inviter par e-mail"
              placeholderTextColor={Colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={submitEmail}
              selectionColor={Colors.accent}
            />
            <TouchableOpacity onPress={submitEmail} hitSlop={10} accessibilityLabel="Ajouter l’e-mail">
              <Ionicons name="add-circle" size={26} color={Colors.accent} />
            </TouchableOpacity>
          </View>
          {form.inviteEmails.map(address => (
            <View key={address} style={styles.chip}>
              <Text style={styles.chipText} numberOfLines={1}>{address}</Text>
              <TouchableOpacity onPress={() => form.removeEmail(address)} hitSlop={8} accessibilityLabel={`Retirer ${address}`}>
                <Ionicons name="close" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          ))}
          <Text style={styles.hint}>Après la création, tu pourras aussi partager un lien WhatsApp.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  modes: { flexDirection: 'row', gap: Spacing.sm2 - 2 },
  tile: {
    flex: 1,
    height: TILE_HEIGHT,
    padding: Spacing.md2,
    justifyContent: 'space-between',
  },
  tileText: { gap: Spacing.xs },
  tileLabel: { ...Typography.displayLabel, color: Colors.textPrimary },
  onDark: { color: Colors.textInverted },
  tileSub: { ...Typography.bodySmall, color: Colors.textMuted },
  tileSubAccent: { color: Colors.accent },
  section: { marginTop: Spacing.lg, gap: Spacing.sm2 - 2 },
  empty: { ...Typography.body, color: Colors.textMuted },
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm2,
    paddingLeft: Spacing.sm2,
    paddingRight: Spacing.md2,
  },
  rowText: { flex: 1, gap: 2 },
  check: {
    width: CHECK_SIZE,
    height: CHECK_SIZE,
    borderRadius: Radii.full,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  emailRow: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm2,
    paddingHorizontal: Spacing.md2,
  },
  emailInput: { flex: 1, fontSize: 16, fontWeight: '600', color: Colors.textInk },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm2,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.background,
  },
  chipText: { ...Typography.bodySmall, color: Colors.textPrimary, maxWidth: 240 },
  hint: { ...Typography.bodySmall, color: Colors.textMuted },
});
