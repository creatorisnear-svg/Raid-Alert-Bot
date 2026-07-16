/**
 * AVIV Raid Alerts — main screen.
 *
 * Supports multiple clans: the user picks which clan they're in from a
 * bottom-sheet picker. The selection is persisted to AsyncStorage and
 * subscribe/unsubscribe calls are routed to that clan's bot URL.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { fetchClanRegistry, loadCachedClans, FALLBACK_CLANS, type Clan } from '@/constants/clans';

const avivLogo = require('../assets/images/aviv-logo.png') as number;

const STORAGE_KEY = 'selectedClanId';

// ─── Palette ─────────────────────────────────────────────────────────────────
const C = {
  bg:          '#080b08',
  surface:     '#111611',
  border:      '#1c2c1c',
  borderBright:'#2a3e2a',
  overlay:     'rgba(0,0,0,0.75)',
  sheet:       '#131913',
  active:      '#27ae60',
  amber:       '#e67e22',
  text:        '#cdd8cd',
  textDim:     '#8aaa8a',
  textFaint:   '#4a654a',
  white:       '#ffffff',
};

// ─── Types ───────────────────────────────────────────────────────────────────
type Status    = 'idle' | 'loading' | 'subscribed' | 'error';
type AlertItem = { id: string; title: string; body: string; time: Date };

function fmtTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ─── Animated pulse ring ──────────────────────────────────────────────────────
function PulseRing({ active, color }: { active: boolean; color: string }) {
  const scale   = useSharedValue(1);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (active) {
      scale.value = withRepeat(
        withSequence(withTiming(1.7, { duration: 1200 }), withTiming(1, { duration: 0 })),
        -1, false,
      );
      opacity.value = withRepeat(
        withSequence(withTiming(0, { duration: 1200 }), withTiming(0.5, { duration: 0 })),
        -1, false,
      );
    } else {
      scale.value   = withTiming(1, { duration: 400 });
      opacity.value = withTiming(0, { duration: 400 });
    }
  }, [active]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { borderRadius: 999, borderWidth: 2, borderColor: color }, style]}
    />
  );
}

// ─── Blinking dot ─────────────────────────────────────────────────────────────
function BlinkDot({ color }: { color: string }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(0.15, { duration: 700 }), withTiming(1, { duration: 700 })),
      -1, false,
    );
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.blink, { backgroundColor: color }, style]} />;
}

// ─── Clan picker modal ────────────────────────────────────────────────────────
function ClanPickerModal({
  visible,
  selected,
  clans,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: Clan;
  clans: Clan[];
  onSelect: (clan: Clan) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={picker.overlay}>
        {/* Tap outside to close */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        {/* Sheet */}
        <View style={[picker.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          {/* Handle */}
          <View style={picker.handle} />

          {/* Header */}
          <View style={picker.header}>
            <Text style={picker.headerTitle}>Select Your Clan</Text>
            <Pressable onPress={onClose} style={picker.closeBtn} hitSlop={12}>
              <MaterialCommunityIcons name="close" size={20} color={C.textDim} />
            </Pressable>
          </View>

          <View style={picker.divider} />

          {/* Clan list */}
          <ScrollView style={picker.list} showsVerticalScrollIndicator={false}>
            {clans.map(clan => {
              const isSelected = clan.id === selected.id;
              const hasUrl = !!clan.botUrl;
              return (
                <Pressable
                  key={clan.id}
                  onPress={() => hasUrl ? onSelect(clan) : undefined}
                  style={({ pressed }) => [
                    picker.clanRow,
                    isSelected && { backgroundColor: `${clan.color}12` },
                    pressed && hasUrl && { opacity: 0.7 },
                  ]}
                >
                  {/* Color swatch */}
                  <View style={[picker.swatch, { backgroundColor: clan.color }]} />

                  {/* Info */}
                  <View style={picker.clanInfo}>
                    <Text style={[picker.clanName, !hasUrl && { color: C.textFaint }]}>
                      {clan.name}
                    </Text>
                    {!hasUrl && (
                      <Text style={picker.clanNoUrl}>Bot URL not configured</Text>
                    )}
                  </View>

                  {/* Check or chevron */}
                  {isSelected ? (
                    <MaterialCommunityIcons name="check-circle" size={22} color={C.active} />
                  ) : hasUrl ? (
                    <MaterialCommunityIcons name="chevron-right" size={22} color={C.textFaint} />
                  ) : (
                    <MaterialCommunityIcons name="alert-circle-outline" size={18} color={C.textFaint} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={picker.divider} />
          <Text style={picker.footer}>
            To add clans, edit{' '}
            <Text style={picker.footerMono}>constants/clans.ts</Text>
            {' '}in the app source
          </Text>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  const [clan,       setClan]       = useState<Clan>(FALLBACK_CLANS[0]!);
  const [clans,      setClans]      = useState<Clan[]>(FALLBACK_CLANS);
  const [showPicker, setShowPicker] = useState(false);
  const [status,     setStatus]     = useState<Status>('idle');
  const [alerts,     setAlerts]     = useState<AlertItem[]>([]);
  const [errorMsg,   setError]      = useState('');
  const [bootTime]                  = useState(() => new Date());

  const notifRef    = useRef<Notifications.EventSubscription | null>(null);
  const responseRef = useRef<Notifications.EventSubscription | null>(null);

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    // 1. Load last-cached clan list immediately (no flicker)
    loadCachedClans().then(cached => {
      setClans(cached);
      // Restore previously selected clan from the cached list
      AsyncStorage.getItem(STORAGE_KEY).then(id => {
        if (id) {
          const saved = cached.find(c => c.id === id);
          if (saved) setClan(saved);
        }
      }).catch(() => {});
    }).catch(() => {});

    // 2. Fetch the live list from the bot registry (non-blocking)
    fetchClanRegistry().then(fresh => {
      setClans(fresh);
      // If the active clan is in the fresh list, keep it; otherwise stay put.
      AsyncStorage.getItem(STORAGE_KEY).then(id => {
        if (id) {
          const updated = fresh.find(c => c.id === id);
          if (updated) setClan(updated); // refresh botUrl in case it changed
        }
      }).catch(() => {});
    }).catch(() => { /* keep cached list on network failure */ });

    createAndroidChannel();

    notifRef.current = Notifications.addNotificationReceivedListener(n => {
      addAlert(n.request.content.title ?? 'Raid Alert!', n.request.content.body ?? '');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    });
    responseRef.current = Notifications.addNotificationResponseReceivedListener(r => {
      const c = r.notification.request.content;
      addAlert(c.title ?? 'Raid Alert!', c.body ?? '');
    });

    return () => { notifRef.current?.remove(); responseRef.current?.remove(); };
  }, []);

  async function createAndroidChannel() {
    if (Platform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync('raid-alert', {
      name: 'Raid Alerts',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'siren.mp3',
      vibrationPattern: [0, 300, 100, 300, 100, 300],
      lightColor: clan.color,
      enableVibrate: true,
      enableLights: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  async function getPushToken(): Promise<string> {
    const projectId = (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId;
    const t = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : {});
    return t.data;
  }

  // ── Subscribe ──────────────────────────────────────────────────────────────
  async function enableAlerts(targetClan: Clan = clan) {
    setStatus('loading');
    setError('');
    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let perm = existing;
      if (existing !== 'granted') {
        const { status: asked } = await Notifications.requestPermissionsAsync();
        perm = asked;
      }
      if (perm !== 'granted') {
        setError('Allow notifications in Settings to receive raid alerts.');
        setStatus('idle');
        return;
      }
      if (!targetClan.botUrl) {
        setError(`${targetClan.name} bot URL not configured — see .env.example.`);
        setStatus('error');
        return;
      }
      const token = await getPushToken();
      const res = await fetch(`${targetClan.botUrl}/api/subscribe-native`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      setStatus('subscribed');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setStatus('error');
    }
  }

  // ── Unsubscribe ────────────────────────────────────────────────────────────
  async function disableAlerts(targetClan: Clan = clan) {
    setStatus('loading');
    try {
      const token = await getPushToken();
      await fetch(`${targetClan.botUrl}/api/unsubscribe-native`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
    } catch { /* best effort */ }
    setStatus('idle');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }

  // ── Clan switch ────────────────────────────────────────────────────────────
  async function handleClanSelect(newClan: Clan) {
    if (newClan.id === clan.id) { setShowPicker(false); return; }

    const wasSubscribed = status === 'subscribed';

    // Unsubscribe from current clan first
    if (wasSubscribed) {
      try {
        const token = await getPushToken();
        await fetch(`${clan.botUrl}/api/unsubscribe-native`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
      } catch { /* ignore */ }
    }

    setClan(newClan);
    setStatus('idle');
    setError('');
    setShowPicker(false);
    await AsyncStorage.setItem(STORAGE_KEY, newClan.id);
    Haptics.selectionAsync();

    // Auto-subscribe to the new clan if we were already enabled
    if (wasSubscribed && newClan.botUrl) {
      await enableAlerts(newClan);
    }
  }

  function addAlert(title: string, body: string) {
    setAlerts(prev => [
      { id: `${Date.now()}${Math.random().toString(36).slice(2)}`, title, body, time: new Date() },
      ...prev.slice(0, 19),
    ]);
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const isActive  = status === 'subscribed';
  const isLoading = status === 'loading';
  const isError   = status === 'error';

  const accent     = clan.color;
  const modeLabel  = isActive ? 'Active' : isError ? 'Error' : isLoading ? 'Loading' : 'Inactive';
  const modeColor  = isActive ? C.active : isError ? accent : isLoading ? C.amber : C.textDim;
  const statusLine =
    isActive  ? `Alerts on — siren will sound when ${clan.name} is raided`
    : isLoading ? 'Connecting…'
    : isError   ? (errorMsg || 'Something went wrong')
    : `Tap Enable Alerts to get notified when ${clan.name} is raided`;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* ── CLAN PICKER MODAL ── */}
      <ClanPickerModal
        visible={showPicker}
        selected={clan}
        clans={clans}
        onSelect={handleClanSelect}
        onClose={() => setShowPicker(false)}
      />

      {/* ── HERO ── */}
      <LinearGradient
        colors={[isActive ? '#130d07' : '#0c0f0c', C.bg]}
        style={[styles.hero, { paddingTop: Math.max(insets.top + 16, 40) }]}
      >
        <View style={[
          styles.logoWrap,
          isActive && { borderColor: accent, shadowColor: accent, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 },
        ]}>
          <PulseRing active={isActive} color={accent} />
          <Image source={avivLogo} style={styles.logoImg} resizeMode="contain" />
        </View>

        <Text style={styles.appName}>AVIV</Text>
        <View style={styles.subtitleRow}>
          <View style={styles.subtitleDash} />
          <Text style={styles.subtitle}>RAID ALERTS</Text>
          <View style={styles.subtitleDash} />
        </View>

        <Animated.View entering={FadeIn} style={[styles.badge, { borderColor: modeColor, backgroundColor: `${modeColor}18` }]}>
          <BlinkDot color={modeColor} />
          <Text style={[styles.badgeText, { color: modeColor }]}>{modeLabel}</Text>
        </Animated.View>

        <View style={styles.heroRule} />
      </LinearGradient>

      {/* ── CLAN SELECTOR ROW ── */}
      <Pressable
        onPress={() => setShowPicker(true)}
        style={({ pressed }) => [styles.clanRow, pressed && { opacity: 0.75 }]}
      >
        <View style={[styles.clanSwatch, { backgroundColor: accent }]} />
        <View style={styles.clanMeta}>
          <Text style={styles.clanLabel}>YOUR CLAN</Text>
          <Text style={[styles.clanName, { color: accent }]}>{clan.name}</Text>
        </View>
        <View style={styles.clanChangeBtn}>
          <Text style={styles.clanChangeText}>Change</Text>
          <MaterialCommunityIcons name="chevron-down" size={16} color={C.textDim} />
        </View>
      </Pressable>

      {/* ── STATUS BAR ── */}
      <View style={[styles.statusRow, isActive && { borderBottomColor: `${C.active}40` }]}>
        <MaterialCommunityIcons
          name={isActive ? 'shield-check' : isError ? 'shield-alert' : 'shield-outline'}
          size={15} color={modeColor} style={{ marginRight: 7 }}
        />
        <Text style={styles.statusText} numberOfLines={2}>{statusLine}</Text>
      </View>

      {/* ── BUTTON ── */}
      <View style={styles.btnWrap}>
        {!isActive ? (
          <Pressable
            onPress={() => enableAlerts()}
            disabled={isLoading}
            style={({ pressed }) => [styles.btn, isLoading && { opacity: 0.5 }, pressed && { opacity: 0.85 }]}
          >
            <LinearGradient
              colors={[shadeDown(accent), accent, shadeDown(accent)]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.btnInner}
            >
              <MaterialCommunityIcons name={isError ? 'refresh' : 'bell-ring'} size={18} color="#fff" />
              <Text style={styles.btnLabel}>
                {isLoading ? 'Connecting…' : isError ? 'Try Again' : 'Enable Alerts'}
              </Text>
              {!isLoading && (
                <MaterialCommunityIcons name="chevron-right" size={18} color="rgba(255,255,255,0.5)" />
              )}
            </LinearGradient>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => disableAlerts()}
            style={({ pressed }) => [styles.btnOutline, pressed && { opacity: 0.7 }]}
          >
            <MaterialCommunityIcons name="bell-off-outline" size={16} color={C.textDim} />
            <Text style={styles.btnLabelDim}>Disable Alerts</Text>
          </Pressable>
        )}
      </View>

      {/* ── RECENT ALERTS ── */}
      <View style={styles.logHeader}>
        <Text style={styles.logTitle}>RECENT ALERTS</Text>
        {alerts.length > 0 && (
          <View style={[styles.logBadge, { backgroundColor: accent }]}>
            <Text style={styles.logBadgeText}>{alerts.length}</Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
        <Text style={styles.logMeta}>{fmtTime(bootTime)}</Text>
      </View>

      <View style={styles.divider} />

      <FlatList
        data={alerts}
        keyExtractor={item => item.id}
        style={styles.list}
        contentContainerStyle={alerts.length === 0 && styles.emptyWrap}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="shield-check-outline" size={40} color={C.textFaint} />
            <Text style={styles.emptyTitle}>No alerts yet</Text>
            <Text style={styles.emptyBody}>You'll see raids here when they happen</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 40).duration(300)}>
            <View style={styles.alertCard}>
              <View style={[styles.alertStripe, { backgroundColor: accent }]} />
              <View style={styles.alertContent}>
                <View style={styles.alertTop}>
                  <Text style={styles.alertTitle}>{item.title}</Text>
                  <Text style={styles.alertTime}>{fmtTime(item.time)}</Text>
                </View>
                {!!item.body && (
                  <Text style={styles.alertMsg} numberOfLines={2}>{item.body}</Text>
                )}
              </View>
              <View style={[styles.alertExclaim, { backgroundColor: `${accent}18` }]}>
                <Text style={[styles.alertExclaimText, { color: accent }]}>!</Text>
              </View>
            </View>
          </Animated.View>
        )}
      />

      {/* ── FOOTER ── */}
      <View style={styles.footer}>
        <Image source={avivLogo} style={styles.footerLogo} resizeMode="contain" />
        <Text style={styles.footerText}>AVIV Raid Alerts</Text>
        {Platform.OS !== 'android' && Platform.OS !== 'ios' && (
          <>
            <View style={styles.footerDot} />
            <Text style={styles.footerText}>Web preview</Text>
          </>
        )}
      </View>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Darken a hex colour by ~25% for gradient edges. */
function shadeDown(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, ((n >> 16) & 0xff) - 60);
  const g = Math.max(0, ((n >> 8)  & 0xff) - 60);
  const b = Math.max(0, ( n        & 0xff) - 60);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  hero: { alignItems: 'center', overflow: 'hidden' },
  logoWrap: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 1.5, borderColor: C.borderBright,
    backgroundColor: C.surface,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0,
  },
  logoImg: { width: 62, height: 62 },

  appName: {
    fontSize: 28, fontWeight: '800', color: C.text,
    letterSpacing: 8, fontFamily: 'Inter_700Bold',
  },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 14 },
  subtitleDash: { height: 1, width: 20, backgroundColor: C.borderBright },
  subtitle: { fontSize: 11, color: C.textDim, letterSpacing: 4, fontFamily: 'Inter_400Regular' },

  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 4,
    paddingHorizontal: 14, paddingVertical: 6, marginBottom: 20,
  },
  blink: { width: 7, height: 7, borderRadius: 3.5 },
  badgeText: { fontSize: 12, fontWeight: '700', letterSpacing: 1, fontFamily: 'Inter_700Bold' },

  heroRule: { width: '100%', height: 1, backgroundColor: C.border },

  // Clan selector
  clanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 12,
  },
  clanSwatch: { width: 4, height: 36, borderRadius: 2 },
  clanMeta: { flex: 1 },
  clanLabel: { fontSize: 9, color: C.textFaint, letterSpacing: 2, fontFamily: 'Inter_600SemiBold' },
  clanName:  { fontSize: 17, fontWeight: '700', fontFamily: 'Inter_700Bold', marginTop: 1 },
  clanChangeBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  clanChangeText: { fontSize: 12, color: C.textDim, fontFamily: 'Inter_400Regular' },

  // Status
  statusRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: C.surface,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  statusText: { flex: 1, fontSize: 12, color: C.textDim, fontFamily: 'Inter_400Regular', letterSpacing: 0.3 },

  // Buttons
  btnWrap: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  btn: { borderRadius: 6, overflow: 'hidden' },
  btnInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 15, paddingHorizontal: 20,
  },
  btnLabel: {
    flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '700',
    color: C.white, letterSpacing: 0.5, fontFamily: 'Inter_700Bold',
  },
  btnOutline: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 13,
    borderWidth: 1, borderColor: C.borderBright, borderRadius: 6,
  },
  btnLabelDim: { fontSize: 14, color: C.textDim, fontFamily: 'Inter_400Regular' },

  // Alert list header
  logHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, gap: 8,
  },
  logTitle: { fontSize: 10, color: C.textDim, letterSpacing: 2.5, fontFamily: 'Inter_600SemiBold' },
  logBadge: { borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  logBadgeText: { fontSize: 10, color: C.white, fontFamily: 'Inter_700Bold' },
  logMeta: { fontSize: 9, color: C.textFaint, letterSpacing: 1, fontFamily: 'Inter_400Regular' },
  divider: { height: 1, backgroundColor: C.border, marginHorizontal: 16 },

  // Alert list
  list: { flex: 1, paddingHorizontal: 16, paddingTop: 10 },
  emptyWrap: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 40, opacity: 0.5 },
  emptyTitle: { fontSize: 14, color: C.textDim, fontFamily: 'Inter_600SemiBold', marginTop: 4 },
  emptyBody: { fontSize: 12, color: C.textFaint, fontFamily: 'Inter_400Regular', textAlign: 'center' },

  // Alert card
  alertCard: {
    flexDirection: 'row', backgroundColor: C.surface,
    borderRadius: 4, borderWidth: 1, borderColor: C.border,
    marginBottom: 8, overflow: 'hidden',
  },
  alertStripe: { width: 3 },
  alertContent: { flex: 1, padding: 11 },
  alertTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  alertTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: C.text, fontFamily: 'Inter_700Bold' },
  alertTime: { fontSize: 10, color: C.textFaint, fontFamily: 'Inter_400Regular', marginTop: 2, flexShrink: 0 },
  alertMsg: { fontSize: 12, color: C.textDim, fontFamily: 'Inter_400Regular', marginTop: 3, lineHeight: 17 },
  alertExclaim: { width: 28, alignItems: 'center', justifyContent: 'center' },
  alertExclaimText: { fontSize: 14, fontWeight: '800', fontFamily: 'Inter_700Bold' },

  // Footer
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border, marginHorizontal: 16,
  },
  footerLogo: { width: 14, height: 14, opacity: 0.5 },
  footerText: { fontSize: 9, color: C.textFaint, letterSpacing: 0.5, fontFamily: 'Inter_400Regular' },
  footerDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: C.textFaint },
});

