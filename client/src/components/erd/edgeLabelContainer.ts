/** 연결된 edge-label 컨테이너를 재사용하고, 없거나 분리되었으면 DOM에서 다시 찾는다. */
export function resolveEdgeLabelContainer(
  domNode: (ParentNode & { contains?: (node: Node) => boolean }) | null,
  current: HTMLElement | null,
): HTMLElement | null {
  if (!domNode) return null;
  if (
    current?.isConnected &&
    (typeof domNode.contains !== 'function' || domNode.contains(current))
  ) {
    return current;
  }
  return domNode.querySelector<HTMLElement>('.react-flow__edgelabel-renderer') ?? null;
}
