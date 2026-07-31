import { cn } from '@/lib/cn';

const steps = ['AI 상담', '조건 확인', '약정서 검토', '서명'];

export function FlowProgress({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <nav aria-label="기부 약정 진행 단계" className="max-w-xl">
      <div className="flex items-center justify-between text-sm">
        <span className="font-bold">기부 약정</span>
        <span className="text-copy-muted">{current}/4 단계</span>
      </div>
      <ol className="mt-3 grid grid-cols-4 gap-1.5">
        {steps.map((step, index) => {
          const number = index + 1;
          const active = number === current;
          const complete = number < current;
          return (
            <li aria-current={active ? 'step' : undefined} key={step}>
              <span
                className={cn(
                  'block h-1 bg-line',
                  (active || complete) && 'bg-accent',
                )}
              />
              <span
                className={cn(
                  'mt-2 hidden text-xs text-copy-disabled sm:block',
                  active && 'font-bold text-copy',
                  complete && 'text-copy-muted',
                )}
              >
                {step}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
