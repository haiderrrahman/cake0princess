"use client";
import { customConfirm } from '@/lib/customConfirm';
import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { compressImage } from "@/lib/imageUtils";
import { Plus, Trash2, PlayCircle, Loader2, ChevronLeft, ChevronDown, ChevronUp, Save, Edit2, X, Check, CheckCircle, GraduationCap, Image as ImageIcon, Search, UploadCloud } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

type Course = {
  id: string;
  title: string;
  price: number;
  description: string;
  thumbnail: string;
  youtubeLink: string;
  level: string;
  curriculum?: { id: string; title: string; videoId: string; duration: string; free: boolean }[];
};

export default function AdminCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Curriculum Form States
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonVideoId, setLessonVideoId] = useState("");
  const [lessonDuration, setLessonDuration] = useState("");
  const [lessonFree, setLessonFree] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [isSavingLesson, setIsSavingLesson] = useState(false);
  
  // Form states
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [youtubeLink, setYoutubeLink] = useState("");
  const [level, setLevel] = useState("مبتدئ");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "courses"));
      const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
      setCourses(items);
    } catch (error) {
      console.error("Error fetching courses:", error);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setTitle("");
    setPrice("");
    setDescription("");
    setYoutubeLink("");
    setLevel("مبتدئ");
    setImageFile(null);
    setEditingCourse(null);
    setIsFormOpen(false);
  };

  const handleEditClick = (course: Course) => {
    setEditingCourse(course);
    setTitle(course.title);
    setPrice(course.price.toString());
    setDescription(course.description);
    setYoutubeLink(course.youtubeLink || "");
    setLevel(course.level || "مبتدئ");
    setImageFile(null);
    setIsFormOpen(true);
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !price || !youtubeLink) return;
    if (!editingCourse && !imageFile) return;

    setUploading(true);
    try {
      let imageUrl = editingCourse?.thumbnail || "";

      if (imageFile) {
        const compressed = await compressImage(imageFile);
        const storageRef = ref(storage, `courses/${Date.now()}_${compressed.name}`);
        await uploadBytes(storageRef, compressed);
        imageUrl = await getDownloadURL(storageRef);
      }

      if (editingCourse) {
        await updateDoc(doc(db, "courses", editingCourse.id), {
          title,
          price: Number(price),
          description,
          thumbnail: imageUrl,
          youtubeLink,
          level
        });
      } else {
        await addDoc(collection(db, "courses"), {
          title,
          price: Number(price),
          description,
          thumbnail: imageUrl,
          youtubeLink,
          level,
          curriculum: []
        });
      }
      
      await fetchCourses();
      resetForm();
    } catch (error) {
      console.error("Error saving course:", error);
    }
    setUploading(false);
  };

  const handleDeleteCourse = async (id: string) => {
    if (await customConfirm("هل أنت متأكد من حذف هذه الدورة؟")) {
      await deleteDoc(doc(db, "courses", id));
      await fetchCourses();
    }
  };

  const handleSaveLesson = async (courseId: string) => {
    if (!lessonTitle || !lessonVideoId || !lessonDuration) return;
    
    setIsSavingLesson(true);
    try {
      const course = courses.find(c => c.id === courseId);
      if (!course) return;

      const currentCurriculum = course.curriculum || [];
      let newCurriculum;

      if (editingLessonId) {
        newCurriculum = currentCurriculum.map(lesson => 
          lesson.id === editingLessonId 
            ? { ...lesson, title: lessonTitle, videoId: lessonVideoId, duration: lessonDuration, free: lessonFree }
            : lesson
        );
      } else {
        const newLesson = {
          id: Date.now().toString(),
          title: lessonTitle,
          videoId: lessonVideoId,
          duration: lessonDuration,
          free: lessonFree
        };
        newCurriculum = [...currentCurriculum, newLesson];
      }

      await updateDoc(doc(db, "courses", courseId), {
        curriculum: newCurriculum
      });

      await fetchCourses();
      
      setLessonTitle("");
      setLessonVideoId("");
      setLessonDuration("");
      setLessonFree(false);
      setEditingLessonId(null);
    } catch (error) {
      console.error("Error saving lesson:", error);
    }
    setIsSavingLesson(false);
  };

  const handleDeleteLesson = async (courseId: string, lessonId: string) => {
    if (!(await customConfirm("هل أنت متأكد من حذف هذا الدرس؟"))) return;
    
    try {
      const course = courses.find(c => c.id === courseId);
      if (!course) return;

      const newCurriculum = (course.curriculum || []).filter(l => l.id !== lessonId);
      
      await updateDoc(doc(db, "courses", courseId), {
        curriculum: newCurriculum
      });

      await fetchCourses();
    } catch (error) {
      console.error("Error deleting lesson:", error);
    }
  };

  const filteredCourses = courses.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.level.includes(searchQuery)
  );

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-zinc-950 pb-24">
      <div className="animate-slide-up">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-[#1a0533] via-[#2d1060] to-[#0f3460] pt-20 pb-6 px-5 overflow-hidden mb-6">
        <div className="absolute top-0 right-0 w-72 h-72 bg-purple-600/20 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/15 blur-[80px] rounded-full translate-y-1/2 -translate-x-1/4 pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="w-10 h-10 bg-white/15 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 hover:bg-white/25 transition">
              <ChevronLeft className="w-5 h-5 text-white" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-white">إدارة الدورات</h1>
              <p className="text-xs text-purple-200">تعديل أو إضافة دورات ودروس للأكاديمية</p>
            </div>
          </div>
          <button
            onClick={() => { resetForm(); setIsFormOpen(true); }}
            className="bg-white text-purple-900 rounded-xl px-4 py-2 flex items-center gap-2 text-sm font-black shadow-sm hover:bg-gray-100 transition active:scale-95"
          >
            <Plus className="w-4 h-4" /> إضافة
          </button>
        </div>

        <div className="relative z-10 mt-2">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300" />
          <input
            type="text"
            placeholder="ابحث عن دورة..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white/10 border border-white/20 text-white placeholder-purple-300 rounded-xl pr-10 pl-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-400 backdrop-blur-md transition-all"
          />
        </div>
      </div>

      {/* ── Courses List ── */}
      <div className="px-5 mt-5">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-8 h-8 animate-spin text-[#F5C842]" />
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="text-center py-10 bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-gray-200 dark:border-zinc-800">
            <div className="text-4xl mb-2 opacity-50">🎓</div>
            <p className="text-gray-500 font-bold text-sm">لا توجد دورات هنا، أضف البعض!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCourses.map((course) => (
              <div key={course.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden transition-all duration-300">
                
                {/* Course Header */}
                <div className="p-3 flex items-start gap-3 relative">
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-gray-50 dark:bg-zinc-800 flex-shrink-0">
                    {course.thumbnail ? (
                      <Image src={course.thumbnail} alt={course.title} fill className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-gray-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 py-1">
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white line-clamp-1">{course.title}</h3>
                    <p className="text-[10px] text-gray-500 mt-0.5">{course.level} • {(course.curriculum || []).length} دروس</p>
                    <p className="text-[#F5C842] font-black text-xs mt-1.5">{course.price.toLocaleString()} د.ع</p>
                  </div>
                  <div className="flex flex-col gap-1.5 absolute left-3 top-3">
                    <button onClick={() => handleEditClick(course)} className="p-1.5 bg-gray-50 dark:bg-zinc-800 rounded-lg text-gray-600 dark:text-gray-300 active:scale-90 transition-all shadow-sm">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDeleteCourse(course.id)} className="p-1.5 bg-red-50 dark:bg-red-500/10 rounded-lg text-red-500 active:scale-90 transition-all shadow-sm">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Course Curriculum Toggle */}
                <div 
                  className="px-4 py-2 bg-gray-50 dark:bg-zinc-800/50 border-t border-gray-100 dark:border-zinc-800 flex justify-between items-center cursor-pointer active:bg-gray-100 dark:active:bg-zinc-800 transition-colors"
                  onClick={() => setExpandedCourse(expandedCourse === course.id ? null : course.id)}
                >
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">إدارة الدروس (المنهج)</span>
                  {expandedCourse === course.id ? (
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </div>

                {/* Curriculum Editor */}
                {expandedCourse === course.id && (
                  <div className="p-4 border-t border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 animate-in slide-in-from-top-2">
                    
                    {/* List of lessons */}
                    <div className="space-y-2 mb-4">
                      {(course.curriculum || []).map((lesson, idx) => (
                        <div key={lesson.id} className="flex items-center gap-2 bg-gray-50 dark:bg-zinc-800/80 p-2 rounded-xl border border-gray-100 dark:border-zinc-700">
                          <div className="w-6 h-6 rounded-full bg-white dark:bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-gray-500">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">{lesson.title}</p>
                            <div className="flex gap-2 text-[9px] text-gray-500 mt-0.5">
                              <span>{lesson.duration}</span>
                              {lesson.free && <span className="text-green-500 font-bold">مجاني</span>}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button 
                              onClick={() => {
                                setEditingLessonId(lesson.id);
                                setLessonTitle(lesson.title);
                                setLessonVideoId(lesson.videoId);
                                setLessonDuration(lesson.duration);
                                setLessonFree(lesson.free);
                              }}
                              className="p-1.5 text-gray-500 bg-white dark:bg-zinc-700 rounded-lg shadow-sm"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleDeleteLesson(course.id, lesson.id)}
                              className="p-1.5 text-red-500 bg-red-50 dark:bg-red-500/10 rounded-lg shadow-sm"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {(!course.curriculum || course.curriculum.length === 0) && (
                        <p className="text-xs text-center text-gray-400 py-2">لا توجد دروس مضافة لهذه الدورة بعد.</p>
                      )}
                    </div>

                    {/* Add/Edit Lesson Form */}
                    <div className="bg-gray-50 dark:bg-zinc-950 p-3 rounded-2xl border border-dashed border-gray-200 dark:border-zinc-800">
                      <h4 className="text-xs font-bold mb-3 flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                        {editingLessonId ? <><Edit2 className="w-3.5 h-3.5" /> تعديل الدرس</> : <><Plus className="w-3.5 h-3.5" /> إضافة درس جديد</>}
                      </h4>
                      <div className="space-y-2.5">
                        <input
                          type="text"
                          placeholder="عنوان الدرس"
                          value={lessonTitle}
                          onChange={(e) => setLessonTitle(e.target.value)}
                          className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#F5C842]"
                        />
                        <input
                          type="text"
                          placeholder="معرف فيديو يوتيوب (Video ID) مثل dQw4w9WgXcQ"
                          value={lessonVideoId}
                          onChange={(e) => setLessonVideoId(e.target.value)}
                          className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#F5C842]"
                        />
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="المدة (مثال: 12:45)"
                            value={lessonDuration}
                            onChange={(e) => setLessonDuration(e.target.value)}
                            className="flex-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#F5C842]"
                          />
                          <label className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={lessonFree}
                              onChange={(e) => setLessonFree(e.target.checked)}
                              className="w-3.5 h-3.5 accent-[#F5C842]"
                            />
                            <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300">مجاني؟</span>
                          </label>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={() => handleSaveLesson(course.id)}
                            disabled={isSavingLesson || !lessonTitle || !lessonVideoId || !lessonDuration}
                            className="flex-1 bg-gray-900 dark:bg-white text-white dark:text-black text-xs font-bold rounded-xl py-2.5 flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-50"
                          >
                            {isSavingLesson ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            حفظ الدرس
                          </button>
                          {editingLessonId && (
                            <button
                              onClick={() => {
                                setEditingLessonId(null);
                                setLessonTitle("");
                                setLessonVideoId("");
                                setLessonDuration("");
                                setLessonFree(false);
                              }}
                              className="px-3 bg-red-50 text-red-500 rounded-xl text-xs font-bold active:scale-95"
                            >
                              إلغاء
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      </div>

      {/* ── Main Course Form Modal ── */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in p-4">
          <div className="bg-white dark:bg-zinc-950 w-full max-w-md max-h-[90vh] rounded-3xl p-6 overflow-y-auto animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black">{editingCourse ? "تعديل الدورة" : "إضافة دورة جديدة"}</h2>
              <button onClick={resetForm} className="p-2 bg-gray-100 dark:bg-zinc-800 rounded-full text-gray-500 active:scale-90 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveCourse} className="space-y-4">
              {/* Image Upload Professional Dropzone */}
              <div className="flex flex-col items-center w-full">
                <label className="w-full h-40 bg-gray-50 dark:bg-zinc-900 border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-3xl flex flex-col items-center justify-center cursor-pointer overflow-hidden relative group hover:bg-gray-100 dark:hover:bg-zinc-800/80 transition-colors">
                  {imageFile ? (
                    <div className="relative w-full h-full flex items-center justify-center bg-black/5">
                      <img src={URL.createObjectURL(imageFile)} alt="Preview" className="h-full object-contain" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white text-sm font-bold flex items-center gap-2"><Edit2 className="w-4 h-4"/> تغيير الصورة</span>
                      </div>
                    </div>
                  ) : editingCourse?.thumbnail ? (
                    <div className="relative w-full h-full flex items-center justify-center bg-black/5">
                      <img src={editingCourse.thumbnail} alt="Current" className="h-full object-contain" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white text-sm font-bold flex items-center gap-2"><Edit2 className="w-4 h-4"/> تغيير الصورة</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-6 text-center">
                      <div className="w-14 h-14 bg-yellow-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <UploadCloud className="w-7 h-7 text-[#F5C842]" />
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-300 font-bold mb-1">اضغط أو اسحب الصورة هنا</span>
                      <span className="text-[10px] text-gray-500">سيتم ضغط غلاف الدورة تلقائياً</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} className="hidden" />
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">عنوان الدورة</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#F5C842]/30 focus:border-[#F5C842] transition-all outline-none"
                  placeholder="مثال: أساسيات التزيين بالكريمة..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">السعر (د.ع)</label>
                  <input
                    type="number"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#F5C842]/30 focus:border-[#F5C842] transition-all outline-none"
                    placeholder="مثال: 75000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">المستوى</label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#F5C842]/30 focus:border-[#F5C842] transition-all outline-none"
                  >
                    <option value="مبتدئ">مبتدئ</option>
                    <option value="متوسط">متوسط</option>
                    <option value="متقدم">متقدم</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">رابط فيديو المقدمة (YouTube URL)</label>
                <input
                  type="url"
                  required
                  value={youtubeLink}
                  onChange={(e) => setYoutubeLink(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#F5C842]/30 focus:border-[#F5C842] transition-all outline-none"
                  placeholder="https://youtube.com/watch?v=..."
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">وصف الدورة</label>
                <textarea
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full h-24 resize-none bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#F5C842]/30 focus:border-[#F5C842] transition-all outline-none"
                  placeholder="تفاصيل ما سيتعلمه الطالب في هذه الدورة..."
                />
              </div>

              <button
                type="submit"
                disabled={uploading}
                className="w-full bg-[#F5C842] text-white rounded-xl py-3.5 mt-6 font-black shadow-lg shadow-yellow-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    {editingCourse ? "حفظ التعديلات" : "إضافة الدورة"}
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
