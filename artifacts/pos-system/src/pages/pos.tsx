import { useState, useRef, useCallback } from "react";
import { PosLayout } from "@/components/pos-layout";
import { useGetProducts, useGetCategories, useCreateOrder, useGetSettings } from "@workspace/api-client-react";
import type { Product, OrderItemInput } from "@workspace/api-client-react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Minus, Printer, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

type CartItem = {
  product: Product;
  quantity: number;
};

export default function Pos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: products = [] } = useGetProducts();
  const { data: categories = [] } = useGetCategories();
  const { data: settings } = useGetSettings();
  const createOrderMutation = useCreateOrder();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [numberInput, setNumberInput] = useState("");
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "mixed">("cash");
  const [cashGiven, setCashGiven] = useState("");
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const numberInputRef = useRef<HTMLInputElement>(null);

  const taxRate = settings?.taxRate ?? 15;
  const currency = settings?.currency ?? "ريال";

  const filteredProducts = products.filter(p => {
    if (!p.active) return false;
    if (selectedCategory !== null && p.categoryId !== selectedCategory) return false;
    return true;
  });

  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product, quantity: 1 }];
    });
  }, []);

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(i => i.product.id !== productId));
  };

  const changeQty = (productId: number, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.product.id !== productId) return i;
      const newQty = i.quantity + delta;
      return newQty <= 0 ? null : { ...i, quantity: newQty };
    }).filter(Boolean) as CartItem[]);
  };

  const subtotal = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const discountAmt = Math.min(discount, subtotal);
  const afterDiscount = subtotal - discountAmt;
  const taxAmt = afterDiscount * (taxRate / 100);
  const total = afterDiscount + taxAmt;

  const handleNumberInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const num = parseInt(numberInput);
      const prod = products.find(p => p.number === num && p.active);
      if (prod) {
        addToCart(prod);
        setNumberInput("");
      } else {
        toast({ variant: "destructive", title: "لم يتم العثور على المنتج رقم " + num });
      }
    }
  };

  const handlePay = () => {
    if (cart.length === 0) return;
    setShowPayDialog(true);
  };

  const confirmPay = () => {
    const items: OrderItemInput[] = cart.map(i => ({
      productId: i.product.id,
      quantity: i.quantity,
      unitPrice: i.product.price,
    }));

    createOrderMutation.mutate({
      data: {
        items,
        paymentMethod,
        subtotal,
        discount: discountAmt,
        tax: taxAmt,
        total,
        cashAmount: paymentMethod === "cash" ? total : paymentMethod === "mixed" ? parseFloat(cashGiven) || 0 : null,
        cardAmount: paymentMethod === "card" ? total : paymentMethod === "mixed" ? total - (parseFloat(cashGiven) || 0) : null,
        userId: user!.id,
      }
    }, {
      onSuccess: (order) => {
        setLastOrder(order);
        setShowPayDialog(false);
        setShowReceipt(true);
        setCart([]);
        setDiscount(0);
        setCashGiven("");
        setPaymentMethod("cash");
      },
      onError: () => {
        toast({ variant: "destructive", title: "فشل في حفظ الفاتورة" });
      }
    });
  };

  const change = parseFloat(cashGiven) - total;

  return (
    <PosLayout>
      <div className="flex w-full h-full overflow-hidden" dir="rtl">
        {/* Right: Products */}
        <div className="flex-1 flex flex-col overflow-hidden border-l border-border">
          {/* Number input + category filter */}
          <div className="p-3 bg-card border-b border-border flex gap-3 items-center">
            <Input
              ref={numberInputRef}
              type="number"
              placeholder="رقم الصنف + Enter"
              value={numberInput}
              onChange={e => setNumberInput(e.target.value)}
              onKeyDown={handleNumberInput}
              className="w-44 text-center font-bold"
              dir="ltr"
            />
            <div className="flex gap-2 overflow-x-auto flex-1">
              <Button
                size="sm"
                variant={selectedCategory === null ? "default" : "outline"}
                onClick={() => setSelectedCategory(null)}
                className="shrink-0"
              >
                الكل
              </Button>
              {categories.map(cat => (
                <Button
                  key={cat.id}
                  size="sm"
                  variant={selectedCategory === cat.id ? "default" : "outline"}
                  onClick={() => setSelectedCategory(cat.id)}
                  className="shrink-0"
                  style={selectedCategory === cat.id && cat.color ? { backgroundColor: cat.color, borderColor: cat.color } : {}}
                >
                  {cat.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Product grid */}
          <ScrollArea className="flex-1">
            <div className="p-3 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
              {filteredProducts.map(prod => (
                <button
                  key={prod.id}
                  onClick={() => addToCart(prod)}
                  className={cn(
                    "bg-card border border-border rounded-lg p-2 text-center hover:border-primary hover:bg-primary/5 transition-all cursor-pointer flex flex-col items-center gap-1 active:scale-95"
                  )}
                >
                  <span className="text-xs font-bold text-primary bg-primary/10 rounded px-1.5 py-0.5 w-full text-center">
                    {prod.number}
                  </span>
                  <span className="text-xs font-medium leading-tight text-center line-clamp-2">{prod.name}</span>
                  <span className="text-sm font-bold text-amber-600">{prod.price.toLocaleString()}</span>
                </button>
              ))}
              {filteredProducts.length === 0 && (
                <div className="col-span-full py-16 text-center text-muted-foreground">
                  لا توجد منتجات
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Left: Cart */}
        <div className="w-80 flex flex-col bg-card border-r-0 shrink-0">
          <div className="p-3 border-b border-border bg-primary text-primary-foreground flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            <span className="font-bold">قائمة الطلب</span>
            {cart.length > 0 && <Badge variant="secondary" className="mr-auto">{cart.length}</Badge>}
          </div>

          <ScrollArea className="flex-1">
            <div className="divide-y divide-border">
              {cart.length === 0 && (
                <div className="py-16 text-center text-muted-foreground text-sm">
                  لم يتم إضافة أصناف بعد
                </div>
              )}
              {cart.map(item => (
                <div key={item.product.id} className="p-2 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.product.name}</p>
                    <p className="text-xs text-amber-600">{item.product.price.toLocaleString()} × {item.quantity} = {(item.product.price * item.quantity).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => changeQty(item.product.id, -1)} className="w-6 h-6 rounded bg-muted hover:bg-muted/80 flex items-center justify-center text-sm font-bold">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                    <button onClick={() => changeQty(item.product.id, 1)} className="w-6 h-6 rounded bg-muted hover:bg-muted/80 flex items-center justify-center">
                      <Plus className="w-3 h-3" />
                    </button>
                    <button onClick={() => removeFromCart(item.product.id)} className="w-6 h-6 rounded text-destructive hover:bg-destructive/10 flex items-center justify-center">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Totals */}
          <div className="border-t border-border p-3 space-y-2 bg-muted/30">
            <div className="flex justify-between text-sm">
              <span>المجموع</span>
              <span>{subtotal.toLocaleString()} {currency}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>خصم</span>
              <Input
                type="number"
                value={discount}
                onChange={e => setDiscount(Number(e.target.value))}
                className="w-24 h-7 text-sm text-center"
                min={0}
              />
            </div>
            <div className="flex justify-between text-sm">
              <span>ضريبة ({taxRate}%)</span>
              <span>{taxAmt.toFixed(2)} {currency}</span>
            </div>
            <div className="flex justify-between font-bold text-base border-t pt-2">
              <span>الإجمالي</span>
              <span className="text-amber-600">{total.toFixed(2)} {currency}</span>
            </div>

            <div className="flex gap-1 pt-1">
              {(["cash", "card", "mixed"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={cn(
                    "flex-1 py-1 text-xs rounded border transition-colors",
                    paymentMethod === m
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:border-primary"
                  )}
                >
                  {m === "cash" ? "نقداً" : m === "card" ? "شبكة" : "مختلط"}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-none"
                onClick={() => setCart([])}
                disabled={cart.length === 0}
              >
                مسح
              </Button>
              <Button
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold"
                disabled={cart.length === 0 || createOrderMutation.isPending}
                onClick={handlePay}
              >
                دفع
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>تأكيد الدفع</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex justify-between font-bold text-lg">
              <span>المبلغ المطلوب:</span>
              <span className="text-amber-600">{total.toFixed(2)} {currency}</span>
            </div>
            {(paymentMethod === "cash" || paymentMethod === "mixed") && (
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">المبلغ المدفوع نقداً</label>
                <Input
                  type="number"
                  value={cashGiven}
                  onChange={e => setCashGiven(e.target.value)}
                  placeholder="0"
                  className="text-center text-lg font-bold"
                  dir="ltr"
                  autoFocus
                />
                {parseFloat(cashGiven) >= total && (
                  <p className="text-green-600 font-bold text-sm">
                    الباقي: {(parseFloat(cashGiven) - total).toFixed(2)} {currency}
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPayDialog(false)}>إلغاء</Button>
            <Button onClick={confirmPay} disabled={createOrderMutation.isPending} className="bg-green-600 hover:bg-green-700">
              تأكيد الدفع
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>تمت العملية بنجاح</DialogTitle>
          </DialogHeader>
          {lastOrder && (
            <div id="receipt-print" className="space-y-2 text-sm">
              <div className="text-center border-b pb-3">
                <p className="font-bold text-lg">{settings?.businessName ?? "المطعم"}</p>
                {settings?.address && <p className="text-xs text-muted-foreground">{settings.address}</p>}
                {settings?.phone && <p className="text-xs text-muted-foreground">{settings.phone}</p>}
                <p className="font-bold mt-1">فاتورة: {lastOrder.invoiceNumber}</p>
                <p className="text-xs text-muted-foreground">{new Date(lastOrder.createdAt).toLocaleString("ar-SA")}</p>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-right py-1">الصنف</th>
                    <th className="text-center py-1">ك</th>
                    <th className="text-left py-1">السعر</th>
                  </tr>
                </thead>
                <tbody>
                  {lastOrder.items?.map((item: any, idx: number) => (
                    <tr key={idx} className="border-b border-dashed">
                      <td className="py-1">{item.productName}</td>
                      <td className="text-center">{item.quantity}</td>
                      <td className="text-left">{item.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t pt-2 space-y-1">
                {lastOrder.discount > 0 && <div className="flex justify-between"><span>خصم</span><span>-{lastOrder.discount.toFixed(2)}</span></div>}
                {lastOrder.tax > 0 && <div className="flex justify-between"><span>ضريبة</span><span>{lastOrder.tax.toFixed(2)}</span></div>}
                <div className="flex justify-between font-bold text-base"><span>الإجمالي</span><span>{lastOrder.total.toFixed(2)} {currency}</span></div>
              </div>
              {settings?.showCashier && <p className="text-center text-xs border-t pt-2">الكاشير: {user?.name}</p>}
              {settings?.receiptMessage && <p className="text-center text-xs text-muted-foreground">{settings.receiptMessage}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReceipt(false)}>إغلاق</Button>
            <Button onClick={() => window.print()} className="gap-2">
              <Printer className="w-4 h-4" />
              طباعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PosLayout>
  );
}
