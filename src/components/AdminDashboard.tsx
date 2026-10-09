"use client";
import React from "react";
import Link from "next/link";
import { Home, Crown, ArrowLeft } from "lucide-react";

export default function AdminDashboard() {
  return (
    <section className="mx-4 my-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* إدارة المنزل */}
        <Link
          href="/admin/home-finance"
          prefetch={true}
          className="group relative bg-gradient-to-r from-rose-500 via-pink-600 to-purple-600 hover:from-rose-600 hover:to-purple-700 text-white rounded-2xl p-3.5 sm:p-4 flex items-center justify-between shadow-lg shadow-pink-500/20 active:scale-98 transition-all border border-pink-400/30 overflow-hidden"
        >
          <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none -translate-y-1/2 translate-x-1/2" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/25 shrink-0 group-hover:scale-105 transition-transform">
              <Home className="w-5 h-5 text-white" />
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1.5">
                <h3 className="font-black text-sm text-white">إدارة المنزل</h3>
                <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-bold">VIP</span>
              </div>
              <p className="text-[11px] text-pink-100 font-medium mt-0.5">ميزانية، مصاريف، وواجبات العائلة</p>
            </div>
          </div>
          <ArrowLeft className="w-4 h-4 text-white/80 group-hover:-translate-x-1 transition-transform relative z-10" />
        </Link>

        {/* مقر القيادة */}
        <Link
          href="/admin"
          prefetch={true}
          className="group relative bg-gradient-to-r from-indigo-600 via-purple-700 to-slate-900 hover:from-indigo-700 hover:to-black text-white rounded-2xl p-3.5 sm:p-4 flex items-center justify-between shadow-lg shadow-indigo-600/20 active:scale-98 transition-all border border-indigo-400/30 overflow-hidden"
        >
          <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none -translate-y-1/2 translate-x-1/2" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/25 shrink-0 group-hover:scale-105 transition-transform">
              <Crown className="w-5 h-5 text-amber-300" />
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1.5">
                <h3 className="font-black text-sm text-white">مقر القيادة</h3>
                <span className="text-[10px] bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full font-bold">المركزية</span>
              </div>
              <p className="text-[11px] text-indigo-200 font-medium mt-0.5">لوحة التحكم وإدارة النظام الشاملة</p>
            </div>
          </div>
          <ArrowLeft className="w-4 h-4 text-white/80 group-hover:-translate-x-1 transition-transform relative z-10" />
        </Link>
      </div>
    </section>
  );
}