// ─── Picker styles ────────────────────────────────────────────────────────────
const picker = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: C.overlay },
  sheet: {
    backgroundColor: C.sheet,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    borderTopWidth: 1, borderTopColor: C.borderBright,
    maxHeight: '80%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: C.borderBright,
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  headerTitle: {
    flex: 1, fontSize: 16, fontWeight: '700',
    color: C.text, fontFamily: 'Inter_700Bold',
  },
  closeBtn: {
    padding: 4,
    backgroundColor: C.surface, borderRadius: 20,
  },
  divider: { height: 1, backgroundColor: C.border, marginHorizontal: 16 },
  list: { paddingHorizontal: 16, paddingTop: 8 },

  clanRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: C.border,
    borderRadius: 8, marginBottom: 2,
    paddingHorizontal: 12,
  },
  swatch: { width: 14, height: 14, borderRadius: 7 },
  clanInfo: { flex: 1 },
  clanName: { fontSize: 16, fontWeight: '700', color: C.text, fontFamily: 'Inter_700Bold' },
  clanNoUrl: { fontSize: 11, color: C.textFaint, fontFamily: 'Inter_400Regular', marginTop: 2 },

  footer: {
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8,
    fontSize: 11, color: C.textFaint,
    fontFamily: 'Inter_400Regular', textAlign: 'center',
  },
  footerMono: { fontFamily: 'Inter_600SemiBold', color: C.textDim },
});
