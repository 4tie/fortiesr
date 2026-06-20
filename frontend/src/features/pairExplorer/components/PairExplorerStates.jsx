export function EmptyState({ hasHistory }) {
  return (
    <div className="flex-1 flex items-center justify-center text-base-content/25 text-sm flex-col gap-2">
      <span className="text-3xl">Pair Explorer</span>
      <span>Configure pairs on the left and click Run Exploration</span>
      {hasHistory && (
        <span className="text-[11px] text-base-content/20">or open Past Runs to reload a previous result</span>
      )}
    </div>
  );
}

export function StartingState() {
  return (
    <div className="flex-1 flex items-center justify-center text-base-content/40 text-sm gap-3">
      <span className="loading loading-spinner loading-sm" />
      <span>Starting exploration...</span>
    </div>
  );
}

export function WaitingForResultsState({ session }) {
  return (
    <div className="flex-1 flex items-center justify-center text-base-content/40 text-sm flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="loading loading-spinner loading-sm" />
        <span>Waiting for the first pair group result...</span>
      </div>
      {session?.status && (
        <span className="text-[11px] text-base-content/25 font-mono">
          Session {session.status}; polling is active.
        </span>
      )}
    </div>
  );
}
