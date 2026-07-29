export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 text-center text-white">
      <div className="max-w-2xl space-y-6">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
          AI Builder Sprint 2026
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          함께 만드는 AI 서비스
        </h1>
        <p className="text-lg leading-8 text-zinc-300">
          프로젝트 초기 화면입니다. 기능을 Issue 단위로 설계하고, 검증 가능한
          작은 단위로 구현합니다.
        </p>
        <a
          className="inline-flex rounded-full bg-cyan-300 px-6 py-3 font-semibold text-zinc-950 transition hover:bg-cyan-200"
          href="/api/health"
        >
          상태 확인 API 보기
        </a>
      </div>
    </main>
  );
}
