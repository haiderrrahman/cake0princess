const settings = {};
const arr = [];
const now = new Date("2026-08-14T20:00:00Z");
let currentCycleStartMonth = now.getMonth();
let currentCycleStartYear = now.getFullYear();

if (now.getDate() < 12) {
  currentCycleStartMonth -= 1;
  if (currentCycleStartMonth < 0) {
    currentCycleStartMonth = 11;
    currentCycleStartYear -= 1;
  }
}

const arMonths = ["كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران", "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول"];

const boundaries = [];
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
  boundaries.push(new Date(year, month, 12));
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
    id: `${startD.getFullYear()}-${String(startD.getMonth() + 1).padStart(2, '0')}-${startD.getDate()}`,
    label: `دورة ${arMonths[startD.getMonth()]} ${startD.getFullYear()} (${startD.getDate()}/${startD.getMonth() + 1} - ${endD.getDate()}/${endD.getMonth() + 1})`
  });
}
console.log(arr.length);
console.log(arr.slice(0, 3));
