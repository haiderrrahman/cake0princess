const fs = require('fs');
const lines = fs.readFileSync('src/app/admin/home-finance/page.tsx', 'utf8').split('\n');

console.log("Quick Actions start:", lines[2294]);
console.log("Quick Actions end:", lines[2317]);

console.log("Alerts start:", lines[2320]);
console.log("Alerts end:", lines[2348]);

console.log("Decor start:", lines[2349]);
console.log("Decor end:", lines[2351]);

console.log("Family start:", lines[2352]);
console.log("Family end:", lines[2357]);

console.log("Fin start:", lines[2358]);
console.log("Fin end:", lines[2563]);
