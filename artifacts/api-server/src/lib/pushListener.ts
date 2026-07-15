/**
 * Push-listener stub for the api-server.
 *
 * The actual @eneris/push-receiver implementation lives in the standalone
 * raid-alert-bot service. The api-server's raidListenerManager dynamically
 * imports this module and wraps the call in a try/catch — if it throws, it
 * logs a warning and continues without a live push listener for that clan.
 *
 * To enable in-process push listening from the api-server (multi-tenant mode),
 * add @eneris/push-receiver as a dependency here and implement the function.
 */

export interface StartPushListenerOptions {
  clanId: number;
  raidKey: string;
  kaosApiKey: string;
  onAlert: (title: string, body: string, serverId: string | null) => Promise<void>;
}

export interface ListenerHandle {
  stop: () => void;
}

export async function startPushListener(
  _opts: StartPushListenerOptions,
): Promise<ListenerHandle> {
  throw new Error(
    "push-receiver is not installed in the api-server package — " +
    "run the standalone raid-alert-bot service instead, or add " +
    "@eneris/push-receiver as a dependency here.",
  );
}
