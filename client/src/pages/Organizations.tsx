import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Settings, Users, Bot, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function Organizations() {
  const [, setLocation] = useLocation();
  const [newOrgName, setNewOrgName] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { data: organizations, isLoading, refetch } = trpc.organizations.list.useQuery();
  const createOrg = trpc.organizations.create.useMutation({
    onSuccess: () => {
      toast.success("組織を作成しました");
      setIsCreateDialogOpen(false);
      setNewOrgName("");
      refetch();
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const switchOrg = trpc.organizations.switchCurrent.useMutation({
    onSuccess: () => {
      toast.success("組織を切り替えました");
      refetch();
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const handleCreateOrg = () => {
    if (!newOrgName.trim()) {
      toast.error("組織名を入力してください");
      return;
    }
    createOrg.mutate({ name: newOrgName });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">有効</Badge>;
      case "trial":
        return <Badge className="bg-blue-500">トライアル</Badge>;
      case "cancelled":
        return <Badge variant="destructive">キャンセル</Badge>;
      case "expired":
        return <Badge variant="secondary">期限切れ</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPlanBadge = (plan: string) => {
    switch (plan) {
      case "starter":
        return <Badge variant="outline">スターター</Badge>;
      case "pro":
        return <Badge className="bg-purple-500">プロ</Badge>;
      case "enterprise":
        return <Badge className="bg-amber-500">エンタープライズ</Badge>;
      default:
        return <Badge variant="secondary">無料</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">組織管理</h1>
            <p className="text-muted-foreground">
              組織（テナント）の作成と管理
            </p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                新規組織
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新規組織の作成</DialogTitle>
                <DialogDescription>
                  新しい組織を作成します。組織ごとにTelegram BOTを設定できます。
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">組織名</Label>
                  <Input
                    id="name"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    placeholder="例: 株式会社サンプル"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  キャンセル
                </Button>
                <Button onClick={handleCreateOrg} disabled={createOrg.isPending}>
                  {createOrg.isPending ? "作成中..." : "作成"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : organizations && organizations.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {organizations.map((org) => (
              <Card key={org.id} className="relative">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-lg">{org.name}</CardTitle>
                    </div>
                    {getStatusBadge(org.subscriptionStatus || "trial")}
                  </div>
                  <CardDescription className="flex items-center gap-2">
                    {getPlanBadge(org.subscriptionPlan || "free")}
                    <span className="text-xs text-muted-foreground">
                      /{org.slug}
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Bot className="h-4 w-4" />
                      {org.telegramBotUsername ? (
                        <span>@{org.telegramBotUsername}</span>
                      ) : (
                        <span className="text-amber-500">BOT未設定</span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => switchOrg.mutate({ organizationId: org.id })}
                      >
                        <Settings className="mr-1 h-3 w-3" />
                        選択
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLocation(`/organizations/${org.id}/settings`)}
                      >
                        <Settings className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLocation(`/organizations/${org.id}/billing`)}
                      >
                        <CreditCard className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">組織がありません</h3>
              <p className="text-muted-foreground text-center mb-4">
                新しい組織を作成して、Telegram BOTの設定を始めましょう。
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                最初の組織を作成
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
