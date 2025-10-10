import { N8nStatusBadge } from "@/components/n8n-status-badge";

export default function TestPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col gap-4 items-center">
        <h1 className="text-2xl font-bold">n8n Status Badge Test</h1>
        <N8nStatusBadge />
      </div>
    </div>
  );
}
