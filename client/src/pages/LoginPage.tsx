/**
 * 로그인 페이지 컴포넌트.
 *
 * 로그인 ID와 비밀번호 입력 폼을 중앙에 배치한 인증 화면이다.
 * 현재는 UI 껍데기이며, 추후 실제 인증 API 연동이 추가될 예정이다.
 */
export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h2 className="text-2xl font-bold mb-6 text-center">Smart ERD</h2>
        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Login ID</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              placeholder="Enter your login ID"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              placeholder="Enter your password"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700 transition"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}
