/**
 * AVIV Raid Alerts — main screen.
 *
 * Authenticated via Discord OAuth against the shared API server (same backend
 * as the AVIV Clan+ website). Clans are loaded from /api/me/clans — no manual
 * URL entry needed. Join a clan by pasting the invite link from the website.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
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
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { api, ApiClan, ApiAlert, ApiInviteClan, loadToken, saveToken, clearToken, API_BASE } from '@/lib/api';

WebBrowser.maybeCompleteAuthSession();

const avivLogo = require('../assets/images/aviv-logo.png') as number;

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:           '#080b08',
  surface:      '#111611',
  border:       '#1c2c1c',
  borderBright: '#2a3e2a',
  overlay:      'rgba(0,0,0,0.75)',
  sheet:        '#131913',
  active:       '#27ae60',
  amber:        '#e67e22',
  discord:      '#5865F2',
  text:         '#cdd8cd',
  textDim:      '#8aaa8a',
  textFaint:    '#4a654a',
  white:        '#ffffff',
};

const CLAN_COLORS = ['#e8430a', '#3498db', '#9b59b6', '#27ae60', '#e67e22', '#e74c3c', '#1abc9c'];
function clanColor(id: number): string {
  return CLAN_COLORS[id % CLAN_COLORS.length] ?? '#e8430a';
}

// ─── Types ────────────────────────────────────────────────────────────────────
type AuthState = 'checking' | 'unauthenticated' | 'authenticated';
type Status    = 'idle' | 'loading' | 'subscribed' | 'error';
type AlertItem = { id: string; title: string; body: string; time: Date; isLive: boolean };

function fmtTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function fmtRelative(iso: string) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)     return `${Math.round(diff)}s ago`;
  if (diff < 3600)   return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.round(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}

// ─── Animated pulse ring ──────────────────────────────────────────────────────
function PulseRing({ active, color }: { active: boolean; color: string }) {
  const scale   = useSharedValue(1);
  const opacity = useSharedValue(0);
  useEffect(() => {
    if (active) {
      scale.value   = withRepeat(withSequence(withTiming(1.7, { duration: 1200 }), withTiming(1, { duration: 0 })), -1, false);
      opacity.value = withRepeat(withSequence(withTiming(0, { duration: 1200 }), withTiming(0.5, { duration: 0 })), -1, false);
    } else {
      scale.value   = withTiming(1, { duration: 400 });
      opacity.value = withTiming(0, { duration: 400 });
    }
  }, [active]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));
  return <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 999, borderWidth: 2, borderColor: color }, style]} />;
}

// ─── Blinking dot ─────────────────────────────────────────────────────────────
function BlinkDot({ color }: { color: string }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(withSequence(withTiming(0.15, { duration: 700 }), withTiming(1, { duration: 700 })), -1, false);
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
  onAddInvite,
  onClose,
}: {
  visible:     boolean;
  selected:    ApiClan | null;
  clans:       ApiClan[];
  onSelect:    (clan: ApiClan) => void;
  onAddInvite: (inviteUrl: string) => Promise<void>;
  onClose:     () => void;
}) {
  const insets = useSafeAreaInsets();
  const [adding,       setAdding]       = useState(false);
  const [inviteUrl,    setInviteUrl]    = useState('');
  const [connecting,   setConnecting]   = useState(false);
  const [connectError, setConnectError] = useState('');
  const [preview,      setPreview]      = useState<ApiInviteClan | null>(null);

  function resetAdd() { setAdding(false); setInviteUrl(''); setConnectError(''); setPreview(null); }

  async function handleConnect() {
    if (!inviteUrl.trim()) return;
    setConnecting(true);
    setConnectError('');
    setPreview(null);
    try {
      await onAddInvite(inviteUrl.trim());
      resetAdd();
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Could not join that clan');
    } finally {
      setConnecting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={picker.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[picker.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <View style={picker.handle} />

          <View style={picker.header}>
            <Text style={picker.headerTitle}>Your Clans</Text>
            <Pressable onPress={onClose} style={picker.closeBtn} hitSlop={12}>
              <MaterialCommunityIcons name="close" size={20} color={C.textDim} />
            </Pressable>
          </View>
          <View style={picker.divider} />

          <ScrollView style={picker.list} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {clans.map(c => {
              const isSelected = c.id === selected?.id;
              const color      = clanColor(c.id);
              return (
                <Pressable
                  key={c.id}
                  onPress={() => onSelect(c)}
                  style={({ pressed }) => [picker.clanRow, isSelected && { backgroundColor: `${color}18` }, pressed && { opacity: 0.7 }]}
                >
                  <View style={[picker.swatch, { backgroundColor: color }]} />
                  <View style={picker.clanInfo}>
                    <Text style={picker.clanName}>{c.name}</Text>
                    <Text style={picker.clanMeta}>{c.memberCount} member{c.memberCount !== 1 ? 's' : ''} · {c.role}</Text>
                  </View>
                  {isSelected
                    ? <MaterialCommunityIcons name="check-circle" size={22} color={C.active} />
                    : <MaterialCommunityIcons name="chevron-right" size={20} color={C.textFaint} />
                  }
                </Pressable>
              );
            })}

            {/* ── Add clan via invite link ── */}
            {!adding ? (
              <Pressable
                onPress={() => setAdding(true)}
                style={({ pressed }) => [picker.addRow, pressed && { opacity: 0.7 }]}
              >
                <MaterialCommunityIcons name="link-plus" size={19} color={C.textDim} />
                <Text style={picker.addLabel}>Join a Clan with Invite Link</Text>
              </Pressable>
            ) : (
              <View style={picker.addForm}>
                <Text style={picker.addFormTitle}>Paste your invite link</Text>
                <Text style={picker.addFormHint}>
                  Get the link from your clan leader on the AVIV Clan+ website, then paste it below.
                </Text>
                <TextInput
                  style={picker.addInput}
                  value={inviteUrl}
                  onChangeText={setInviteUrl}
                  placeholder="https://clan-plus.app/invite/..."
                  placeholderTextColor={C.textFaint}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  returnKeyType="go"
                  onSubmitEditing={handleConnect}
                  autoFocus
                />
                {!!connectError && <Text style={picker.addError}>{connectError}</Text>}
                {preview && (
                  <View style={picker.previewBox}>
                    <Text style={picker.previewName}>{preview.name}</Text>
                    <Text style={picker.previewMeta}>{preview.memberCount} members · led by {preview.leaderUsername}</Text>
                  </View>
                )}
                <View style={picker.addActions}>
                  <Pressable onPress={resetAdd} style={picker.cancelBtn}>
                    <Text style={picker.cancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleConnect}
                    disabled={connecting || !inviteUrl.trim()}
                    style={[picker.connectBtn, (connecting || !inviteUrl.trim()) && { opacity: 0.45 }]}
                  >
                    {connecting
                      ? <ActivityIndicator size="small" color={C.white} />
                      : <Text style={picker.connectText}>Join Clan</Text>
                    }
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Sign-in screen ───────────────────────────────────────────────────────────
function SignInScreen({ onSignIn, loading }: { onSignIn: () => void; loading: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient colors={['#0a120a', C.bg]} style={[signIn.root, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 }]}>
      <Image source={avivLogo} style={signIn.logo} resizeMode="contain" />
      <Text style={signIn.appName}>AVIV</Text>
      <View style={signIn.subtitleRow}>
        <View style={signIn.dash} />
        <Text style={signIn.subtitle}>RAID ALERTS</Text>
        <View style={signIn.dash} />
      </View>
      <Text style={signIn.desc}>
        Sign in with Discord to see your clans and{'\n'}get raid alerts on your phone.
      </Text>
      <Pressable onPress={onSignIn} disabled={loading} style={({ pressed }) => [signIn.btn, pressed && { opacity: 0.8 }, loading && { opacity: 0.5 }]}>
        {loading
          ? <ActivityIndicator color={C.white} />
          : <>
              <MaterialCommunityIcons name="discord" size={20} color={C.white} />
              <Text style={signIn.btnText}>Sign in with Discord</Text>
            </>
        }
      </Pressable>
      <Text style={signIn.hint}>Your clans from the AVIV Clan+ website appear automatically.</Text>
    </LinearGradient>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  const [authState,  setAuthState]  = useState<AuthState>('checking');
  const [user,       setUser]       = useState<{ id: number; username: string; avatar: string | null } | null>(null);
  const [clan,       setClan]       = useState<ApiClan | null>(null);
  const [clans,      setClans]      = useState<ApiClan[]>([]);
  const [clansLoading, setClansLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [status,     setStatus]     = useState<Status>('idle');
  const [alerts,     setAlerts]     = useState<AlertItem[]>([]);
  const [errorMsg,   setError]      = useState('');
  const [signingIn,  setSigningIn]  = useState(false);

  const notifRef    = useRef<Notifications.EventSubscription | null>(null);
  const responseRef = useRef<Notifications.EventSubscription | null>(null);
  const pushToken   = useRef<string | null>(null);

  // ── Boot: check stored auth token ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const token = await loadToken();
      if (!token) { setAuthState('unauthenticated'); return; }
      try {
        const me = await api.me();
        setUser(me);
        setAuthState('authenticated');
        await refreshClans();
      } catch {
        await clearToken();
        setAuthState('unauthenticated');
      }
    })();

    createAndroidChannel();

    notifRef.current = Notifications.addNotificationReceivedListener(n => {
      addLiveAlert(n.request.content.title ?? 'Raid Alert!', n.request.content.body ?? '');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    });
    responseRef.current = Notifications.addNotificationResponseReceivedListener(r => {
      const c = r.notification.request.content;
      addLiveAlert(c.title ?? 'Raid Alert!', c.body ?? '');
    });

    return () => { notifRef.current?.remove(); responseRef.current?.remove(); };
  }, []);

  // Reload alert history when active clan changes
  useEffect(() => {
    if (clan) loadAlertHistory(clan.id);
  }, [clan?.id]);

  async function createAndroidChannel() {
    if (Platform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync('raid-alert', {
      name: 'Raid Alerts',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'siren.mp3',
      vibrationPattern: [0, 300, 100, 300, 100, 300],
      enableVibrate: true,
      enableLights: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  const refreshClans = useCallback(async () => {
    setClansLoading(true);
    try {
      const list = await api.myClans();
      setClans(list);
      if (list.length > 0) {
        setClan(prev => prev ? (list.find(c => c.id === prev.id) ?? list[0]!) : list[0]!);
      }
    } catch { /* ignore */ }
    finally { setClansLoading(false); }
  }, []);

  async function loadAlertHistory(clanId: number) {
    try {
      const history = await api.alerts(clanId);
      const items: AlertItem[] = history.map(a => ({
        id:     String(a.id),
        title:  a.title,
        body:   a.body,
        time:   new Date(a.createdAt),
        isLive: false,
      }));
      // Keep live alerts at top, append history
      setAlerts(prev => {
        const live = prev.filter(a => a.isLive);
        const combined = [...live, ...items];
        return combined.slice(0, 50);
      });
    } catch { /* ignore — network error, don't clear existing */ }
  }

  function addLiveAlert(title: string, body: string) {
    setAlerts(prev => [
      { id: `live-${Date.now()}${Math.random().toString(36).slice(2)}`, title, body, time: new Date(), isLive: true },
      ...prev.slice(0, 49),
    ]);
  }

  async function getOrFetchPushToken(): Promise<string> {
    if (pushToken.current) return pushToken.current;
    const projectId = (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId;
    const t = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : {});
    pushToken.current = t.data;
    return t.data;
  }

  // ── Discord OAuth ─────────────────────────────────────────────────────────
  async function signIn() {
    if (!API_BASE) {
      setError('API URL not configured. Set EXPO_PUBLIC_API_URL.');
      return;
    }
    setSigningIn(true);
    try {
      const redirectUrl = Linking.createURL('auth');
      const authUrl     = `${API_BASE}/api/auth/discord?platform=mobile&redirect=${encodeURIComponent(redirectUrl)}`;
      const result      = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

      if (result.type === 'success') {
        const parsed = new URL(result.url);
        const token  = parsed.searchParams.get('token');
        if (token) {
          await saveToken(token);
          const me = await api.me();
          setUser(me);
          setAuthState('authenticated');
          await refreshClans();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setSigningIn(false);
    }
  }

  async function signOut() {
    if (status === 'subscribed' && clan) {
      await disableAlerts(clan).catch(() => {});
    }
    await api.logout().catch(() => {});
    await clearToken();
    setUser(null);
    setClans([]);
    setClan(null);
    setAlerts([]);
    setStatus('idle');
    setAuthState('unauthenticated');
  }

  // ── Subscribe / Unsubscribe ───────────────────────────────────────────────
  async function enableAlerts(targetClan: ApiClan = clan!) {
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
      const token = await getOrFetchPushToken();
      await api.subNative(targetClan.id, token);
      setStatus('subscribed');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setStatus('error');
    }
  }

  async function disableAlerts(targetClan: ApiClan = clan!) {
    setStatus('loading');
    try {
      const token = await getOrFetchPushToken();
      await api.unsubNative(targetClan.id, token).catch(() => {});
    } catch { /* ignore */ }
    setStatus('idle');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }

  // ── Clan switch ───────────────────────────────────────────────────────────
  async function handleClanSelect(newClan: ApiClan) {
    if (newClan.id === clan?.id) { setShowPicker(false); return; }
    const wasSubscribed = status === 'subscribed';
    if (wasSubscribed && clan) {
      try {
        const token = await getOrFetchPushToken();
        await api.unsubNative(clan.id, token);
      } catch { /* ignore */ }
    }
    setClan(newClan);
    setStatus('idle');
    setError('');
    setShowPicker(false);
    Haptics.selectionAsync();
    if (wasSubscribed) await enableAlerts(newClan);
  }

  // ── Join via invite link ──────────────────────────────────────────────────
  async function handleAddInvite(inviteUrl: string) {
    // Parse token from URL like https://...koyeb.app/invite/TOKEN
    const match = inviteUrl.match(/\/invite\/([a-f0-9]+)/i);
    if (!match?.[1]) throw new Error('That doesn\'t look like a valid invite link. Copy it from the AVIV Clan+ website.');
    const token = match[1];

    // Preview the clan
    const preview = await api.inviteLookup(token);
    // Join
    await api.inviteJoin(token);
    // Reload clans
    await refreshClans();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  const isActive  = status === 'subscribed';
  const isLoading = status === 'loading';
  const isError   = status === 'error';
  const accent    = clan ? clanColor(clan.id) : '#e8430a';
  const modeLabel = isActive ? 'Active' : isError ? 'Error' : isLoading ? 'Loading' : 'Inactive';
  const modeColor = isActive ? C.active : isError ? accent : isLoading ? C.amber : C.textDim;
  const statusLine =
    isActive  ? `Alerts on — siren will sound when ${clan?.name ?? 'your clan'} is raided`
    : isLoading ? 'Connecting…'
    : isError   ? (errorMsg || 'Something went wrong')
    : clan ? `Tap Enable Alerts to get notified when ${clan.name} is raided`
    : 'No clans yet — join one with an invite link from the website';

  // ── Auth states ───────────────────────────────────────────────────────────
  if (authState === 'checking') {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={C.active} size="large" />
      </View>
    );
  }

  if (authState === 'unauthenticated') {
    return <SignInScreen onSignIn={signIn} loading={signingIn} />;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <ClanPickerModal
        visible={showPicker}
        selected={clan}
        clans={clans}
        onSelect={handleClanSelect}
        onAddInvite={handleAddInvite}
        onClose={() => setShowPicker(false)}
      />

      {/* ── HERO ── */}
      <LinearGradient
        colors={[isActive ? '#130d07' : '#0c0f0c', C.bg]}
        style={[styles.hero, { paddingTop: Math.max(insets.top + 16, 40) }]}
      >
        {/* User badge top-right */}
        <Pressable onPress={signOut} style={styles.userBadge} hitSlop={8}>
          <MaterialCommunityIcons name="account-circle-outline" size={14} color={C.textDim} />
          <Text style={styles.userBadgeText}>{user?.username ?? ''}</Text>
          <MaterialCommunityIcons name="logout" size={12} color={C.textFaint} />
        </Pressable>

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
      {clan ? (
        <Pressable
          onPress={() => setShowPicker(true)}
          style={({ pressed }) => [styles.clanRow, pressed && { opacity: 0.75 }]}
        >
          <View style={[styles.clanSwatch, { backgroundColor: accent }]} />
          <View style={styles.clanMeta}>
            <Text style={styles.clanLabel}>YOUR CLAN</Text>
            <Text style={[styles.clanName, { color: accent }]}>{clan.name}</Text>
          </View>
          {clansLoading
            ? <ActivityIndicator size="small" color={C.textDim} />
            : <View style={styles.clanChangeBtn}>
                <Text style={styles.clanChangeText}>Change</Text>
                <MaterialCommunityIcons name="chevron-down" size={16} color={C.textDim} />
              </View>
          }
        </Pressable>
      ) : (
        <Pressable
          onPress={() => setShowPicker(true)}
          style={({ pressed }) => [styles.clanRow, pressed && { opacity: 0.75 }]}
        >
          <MaterialCommunityIcons name="shield-plus-outline" size={20} color={C.textDim} style={{ marginRight: 8 }} />
          <Text style={[styles.clanLabel, { flex: 1 }]}>Join a clan to get started</Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color={C.textFaint} />
        </Pressable>
      )}

      {/* ── STATUS BAR ── */}
      <View style={[styles.statusRow, isActive && { borderBottomColor: `${C.active}40` }]}>
        <MaterialCommunityIcons
          name={isActive ? 'shield-check' : isError ? 'shield-alert' : 'shield-outline'}
          size={15} color={modeColor} style={{ marginRight: 7 }}
        />
        <Text style={styles.statusText} numberOfLines={2}>{statusLine}</Text>
      </View>

      {/* ── BUTTON ── */}
      {clan && (
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
                {!isLoading && <MaterialCommunityIcons name="chevron-right" size={18} color="rgba(255,255,255,0.5)" />}
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
      )}

      {/* ── RECENT ALERTS ── */}
      <View style={styles.logHeader}>
        <Text style={styles.logTitle}>RECENT ALERTS</Text>
        {alerts.length > 0 && (
          <View style={[styles.logBadge, { backgroundColor: accent }]}>
            <Text style={styles.logBadgeText}>{alerts.length}</Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => clan && loadAlertHistory(clan.id)} hitSlop={8}>
          <MaterialCommunityIcons name="refresh" size={15} color={C.textFaint} />
        </Pressable>
      </View>

      <View style={styles.divider} />

      <FlatList
        data={alerts}
        keyExtractor={item => item.id}
        style={styles.list}
        contentContainerStyle={alerts.length === 0 && styles.emptyWrap}
        showsVerticalScrollIndicator={false}
        onRefresh={() => clan && loadAlertHistory(clan.id)}
        refreshing={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="shield-check-outline" size={40} color={C.textFaint} />
            <Text style={styles.emptyTitle}>No alerts yet</Text>
            <Text style={styles.emptyBody}>You'll see raids here when they happen</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 30).duration(300)}>
            <View style={styles.alertCard}>
              <View style={[styles.alertStripe, { backgroundColor: item.isLive ? accent : C.border }]} />
              <View style={styles.alertContent}>
                <View style={styles.alertTop}>
                  <Text style={styles.alertTitle}>{item.title}</Text>
                  <Text style={styles.alertTime}>{fmtRelative(item.time.toISOString())}</Text>
                </View>
                {!!item.body && <Text style={styles.alertMsg} numberOfLines={2}>{item.body}</Text>}
              </View>
              {item.isLive && (
                <View style={[styles.alertExclaim, { backgroundColor: `${accent}18` }]}>
                  <Text style={[styles.alertExclaimText, { color: accent }]}>!</Text>
                </View>
              )}
            </View>
          </Animated.View>
        )}
      />

      {/* ── FOOTER ── */}
      <View style={styles.footer}>
        <Image source={avivLogo} style={styles.footerLogo} resizeMode="contain" />
        <Text style={styles.footerText}>AVIV Clan+</Text>
      </View>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function shadeDown(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, ((n >> 16) & 0xff) - 60);
  const g = Math.max(0, ((n >> 8)  & 0xff) - 60);
  const b = Math.max(0, ( n        & 0xff) - 60);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  hero: { alignItems: 'center', overflow: 'hidden' },
  userBadge: {
    position: 'absolute', top: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
  },
  userBadgeText: { fontSize: 11, color: C.textDim, fontFamily: 'Inter_400Regular' },

  logoWrap: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 1.5, borderColor: C.borderBright,
    backgroundColor: C.surface,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0,
  },
  logoImg: { width: 62, height: 62 },

  appName: { fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: 8, fontFamily: 'Inter_700Bold' },
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

  clanRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.surface,
    borderBottomWidth: 1, borderBottomColor: C.border,
    gap: 12,
  },
  clanSwatch: { width: 4, height: 36, borderRadius: 2 },
  clanMeta: { flex: 1 },
  clanLabel: { fontSize: 9, color: C.textFaint, letterSpacing: 2, fontFamily: 'Inter_600SemiBold' },
  clanName:  { fontSize: 17, fontWeight: '700', fontFamily: 'Inter_700Bold', marginTop: 1 },
  clanChangeBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  clanChangeText: { fontSize: 12, color: C.textDim, fontFamily: 'Inter_400Regular' },

  statusRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: C.surface,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  statusText: { flex: 1, fontSize: 12, color: C.textDim, fontFamily: 'Inter_400Regular', letterSpacing: 0.3 },

  btnWrap: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  btn: { borderRadius: 6, overflow: 'hidden' },
  btnInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 15, paddingHorizontal: 20,
  },
  btnLabel: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '700', color: C.white, letterSpacing: 0.5, fontFamily: 'Inter_700Bold' },
  btnOutline: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14,
    borderWidth: 1, borderColor: C.border, borderRadius: 6,
  },
  btnLabelDim: { fontSize: 14, color: C.textDim, fontFamily: 'Inter_400Regular' },

  logHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, gap: 8,
  },
  logTitle: { fontSize: 10, color: C.textFaint, letterSpacing: 3, fontFamily: 'Inter_600SemiBold' },
  logBadge: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  logBadgeText: { fontSize: 11, color: C.white, fontWeight: '700' },

  divider: { height: 1, backgroundColor: C.border, marginHorizontal: 16 },
  list: { flex: 1 },
  emptyWrap: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 15, color: C.textDim, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  emptyBody:  { fontSize: 13, color: C.textFaint, textAlign: 'center', fontFamily: 'Inter_400Regular' },

  alertCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 8,
    backgroundColor: C.surface,
    borderRadius: 8, overflow: 'hidden',
    borderWidth: 1, borderColor: C.border,
  },
  alertStripe: { width: 3, alignSelf: 'stretch' },
  alertContent: { flex: 1, paddingHorizontal: 12, paddingVertical: 10 },
  alertTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  alertTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: C.text, fontFamily: 'Inter_700Bold' },
  alertTime:  { fontSize: 11, color: C.textFaint, fontFamily: 'Inter_400Regular' },
  alertMsg:   { fontSize: 12, color: C.textDim, marginTop: 3, fontFamily: 'Inter_400Regular' },
  alertExclaim: {
    width: 36, alignSelf: 'stretch',
    alignItems: 'center', justifyContent: 'center',
  },
  alertExclaimText: { fontSize: 18, fontWeight: '900' },

  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, gap: 8,
  },
  footerLogo: { width: 16, height: 16, opacity: 0.4 },
  footerText: { fontSize: 11, color: C.textFaint, fontFamily: 'Inter_400Regular' },
});

