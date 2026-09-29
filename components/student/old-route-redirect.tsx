"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface OldRouteRedirectProps {
  tab: string;
}

export function OldRouteRedirect({ tab }: OldRouteRedirectProps) {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/panel#${tab}`);
  }, [router, tab]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <p className="text-sm font-medium text-gray-500">
        Panele yönlendiriliyorsunuz...
      </p>
    </main>
  );
}
