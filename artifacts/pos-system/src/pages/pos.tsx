import { useState, useRef, useCallback } from "react";
import { PosLayout } from "@/components/pos-layout";
import {
  useGetProducts, useGetCategories, useCreateOrder, useGetSettings,
  useGetReceiptCopyConfigs, useGetDepartmentPrintConfigs, useCreatePrintLog,
} from "@workspace/api-client-react";
import type { Product, OrderItemInput, Order } from "@workspace/api-client-react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Minus, Printer, ShoppingCart, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type CartItem = {
  product: Product;
  quantity: number;
};

type OrderType = "dine-in" | "takeout" | "delivery";

const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  "dine-in": "محلي",
  "takeout": "سفري",
  "delivery": "توصيل",
};

export default function Pos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: products = [] } = useGetProducts();
  const { data: categories = [] } = useGetCategories();
  const { data: settings } = useGetSettings();
  const { data: receiptCopies = [] } = useGetReceiptCopyConfigs();
  const { data: deptConfigs = [] } = useGetDepartmentPrintConfigs();
  const createOrderMutation = useCreateOrder();
  const createPrintLog = useCreatePrintLog();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [numberInput, setNumberInput] = useState("");
  const [discount, setDiscount] = useState(0);
  const [orderType, setOrderType] = useState<OrderType>("dine-in");
  const [tableNumber, setTableNumber] = useState("");
  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "mixed">("cash");
  const [cashGiven, setCashGiven] = useState("");
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [reprintReason, setReprintReason] = useState("");
  const [showReprintDialog, setShowReprintDialog] = useState(false);
  const numberInputRef = useRef<HTMLInputElement>(null);

  const taxRate = settings?.taxRate ?? 15;
  const currency = settings?.currency ?? "ريال";
  const autoPrintTrigger = settings?.autoPrintTrigger ?? "print_button";

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

  // Log a print operation to server
  const logPrint = (order: Order, receiptType: string, deptName?: string, printerName?: string, copies?: number) => {
    createPrintLog.mutate({
      data: {
        orderId: order.id,
        invoiceNumber: order.invoiceNumber,
        receiptType,
        departmentName: deptName ?? null,
        printerName: printerName ?? null,
        copies: copies ?? 1,
        status: "success",
        reprintCount: 0,
      }
    });
  };

  // Trigger browser print for a given receipt type
  const triggerPrint = (order: Order, isReprint = false, reprintReasonText?: string) => {
    const enabledCopies = receiptCopies.filter(c => c.enabled);
    const copiesCount = settings?.masterCopiesCount ?? 2;

    // Log master receipts
    for (let i = 0; i < copiesCount; i++) {
      const copyLabel = enabledCopies[i]?.label ?? `نسخة ${i + 1}`;
      createPrintLog.mutate({
        data: {
          orderId: order.id,
          invoiceNumber: order.invoiceNumber,
          receiptType: isReprint ? "reprint" : "master",
          departmentName: copyLabel,
          printerName: null,
          copies: 1,
          status: "success",
          reprintReason: isReprint ? (reprintReasonText ?? "إعادة طباعة") : null,
          reprintCount: isReprint ? 1 : 0,
        }
      });
    }

    // Log department receipts
    const enabledDepts = deptConfigs
      .filter(d => d.enabled)
      .sort((a, b) => a.printOrder - b.printOrder);

    for (const dept of enabledDepts) {
      const deptItems = order.items?.filter(item => item.categoryId === dept.categoryId);
      if (!deptItems?.length) continue;
      createPrintLog.mutate({
        data: {
          orderId: order.id,
          invoiceNumber: order.invoiceNumber,
          receiptType: "department",
          departmentName: dept.categoryName ?? "قسم",
          printerName: dept.printerName ?? null,
          copies: dept.copies,
          status: "success",
          reprintCount: 0,
        }
      });
    }

    window.print();
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
        orderType,
        tableNumber: tableNumber || null,
        note: note || null,
      }
    }, {
      onSuccess: (order) => {
        setLastOrder(order);
        setShowPayDialog(false);
        setCart([]);
        setDiscount(0);
        setCashGiven("");
        setPaymentMethod("cash");
        setNote("");
        setTableNumber("");

        // Auto-print if triggered after payment
        if (autoPrintTrigger === "after_payment") {
          setShowReceipt(true);
          setTimeout(() => triggerPrint(order), 500);
        } else {
          setShowReceipt(true);
        }
      },
      onError: () => {
        toast({ variant: "destructive", title: "فشل في حفظ الفاتورة" });
      }
    });
  };

  const handleReprint = () => {
    if (!lastOrder) return;
    const maxReprint = settings?.maxReprintCount ?? 3;
    if (maxReprint > 0) {
      setShowReprintDialog(true);
    } else {
      triggerPrint(lastOrder, true);
    }
  };

  const confirmReprint = () => {
    if (!lastOrder) return;
    triggerPrint(lastOrder, true, reprintReason);
    setShowReprintDialog(false);
    setReprintReason("");
  };

  const change = parseFloat(cashGiven) - total;

  // Group order items by department for department receipts view
  const getDeptGroups = (order: Order | null) => {
    if (!order) return [];
    const enabledDepts = deptConfigs.filter(d => d.enabled).sort((a, b) => a.printOrder - b.printOrder);
    return enabledDepts.map(dept => {
      const items = order.items?.filter(item => item.categoryId === dept.categoryId) ?? [];
      return { dept, items };
    }).filter(g => g.items.length > 0);
  };

  const enabledCopies = receiptCopies.filter(c => c.enabled);
  const masterCopiesCount = settings?.masterCopiesCount ?? 2;
  const deptGroups = getDeptGroups(lastOrder);

  return (
    <PosLayout>
      <div className="flex w-full h-full overflow-hidden" dir="rtl">
        {/* Right: Products */}
        <div className="flex-1 flex flex-col overflow-hidden border-l border-border">
          {/* Controls bar */}
          <div className="p-3 bg-card border-b border-border flex gap-3 items-center flex-wrap">
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
            {/* Order type selector */}
            <div className="flex rounded-md border border-border overflow-hidden shrink-0">
              {(["dine-in", "takeout", "delivery"] as OrderType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setOrderType(t)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-colors",
                    orderType === t
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  )}
                >
                  {ORDER_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
            {orderType === "dine-in" && (
              <Input
                placeholder="رقم الطاولة"
                value={tableNumber}
                onChange={e => setTableNumber(e.target.value)}
                className="w-28 text-center"
              />
            )}
            {/* Category filter */}
            <div className="flex gap-1 overflow-x-auto flex-1">
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
                  {prod.categoryName && (
                    <span className="text-[10px] text-muted-foreground">{prod.categoryName}</span>
                  )}
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
            <Badge variant="secondary" className="text-xs">
              {ORDER_TYPE_LABELS[orderType]}
              {tableNumber ? ` - طاولة ${tableNumber}` : ""}
            </Badge>
            {cart.length > 0 && <Badge variant="outline" className="mr-auto border-primary-foreground/30 text-primary-foreground">{cart.length}</Badge>}
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
                    {item.product.categoryName && (
                      <p className="text-[10px] text-muted-foreground">{item.product.categoryName}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => changeQty(item.product.id, -1)} className="w-6 h-6 rounded bg-muted hover:bg-muted/80 flex items-center justify-center">
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

          {/* Note input */}
          {cart.length > 0 && (
            <div className="px-3 pb-2">
              <Input
                placeholder="ملاحظة على الطلب..."
                value={note}
                onChange={e => setNote(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          )}

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
        <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="w-5 h-5" />
              تمت العملية - الفاتورة
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 -mx-2 px-2">
            {lastOrder && (
              <div className="space-y-4" id="receipt-print">
                {/* Master Receipt */}
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-sm">الفاتورة الرئيسية</h3>
                    <div className="flex gap-1 flex-wrap justify-end">
                      {Array.from({ length: masterCopiesCount }).map((_, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {enabledCopies[i]?.label ?? `نسخة ${i + 1}`}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="text-center border-b pb-3">
                      <p className="font-bold text-lg">{settings?.businessName ?? "المطعم"}</p>
                      {settings?.address && <p className="text-xs text-muted-foreground">{settings.address}</p>}
                      {settings?.phone && <p className="text-xs text-muted-foreground">{settings.phone}</p>}
                      {settings?.showOrderNumber !== false && (
                        <p className="font-bold mt-1">فاتورة: {lastOrder.invoiceNumber}</p>
                      )}
                      {settings?.showDateTime !== false && (
                        <p className="text-xs text-muted-foreground">{new Date(lastOrder.createdAt).toLocaleString("ar-SA")}</p>
                      )}
                      {settings?.showOrderType !== false && (
                        <p className="text-xs font-medium mt-1">
                          نوع الطلب: <span className="text-primary">{ORDER_TYPE_LABELS[lastOrder.orderType as OrderType ?? "dine-in"]}</span>
                          {lastOrder.tableNumber && ` - طاولة: ${lastOrder.tableNumber}`}
                        </p>
                      )}
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="text-right py-1">الصنف</th>
                          <th className="text-center py-1">ك</th>
                          <th className="text-left py-1">المجموع</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lastOrder.items?.map((item, idx) => (
                          <tr key={idx} className="border-b border-dashed">
                            <td className="py-1">
                              <div>{item.productName}</div>
                              {item.categoryName && <div className="text-muted-foreground text-[10px]">{item.categoryName}</div>}
                            </td>
                            <td className="text-center">{item.quantity}</td>
                            <td className="text-left">{item.total.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="border-t pt-2 space-y-1">
                      {settings?.showDiscount !== false && (lastOrder.discount ?? 0) > 0 && (
                        <div className="flex justify-between"><span>خصم</span><span>-{(lastOrder.discount ?? 0).toFixed(2)}</span></div>
                      )}
                      {settings?.showTax !== false && (lastOrder.tax ?? 0) > 0 && (
                        <div className="flex justify-between"><span>ضريبة ({taxRate}%)</span><span>{(lastOrder.tax ?? 0).toFixed(2)}</span></div>
                      )}
                      <div className="flex justify-between font-bold text-base">
                        <span>الإجمالي</span>
                        <span>{lastOrder.total.toFixed(2)} {currency}</span>
                      </div>
                    </div>
                    {settings?.showCashier && (
                      <p className="text-center text-xs border-t pt-2">الكاشير: {user?.name}</p>
                    )}
                    {settings?.showNotes !== false && lastOrder.note && (
                      <p className="text-center text-xs text-muted-foreground">ملاحظة: {lastOrder.note}</p>
                    )}
                    {settings?.receiptMessage && (
                      <p className="text-center text-xs text-muted-foreground">{settings.receiptMessage}</p>
                    )}
                  </div>
                </div>

                {/* Department Receipts */}
                {deptGroups.length > 0 && (
                  <div className="space-y-2">
                    <Separator />
                    <h3 className="font-bold text-sm text-muted-foreground">فواتير الأقسام ({deptGroups.length})</h3>
                    {deptGroups.map(({ dept, items }) => (
                      <div key={dept.id} className="border rounded-lg p-3 bg-blue-50 dark:bg-blue-950/20">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-bold text-sm text-blue-700 dark:text-blue-300">
                            {dept.categoryName}
                          </h4>
                          <div className="flex items-center gap-2">
                            {dept.printerName && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Printer className="w-3 h-3" />
                                {dept.printerName}
                              </span>
                            )}
                            <Badge variant="outline" className="text-xs">{dept.copies} نسخة</Badge>
                          </div>
                        </div>
                        <div className="text-center mb-2 text-xs font-medium text-muted-foreground">
                          فاتورة قسم {dept.categoryName} | {lastOrder.invoiceNumber}
                        </div>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-blue-200 dark:border-blue-800">
                              <th className="text-right py-1">الصنف</th>
                              <th className="text-center py-1">الكمية</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item, idx) => (
                              <tr key={idx} className="border-b border-dashed border-blue-200 dark:border-blue-800">
                                <td className="py-1 font-medium">{item.productName}</td>
                                <td className="text-center font-bold text-lg">{item.quantity}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {settings?.showOrderType !== false && (
                          <p className="text-xs text-center mt-2 text-muted-foreground">
                            {ORDER_TYPE_LABELS[lastOrder.orderType as OrderType ?? "dine-in"]}
                            {lastOrder.tableNumber ? ` - طاولة ${lastOrder.tableNumber}` : ""}
                          </p>
                        )}
                        {lastOrder.note && settings?.showNotes !== false && (
                          <p className="text-xs text-center mt-1 text-muted-foreground">ملاحظة: {lastOrder.note}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setShowReceipt(false)}>إغلاق</Button>
            {lastOrder && (
              <Button
                variant="outline"
                onClick={handleReprint}
                className="gap-2"
              >
                <ChevronDown className="w-4 h-4" />
                إعادة طباعة
              </Button>
            )}
            <Button
              onClick={() => {
                if (lastOrder) triggerPrint(lastOrder);
              }}
              className="gap-2"
            >
              <Printer className="w-4 h-4" />
              طباعة ({masterCopiesCount} نسخة
              {deptGroups.length > 0 ? ` + ${deptGroups.length} قسم` : ""})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reprint Reason Dialog */}
      <Dialog open={showReprintDialog} onOpenChange={setShowReprintDialog}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>سبب إعادة الطباعة</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              يرجى إدخال سبب إعادة الطباعة. سيُسجَّل هذا في سجل الطباعة.
            </p>
            <Input
              value={reprintReason}
              onChange={e => setReprintReason(e.target.value)}
              placeholder="مثال: الفاتورة تالفة، طلب العميل..."
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReprintDialog(false)}>إلغاء</Button>
            <Button onClick={confirmReprint} disabled={!reprintReason.trim()}>
              <Printer className="w-4 h-4 me-2" />
              طباعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PosLayout>
  );
}
