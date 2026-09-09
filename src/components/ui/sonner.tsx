"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast: "!bg-card !text-foreground !border-border !font-sans !shadow-[0_0_24px_rgba(34,211,238,0.12)]",
          description: "!text-muted-foreground",
          actionButton: "!bg-primary !text-primary-foreground",
          error: "!border-mjc-red/60",
          success: "!border-mjc-green/60",
        },
      }}
      {...props}
    />
  );
}
