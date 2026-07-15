import { useCallback, useEffect, useRef, useState } from 'react';
import { useGetVapidKey, usePushSubscribe, usePushUnsubscribe } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';

function urlB64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

let swRegistrationPromise: Promise<ServiceWorkerRegistration> | null = null;

function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!swRegistrationPromise) {
    swRegistrationPromise = navigator.serviceWorker.register('/sw.js');
  }
  return swRegistrationPromise;
}

/**
 * Wires up raid-alert push notifications + the alarm siren for a clan.
 * - Registers the service worker and manages the push subscription for this clan.
 * - Plays the siren and shows a toast when a RAID_ALERT message is relayed
 *   from the service worker (works whether the alert arrived as a real push
 *   or was triggered while this tab is already open).
 */
export function useRaidSiren(clanId: number) {
  const supported =
    typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

  const [permission, setPermission] = useState<NotificationPermission>(
    supported ? Notification.permission : 'denied',
  );
  const [subscribed, setSubscribed] = useState(false);
  const [checking, setChecking] = useState(supported);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  const { data: vapid } = useGetVapidKey(clanId, { query: { enabled: supported } });
  const subscribeMutation = usePushSubscribe();
  const unsubscribeMutation = usePushUnsubscribe();

  // Shared siren <audio> element, created once.
  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio('/siren.mp3');
      audio.preload = 'auto';
      audioRef.current = audio;
    }
  }, []);

  const playSiren = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {
      // Autoplay was blocked (no prior user gesture) — the system
      // notification from the service worker still fires regardless.
    });
  }, []);

  // Register the service worker and relay RAID_ALERT messages into the siren.
  useEffect(() => {
    if (!supported) {
      setChecking(false);
      return;
    }

    let cancelled = false;

    registerServiceWorker()
      .then(async (registration) => {
        const existing = await registration.pushManager.getSubscription();
        if (!cancelled) {
          setSubscribed(!!existing);
          setChecking(false);
        }
      })
      .catch(() => {
        if (!cancelled) setChecking(false);
      });

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'RAID_ALERT') {
        playSiren();
        toast({
          title: `🚨 ${event.data.title || 'Raid Alert!'}`,
          description: event.data.body || undefined,
        });
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('message', onMessage);
    };
  }, [supported, playSiren, toast]);

  // If the app was closed when the push arrived and the user tapped the
  // notification, the SW navigates here with ?siren=1. Detect it, play the
  // siren, and clean the URL so a refresh doesn't replay it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('siren') !== '1') return;
    params.delete('siren');
    const cleaned = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (cleaned ? `?${cleaned}` : ''));
    // Small delay so the audio element is guaranteed to be initialised.
    const t = setTimeout(() => playSiren(), 300);
    return () => clearTimeout(t);
  }, [playSiren]);

  const enable = useCallback(async () => {
    if (!supported || !vapid?.publicKey) return;

    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== 'granted') return;

    const registration = await registerServiceWorker();
    let sub = await registration.pushManager.getSubscription();
    if (!sub) {
      sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(vapid.publicKey) as unknown as BufferSource,
      });
    }
    const json = sub.toJSON();
    await subscribeMutation.mutateAsync({
      clanId,
      data: { endpoint: sub.endpoint, p256dh: json.keys!.p256dh, auth: json.keys!.auth },
    });
    // Unlock autoplay for the siren with this user gesture.
    audioRef.current?.play().then(() => audioRef.current?.pause()).catch(() => {});
    setSubscribed(true);
  }, [supported, vapid, clanId, subscribeMutation]);

  const disable = useCallback(async () => {
    const registration = await registerServiceWorker();
    const sub = await registration.pushManager.getSubscription();
    if (sub) {
      await unsubscribeMutation.mutateAsync({ clanId, data: { endpoint: sub.endpoint } });
      await sub.unsubscribe();
    }
    setSubscribed(false);
  }, [clanId, unsubscribeMutation]);

  return {
    supported,
    checking,
    permission,
    subscribed,
    enabling: subscribeMutation.isPending,
    disabling: unsubscribeMutation.isPending,
    enable,
    disable,
  };
}
