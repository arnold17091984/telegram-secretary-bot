import DashboardLayout from "@/components/DashboardLayout";
import TriggerSettings from "@/components/TriggerSettings";

export default function Triggers() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">トリガー管理</h2>
          <p className="text-muted-foreground">
            BOTのトリガーキーワードと動作フローを管理します。
          </p>
        </div>

        <TriggerSettings />
      </div>
    </DashboardLayout>
  );
}
