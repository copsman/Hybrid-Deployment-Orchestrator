"use client";

import {
  Activity,
  ArrowRightToLine,
  Cloud,
  Cpu,
  Database,
  GitBranch,
  Globe,
  KeyRound,
  Lock,
  Package,
  RefreshCw,
  Route,
  Server,
  Shield,
  ShieldBan,
  type LucideIcon,
} from "lucide-react";

const STACK_ICONS: Record<string, LucideIcon> = {
  cloud: Cloud,
  route: Route,
  cpu: Cpu,
  database: Database,
  "key-round": KeyRound,
  package: Package,
  lock: Lock,
  activity: Activity,
  "git-branch": GitBranch,
  globe: Globe,
  server: Server,
  shield: Shield,
  "shield-ban": ShieldBan,
  "refresh-cw": RefreshCw,
  "arrow-right-to-line": ArrowRightToLine,
};

export function StackIcon({ name, className }: { name: string; className?: string }) {
  const Icon = STACK_ICONS[name] ?? Package;
  return <Icon className={className} aria-hidden />;
}

export const ENV_ICON: Record<"cloud" | "onprem" | "airgapped", LucideIcon> = {
  cloud: Cloud,
  onprem: Server,
  airgapped: ShieldBan,
};
