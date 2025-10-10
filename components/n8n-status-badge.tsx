"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

export function N8nStatusBadge() {
  const [status, setStatus] = useState<
    "checking" | "connected" | "disconnected"
  >("checking");

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch("/api/n8n/health");
        if (response.ok) {
          setStatus("connected");
        } else {
          setStatus("disconnected");
        }
      } catch (_error) {
        setStatus("disconnected");
      }
    };

    // Initial check
    checkHealth();

    // Poll every 30 seconds
    const interval = setInterval(checkHealth, 30000);

    return () => clearInterval(interval);
  }, []);

  const getVariant = () => {
    switch (status) {
      case "checking":
        return "secondary";
      case "connected":
        return "default";
      case "disconnected":
        return "destructive";
    }
  };

  const getText = () => {
    switch (status) {
      case "checking":
        return "Checking...";
      case "connected":
        return "n8n Connected";
      case "disconnected":
        return "n8n Offline";
    }
  };

  return <Badge variant={getVariant()}>{getText()}</Badge>;
}
