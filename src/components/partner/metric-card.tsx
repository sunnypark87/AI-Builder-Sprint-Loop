import { Card } from '@/components/ui/card';
export function MetricCard({
  label,
  value,
  help,
}: {
  label: string;
  value: string;
  help: string;
}) {
  return (
    <Card className="p-5">
      <p className="text-sm text-copy-muted">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
      <p className="mt-2 text-xs text-copy-muted">{help}</p>
    </Card>
  );
}
