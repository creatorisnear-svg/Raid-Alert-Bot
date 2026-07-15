/**
 * TCK Raid Alerts — main screen.
 *
 * Design concept: "Tactical HUD" — dark military readout with a glowing
 * animated siren icon, real-time status bar, and a log-style alert feed.
 *
 * Animations:
 *   • Pulsing ring around the icon when alerts are armed
 *   • Blinking status dot
 *   • FadeInDown entry for each alert card
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
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
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';

// ─── Config ──────────────────────────────────────────────────────────────────
const BOT_URL = (process.env.EXPO_PUBLIC_BOT_URL ?? '').replace(/\/$/, '');

// ─── Palette ─────────────────────────────────────────────────────────────────
const C = {
  bg:          '#080b08',
  bgMid:       '#0e130e',
  surface:     '#111611',
  surface2:    '#172017',
  border:      '#1c2c1c',
  borderBright:'#2a3e2a',
  accent:      '#c0392b',
  accentGlow:  'rgba(192,57,43,0.20)',
  accentRing:  'rgba(192,57,43,0.12)',
  armed:       '#27ae60',
  armedGlow:   'rgba(39,174,96,0.18)',
  amber:       '#e67e22',
  text:        '#cdd8cd',
  textDim:     '#8aaa8a',
  textFaint:   '#4a654a',
  white:       '#ffffff',
};

// ─── Types ───────────────────────────────────────────────────────────────────
type Status   = 'idle' | 'loading' | 'subscribed' | 'error';
type AlertItem = { id: string; title: string; body: string; time: Date };

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ─── Animated pulsing ring ────────────────────────────────────────────────────
function PulseRing({ active }: { active: boolean }) {
  const scale   = useSharedValue(1);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (active) {
      scale.value = withRepeat(
        withSequence(withTiming(1.7, { duration: 1200 }), withTiming(1, { duration: 0 })),
        -1, false,
      );
      opacity.value = withRepeat(
        withSequence(withTiming(0, { duration: 1200 }), withTiming(0.55, { duration: 0 })),
        -1, false,
      );
    } else {
      scale.value   = withTiming(1,   { duration: 400 });
      opacity.value = withTiming(0,   { duration: 400 });
    }
  }, [active]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        { borderRadius: 999, borderWidth: 2, borderColor: C.accent },
        style,
      ]}
    />
  );
}

// ─── Blinking dot ────────────────────────────────────────────────────────────
function BlinkDot({ color }: { color: string }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(0.15, { duration: 700 }), withTiming(1, { duration: 700 })),
      -1, false,
    );
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[styles.blink, { backgroundColor: color }, style]} />
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  const [status,   setStatus]   = useState<Status>('idle');
  const [alerts,   setAlerts]   = useState<AlertItem[]>([]);
  const [errorMsg, setError]    = useState('');
  const [bootTime]              = useState(() => new Date());

  const notifRef    = useRef<Notifications.EventSubscription | null>(null);
  const responseRef = useRef<Notifications.EventSubscription | null>(null);

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  useEffect(() => {
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
      lightColor: C.accent,
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

  // ── Enable ─────────────────────────────────────────────────────────────────
  async function enableAlerts() {
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
      if (!BOT_URL) {
        setError('EXPO_PUBLIC_BOT_URL not configured — see .env.example.');
        setStatus('error');
        return;
      }
      const token = await getPushToken();
      const res = await fetch(`${BOT_URL}/api/subscribe-native`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      setStatus('subscribed');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable alerts.');
      setStatus('error');
    }
  }

  // ── Disable ────────────────────────────────────────────────────────────────
  async function disableAlerts() {
    setStatus('loading');
    try {
      const token = await getPushToken();
      await fetch(`${BOT_URL}/api/unsubscribe-native`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
    } catch { /* best effort */ }
    setStatus('idle');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }

  function addAlert(title: string, body: string) {
    setAlerts(prev => [
      { id: `${Date.now()}${Math.random().toString(36).slice(2)}`, title, body, time: new Date() },
      ...prev.slice(0, 19),
    ]);
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const isArmed   = status === 'subscribed';
  const isLoading = status === 'loading';
  const isError   = status === 'error';

  const modeLabel  = isArmed ? 'ARMED' : isError ? 'FAULT' : isLoading ? 'INIT' : 'STANDBY';
  const modeColor  = isArmed ? C.armed : isError ? C.accent : isLoading ? C.amber : C.textDim;
  const statusLine = isArmed
    ? 'Monitoring · siren will play on raid'
    : isLoading ? 'Establishing uplink…'
    : isError   ? (errorMsg || 'Uplink failed')
    : 'Tap ENGAGE to subscribe to raid alerts';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* ── HERO ── */}
      <LinearGradient
        colors={[isArmed ? '#130d0d' : '#0c0f0c', C.bg]}
        style={[styles.hero, { paddingTop: Math.max(insets.top + 16, 40) }]}
      >
        {/* Corner marks */}
        <View style={[styles.cornerMark, styles.cornerTL]} />
        <View style={[styles.cornerMark, styles.cornerTR]} />

        {/* Icon */}
        <View style={styles.iconArea}>
          <View style={[
            styles.iconRing,
            isArmed && { borderColor: C.accent, shadowColor: C.accent, shadowOpacity: 0.5, shadowRadius: 16, elevation: 8 },
          ]}>
            <PulseRing active={isArmed} />
            <MaterialCommunityIcons
              name="alarm-light"
              size={52}
              color={isArmed ? C.accent : C.textDim}
            />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>RAID ALERTS</Text>
        <View style={styles.clanRow}>
          <View style={styles.clanDash} />
          <Text style={styles.clanLabel}>TCK CLAN</Text>
          <View style={styles.clanDash} />
        </View>

        {/* Mode badge */}
        <Animated.View
          entering={FadeIn}
          style={[
            styles.modeBadge,
            { borderColor: modeColor, backgroundColor: `${modeColor}18` },
          ]}
        >
          <BlinkDot color={modeColor} />
          <Text style={[styles.modeText, { color: modeColor }]}>{modeLabel}</Text>
        </Animated.View>

        {/* Bottom rule */}
        <View style={styles.heroRule} />
      </LinearGradient>

      {/* ── STATUS PANEL ── */}
      <View style={[styles.statusPanel, isArmed && styles.statusPanelArmed]}>
        <MaterialCommunityIcons
          name={isArmed ? 'shield-check' : isError ? 'shield-alert' : 'shield-outline'}
          size={15}
          color={modeColor}
          style={{ marginRight: 7 }}
        />
        <Text style={styles.statusText} numberOfLines={1}>{statusLine}</Text>
        {isLoading && (
          <Text style={[styles.statusMono, { color: C.amber }]}>…</Text>
        )}
      </View>

      {/* ── ACTION BUTTON ── */}
      <View style={styles.btnWrap}>
        {!isArmed ? (
          <Pressable
            onPress={enableAlerts}
            disabled={isLoading}
            style={({ pressed }) => [
              styles.btn,
              styles.btnPrimary,
              isLoading && { opacity: 0.5 },
              pressed && { opacity: 0.85 },
            ]}
          >
            <LinearGradient
              colors={['#9b2335', '#c0392b', '#8e1a26']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.btnGradient}
            >
              <MaterialCommunityIcons name={isError ? 'refresh' : 'bell-ring'} size={18} color="#fff" />
              <Text style={styles.btnLabel}>
                {isLoading ? 'ESTABLISHING UPLINK…' : isError ? 'RETRY' : 'ENGAGE'}
              </Text>
              {!isLoading && (
                <MaterialCommunityIcons name="chevron-right" size={18} color="rgba(255,255,255,0.5)" />
              )}
            </LinearGradient>
          </Pressable>
        ) : (
          <Pressable
            onPress={disableAlerts}
            style={({ pressed }) => [styles.btn, styles.btnSecondary, pressed && { opacity: 0.7 }]}
          >
            <MaterialCommunityIcons name="bell-off-outline" size={16} color={C.textDim} />
            <Text style={styles.btnLabelDim}>DISENGAGE</Text>
          </Pressable>
        )}
      </View>

      {/* ── INTERCEPT LOG ── */}
      <View style={styles.logHeader}>
        <Text style={styles.logTitle}>INTERCEPT LOG</Text>
        {alerts.length > 0 && (
          <View style={styles.logBadge}>
            <Text style={styles.logBadgeText}>{alerts.length}</Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
        <Text style={styles.logMeta}>SESS · {fmtTime(bootTime)}</Text>
      </View>

      <View style={styles.logDivider} />

      <FlatList
        data={alerts}
        keyExtractor={item => item.id}
        style={styles.list}
        contentContainerStyle={alerts.length === 0 && styles.emptyWrap}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="radar" size={40} color={C.textFaint} />
            <Text style={styles.emptyTitle}>NO INTERCEPTS</Text>
            <Text style={styles.emptyBody}>Session is clean</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 40).duration(300)}>
            <View style={styles.alertCard}>
              <View style={styles.alertStripe} />
              <View style={styles.alertBody}>
                <View style={styles.alertTop}>
                  <Text style={styles.alertTitle}>{item.title}</Text>
                  <Text style={styles.alertTime}>{fmtTime(item.time)}</Text>
                </View>
                {!!item.body && (
                  <Text style={styles.alertMsg} numberOfLines={2}>{item.body}</Text>
                )}
              </View>
              <View style={styles.alertBadgeWrap}>
                <Text style={styles.alertBadge}>!</Text>
              </View>
            </View>
          </Animated.View>
        )}
      />

      {/* ── FOOTER ── */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>SENTINEL v1.0</Text>
        <View style={styles.footerDot} />
        <Text style={styles.footerText}>
          {Platform.OS !== 'android' && Platform.OS !== 'ios'
            ? 'WEB PREVIEW · SIREN REQUIRES APK BUILD'
            : 'SIREN ACTIVE ON BUILD'}
        </Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingBottom: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  cornerMark: {
    position: 'absolute',
    width: 16,
    height: 16,
    top: 56,
    borderColor: C.borderBright,
  },
  cornerTL: { left: 20,  borderTopWidth: 1.5, borderLeftWidth: 1.5 },
  cornerTR: { right: 20, borderTopWidth: 1.5, borderRightWidth: 1.5 },

  iconArea: {
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: C.borderBright,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },

  title: {
    fontSize: 26,
    fontWeight: '800',
    color: C.text,
    letterSpacing: 8,
    fontFamily: 'Inter_700Bold',
  },
  clanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 5,
    marginBottom: 14,
  },
  clanDash: {
    height: 1,
    width: 24,
    backgroundColor: C.borderBright,
  },
  clanLabel: {
    fontSize: 11,
    color: C.textDim,
    letterSpacing: 4,
    fontFamily: 'Inter_400Regular',
  },

  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 20,
  },
  blink: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  modeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
    fontFamily: 'Inter_700Bold',
  },

  heroRule: {
    width: '100%',
    height: 1,
    backgroundColor: C.border,
  },

  // Status panel
  statusPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  statusPanelArmed: {
    borderBottomColor: `${C.armed}40`,
  },
  statusText: {
    flex: 1,
    fontSize: 12,
    color: C.textDim,
    fontFamily: 'Inter_400Regular',
    letterSpacing: 0.3,
  },
  statusMono: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    marginLeft: 6,
  },

  // Buttons
  btnWrap: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: C.bg,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  btn: {
    borderRadius: 6,
    overflow: 'hidden',
  },
  btnPrimary: {},
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: C.borderBright,
    borderRadius: 6,
  },
  btnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  btnLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: C.white,
    letterSpacing: 2.5,
    fontFamily: 'Inter_700Bold',
  },
  btnLabelDim: {
    fontSize: 12,
    color: C.textDim,
    letterSpacing: 2.5,
    fontFamily: 'Inter_600SemiBold',
  },

  // Intercept log
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 8,
  },
  logTitle: {
    fontSize: 10,
    color: C.textDim,
    letterSpacing: 2.5,
    fontFamily: 'Inter_600SemiBold',
  },
  logBadge: {
    backgroundColor: C.accent,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  logBadgeText: {
    fontSize: 10,
    color: C.white,
    fontFamily: 'Inter_700Bold',
  },
  logMeta: {
    fontSize: 9,
    color: C.textFaint,
    letterSpacing: 1,
    fontFamily: 'Inter_400Regular',
  },
  logDivider: {
    height: 1,
    backgroundColor: C.border,
    marginHorizontal: 16,
  },

  // Alert list
  list: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  emptyWrap: {
    flex: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 40,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 12,
    color: C.textDim,
    letterSpacing: 2.5,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 4,
  },
  emptyBody: {
    fontSize: 11,
    color: C.textFaint,
    fontFamily: 'Inter_400Regular',
    letterSpacing: 1,
  },

  // Alert card
  alertCard: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 8,
    overflow: 'hidden',
  },
  alertStripe: {
    width: 3,
    backgroundColor: C.accent,
  },
  alertBody: {
    flex: 1,
    padding: 11,
  },
  alertTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  alertTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: C.text,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.3,
  },
  alertTime: {
    fontSize: 10,
    color: C.textFaint,
    fontFamily: 'Inter_400Regular',
    letterSpacing: 0.5,
    marginTop: 2,
    flexShrink: 0,
  },
  alertMsg: {
    fontSize: 12,
    color: C.textDim,
    fontFamily: 'Inter_400Regular',
    marginTop: 3,
    lineHeight: 17,
  },
  alertBadgeWrap: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${C.accent}18`,
  },
  alertBadge: {
    fontSize: 14,
    fontWeight: '800',
    color: C.accent,
    fontFamily: 'Inter_700Bold',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
    marginHorizontal: 16,
  },
  footerText: {
    fontSize: 9,
    color: C.textFaint,
    letterSpacing: 1.5,
    fontFamily: 'Inter_400Regular',
  },
  footerDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: C.textFaint,
  },
});
