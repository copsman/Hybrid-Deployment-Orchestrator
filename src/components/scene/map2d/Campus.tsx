"use client";

import { useMemo } from "react";
import type { EnvId } from "@/engine";
import { useOrchestrator } from "@/store/orchestrator";
import { CLASS_HEX, ENV_ACCENT, MJC, NET_LABEL } from "@/lib/palette";
import { parseVersionKey, selQueueKey, selRunning, selSpec, selVersionKey } from "../selectors";
import { GATE_DX, GATE_Y, HEADLINE_Y, LAYER_ABBR, MAST_DX, PAD, POD, SERVING_INDEX, TILE, ZONE_X, parseQueueKey, tileCentre, tileOrigin } from "./geometry";
import { T, useStill } from "./primitives";

const MAX_TOKENS = 5;
const MAX_PODS = 8;

/**
 * One generic campus per perimeter: the same ten-layer stack in the same 5 × 2 grid,
 * real GPU LEDs (or elastic pods), a front gate with queue tokens, a version plaque and
 * a headline, all read from the environment spec and runtime. Only the enclosure and
 * the accent colour differ by `spec.kind`.
 */
export function Campus({ id, focused, onSelect }: { id: EnvId; focused: boolean; onSelect: () => void }) {
  const spec = useOrchestrator(selSpec[id]);
  const running = useOrchestrator(selRunning[id]);
  const queueKey = useOrchestrator(selQueueKey[id]);
  const versionKey = useOrchestrator(selVersionKey[id]);
  const still = useStill();
  const queue = useMemo(() => parseQueueKey(queueKey), [queueKey]);
  const versions = useMemo(() => parseVersionKey(versionKey), [versionKey]);

  const zx = ZONE_X[id];
  const accent = ENV_ACCENT[id];
  const busy = running > 0;
  const loaded = versions.filter((v) => v.presence === "loaded").map((v) => v.version);
  const pending = versions.filter((v) => v.presence === "present" || v.presence === "inflight").map((v) => v.version);
  const rejected = versions.filter((v) => v.presence === "rejected").map((v) => v.version);
  const status = busy ? `BUSY ${running}` : queue.length ? `QUEUE ${queue.length}` : "ONLINE";
  const capacity = spec.slots === null ? "ELASTIC" : `${spec.slots} GPU`;
  const cx = zx + PAD.dx + PAD.w / 2;
  const [gx, gy] = [zx + GATE_DX, GATE_Y];

  return (
    <g onClick={onSelect} className="cursor-pointer">
      {/* headline */}
      <T x={cx} y={HEADLINE_Y.codename} size={11} ls={3} anchor="middle" fill={focused ? accent : MJC.fg}>
        {spec.codename}
      </T>
      <T x={cx} y={HEADLINE_Y.name} size={8.5} ls={0} anchor="middle" sans fill={MJC.fg} opacity={0.85}>
        {spec.name}
      </T>
      <T x={cx} y={HEADLINE_Y.stats} size={7} ls={1} anchor="middle" fill={busy ? accent : MJC.mutedFg}>
        {`${capacity} · ${NET_LABEL[spec.network]} · ${status}`}
      </T>

      {/* posture prop */}
      {spec.kind === "cloud" && <Mast x={zx + MAST_DX} base={PAD.y} accent={accent} still={still} />}
      {spec.kind === "airgapped" && <Mast x={zx + MAST_DX} base={PAD.y} accent={accent} still={still} crossed />}

      {/* enclosure + pad */}
      <Enclosure kind={spec.kind} zx={zx} accent={accent} />
      {focused && <ellipse cx={cx} cy={PAD.y + PAD.h / 2} rx={PAD.w / 2 + 30} ry={PAD.h / 2 + 30} fill={`url(#glow-${id})`} />}
      <rect x={zx + PAD.dx} y={PAD.y} width={PAD.w} height={PAD.h} rx={3} fill={MJC.card} stroke={accent} strokeOpacity={focused ? 0.9 : 0.55} strokeWidth={1.5} />
      {spec.kind === "airgapped" && <rect x={zx + PAD.dx} y={PAD.y} width={PAD.w} height={PAD.h} rx={3} fill="url(#hatch)" />}

      {/* module grid */}
      {spec.stack.map((layer, i) => {
        const [tx, ty] = tileOrigin(zx, i);
        const serving = i === SERVING_INDEX;
        return (
          <g key={layer.layer}>
            <rect x={tx} y={ty} width={TILE.w} height={TILE.h} rx={2} fill={MJC.secondary} stroke={accent} strokeOpacity={serving ? 0.8 : 0.45} />
            {serving && <rect x={tx} y={ty} width={TILE.w} height={TILE.h} rx={2} fill={accent} fillOpacity={0.18} />}
            <T x={tx + TILE.w / 2} y={ty + (serving ? 9 : 14)} size={6} ls={0.5} anchor="middle" fill={serving ? accent : MJC.fg} opacity={serving ? 1 : 0.8}>
              {LAYER_ABBR[layer.layer] ?? layer.layer.toUpperCase()}
            </T>
            {serving && spec.slots !== null && (
              <g>
                {Array.from({ length: spec.slots }).map((_, k) => {
                  const lit = k < running;
                  return (
                    <circle key={k} cx={tx + 7 + k * 7.5} cy={ty + 16.5} r={2} fill={lit ? MJC.green : MJC.border} stroke={lit ? MJC.green : MJC.mutedFg} strokeOpacity={lit ? 0.9 : 0.5} strokeWidth={0.6}>
                      {lit && !still && <animate attributeName="opacity" values="1;0.35;1" dur="0.8s" repeatCount="indefinite" />}
                    </circle>
                  );
                })}
              </g>
            )}
            {serving && spec.slots === null && (
              <T x={tx + TILE.w / 2} y={ty + 18.5} size={5} ls={1} anchor="middle" fill={accent} opacity={0.9}>
                ELASTIC
              </T>
            )}
          </g>
        );
      })}

      {/* busy ring around the serving tile: turns only while something runs */}
      {busy && (
        <circle cx={tileCentre(zx, SERVING_INDEX)[0]} cy={tileCentre(zx, SERVING_INDEX)[1]} r={19} fill="none" stroke={accent} strokeOpacity={0.7} strokeDasharray="3 4">
          {!still && <animateTransform attributeName="transform" type="rotate" from={`0 ${tileCentre(zx, SERVING_INDEX)[0]} ${tileCentre(zx, SERVING_INDEX)[1]}`} to={`360 ${tileCentre(zx, SERVING_INDEX)[0]} ${tileCentre(zx, SERVING_INDEX)[1]}`} dur="3s" repeatCount="indefinite" />}
        </circle>
      )}

      {/* elastic pods on the apron (cloud only): one per running job */}
      {spec.slots === null &&
        Array.from({ length: Math.min(running, MAX_PODS) }).map((_, k) => <rect key={k} x={zx + PAD.dx + PAD.w + 6} y={PAD.y + 4 + k * POD.pitch} width={8} height={POD.h} rx={1} fill={accent} fillOpacity={0.85} />)}

      {/* plaque */}
      <rect x={zx + PAD.dx} y={gy - 4} width={94} height={14} rx={2} fill={MJC.card} stroke={accent} strokeOpacity={0.5} />
      <T x={zx + PAD.dx + 47} y={gy + 6} size={7} ls={0.5} anchor="middle" fill={loaded.length ? MJC.green : MJC.mutedFg}>
        {loaded.length ? `SCRIBE ${loaded.join(" · ")}` : "SCRIBE —"}
      </T>
      {pending.length > 0 && (
        <T x={zx + PAD.dx + 2} y={gy + 20} size={6.5} fill={MJC.amber}>
          {`${pending.join(" · ")} PENDING`}
        </T>
      )}
      {rejected.length > 0 && (
        <T x={zx + PAD.dx + 2} y={gy + 20 + (pending.length ? 9 : 0)} size={6.5} fill={MJC.red}>
          {`${rejected.join(" · ")} REJECTED`}
        </T>
      )}

      {/* front gate */}
      <path d={`M${gx - 9},${gy + 9} V${gy - 5} H${gx - 3} M${gx + 9},${gy + 9} V${gy - 5} H${gx + 3}`} fill="none" stroke={accent} strokeWidth={1.5} strokeOpacity={0.9} />

      {/* queue tokens */}
      {queue.slice(0, MAX_TOKENS).map((q, k) => (
        <circle key={q.jobId} cx={gx + 20 + k * 11} cy={gy + 2} r={4} fill={CLASS_HEX[q.classification]} fillOpacity={0.9} stroke={MJC.bg} strokeWidth={0.8} />
      ))}
      {queue.length > MAX_TOKENS && (
        <T x={gx + 20 + MAX_TOKENS * 11 - 3} y={gy + 5} size={7} fill={MJC.amber}>
          {`+${queue.length - MAX_TOKENS}`}
        </T>
      )}
      {queue.length > 0 && (
        <T x={gx + 16} y={gy + 20} size={6.5} fill={MJC.amber}>
          {`QUEUE ${queue.length}`}
        </T>
      )}
    </g>
  );
}

