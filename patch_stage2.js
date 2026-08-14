const fs = require('fs');
const file = 'src/app/admin/home-finance/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. cycles useMemo replacement
const oldCycles = `  const cycles = useMemo(() => {
    const arr: Cycle[] = [];
    const now = new Date();
    let currentCycleStartMonth = now.getMonth();
    let currentCycleStartYear = now.getFullYear();
    
    // إذا كان اليوم أقل من 10، نعتبر الدورة بدأت الشهر الماضي
    if (now.getDate() < 10) {
      currentCycleStartMonth -= 1;
      if (currentCycleStartMonth < 0) {
        currentCycleStartMonth = 11;
        currentCycleStartYear -= 1;
      }
    }

    const arMonths = ["كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران", "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول"];
    
    for (let i = 0; i < 24; i++) { // نعرض 24 دورة سابقة (سنتين)
      let month = currentCycleStartMonth - i;
      let year = currentCycleStartYear;
      while (month < 0) {
        month += 12;
        year -= 1;
      }
      
      const startDate = new Date(year, month, 10);
      const endDate = new Date(year, month + 1, 9, 23, 59, 59, 999);
      
      arr.push({
        id: \`\${year}-\${String(month + 1).padStart(2, '0')}\`,
        label: \`دورة \${arMonths[month]} \${year} (\${startDate.getDate()}/\${startDate.getMonth() + 1} - \${endDate.getDate()}/\${endDate.getMonth() + 1})\`,
        start: startDate,
        end: endDate
      });
    }

    return arr;
  }, []);`;

const newCycles = `  const cycles = useMemo(() => {
    const arr: Cycle[] = [];
    const now = new Date();
    let currentCycleStartMonth = now.getMonth();
    let currentCycleStartYear = now.getFullYear();
    
    if (now.getDate() < 10) {
      currentCycleStartMonth -= 1;
      if (currentCycleStartMonth < 0) {
        currentCycleStartMonth = 11;
        currentCycleStartYear -= 1;
      }
    }

    const arMonths = ["كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران", "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول"];
    
    const boundaries: Date[] = [];
    for (let i = -1; i <= 24; i++) {
      let month = currentCycleStartMonth - i;
      let year = currentCycleStartYear;
      while (month < 0) {
        month += 12;
        year -= 1;
      }
      while (month > 11) {
        month -= 12;
        year += 1;
      }
      boundaries.push(new Date(year, month, 10));
    }

    const manualDates = (settings.manualCycleStarts || []).map(ds => new Date(ds));
    
    const validBoundaries = boundaries.filter(b => {
      return !manualDates.some(md => md.getFullYear() === b.getFullYear() && md.getMonth() === b.getMonth());
    });
    
    const allBoundaries = [...validBoundaries, ...manualDates].sort((a,b) => b.getTime() - a.getTime());

    for (let i = 1; i < allBoundaries.length && arr.length < 24; i++) {
      const endD = new Date(allBoundaries[i-1].getTime() - 1);
      const startD = allBoundaries[i];
      if (startD > now && endD > now) continue;
      arr.push({
        id: \`\${startD.getFullYear()}-\${String(startD.getMonth() + 1).padStart(2, '0')}-\${startD.getDate()}\`,
        label: \`دورة \${arMonths[startD.getMonth()]} \${startD.getFullYear()} (\${startD.getDate()}/\${startD.getMonth() + 1} - \${endD.getDate()}/\${endD.getMonth() + 1})\`,
        start: startD,
        end: endD
      });
    }

    return arr;
  }, [settings]);`;

content = content.replace(oldCycles, newCycles);

// 2. Button for Ending Cycle Manually
const oldCycleButton = `            <ClipboardCopy className="w-4 h-4" />\n            تصدير ونسخ تقرير الدورة\n          </button>\n        </div>`;
const newCycleButton = `            <ClipboardCopy className="w-4 h-4" />\n            تصدير ونسخ تقرير الدورة\n          </button>\n          \n          <button \n            onClick={() => {\n              if (confirm("هل أنت متأكد من إنهاء الدورة الحالية وبدء دورة جديدة الآن؟")) {\n                const newManualStarts = [...(settings.manualCycleStarts || []), new Date().toISOString()];\n                syncToFirebase("settings", { ...settings, manualCycleStarts: newManualStarts });\n                toast.success("تم بدء دورة جديدة يدوياً!");\n              }\n            }}\n            className="w-full md:w-auto bg-blue-600/50 hover:bg-blue-600 border border-blue-400/50 text-white rounded-xl px-4 py-2 text-xs font-bold transition flex items-center justify-center gap-2"\n          >\n            إنهاء الدورة يدوياً\n          </button>\n        </div>`;

content = content.replace(oldCycleButton, newCycleButton);

fs.writeFileSync(file, content);
console.log('Stage 2 done.');
