/**
 * 좌측 사이드바 컴포넌트.
 *
 * 고정 너비(224px)의 테이블 목록 패널을 표시한다.
 * 현재는 테이블이 없는 빈 상태를 보여주며, 추후 테이블 목록 기능이 추가될 예정이다.
 */
export default function Sidebar() {
  return (
    <aside className="w-56 bg-gray-50 border-r border-gray-200 p-4 shrink-0">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Tables
      </h2>
      <p className="text-xs text-gray-400">No tables yet</p>
    </aside>
  );
}
