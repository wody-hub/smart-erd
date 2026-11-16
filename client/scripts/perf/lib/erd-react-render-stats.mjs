/**
 * React DevTools hook 기반 커밋/컴포넌트 렌더 카운터를 페이지에 설치한다 (`page.addInitScript`용).
 * `window.__RS.on === true`인 동안만 fiber를 순회한다. dev 빌드에서만 컴포넌트 이름이 보인다.
 *
 * @returns {void}
 */
export function installReactRenderStats() {
  // React DevTools hook: 커밋 단위 렌더 카운터 (RS.on === true 일 때만 fiber를 순회한다)
  const RS = (window.__RS = { on: false, commits: 0, renders: {}, mounts: {}, total: 0 });
  const componentName = (type) => {
    if (!type) return null;
    if (typeof type === 'function') return type.displayName || type.name || null;
    if (type.render) return type.render.displayName || type.render.name || type.displayName || null;
    if (type.type) return componentName(type.type);
    return type.displayName || null;
  };
  const COMPONENT_TAGS = new Set([0, 1, 11, 15]); // Function, Class, ForwardRef, SimpleMemo
  const walk = (start) => {
    const stack = [start];
    while (stack.length) {
      let fiber = stack.pop();
      while (fiber) {
        const alt = fiber.alternate;
        if (COMPONENT_TAGS.has(fiber.tag)) {
          const name = componentName(fiber.type) || 'Anonymous';
          if (!alt) {
            RS.mounts[name] = (RS.mounts[name] ?? 0) + 1;
          } else if (fiber.flags & 1) {
            RS.renders[name] = (RS.renders[name] ?? 0) + 1;
            RS.total += 1;
          }
        }
        if (fiber.child && (!alt || fiber.child !== alt.child)) stack.push(fiber.child);
        fiber = fiber.sibling;
      }
    }
  };
  RS.reset = () => {
    RS.commits = 0;
    RS.renders = {};
    RS.mounts = {};
    RS.total = 0;
  };
  const hook = {
    supportsFiber: true,
    isDisabled: false,
    renderers: new Map(),
    inject(renderer) {
      const id = hook.renderers.size + 1;
      hook.renderers.set(id, renderer);
      return id;
    },
    onScheduleFiberRoot() {},
    onCommitFiberRoot(_id, root) {
      if (!RS.on) return;
      RS.commits += 1;
      try {
        walk(root.current);
      } catch {
        // 계측 실패는 무시 (렌더 카운트만 비게 된다)
      }
    },
    onPostCommitFiberRoot() {},
    onCommitFiberUnmount() {},
    checkDCE() {},
  };
  if (!window.__REACT_DEVTOOLS_GLOBAL_HOOK__) window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = hook;
}
