import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGetDashboardSummary, useGetTopProducts, useGetSalesByHour } from "@workspace/api-client-react";
import { Loader2, DollarSign, Receipt, TrendingUp, Package, Users } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: topProducts, isLoading: isLoadingTopProducts } = useGetTopProducts();
  const { data: salesByHour, isLoading: isLoadingSalesByHour } = useGetSalesByHour();

  if (isLoadingSummary || isLoadingTopProducts || isLoadingSalesByHour) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">لوحة القيادة</h1>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-primary/10 text-primary rounded-lg">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">مبيعات اليوم</p>
                <p className="text-2xl font-bold">{summary?.todaySales.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-accent/10 text-accent rounded-lg">
                <Receipt className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">فواتير اليوم</p>
                <p className="text-2xl font-bold">{summary?.todayOrders}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-green-500/10 text-green-600 rounded-lg">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">أرباح اليوم</p>
                <p className="text-2xl font-bold">{summary?.todayProfit.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 text-blue-600 rounded-lg">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">مبيعات الشهر</p>
                <p className="text-2xl font-bold">{summary?.monthSales.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-purple-500/10 text-purple-600 rounded-lg">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي المنتجات</p>
                <p className="text-2xl font-bold">{summary?.totalProducts}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-orange-500/10 text-orange-600 rounded-lg">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي العملاء</p>
                <p className="text-2xl font-bold">{summary?.totalCustomers}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales by Hour Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">مبيعات اليوم حسب الساعة</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesByHour || []} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="hour" tickFormatter={(val) => `${val}:00`} />
                  <YAxis />
                  <Tooltip labelFormatter={(val) => `الساعة ${val}:00`} />
                  <Line type="monotone" dataKey="total" name="المبيعات" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top Products Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">أكثر المنتجات مبيعاً</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts || []} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="productName" width={90} />
                  <Tooltip />
                  <Bar dataKey="totalQty" name="الكمية" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

      </div>
    </AdminLayout>
  );
}
