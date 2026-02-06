import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import ERDCanvas from '../components/erd/ERDCanvas';

/**
 * 다이어그램 페이지 컴포넌트.
 *
 * 메인 레이아웃으로 상단 {@link Header}, 좌측 {@link Sidebar},
 * 중앙 {@link ERDCanvas}를 조합하여 ERD 편집 화면을 구성한다.
 */
export default function DiagramPage() {
  return (
    <div className="h-screen flex flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1">
          <ERDCanvas />
        </main>
      </div>
    </div>
  );
}
