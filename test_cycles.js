const monthNames = ["كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران", "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول"];
const now = new Date("2026-08-14T21:00:00");
let currentCycleStartMonth = now.getMonth(); // 7
let currentCycleStartYear = now.getFullYear(); // 2026
const startDay = 12;

let validBoundaries = [];
let d = new Date(currentCycleStartYear, currentCycleStartMonth, startDay); // 2026-08-12
if (d > now) {
  d = new Date(currentCycleStartYear, currentCycleStartMonth - 1, startDay);
}
for (let m = 0; m < 24; m++) {
  validBoundaries.push(new Date(d));
  d.setMonth(d.getMonth() - 1);
}
let allBoundaries = [...validBoundaries].sort((a, b) => b.getTime() - a.getTime());
let arr = [];
for (let i = 1; i < allBoundaries.length && arr.length < 24; i++) {
  const endBoundary = allBoundaries[i - 1];
  const startBoundary = allBoundaries[i];
  
  const startMonth = startBoundary.getMonth() + 1;
  const startYear = startBoundary.getFullYear();
  const startDayStr = startBoundary.getDate();
  const endMonth = endBoundary.getMonth() + 1;
  const endDay = endBoundary.getDate() - 1;
  const startMonthName = monthNames[startBoundary.getMonth()];
  
  const cycleName = `دورة ${startMonthName} ${startYear} (${startDayStr}/${startMonth} - ${endDay}/${endMonth})`;
  
  arr.push({
    id: `cycle_${startBoundary.getTime()}`,
    name: cycleName,
    start: startBoundary.toISOString(),
    end: endBoundary.toISOString()
  });
}
console.log(arr[0]);
console.log(arr[1]);
