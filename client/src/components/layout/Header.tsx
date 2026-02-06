/**
 * 애플리케이션 상단 헤더 컴포넌트.
 *
 * 고정 높이(48px)의 다크 배경 바에 애플리케이션 타이틀("Smart ERD")을 표시한다.
 */
export default function Header() {
  return (
    <header className="h-12 bg-gray-900 text-white flex items-center px-4 shrink-0">
      <h1 className="text-lg font-bold">Smart ERD</h1>
    </header>
  );
}
