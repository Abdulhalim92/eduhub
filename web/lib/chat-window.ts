import { CONVS } from "./data";

export function resolveConvId(instId?: number): number {
  if (instId != null) {
    const conv = CONVS.find((c) => c.instId === instId);
    if (conv) return conv.id;
  }
  return CONVS[0]?.id ?? 1;
}

export function chatHref(instId?: number): string {
  return `/messages?conv=${resolveConvId(instId)}`;
}
