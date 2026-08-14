"use client";
import { customConfirm } from '@/lib/customConfirm';
import toast from 'react-hot-toast';
import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, orderBy, query, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ChevronLeft, Loader2, Plus, Trash2, Tag, Edit2, X, Check, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function AdminCategories() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  
  // Edit states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "categories"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching categories:", error);
      // Fallback if no index exists
      try {
        const snapshot = await getDocs(collection(db, "categories"));
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Manual sort as fallback
        data.sort((a: any, b: any) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return timeB - timeA;
        });
        setCategories(data);
      } catch (e) {
        console.error(e);
      }
    }
    setLoading(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.trim()) return;

    setIsAdding(true);
    try {
      const docRef = await addDoc(collection(db, "categories"), {
        name: newCategory.trim(),
        createdAt: serverTimestamp()
      });
      setCategories([{ id: docRef.id, name: newCategory.trim() }, ...categories]);
      setNewCategory("");
    } catch (error) {
      console.error("Error adding category:", error);
      toast.error("حدث خطأ أثناء الإضافة.");
    }
    setIsAdding(false);
  };

  const handleEdit = (category: any) => {
    setEditingId(category.id);
    setEditName(category.name);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "categories", id), {
        name: editName.trim()
      });
      setCategories(categories.map(c => c.id === id ? { ...c, name: editName.trim() } : c));
      setEditingId(null);
    } catch (error) {
      console.error("Error updating category:", error);
      toast.error("حدث خطأ أثناء التعديل.");
    }
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!(await customConfirm("هل أنت متأكد من حذف هذا التصنيف؟"))) return;
    try {
      await deleteDoc(doc(db, "categories", id));
      setCategories(categories.filter(c => c.id !== id));
    } catch (error) {
      console.error("Error deleting category:", error);
      toast.error("حدث خطأ أثناء الحذف.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 pb-24 animate-slide-up">
            {/* ═══════════════ HEADER ═══════════════ */}
      <div className="relative bg-gradient-to-br from-[#1a0533] via-[#2d1060] to-[#0f3460] pt-20 pb-6 px-5 overflow-hidden mb-6">
        <div className="absolute top-0 right-0 w-72 h-72 bg-purple-600/20 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/15 blur-[80px] rounded-full translate-y-1/2 -translate-x-1/4 pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="w-10 h-10 bg-white/15 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 hover:bg-white/25 transition">
              <ArrowRight className="w-5 h-5 text-white" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-white">إدارة التصنيفات</h1>
              <p className="text-xs text-purple-200">تعديل أو إضافة تصنيف جديد</p>
            </div>
          </div>
          
        </div>
      </div>

      <div className="px-5">
        {/* Add new category form */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-zinc-800 mb-8">
          <h2 className="font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
            <Tag className="w-5 h-5 text-pink-500" /> إضافة تصنيف جديد
          </h2>
          <form onSubmit={handleAdd} className="flex gap-3">
            <input 
              type="text" 
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              placeholder="اسم التصنيف (مثال: كيك الأعراس)"
              className="flex-1 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-pink-500 transition-colors"
            />
            <button 
              type="submit" 
              disabled={isAdding || !newCategory.trim()}
              className="bg-pink-500 hover:bg-pink-600 text-white px-6 rounded-xl font-bold transition flex items-center gap-2 disabled:opacity-50"
            >
              {isAdding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
              إضافة
            </button>
          </form>
        </div>

        {/* List of categories */}
        {loading ? (
          <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-pink-500" /></div>
        ) : (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden shadow-sm border border-gray-100 dark:border-zinc-800">
            {categories.length === 0 ? (
              <div className="p-8 text-center text-gray-500">لا توجد تصنيفات مضافة حالياً.</div>
            ) : (
              <ul className="divide-y divide-gray-50 dark:divide-zinc-800/50">
                {categories.map(category => (
                  <li key={category.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition gap-4">
                    {editingId === category.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input 
                          type="text" 
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-pink-500"
                          autoFocus
                        />
                        <button 
                          onClick={() => handleSaveEdit(category.id)}
                          disabled={isSaving || !editName.trim()}
                          className="p-2 text-green-600 bg-green-50 hover:bg-green-100 dark:bg-green-500/10 dark:hover:bg-green-500/20 rounded-lg transition disabled:opacity-50"
                        >
                          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </button>
                        <button 
                          onClick={() => setEditingId(null)}
                          disabled={isSaving}
                          className="p-2 text-gray-500 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg transition"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="font-bold text-gray-800 dark:text-gray-200">{category.name}</span>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleEdit(category)}
                            className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition"
                            title="تعديل"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => handleDelete(category.id)}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition"
                            title="حذف"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