/** Kerb (cloud), dashed fence with posts (on-prem) or bunker outline with a door gap (enclave). */
function Enclosure({ kind, zx, accent }: { kind: EnvId; zx: number; accent: string }) {
  const x0 = zx + PAD.dx - 7;
  const y0 = PAD.y - 7;
  const w = PAD.w + 14;
  const h = PAD.h + 14;
  if (kind === "cloud") return <rect x={x0} y={y0} width={w} height={h} rx={5} fill="none" stroke={accent} strokeOpacity={0.3} />;
  if (kind === "onprem") {
    const xs = [x0, x0 + w / 4, x0 + w / 2, x0 + (3 * w) / 4, x0 + w];
    const posts: [number, number][] = [...xs.map((x): [number, number] => [x, y0]), ...xs.map((x): [number, number] => [x, y0 + h]), [x0, y0 + h / 2], [x0 + w, y0 + h / 2]];
    return (
      <g>
        <rect x={x0} y={y0} width={w} height={h} fill="none" stroke={accent} strokeOpacity={0.55} strokeDasharray="4 3" />
        {posts.map(([px, py], i) => (
          <rect key={i} x={px - 1.5} y={py - 1.5} width={3} height={3} fill={accent} fillOpacity={0.85} />
        ))}
      </g>
    );
  }
  const gx = zx + GATE_DX;
  const outline = `M${gx + 12},${y0 + h} H${x0 + w} V${y0} H${x0} V${y0 + h} H${gx - 12}`;
  return (
    <g>
      <path d={outline} fill="none" stroke={accent} strokeOpacity={0.75} strokeWidth={2.5} />
      {[
        [x0, y0],
        [x0 + w, y0],
        [x0, y0 + h],
        [x0 + w, y0 + h],
      ].map(([px, py], i) => (
        <rect key={i} x={px - 3} y={py - 3} width={6} height={6} fill={MJC.card} stroke={accent} strokeOpacity={0.8} />
      ))}
    </g>
  );
}

/** Uplink mast with a pulsing ring (cloud) or a crossed stub mast (enclave: no link). */
function Mast({ x, base, accent, still, crossed = false }: { x: number; base: number; accent: string; still: boolean; crossed?: boolean }) {
  const top = base - 26;
  return (
    <g>
      <line x1={x} y1={base} x2={x} y2={top} stroke={accent} strokeOpacity={0.7} />
      <circle cx={x} cy={top - 2} r={2.5} fill={accent} />
      {crossed ? (
        <g stroke={accent} strokeWidth={1.5} strokeOpacity={0.9}>
          <line x1={x - 6} y1={top - 8} x2={x + 6} y2={top + 4} />
          <line x1={x + 6} y1={top - 8} x2={x - 6} y2={top + 4} />
        </g>
      ) : (
        <circle cx={x} cy={top - 2} r={5} fill="none" stroke={accent} strokeOpacity={0.6}>
          {!still && (
            <>
              <animate attributeName="r" values="4;11" dur="2s" repeatCount="indefinite" />
              <animate attributeName="stroke-opacity" values="0.6;0" dur="2s" repeatCount="indefinite" />
            </>
          )}
        </circle>
      )}
    </g>
  );
}
