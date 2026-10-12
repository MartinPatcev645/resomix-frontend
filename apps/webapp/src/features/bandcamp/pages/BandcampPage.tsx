import { useCallback, useEffect, useRef, useState } from "react";
import { PAGE_BTN_PRIMARY } from "@resomix/ui";
import { BackButton } from "@/components/Navigation/BackButton.tsx";
import { BANDCAMP_COPY } from "../bandcampCopy.ts";
import { useBandcampConnection, type ConnectionPhase } from "../hooks/useBandcampConnection.ts";
import { useBandcampCollection } from "../hooks/useBandcampCollection.ts";
import type { SyncPollingOptions } from "../hooks/useSyncJobPolling.ts";
import { ConnectForm, type ConnectFormHandle } from "../components/ConnectForm.tsx";
import { SyncProgress } from "../components/SyncProgress.tsx";
import { CollectionView } from "../components/CollectionView.tsx";
import { CollectionSkeleton } from "../components/CollectionSkeleton.tsx";
import { DisconnectDialog } from "../components/DisconnectDialog.tsx";
import { ErrorBody, StateNotice } from "../components/StateNotice.tsx";
import { errorCopyFor } from "../lib/errorCopy.ts";

/**
 * `/library/bandcamp` — connect a public Bandcamp fan collection, watch it import, browse it.
 */
export default function BandcampPage({ pollingOptions }: { pollingOptions?: SyncPollingOptions } = {}) {
  const connection = useBandcampConnection(pollingOptions);
  const collection = useBandcampCollection({ enabled: connection.phase === "ready" });
  const [confirmOpen, setConfirmOpen] = useState(false);

  const connectFormRef = useRef<ConnectFormHandle>(null);
  const syncHeadingRef = useRef<HTMLHeadingElement>(null);
  const collectionHeadingRef = useRef<HTMLHeadingElement>(null);
  const disconnectButtonRef = useRef<HTMLButtonElement>(null);
  const previousPhase = useRef<ConnectionPhase>(connection.phase);

  // Move focus with the user's own transitions (connect → progress → collection → disconnected),
  // but not when the page first resolves what to show.
  useEffect(() => {
    const from = previousPhase.current;
    const to = connection.phase;
    previousPhase.current = to;
    if (from === to || from === "checking" || from === "check_failed") return;
    const frame = requestAnimationFrame(() => {
      if (document.activeElement?.closest('[role="dialog"]')) return;
      if (to === "syncing") syncHeadingRef.current?.focus();
      else if (to === "ready") collectionHeadingRef.current?.focus();
      else if (to === "disconnected") connectFormRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [connection.phase]);

  const { recheck } = connection;

  // A search left in the URL from an earlier connection must not filter the next one.
  const { clearBrowseState, query, page, matchedOnly } = collection;
  useEffect(() => {
    if (connection.phase === "disconnected" && (query || page > 1 || matchedOnly)) clearBrowseState();
  }, [connection.phase, query, page, matchedOnly, clearBrowseState]);

  const handleDisconnect = async () => {
    const ok = await connection.disconnect();
    if (ok) setConfirmOpen(false);
  };

  const closeDialog = () => {
    setConfirmOpen(false);
    connection.clearDisconnectError();
  };

  const handleNotConnected = useCallback(() => recheck(), [recheck]);

  return (
    <section className="px-[var(--px-12)] pt-[var(--px-16)] pb-[var(--px-40)] tracking-[var(--px-1)]">
      <div className="mx-auto w-full max-w-4xl text-[var(--rx-color-text-primary)]">
        <div className="mb-[var(--px-16)] flex">
          <BackButton label={BANDCAMP_COPY.links.library} to="/library" id="bandcamp-back-link" />
        </div>

        <header className="mb-[var(--px-24)]">
          <p className="mb-[var(--px-16)] flex items-center gap-[var(--px-10)] font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-2)] text-[var(--rx-color-text-muted)] before:block before:w-[var(--px-32)] before:border-t before:border-[var(--rx-color-accent)] before:content-['']">
            {BANDCAMP_COPY.kicker}
          </p>
          <h1 className="m-0 font-helvetica text-[length:var(--px-28)] font-medium uppercase leading-[var(--px-32)] md:text-[length:var(--px-36)] md:leading-[var(--px-40)]">
            {BANDCAMP_COPY.title}
          </h1>
          <p className="mt-[var(--px-12)] font-helvetica text-[length:var(--px-15)] font-light leading-[var(--px-22)] text-[var(--rx-color-text-secondary)] opacity-80">
            {BANDCAMP_COPY.intro}
          </p>
        </header>

        {connection.phase === "checking" ? (
          <div aria-busy="true" aria-label="Loading your Bandcamp connection">
            <CollectionSkeleton count={3} />
          </div>
        ) : connection.phase === "check_failed" && connection.checkError ? (
          <StateNotice
            tone="error"
            urgent
            title={errorCopyFor(connection.checkError.kind).title}
            body={<ErrorBody kind={connection.checkError.kind} />}
          >
            <button type="button" className={PAGE_BTN_PRIMARY} onClick={connection.recheck}>
              {BANDCAMP_COPY.sync.retry}
            </button>
          </StateNotice>
        ) : connection.phase === "disconnected" ? (
          <ConnectForm
            ref={connectFormRef}
            onConnect={connection.connect}
            submitting={connection.submitting}
            apiError={connection.connectError}
            initialValue={connection.username ?? ""}
          />
        ) : connection.phase === "syncing" ? (
          <SyncProgress
            ref={syncHeadingRef}
            sync={connection.sync}
            username={connection.username}
            onRetry={() => void connection.retrySync()}
            retrying={connection.submitting}
            retryError={connection.connectError}
          />
        ) : (
          <CollectionView
            collection={collection}
            username={connection.username}
            matchedCount={connection.matchedCount}
            importError={connection.importError}
            syncError={connection.connectError}
            syncing={connection.submitting}
            onSync={() => void connection.retrySync()}
            onDisconnectClick={() => setConfirmOpen(true)}
            onNotConnected={handleNotConnected}
            disconnectButtonRef={disconnectButtonRef}
            headingRef={collectionHeadingRef}
          />
        )}
      </div>

      <DisconnectDialog
        isOpen={confirmOpen}
        busy={connection.disconnecting}
        failed={connection.disconnectError !== null}
        onClose={closeDialog}
        onConfirm={() => void handleDisconnect()}
      />
    </section>
  );
}
