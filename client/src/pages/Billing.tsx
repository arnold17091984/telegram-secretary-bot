import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, Bitcoin, Check, Loader2, Building2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

// Pricing plans
const PLANS = [
  {
    id: "starter",
    name: "スターター",
    price: "¥980",
    period: "/月",
    features: ["1つのTelegram BOT", "基本機能", "メールサポート"],
    priceId: "price_starter_monthly",
  },
  {
    id: "pro",
    name: "プロ",
    price: "¥2,980",
    period: "/月",
    features: ["3つのTelegram BOT", "全機能", "優先サポート", "API アクセス"],
    priceId: "price_pro_monthly",
    popular: true,
  },
  {
    id: "enterprise",
    name: "エンタープライズ",
    price: "¥9,800",
    period: "/月",
    features: ["無制限のBOT", "全機能", "専任サポート", "カスタム開発"],
    priceId: "price_enterprise_monthly",
  },
];

const CRYPTO_OPTIONS = [
  { symbol: "BTC", name: "Bitcoin", icon: "₿" },
  { symbol: "ETH", name: "Ethereum", icon: "Ξ" },
  { symbol: "USDT", name: "Tether", icon: "$" },
  { symbol: "USDC", name: "USD Coin", icon: "$" },
];

export default function Billing() {
  const [selectedCrypto, setSelectedCrypto] = useState<string | null>(null);

  // Get user's organizations
  const { data: organizations, isLoading: orgsLoading } = trpc.organizations.list.useQuery();
  
  // Use the first organization or null if none
  const organizationId = organizations?.[0]?.id ?? null;

  const { data: subscription, isLoading: subLoading } = trpc.stripe.getSubscription.useQuery(
    { organizationId: organizationId! },
    { enabled: !!organizationId }
  );

  const { data: payments, isLoading: paymentsLoading } = trpc.stripe.getPayments.useQuery(
    { organizationId: organizationId! },
    { enabled: !!organizationId }
  );

  const createCheckout = trpc.stripe.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        toast.info("決済ページに移動します...");
        window.open(data.url, "_blank");
      }
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const createPortal = trpc.stripe.createPortalSession.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, "_blank");
      }
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const createCryptoPayment = trpc.crypto.createPayment.useMutation({
    onSuccess: (data) => {
      toast.success("支払い情報を生成しました");
      console.log(data);
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const handleStripeCheckout = (priceId: string) => {
    if (!organizationId) {
      toast.error("組織を作成してください");
      return;
    }
    createCheckout.mutate({ organizationId, priceId });
  };

  const handleCryptoPayment = (crypto: string, amountJPY: number) => {
    if (!organizationId) {
      toast.error("組織を作成してください");
      return;
    }
    createCryptoPayment.mutate({
      organizationId,
      amountJPY,
      cryptoCurrency: crypto as "BTC" | "ETH" | "USDT" | "USDC",
    });
  };

  // Show loading state
  if (orgsLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  // Show prompt to create organization if user has none
  if (!organizationId) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">請求・プラン</h1>
            <p className="text-muted-foreground">
              サブスクリプションの管理と支払い
            </p>
          </div>

          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
              <Building2 className="h-16 w-16 text-muted-foreground" />
              <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold">組織を作成してください</h2>
                <p className="text-muted-foreground max-w-md">
                  請求・プラン機能を利用するには、まず組織を作成する必要があります。
                  組織を作成すると、Telegram BOTの設定やサブスクリプションの管理ができるようになります。
                </p>
              </div>
              <Link href="/organizations">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  組織を作成する
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">請求・プラン</h1>
          <p className="text-muted-foreground">
            サブスクリプションの管理と支払い
          </p>
        </div>

        {/* Current Subscription */}
        <Card>
          <CardHeader>
            <CardTitle>現在のプラン</CardTitle>
            <CardDescription>
              現在のサブスクリプション状況
            </CardDescription>
          </CardHeader>
          <CardContent>
            {subLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>読み込み中...</span>
              </div>
            ) : subscription ? (
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold">
                      {subscription.plan === "pro" ? "プロ" : 
                       subscription.plan === "enterprise" ? "エンタープライズ" : 
                       subscription.plan === "starter" ? "スターター" : "無料"}
                    </span>
                    <Badge variant={subscription.status === "active" ? "default" : "secondary"}>
                      {subscription.status === "active" ? "有効" : 
                       subscription.status === "trial" ? "トライアル" : subscription.status}
                    </Badge>
                  </div>
                  {subscription.expiresAt && (
                    <p className="text-sm text-muted-foreground">
                      有効期限: {new Date(subscription.expiresAt).toLocaleDateString("ja-JP")}
                    </p>
                  )}
                </div>
                {subscription.hasStripeCustomer && (
                  <Button
                    variant="outline"
                    onClick={() => createPortal.mutate({ organizationId })}
                    disabled={createPortal.isPending}
                  >
                    {createPortal.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="mr-2 h-4 w-4" />
                    )}
                    請求管理
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">プランが設定されていません</p>
            )}
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Tabs defaultValue="stripe" className="space-y-4">
          <TabsList>
            <TabsTrigger value="stripe">
              <CreditCard className="mr-2 h-4 w-4" />
              クレジットカード
            </TabsTrigger>
            <TabsTrigger value="crypto">
              <Bitcoin className="mr-2 h-4 w-4" />
              仮想通貨
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stripe" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              {PLANS.map((plan) => (
                <Card
                  key={plan.id}
                  className={`relative ${plan.popular ? "border-primary" : ""}`}
                >
                  {plan.popular && (
                    <Badge className="absolute -top-2 left-1/2 -translate-x-1/2">
                      人気
                    </Badge>
                  )}
                  <CardHeader>
                    <CardTitle>{plan.name}</CardTitle>
                    <CardDescription>
                      <span className="text-2xl font-bold">{plan.price}</span>
                      <span className="text-muted-foreground">{plan.period}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-2">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="w-full"
                      variant={plan.popular ? "default" : "outline"}
                      onClick={() => handleStripeCheckout(plan.priceId)}
                      disabled={createCheckout.isPending}
                    >
                      {createCheckout.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      選択する
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="crypto" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>仮想通貨で支払い</CardTitle>
                <CardDescription>
                  Bitcoin、Ethereum、USDT、USDCで支払いできます
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-4">
                  {CRYPTO_OPTIONS.map((crypto) => (
                    <Button
                      key={crypto.symbol}
                      variant={selectedCrypto === crypto.symbol ? "default" : "outline"}
                      className="h-20 flex-col"
                      onClick={() => setSelectedCrypto(crypto.symbol)}
                    >
                      <span className="text-2xl">{crypto.icon}</span>
                      <span>{crypto.name}</span>
                    </Button>
                  ))}
                </div>

                {selectedCrypto && (
                  <div className="space-y-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      プランを選択して支払いを開始してください
                    </p>
                    <div className="grid gap-2 md:grid-cols-3">
                      {PLANS.map((plan) => (
                        <Button
                          key={plan.id}
                          variant="outline"
                          onClick={() => handleCryptoPayment(
                            selectedCrypto,
                            parseInt(plan.price.replace(/[^0-9]/g, ""))
                          )}
                          disabled={createCryptoPayment.isPending}
                        >
                          {plan.name} - {plan.price}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Payment History */}
        <Card>
          <CardHeader>
            <CardTitle>支払い履歴</CardTitle>
            <CardDescription>
              過去の支払い記録
            </CardDescription>
          </CardHeader>
          <CardContent>
            {paymentsLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>読み込み中...</span>
              </div>
            ) : payments && payments.length > 0 ? (
              <div className="space-y-2">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">
                        {payment.description || "サブスクリプション"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(payment.createdAt).toLocaleDateString("ja-JP")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        ¥{payment.amount.toLocaleString()}
                      </p>
                      <Badge variant={
                        payment.paymentStatus === "completed" ? "default" :
                        payment.paymentStatus === "pending" ? "secondary" : "destructive"
                      }>
                        {payment.paymentStatus === "completed" ? "完了" :
                         payment.paymentStatus === "pending" ? "保留中" : "失敗"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                支払い履歴がありません
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
