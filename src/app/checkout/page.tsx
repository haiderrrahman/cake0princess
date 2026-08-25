"use client";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowRight, MapPin, CreditCard, CheckCircle2, AlertCircle, Calendar, Wallet, Landmark, Phone, Home, CheckCircle, XCircle, User } from "lucide-react";
import { useState, useEffect } from "react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp, doc, updateDoc, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";

// ── Validation helpers ──────────────────────────────────────────
function validatePhone(phone: string): { valid: boolean; message: string } {
  const clean = phone.replace(/\s|-/g, "");
  if (!clean) return { valid: false, message: "رقم الهاتف مطلوب" };
  if (!/^\d+$/.test(clean)) return { valid: false, message: "الرقم يجب أن يحتوي على أرقام فقط" };
  if (!clean.startsWith("07")) return { valid: false, message: "الرقم يجب أن يبدأ بـ 07" };
  if (clean.length !== 11) return { valid: false, message: `الرقم يجب أن يكون 11 رقماً (أدخلت ${clean.length})` };
  return { valid: true, message: "رقم صحيح ✓" };
}

function validateAddress(address: string): { valid: boolean; message: string } {
  const trimmed = address.trim();
  if (!trimmed) return { valid: false, message: "العنوان مطلوب" };
  if (trimmed.length < 20) return { valid: false, message: `العنوان قصير جداً (${trimmed.length}/20 حرف) — أدخل: المنطقة، المحلة، الزقاق، الدار` };
  const words = trimmed.split(/\s+/).filter(w => w.length > 1);
  if (words.length < 3) return { valid: false, message: "العنوان يجب أن يحتوي على تفاصيل كافية (المنطقة + المحلة + رقم الدار)" };
  return { valid: true, message: "عنوان كامل ✓" };
}
// ────────────────────────────────────────────────────────────────

