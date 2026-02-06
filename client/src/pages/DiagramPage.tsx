import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import ERDCanvas from '../components/erd/ERDCanvas';

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
