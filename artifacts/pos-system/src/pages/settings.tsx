import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey } from "@workspace/api-client-react";
import type { SettingsInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

export default function Settings() {
  const { data: settings, isLoading } = useGetSettings();
  const updateMutation = useUpdateSettings();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState<SettingsInput>({
    businessName: "",
    address: null,
    phone: null,
    taxNumber: null,
    taxRate: 15,
    currency: "ريال",
    receiptMessage: null,
    printLogo: true,
    printQr: false,
    showCashier: true,
    showCustomer: true,
  });

  useEffect(() => {
    if (settings) setForm({ ...settings });
  }, [settings]);

  const handleSave = () => {
    updateMutation.mutate({ data: form }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        toast({ title: "تم حفظ الإعدادات" });
      },
      onError: () => toast({ variant: "destructive", title: "فشل في الحفظ" })
    });
  };

  if (isLoading) return <AdminLayout><div className="text-center py-16 text-muted-foreground">جاري التحميل...</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-2xl">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">إعدادات النظام</h1>
          <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-2">
            <Save className="w-4 h-4" />
            حفظ الإعدادات
          </Button>
        </div>

        <Card>
          <CardHeader><CardTitle>معلومات النشاط التجاري</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {([
              ["businessName", "اسم النشاط *", true],
              ["address", "العنوان", false],
              ["phone", "رقم الهاتف", false],
              ["taxNumber", "الرقم الضريبي", false],
              ["currency", "العملة", false],
            ] as [keyof SettingsInput, string, boolean][]).map(([field, label]) => (
              <div key={field} className="space-y-1">
                <label className="text-sm font-medium">{label}</label>
                <Input
                  value={(form[field] as string) ?? ""}
                  onChange={e => setForm({ ...form, [field]: e.target.value || null })}
                />
              </div>
            ))}
            <div className="space-y-1">
              <label className="text-sm font-medium">نسبة الضريبة (%)</label>
              <Input
                type="number"
                value={form.taxRate ?? 15}
                onChange={e => setForm({ ...form, taxRate: Number(e.target.value) })}
                className="w-32"
                min={0}
                max={100}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>إعدادات الفاتورة</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">رسالة الشكر في نهاية الفاتورة</label>
              <Input
                value={form.receiptMessage ?? ""}
                onChange={e => setForm({ ...form, receiptMessage: e.target.value || null })}
                placeholder="شكراً لزيارتكم..."
              />
            </div>
            {([
              ["printLogo", "طباعة الشعار"],
              ["printQr", "طباعة QR Code"],
              ["showCashier", "إظهار اسم الكاشير"],
              ["showCustomer", "إظهار اسم العميل"],
            ] as [keyof SettingsInput, string][]).map(([field, label]) => (
              <div key={field} className="flex items-center justify-between py-1">
                <label className="text-sm font-medium">{label}</label>
                <Switch
                  checked={Boolean(form[field])}
                  onCheckedChange={v => setForm({ ...form, [field]: v })}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>معلومات الدخول الافتراضية</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-4 font-mono">
              <p>مدير النظام: <span className="font-bold text-foreground">admin</span> / كلمة المرور: <span className="font-bold text-foreground">admin123</span></p>
              <p>الكاشير: <span className="font-bold text-foreground">cashier</span> / كلمة المرور: <span className="font-bold text-foreground">cashier123</span></p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