export default function Checkout() {
  const [method, setMethod] = useState<"manual_transfer" | "cash">("manual_transfer");
  const [transferReceipt, setTransferReceipt] = useState("");
  const [transferReceiptTouched, setTransferReceiptTouched] = useState(false);
  const [deliveryZone, setDeliveryZone] = useState<"bismayah" | "rusafa" | "karkh">("bismayah");
  const [paymentSplit, setPaymentSplit] = useState<"25" | "50" | "100">("100");
  const [isSuccess, setIsSuccess] = useState(false);
  const [successOrderId, setSuccessOrderId] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [guestName, setGuestName] = useState("");
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Touch state for real-time validation feedback
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [addressTouched, setAddressTouched] = useState(false);
  const [guestNameTouched, setGuestNameTouched] = useState(false);

  const { subtotal, clearCart, items } = useCart();
  const { user } = useAuth();
  const router = useRouter();

  const hasCourses = items.some((i: any) => i.isCourse);
  const hasSupplies = items.some((i: any) => i.isSupply);
  const hasCakes = items.some((i: any) => !i.isCourse && !i.isSupply);
  const needsDelivery = hasCakes || hasSupplies;

  // Validation results
  const phoneValidation = validatePhone(phone);
  const addressValidation = validateAddress(address);
  const isGuestNameValid = !!user || guestName.trim().length >= 3;
  const isDeliveryValid = !needsDelivery || (phoneValidation.valid && addressValidation.valid);
  const isTransferValid = method !== "manual_transfer" || transferReceipt.trim().length > 3;
  const isFormValid = isDeliveryValid && isGuestNameValid && isTransferValid;

  useEffect(() => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.get("success") === "true") {
        clearCart();
        setIsSuccess(true);
        setSuccessOrderId(url.searchParams.get("orderId") || "CP-8492");
      }
    }
    if (!hasCakes) setPaymentSplit("100");
  }, [clearCart, hasCakes]);

  // Delivery Pricing
  const deliveryPrices = { bismayah: 1500, rusafa: 7000, karkh: 10000 };
  const delivery = hasCakes ? deliveryPrices[deliveryZone] : (hasSupplies ? 5000 : 0);
  const total = subtotal + delivery;
  const toPayNow = (total * parseInt(paymentSplit)) / 100;
  const remaining = total - toPayNow;

  const handleGetLocation = () => {
    if (!navigator.geolocation) { toast.error("متصفحك لا يدعم تحديد الموقع"); return; }
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGettingLocation(false); },
      (err) => { console.error(err); toast.error("تعذر الحصول على الموقع. يرجى إعطاء صلاحية الموقع."); setGettingLocation(false); }
    );
  };

  if (isSuccess) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center p-6 text-center animate-slide-up">
        <div className="w-28 h-28 bg-gradient-to-br from-[#e8456b]/10 to-[#E040FB]/10 rounded-full flex items-center justify-center mb-6 animate-breathe">
          <CheckCircle2 className="w-14 h-14 text-[#e8456b]" />
        </div>
        <h1 className="text-2xl font-black mb-2">تم تأكيد طلبك! 🎉</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 max-w-xs leading-relaxed">
          شكراً لطلبك من كيك الأميرة. رقم الطلب{" "}
          <span className="font-mono text-[#e8456b] font-bold">#{successOrderId.slice(0, 8).toUpperCase()}</span>
          . يمكنك متابعة حالة الطلب من صفحة طلباتي.
        </p>
        <button
          onClick={() => window.location.href = user ? "/orders" : `/track-order?id=${successOrderId}`}
          className="btn-premium py-4 px-12 rounded-2xl text-base"
        >
          الذهاب إلى طلباتي
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen pb-40 animate-slide-up">
      {/* Header */}
      <header className="px-6 pt-4 pb-4 bg-white dark:bg-zinc-900 sticky top-0 z-40 flex items-center gap-4 border-b border-gray-100 dark:border-zinc-800 shadow-sm">
        <Link href="/cart" className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition -ml-2 active:scale-95">
          <ArrowRight className="w-6 h-6" />
        </Link>
        <h1 className="text-xl font-black">إتمام الدفع والحجز</h1>
      </header>

      <div className="px-5 mt-6 space-y-6">

        {/* ── Delivery Zone & Address ── */}
        {needsDelivery && (
          <div className="space-y-4">
            {hasCakes ? (
              <>
                <div className="px-1">
                  <h2 className="font-black text-sm mb-1">منطقة التوصيل (داخل بغداد فقط)</h2>
                  <p className="text-xs text-gray-500">الكيك حساس ولذلك لا يوجد توصيل خارج بغداد.</p>
                </div>
                <div className="space-y-3">
                  <DeliveryOption label="مدينة بسماية" price={1500} selected={deliveryZone === "bismayah"} onClick={() => setDeliveryZone("bismayah")} />
                  <DeliveryOption label="جانب الرصافة" price={7000} selected={deliveryZone === "rusafa"} onClick={() => setDeliveryZone("rusafa")} />
                  <DeliveryOption label="جانب الكرخ" price={10000} selected={deliveryZone === "karkh"} onClick={() => setDeliveryZone("karkh")} />
                </div>
              </>
            ) : (
              <>
                <div className="px-1">
                  <h2 className="font-black text-sm mb-1">منطقة التوصيل (لكافة المحافظات)</h2>
                  <p className="text-xs text-gray-500">توصيل مواد الكيك متوفر لجميع محافظات العراق.</p>
                </div>
                <DeliveryOption label="توصيل لجميع المحافظات" price={5000} selected={true} onClick={() => {}} />
              </>
            )}

            {/* ── Contact & Address ── */}
            <div className="space-y-3 mt-2">

              {/* Guest Name Field */}
              {!user && (
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-black text-gray-700 dark:text-gray-300 mb-1.5 px-1">
                    <User className="w-3.5 h-3.5 text-[#e8456b]" />
                    الاسم الكامل
                    <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={guestName}
                      onChange={e => setGuestName(e.target.value)}
                      onBlur={() => setGuestNameTouched(true)}
                      className={`w-full bg-white dark:bg-zinc-900 border-2 rounded-2xl p-4 text-sm outline-none transition-all duration-200
                        ${guestNameTouched
                          ? isGuestNameValid
                            ? "border-green-400 shadow-[0_0_0_3px_rgba(34,197,94,0.12)]"
                            : "border-red-400 shadow-[0_0_0_3px_rgba(239,68,68,0.12)]"
                          : "border-gray-100 dark:border-zinc-800 focus:border-[#e8456b] focus:shadow-[0_0_0_3px_rgba(232,69,107,0.12)]"
                        }`}
                      placeholder="اسمك الكريم..."
                    />
                  </div>
                  {guestNameTouched && !isGuestNameValid && (
                    <p className="text-[11px] font-bold mt-1.5 px-1 text-red-400 animate-slide-down">الاسم مطلوب (3 أحرف على الأقل)</p>
                  )}
                </div>
              )}

              {/* Phone Field */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-black text-gray-700 dark:text-gray-300 mb-1.5 px-1">
                  <Phone className="w-3.5 h-3.5 text-[#e8456b]" />
                  رقم الهاتف للتواصل
                  <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    onBlur={() => setPhoneTouched(true)}
                    className={`w-full bg-white dark:bg-zinc-900 border-2 rounded-2xl p-4 text-sm outline-none transition-all duration-200
                      ${phoneTouched
                        ? phoneValidation.valid
                          ? "border-green-400 shadow-[0_0_0_3px_rgba(34,197,94,0.12)]"
                          : "border-red-400 shadow-[0_0_0_3px_rgba(239,68,68,0.12)]"
                        : "border-gray-100 dark:border-zinc-800 focus:border-[#e8456b] focus:shadow-[0_0_0_3px_rgba(232,69,107,0.12)]"
                      }`}
                    placeholder="07XXXXXXXXX"
                    dir="ltr"
                    maxLength={11}
                    inputMode="numeric"
                  />
                  {phoneTouched && (
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 animate-pop">
                      {phoneValidation.valid
                        ? <CheckCircle className="w-5 h-5 text-green-500" />
                        : <XCircle className="w-5 h-5 text-red-400" />
                      }
                    </div>
                  )}
                </div>
                {phoneTouched && (
                  <p className={`text-[11px] font-bold mt-1.5 px-1 animate-slide-down
                    ${phoneValidation.valid ? "text-green-500" : "text-red-400"}`}>
                    {phoneValidation.message}
                  </p>
                )}
                {!phoneTouched && (
                  <p className="text-[10px] text-gray-400 mt-1 px-1">يجب أن يكون 11 رقماً ويبدأ بـ 07</p>
                )}
              </div>

              {/* Address Field */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-black text-gray-700 dark:text-gray-300 mb-1.5 px-1">
                  <Home className="w-3.5 h-3.5 text-[#e8456b]" />
                  العنوان التفصيلي الكامل
                  <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <textarea
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    onBlur={() => setAddressTouched(true)}
                    className={`w-full bg-white dark:bg-zinc-900 border-2 rounded-2xl p-4 text-sm outline-none resize-none h-24 transition-all duration-200
                      ${addressTouched
                        ? addressValidation.valid
                          ? "border-green-400 shadow-[0_0_0_3px_rgba(34,197,94,0.12)]"
                          : "border-red-400 shadow-[0_0_0_3px_rgba(239,68,68,0.12)]"
                        : "border-gray-100 dark:border-zinc-800 focus:border-[#e8456b] focus:shadow-[0_0_0_3px_rgba(232,69,107,0.12)]"
                      }`}
                    placeholder="مثال: بغداد، بسماية، المجمع السكني، القطعة 15، الزقاق 3، الدار 7"
                  />
                  {/* Character counter */}
                  <span className={`absolute bottom-3 left-3 text-[10px] font-bold transition-colors
                    ${address.trim().length >= 20 ? "text-green-500" : "text-gray-400"}`}>
                    {address.trim().length}/20+
                  </span>
                </div>
                {addressTouched && (
                  <p className={`text-[11px] font-bold mt-1.5 px-1 animate-slide-down
                    ${addressValidation.valid ? "text-green-500" : "text-red-400"}`}>
                    {addressValidation.message}
                  </p>
                )}
                {!addressTouched && (
                  <p className="text-[10px] text-gray-400 mt-1 px-1">أدخل: المحافظة، المنطقة، المحلة، الزقاق، رقم الدار</p>
                )}
              </div>

              {/* GPS Button */}
              <button
                type="button"
                onClick={handleGetLocation}
                disabled={gettingLocation}
                className={`w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm transition-all shadow-sm active:scale-[0.98] disabled:opacity-50
                  ${location
                    ? "bg-green-50 dark:bg-green-900/10 text-green-600 border-2 border-green-200 dark:border-green-800"
                    : "bg-blue-50 dark:bg-blue-900/10 text-blue-600 border-2 border-blue-100 dark:border-blue-900/30"
                  }`}
              >
                <MapPin className="w-5 h-5" />
                {gettingLocation ? "جاري تحديد الموقع..." : location ? "✓ تم تحديد الموقع" : "تحديد موقعي الحالي (GPS)"}
              </button>
            </div>
          </div>
        )}

        {/* ── Preparation Time Notice ── */}
        {hasCakes && (
          <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 rounded-2xl p-4 flex gap-3">
            <Calendar className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-black text-sm text-orange-700 dark:text-orange-400 mb-1">موعد التجهيز</h4>
              <p className="text-[11px] text-orange-600/80 dark:text-orange-400/80 leading-relaxed">
                الكيك الجاهز يستغرق (1-2 أيام) للتحضير.<br />
                الكيك الخاص (حسب الطلب) يستغرق (3-5 أيام). سيقوم فريقنا بالتواصل لتأكيد الموعد الدقيق.
              </p>
            </div>
          </div>
        )}

        {/* ── Payment Split ── */}
        {hasCakes ? (
          <div>
            <h2 className="font-black text-sm mb-1 px-1">نظام الدفع (العربون)</h2>
            <p className="text-xs text-gray-500 mb-3 px-1">اختر نسبة المبلغ التي تود دفعها الآن لتأكيد الحجز.</p>
            <div className="flex gap-2 bg-gray-100 dark:bg-zinc-900 p-1.5 rounded-2xl">
              {[
                { label: "دفع كامل (100%)", val: "100" },
                { label: "نصف المبلغ (50%)", val: "50" },
                { label: "عربون (25%)", val: "25" }
              ].map(opt => (
                <button
                  key={opt.val}
                  onClick={() => setPaymentSplit(opt.val as any)}
                  className={`flex-1 py-3 text-xs font-black rounded-xl transition-all
                    ${paymentSplit === opt.val
                      ? "bg-white dark:bg-zinc-800 text-[#e8456b] shadow-md"
                      : "text-gray-500 hover:bg-white/50"}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ) : hasCourses ? (
          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-black text-sm text-blue-800 dark:text-blue-300 mb-1">دفع الدورات</h4>
              <p className="text-[11px] text-blue-600/80 dark:text-blue-400/80">الدورات تتطلب دفع كامل المبلغ (100%) ولا يمكن حجزها بدفع جزئي.</p>
            </div>
          </div>
        ) : null}

        {/* ── Payment Method (Manual Transfer Only) ── */}
        <div>
          <h2 className="font-black text-sm mb-3 px-1">وسيلة الدفع</h2>
          <div className="grid grid-cols-1 gap-3">
            <PaymentOption icon={Wallet} label="تحويل مالي (زين كاش / FIB)" selected={true} onClick={() => {}} />
          </div>
        </div>

        {/* ── Manual Transfer Details ── */}
        {method === "manual_transfer" && (
          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-4 mt-4 animate-slide-down">
             <h3 className="font-black text-sm text-blue-800 dark:text-blue-300 mb-2">أرقام الحسابات للتحويل:</h3>
             <ul className="text-sm font-bold text-blue-700 dark:text-blue-400 space-y-2 mb-5 font-mono bg-white dark:bg-zinc-900/50 p-3 rounded-xl border border-blue-200 dark:border-blue-800">
               <li className="flex justify-between items-center">
                 <span>زين كاش (ZainCash):</span>
                 <span className="text-black dark:text-white select-all">078XXXXXXX</span>
               </li>
               <li className="flex justify-between items-center">
                 <span>مصرف العراق الأول (FIB):</span>
                 <span className="text-black dark:text-white select-all">XXXXXXXXX</span>
               </li>
             </ul>
             
             <label className="flex items-center gap-1.5 text-xs font-black text-gray-700 dark:text-gray-300 mb-2 px-1">
               <CheckCircle className="w-4 h-4 text-[#e8456b]" />
               رقم عملية التحويل (التأكيد)
               <span className="text-red-400">*</span>
             </label>
             <input
               type="text"
               value={transferReceipt}
               onChange={e => setTransferReceipt(e.target.value)}
               onBlur={() => setTransferReceiptTouched(true)}
               className={`w-full bg-white dark:bg-zinc-900 border-2 rounded-xl p-3.5 text-sm outline-none transition-all duration-200
                 ${transferReceiptTouched && !isTransferValid 
                   ? "border-red-400 shadow-[0_0_0_3px_rgba(239,68,68,0.12)]" 
                   : "border-gray-200 dark:border-zinc-700 focus:border-[#e8456b]"}`}
               placeholder="مثال: أدخل رقم العملية أو المرجع هنا..."
             />
             {transferReceiptTouched && !isTransferValid && (
               <p className="text-[11px] font-bold mt-1.5 px-1 text-red-400">الرجاء إدخال رقم تأكيد صحيح</p>
             )}
          </div>
        )}
      </div>

      {/* ── Sticky Pay Button ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border-t border-gray-100 dark:border-zinc-800 px-5 py-4 pb-safe">
        <div className="mx-auto max-w-md">

          {/* Validation warning */}
          {((needsDelivery && (phoneTouched || addressTouched) && !isDeliveryValid) || (!user && guestNameTouched && !isGuestNameValid)) && (
            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-2xl p-3.5 flex gap-2.5 mb-3 animate-slide-down">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black text-red-600 dark:text-red-400">يرجى تصحيح:</p>
                <ul className="mt-0.5 space-y-0.5">
                  {!user && !isGuestNameValid && <li className="text-[11px] text-red-500">• الاسم مطلوب</li>}
                  {needsDelivery && !phoneValidation.valid && <li className="text-[11px] text-red-500">• {phoneValidation.message}</li>}
                  {needsDelivery && !addressValidation.valid && <li className="text-[11px] text-red-500">• {addressValidation.message}</li>}
                </ul>
              </div>
            </div>
          )}

          {/* Payment error */}
          {paymentError && (
            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-2xl p-3.5 flex gap-2.5 mb-3 animate-slide-down">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm font-bold text-red-600 dark:text-red-400 leading-relaxed">{paymentError}</p>
            </div>
          )}

          {/* Amount summary */}
          <div className="flex justify-between items-end mb-3">
            <div>
              <p className="text-xs text-gray-500 font-bold">المطلوب دفعه الآن ({paymentSplit}%)</p>
              {remaining > 0 && <p className="text-[10px] text-gray-400">المتبقي: {remaining.toLocaleString()} د.ع</p>}
            </div>
            <p className="text-xl font-black text-[#e8456b]">{toPayNow.toLocaleString()} <span className="text-sm font-bold">د.ع</span></p>
          </div>

          {/* Pay button */}
          <button
            disabled={isProcessing || !isFormValid}
            onClick={async () => {
              // Touch all fields to show all errors
              if (!user) setGuestNameTouched(true);
              if (needsDelivery) {
                setPhoneTouched(true);
                setAddressTouched(true);
              }
              if (method === "manual_transfer") setTransferReceiptTouched(true);

              if (!isFormValid) return;

              setIsProcessing(true);
              try {
                const orderData = {
                  userId: user?.uid || "guest",
                  userName: user?.displayName || guestName.trim(),
                  userEmail: user?.email || "",
                  items,
                  subtotal,
                  delivery,
                  total,
                  paymentSplit,
                  toPayNow,
                  paymentMethod: method,
                  transferReceipt: method === "manual_transfer" ? transferReceipt.trim() : null,
                  deliveryZone: hasCakes ? deliveryZone : (hasSupplies ? "all_iraq" : null),
                  address: needsDelivery ? address.trim() : null,
                  phone: needsDelivery ? phone.trim() : null,
                  location: needsDelivery ? location : null,
                  status: method === "cash" ? "pending_delivery" : (method === "manual_transfer" ? "pending_verification" : "pending_payment"),
                  createdAt: serverTimestamp()
                };

                const docRef = await addDoc(collection(db, "orders"), orderData);

                // Decrement stock for supplies
                for (const item of items) {
                  if (item.isSupply && !item.id.startsWith("s-")) {
                    try {
                      await updateDoc(doc(db, "supplies", item.id), { stockQuantity: increment(-item.quantity) });
                    } catch (e) { console.error("Failed to decrement stock", e); }
                  }
                }

                if (method === "cash" || method === "manual_transfer") {
                  try {
                    await addDoc(collection(db, "notifications"), {
                      userId: "admin",
                      title: method === "cash" ? "طلب نقدي جديد 💵" : "طلب تحويل مالي جديد 🏦",
                      message: `طلب جديد ${method === "cash" ? "بالدفع النقدي" : "بالتحويل المالي"} من ${user?.displayName || "عميل"} - ${total.toLocaleString()} د.ع`,
                      type: "order",
                      link: "/admin/orders",
                      read: false,
                      createdAt: serverTimestamp(),
                    });
                  } catch (e) { }
                  router.push(`/checkout?success=true&orderId=${docRef.id}`);
                }
              } catch (error) {
                console.error("Error creating order", error);
                setIsProcessing(false);
              }
            }}
            className={`w-full py-4 rounded-2xl font-black text-base text-white transition-all
              ${isProcessing || !isFormValid
                ? "bg-gray-300 dark:bg-zinc-700 cursor-not-allowed"
                : "btn-premium active:scale-[0.98]"
              }`}
          >
            {isProcessing
              ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />جاري التجهيز...</span>
              : "إتمام الدفع وتأكيد الطلب"
            }
          </button>

          {/* Validation hint below button */}
          {!isFormValid && !phoneTouched && !addressTouched && !guestNameTouched && (
            <p className="text-center text-[11px] text-gray-400 mt-2">
              يرجى إكمال جميع الحقول المطلوبة باللون الأحمر أعلاه
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────

function DeliveryOption({ label, price, selected, onClick }: any) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-between p-4 bg-white dark:bg-zinc-900 rounded-2xl border-2 transition-all cursor-pointer
        ${selected
          ? "border-[#e8456b] bg-[#e8456b]/5 shadow-md shadow-[#e8456b]/10"
          : "border-gray-100 dark:border-zinc-800 hover:border-gray-200"
        }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all
          ${selected ? "border-[#e8456b]" : "border-gray-300 dark:border-zinc-600"}`}>
          {selected && <div className="w-2.5 h-2.5 bg-[#e8456b] rounded-full" />}
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin className={`w-4 h-4 ${selected ? "text-[#e8456b]" : "text-gray-400"}`} />
          <span className={`font-bold text-sm ${selected ? "text-[#e8456b]" : "text-gray-600 dark:text-gray-300"}`}>{label}</span>
        </div>
      </div>
      <span className={`font-black text-xs ${selected ? "text-[#e8456b]" : "text-gray-500"}`}>{price.toLocaleString()} د.ع</span>
    </div>
  );
}

function PaymentOption({ icon: Icon, label, selected, onClick }: any) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 p-4 bg-white dark:bg-zinc-900 rounded-2xl border-2 transition-all cursor-pointer
        ${selected
          ? "border-[#e8456b] bg-[#e8456b]/5 shadow-md shadow-[#e8456b]/10"
          : "border-gray-100 dark:border-zinc-800 hover:border-gray-200"
        }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
        ${selected ? "bg-[#e8456b]/10" : "bg-gray-50 dark:bg-zinc-800"}`}>
        <Icon className={`w-5 h-5 ${selected ? "text-[#e8456b]" : "text-gray-400"}`} />
      </div>
      <span className={`font-bold text-sm flex-1 ${selected ? "text-[#e8456b]" : "text-gray-600 dark:text-gray-300"}`}>{label}</span>
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
        ${selected ? "border-[#e8456b]" : "border-gray-300 dark:border-zinc-600"}`}>
        {selected && <div className="w-2.5 h-2.5 bg-[#e8456b] rounded-full" />}
      </div>
    </div>
  );
}
