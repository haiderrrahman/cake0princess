"use client";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Minus, Plus, Trash2, ArrowLeft } from "lucide-react";
import { useCart } from "@/context/CartContext";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function Cart() {
  const { items, removeFromCart, updateQuantity, subtotal } = useCart();
  const { user } = useAuth();
  const router = useRouter();
  const [showGuestWarning, setShowGuestWarning] = useState(false);

  const hasSupplies = items.some(i => i.isSupply);
  const hasCakes = items.some(i => !i.isCourse && !i.isSupply);
  const delivery = hasCakes ? 1500 : (hasSupplies ? 5000 : 0);
  const total = subtotal + delivery;

  const handleCheckoutClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (user) {
      router.push("/checkout");
    } else {
      setShowGuestWarning(true);
    }
  };

  return (
    <div className="flex flex-col min-h-screen pb-32">
      {/* Header */}
      <header className="px-6 pt-4 pb-4 bg-white dark:bg-zinc-950 sticky top-0 z-40 flex items-center gap-4">
        <Link href="/" className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition">
          <ArrowRight className="w-6 h-6" />
        </Link>
        <h1 className="text-2xl font-bold">سلة المشتريات</h1>
      </header>

      {/* Cart Items */}
      <div className="px-6 mt-4 flex flex-col gap-4">
        {items.length === 0 ? (
          <div className="text-center py-12">
            <h2 className="text-xl font-bold text-gray-500 mb-2">السلة فارغة</h2>
            <Link href="/shop" className="text-pink-500 font-bold hover:underline">تصفح المتجر</Link>
          </div>
        ) : (
          items.map(item => (
            <div key={item.cartItemId || item.id} className="flex gap-4 p-3 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm relative">
              <div className="relative w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden">
                <Image src={item.image} alt={item.name} fill className="object-cover" />
              </div>
              <div className="flex flex-col justify-between flex-1 py-1">
                <div className="flex justify-between items-start">
                  <div className="flex-1 pr-2">
                    <h3 className="font-bold text-sm leading-tight mb-1">{item.name}</h3>
                    {item.isCourse && <span className="text-[10px] bg-pink-50 text-pink-500 px-2 py-0.5 rounded-full font-bold">دورة أونلاين</span>}
                    {!item.isCourse && item.size && (
                      <div className="text-xs text-gray-500 mt-1">الحجم: {item.size}</div>
                    )}
                    {!item.isCourse && item.fillings && item.fillings.length > 0 && (
                      <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">الحشوات: {item.fillings.join("، ")}</div>
                    )}
                    {!item.isCourse && item.notes && (
                      <div className="text-[10px] text-pink-600 dark:text-pink-400 mt-1 bg-pink-50 dark:bg-pink-900/20 px-2 py-1 rounded-md line-clamp-2">
                        ملاحظة: {item.notes}
                      </div>
                    )}
                  </div>
                  <button onClick={() => removeFromCart(item.cartItemId || item.id)} className="text-gray-400 hover:text-red-500 transition p-1 shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="flex justify-between items-center mt-2">
                  <span className="font-bold text-pink-600 dark:text-pink-400">{item.price.toLocaleString()} د.ع</span>
                  
                  {!item.isCourse && (
                    <div className="flex items-center gap-3 bg-gray-50 dark:bg-zinc-800 rounded-full px-2 py-1 border border-gray-200 dark:border-zinc-700">
                      <button onClick={() => updateQuantity(item.cartItemId || item.id, -1)} className="w-6 h-6 flex items-center justify-center bg-white dark:bg-zinc-700 rounded-full shadow-sm text-gray-600">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-bold text-sm w-4 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.cartItemId || item.id, 1)} className="w-6 h-6 flex items-center justify-center bg-white dark:bg-zinc-700 rounded-full shadow-sm text-pink-600">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary */}
      {items.length > 0 && (
        <div className="mt-8 px-6">
          <div className="bg-gray-50 dark:bg-zinc-900/50 rounded-3xl p-5 border border-gray-100 dark:border-zinc-800">
            <div className="flex justify-between mb-3 text-sm text-gray-600 dark:text-gray-400">
              <span>المجموع الفرعي</span>
              <span>{subtotal.toFixed(2)} د.ع</span>
            </div>
            <div className="flex justify-between mb-3 text-sm text-gray-600 dark:text-gray-400">
              <span>رسوم التوصيل</span>
              <span>{delivery > 0 ? `يبدأ من ${delivery.toLocaleString()} د.ع` : 'مجاناً'}</span>
            </div>
            <div className="h-px w-full bg-gray-200 dark:bg-zinc-800 my-4"></div>
            <div className="flex justify-between font-bold text-lg">
              <span>الإجمالي المتوقع</span>
              <span className="text-pink-600 dark:text-pink-400">{total.toLocaleString()} د.ع</span>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Button */}
      {items.length > 0 && (
        <div className="fixed bottom-[80px] left-0 right-0 z-40 md:bottom-0">
          <div className="mx-auto max-w-md px-6 py-4 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-t border-gray-100 dark:border-zinc-800">
            <button onClick={handleCheckoutClick} className="w-full bg-pink-500 hover:bg-pink-600 text-white font-bold py-4 rounded-2xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2">
              إتمام الطلب <ArrowLeft className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
      {/* Guest Checkout Modal */}
      {showGuestWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-5 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black mb-2 text-center text-gray-900 dark:text-white">هل أنت متأكد من الشراء كضيف؟</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6 leading-relaxed">
              ننصحك بالتسجيل أو تسجيل الدخول لضمان متابعة حالة طلباتك ودوراتك بسهولة في المستقبل والاحتفاظ بها في حسابك.
            </p>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => router.push("/login")}
                className="w-full bg-[#e8456b] text-white font-bold py-3.5 rounded-xl shadow-lg shadow-[#e8456b]/20 active:scale-95 transition"
              >
                تسجيل الدخول / إنشاء حساب
              </button>
              
              <button 
                onClick={() => router.push("/checkout")}
                className="w-full bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 font-bold py-3.5 rounded-xl active:scale-95 transition"
              >
                الاستمرار كضيف
              </button>
              
              <button 
                onClick={() => setShowGuestWarning(false)}
                className="w-full text-xs font-bold text-gray-400 mt-2 hover:text-gray-600 dark:hover:text-gray-200 transition"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