const picker = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: C.overlay },
  sheet: {
    backgroundColor: C.sheet,
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    maxHeight: '80%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: C.borderBright,
    alignSelf: 'center', marginTop: 10, marginBottom: 4,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  headerTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: C.text, fontFamily: 'Inter_700Bold' },
  closeBtn: { padding: 4 },
  divider: { height: 1, backgroundColor: C.border, marginHorizontal: 16 },
  list: { paddingHorizontal: 16, paddingTop: 8 },

  clanRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, gap: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
    borderRadius: 6,
  },
  swatch:   { width: 4, height: 36, borderRadius: 2 },
  clanInfo: { flex: 1 },
  clanName: { fontSize: 15, fontWeight: '700', color: C.text, fontFamily: 'Inter_700Bold' },
  clanMeta: { fontSize: 11, color: C.textDim, marginTop: 2, fontFamily: 'Inter_400Regular' },

  addRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 16, gap: 10,
  },
  addLabel: { fontSize: 14, color: C.textDim, fontFamily: 'Inter_400Regular' },

  addForm: { paddingVertical: 12, gap: 10 },
  addFormTitle: { fontSize: 14, fontWeight: '700', color: C.text, fontFamily: 'Inter_700Bold' },
  addFormHint:  { fontSize: 12, color: C.textDim, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  addInput: {
    borderWidth: 1, borderColor: C.borderBright, borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 10,
    color: C.text, fontSize: 13, backgroundColor: C.surface, fontFamily: 'Inter_400Regular',
  },
  addError: { fontSize: 12, color: '#e74c3c' },

  previewBox: {
    backgroundColor: C.surface, borderRadius: 6, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  previewName: { fontSize: 14, fontWeight: '700', color: C.text },
  previewMeta: { fontSize: 12, color: C.textDim, marginTop: 2 },

  addActions: { flexDirection: 'row', gap: 10, paddingBottom: 8 },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 6,
    borderWidth: 1, borderColor: C.border, alignItems: 'center',
  },
  cancelText: { fontSize: 14, color: C.textDim, fontFamily: 'Inter_400Regular' },
  connectBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 6,
    backgroundColor: C.active, alignItems: 'center', justifyContent: 'center',
  },
  connectText: { fontSize: 14, fontWeight: '700', color: C.white, fontFamily: 'Inter_700Bold' },
});

const signIn = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  logo:        { width: 80, height: 80, marginBottom: 16 },
  appName:     { fontSize: 32, fontWeight: '800', color: C.text, letterSpacing: 10, fontFamily: 'Inter_700Bold' },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 32 },
  dash:        { height: 1, width: 20, backgroundColor: C.borderBright },
  subtitle:    { fontSize: 11, color: C.textDim, letterSpacing: 4, fontFamily: 'Inter_400Regular' },
  desc: {
    fontSize: 14, color: C.textDim, textAlign: 'center', lineHeight: 22,
    fontFamily: 'Inter_400Regular', marginBottom: 28,
  },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.discord, borderRadius: 8,
    paddingVertical: 14, paddingHorizontal: 28,
    minWidth: 220, justifyContent: 'center',
  },
  btnText: { fontSize: 15, fontWeight: '700', color: C.white, fontFamily: 'Inter_700Bold' },
  hint: {
    marginTop: 20, fontSize: 12, color: C.textFaint,
    textAlign: 'center', fontFamily: 'Inter_400Regular', lineHeight: 18,
  },
});
