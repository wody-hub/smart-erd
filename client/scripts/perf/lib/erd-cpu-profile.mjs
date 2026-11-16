/** CDP CPU 프로파일 요약 (erd-app-bench.mjs와 동일 로직) */

/**
 * CDP CPU 프로파일을 self-time 기준 상위 함수/파일로 요약한다.
 *
 * @param profile `Profiler.stop` 결과의 profile
 * @returns `{ totalMs, topFunctions, topFiles }`
 */
export function summarizeCpuProfile(profile) {
  const byId = new Map(profile.nodes.map((node) => [node.id, node]));
  const selfUs = new Map();
  profile.samples.forEach((nodeId, index) => {
    selfUs.set(nodeId, (selfUs.get(nodeId) ?? 0) + (profile.timeDeltas[index] ?? 0));
  });
  const shortUrl = (url) => {
    if (!url) return '(native)';
    try {
      const parsed = new URL(url);
      return decodeURIComponent(parsed.pathname).replace(
        /^\/node_modules\/\.vite\/deps\//,
        'deps/',
      );
    } catch {
      return url;
    }
  };
  const byFunction = new Map();
  const byFile = new Map();
  let totalUs = 0;
  for (const [nodeId, us] of selfUs) {
    const frame = byId.get(nodeId).callFrame;
    const file = shortUrl(frame.url);
    const fnKey = `${frame.functionName || '(anonymous)'} @ ${file}:${frame.lineNumber + 1}`;
    byFunction.set(fnKey, (byFunction.get(fnKey) ?? 0) + us);
    byFile.set(file, (byFile.get(file) ?? 0) + us);
    totalUs += us;
  }
  const top = (map, count) =>
    [...map.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, count)
      .map(([name, us]) => ({
        name,
        selfMs: Math.round(us / 100) / 10,
        pct: Math.round((us / totalUs) * 1000) / 10,
      }));
  // 자기 시간 상위 5개 함수의 직접 호출자(부모 프레임)를 집계한다 — 네이티브 함수(querySelector 등)의 출처 추적용.
  const parentOf = new Map();
  for (const node of profile.nodes)
    for (const childId of node.children ?? []) parentOf.set(childId, node.id);
  const topNames = new Set(top(byFunction, 5).map((entry) => entry.name));
  const callers = {};
  for (const [nodeId, us] of selfUs) {
    const frame = byId.get(nodeId).callFrame;
    const name = `${frame.functionName || '(anonymous)'} @ ${shortUrl(frame.url)}:${frame.lineNumber + 1}`;
    if (!topNames.has(name)) continue;
    const parent = byId.get(parentOf.get(nodeId));
    const parentFrame = parent?.callFrame;
    const parentName = parentFrame
      ? `${parentFrame.functionName || '(anonymous)'} @ ${shortUrl(parentFrame.url)}:${parentFrame.lineNumber + 1}`
      : '(root)';
    callers[name] ??= new Map();
    callers[name].set(parentName, (callers[name].get(parentName) ?? 0) + us);
  }
  const callerSummary = Object.fromEntries(
    Object.entries(callers).map(([name, map]) => [
      name,
      [...map.entries()]
        .sort((l, r) => r[1] - l[1])
        .slice(0, 6)
        .map(([caller, us]) => ({ caller, selfMs: Math.round(us / 100) / 10 })),
    ]),
  );
  return {
    totalMs: Math.round(totalUs / 100) / 10,
    topFunctions: top(byFunction, 25),
    topFiles: top(byFile, 15),
    callers: callerSummary,
  };
}
