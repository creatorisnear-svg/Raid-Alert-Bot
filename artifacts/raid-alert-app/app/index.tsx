import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';

// Set EXPO_PUBLIC_BOT_URL to your Koyeb raid-alert-bot URL, e.g.
// https://my-bot.koyeb.app
const BOT_URL = (process.env.EXPO_PUBLIC_BOT_URL ?? '').replace(/\/$/, '');

// ─── Colours (always dark) ───────────────────────────────────────────────────
const C = {
  bg:         '#0b0e0b',
  surface:    '#141a14',
  border:     '#2a3a2a',
  accent:     '#c0392b',
  accentDark: '#7a1f1f',
  text:       '#e8ede8',
  muted:      '#7a8f7a',
  green:      '#2ecc71',
  yellow:     '#f39c12',
  red:        '#e74c3c',
};

// ─── Types ───────────────────────────────────────────────────────────────────
type AlertItem = {
  id: string;
  title: string;
  body: string;
  time: Date;
};

type Status = 'idle' | 'loading' | 'subscribed' | 'error';

// ─── Component ───────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [status, setStatus]   = useState<Status>('idle');
  const [alerts, setAlerts]   = useState<AlertItem[]>([]);
  const [errorMsg, setError]  = useState('');

  const notifRef    = useRef<Notifications.EventSubscription | null>(null);
  const responseRef = useRef<Notifications.EventSubscription | null>(null);

  // ── Setup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    createAndroidChannel();

    // Foreground notification received
    notifRef.current = Notifications.addNotificationReceivedListener(n => {
      addAlert(n.request.content.title ?? 'Raid Alert!', n.request.content.body ?? '');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    });

    // User tapped a notification (background / killed)
    responseRef.current = Notifications.addNotificationResponseReceivedListener(r => {
      const c = r.notification.request.content;
      addAlert(c.title ?? 'Raid Alert!', c.body ?? '');
    });

    return () => {
      notifRef.current?.remove();
      responseRef.current?.remove();
    };
  }, []);

  async function createAndroidChannel() {
    if (Platform.OS !== 'android') return;
    // This channel is what gives the siren its screen-off sound on Android.
    // The sound file (siren.mp3) is bundled into the APK by the
    // expo-notifications plugin in app.json -- it does NOT work in Expo Go,
    // only in a built APK.
    await Notifications.setNotificationChannelAsync('raid-alert', {
      name: 'Raid Alerts',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'siren.mp3',            // matches the filename in assets/sounds/
      vibrationPattern: [0, 300, 100, 300, 100, 300],
      lightColor: C.accent,
      enableVibrate: true,
      enableLights: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false,
    });
  }

  async function getPushToken(): Promise<string> {
    // projectId is needed for production APK builds (set via EAS or app.json).
    // In Expo Go for testing it works without one.
    const projectId = (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)
      ?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : {}
    );
    return tokenData.data;
  }

  // ── Enable ───────────────────────────────────────────────────────────────
  async function enableAlerts() {
    setStatus('loading');
    setError('');
    try {
      // 1. Permission
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

      // 2. Bot URL check
      if (!BOT_URL) {
        setError('EXPO_PUBLIC_BOT_URL not set -- see .env.example.');
        setStatus('error');
        return;
      }

      // 3. Get Expo push token and register with the bot
      const token = await getPushToken();
      const res = await fetch(`${BOT_URL}/api/subscribe-native`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) throw new Error(`Bot returned ${res.status}`);

      setStatus('subscribed');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable alerts.');
      setStatus('error');
    }
  }

  // ── Disable ──────────────────────────────────────────────────────────────
  async function disableAlerts() {
    setStatus('loading');
    try {
      const token = await getPushToken();
      await fetch(`${BOT_URL}/api/unsubscribe-native`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
    } catch {
      // Ignore -- unsubscribe best-effort
    }
    setStatus('idle');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }

  // ── Alert history ────────────────────────────────────────────────────────
  function addAlert(title: string, body: string) {
    setAlerts(prev => [
      {
        id: `${Date.now()}${Math.random().toString(36).slice(2)}`,
        title,
        body,
        time: new Date(),
      },
      ...prev.slice(0, 19), // keep last 20
    ]);
  }

  // ── Derived UI state ─────────────────────────────────────────────────────
  const dotColor =
    status === 'subscribed' ? C.green
    : status === 'error'    ? C.red
    : C.yellow;

  const statusLabel =
    status === 'subscribed' ? 'Alerts enabled -- siren will play on raid'
    : status === 'loading'  ? 'Setting up...'
    : status === 'error'    ? (errorMsg || 'Something went wrong')
    : 'Tap below to receive raid alerts';

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <View
      style={[
        styles.root,
        {
          paddingTop:    Math.max(insets.top, Platform.OS === 'web' ? 67 : 0),
          paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 34 : 0),
        },
      ]}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name="alarm-light" size={56} color={C.accent} />
        </View>
        <Text style={styles.title}>RAID ALERTS</Text>
        <Text style={styles.clan}>TCK Clan</Text>
      </View>

      {/* ── Status ── */}
      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Text style={styles.statusText} numberOfLines={2}>
          {statusLabel}
        </Text>
      </View>

      {/* ── Action button ── */}
      {status !== 'subscribed' ? (
        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary, status === 'loading' && { opacity: 0.6 }]}
          onPress={enableAlerts}
          disabled={status === 'loading'}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="bell-ring" size={20} color="#fff" style={styles.btnIcon} />
          <Text style={styles.btnLabel}>
            {status === 'loading' ? 'Enabling...' : status === 'error' ? 'Try Again' : 'Enable Alerts'}
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.btn, styles.btnSecondary]}
          onPress={disableAlerts}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="bell-off-outline" size={18} color={C.muted} style={styles.btnIcon} />
          <Text style={styles.btnLabelMuted}>Disable Alerts</Text>
        </TouchableOpacity>
      )}

      {/* ── Build note (Expo Go only) ── */}
      {Platform.OS !== 'web' && (
        <Text style={styles.note}>
          Custom siren sound requires a built APK -- not Expo Go
        </Text>
      )}

      {/* ── Alert history ── */}
      <Text style={styles.sectionTitle}>RECENT ALERTS</Text>

      <FlatList
        data={alerts}
        keyExtractor={item => item.id}
        scrollEnabled={!!alerts.length}
        style={styles.list}
        contentContainerStyle={alerts.length === 0 && styles.emptyWrap}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="shield-check-outline" size={36} color={C.muted} />
            <Text style={styles.emptyText}>No alerts this session</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.alertItem}>
            <Text style={styles.alertTitle}>{item.title}</Text>
            {!!item.body && <Text style={styles.alertBody}>{item.body}</Text>}
            <Text style={styles.alertTime}>{item.time.toLocaleTimeString()}</Text>
          </View>
        )}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    paddingHorizontal: 20,
  },
  // Header
  header: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 20,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#130a0a',
    borderWidth: 2,
    borderColor: '#7a1f1f',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: C.text,
    letterSpacing: 5,
    fontFamily: 'Inter_700Bold',
  },
  clan: {
    fontSize: 12,
    color: C.muted,
    letterSpacing: 3,
    marginTop: 4,
    fontFamily: 'Inter_400Regular',
  },
  // Status row
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  statusText: {
    flex: 1,
    fontSize: 13,
    color: C.text,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  // Buttons
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  btnPrimary: {
    backgroundColor: C.accent,
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: C.border,
  },
  btnIcon: {
    marginRight: 8,
  },
  btnLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
  },
  btnLabelMuted: {
    fontSize: 14,
    color: C.muted,
    fontFamily: 'Inter_400Regular',
  },
  // Note
  note: {
    fontSize: 11,
    color: C.muted,
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'Inter_400Regular',
  },
  // Alert list
  sectionTitle: {
    fontSize: 11,
    color: C.muted,
    letterSpacing: 2,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 10,
  },
  list: {
    flex: 1,
  },
  emptyWrap: {
    flex: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: C.muted,
    fontFamily: 'Inter_400Regular',
  },
  alertItem: {
    backgroundColor: C.surface,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: C.accent,
    padding: 12,
    marginBottom: 8,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: C.text,
    fontFamily: 'Inter_600SemiBold',
  },
  alertBody: {
    fontSize: 13,
    color: C.muted,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  alertTime: {
    fontSize: 11,
    color: C.muted,
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
  },
});
