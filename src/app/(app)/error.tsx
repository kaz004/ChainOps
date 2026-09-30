"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/feedback/states";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-side surfacing happens in services; here we only track client ref.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <ErrorState
        title="Something went wrong"
        message="The section could not be rendered. The monitoring service may be temporarily unavailable. No stack trace is shown for security reasons."
        onRetry={reset}
      />
    </div>
  );
}
