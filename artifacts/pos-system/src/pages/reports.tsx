import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useGetSalesReport } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function Reports() {
  const now = new Date();
  const [startDate, setStartDate] = useState(now.toISOString().slice(0, 7) + "-01");
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10));
  const [groupBy, setGroupBy] = useState<"day" | "month" | "year">("day");

  const { data: rows = [], isLoading } = useGetSalesReport({ startDate, endDate, groupBy });

  const totalSales = rows.reduce((s, r) => s + r.total, 0);
  const totalOrders = rows.reduce((s, r) => s + r.orders, 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h1 className="text-2xl font-bold">تقارير المبيعات</h1>
          <div className="flex gap-2 flex-wrap items-center">
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-36" />
            <span className="text-muted-foreground">-</span>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-36" />
            <div className="flex gap-1 border rounded-lg overflow-hidden">
              {(["day","month","year"] as const).map(g => (
                <button key={g} onClick={() => setGroupBy(g)}
                  className={`px-3 py-1 text-sm ${groupBy === g ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                  {g === "day" ? "يومي" : g === "month" ? "شهري" : "سنوي"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-primary/10 text-primary rounded-lg text-2xl font-bold">ر</div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي المبيعات</p>
                <p className="text-2xl font-bold text-amber-600">{totalSales.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-accent/10 text-accent-foreground rounded-lg text-2xl font-bold">#</div>
              <div>
                <p className="text-sm text-muted-foreground">عدد الفواتير</p>
                <p className="text-2xl font-bold">{totalOrders}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>مبيعات حسب الفترة</CardTitle></CardHeader>
          <CardContent className="h-[350px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">جاري التحميل...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total" name="المبيعات" fill="#1e3a5f" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>تفصيل البيانات</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-right p-3">الفترة</th>
                  <th className="text-right p-3">عدد الفواتير</th>
                  <th className="text-left p-3">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r, i) => (
                  <tr key={i} className="hover:bg-muted/30">
                    <td className="p-3 font-mono">{r.period}</td>
                    <td className="p-3">{r.orders}</td>
                    <td className="p-3 text-left font-bold text-amber-600">{r.total.toFixed(2)}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={3} className="py-12 text-center text-muted-foreground">لا توجد بيانات في هذه الفترة</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
