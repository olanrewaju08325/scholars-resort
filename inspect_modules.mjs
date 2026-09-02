import fs from 'fs';

console.log("=== INSPECTING STUDENT PAGES ===");
const studentPages = fs.readdirSync('./src/pages');
studentPages.forEach(p => console.log(`- ${p}`));

console.log("\n=== INSPECTING ADMIN TABS ===");
const adminTabs = fs.readdirSync('./src/pages/admin-tabs');
adminTabs.forEach(t => console.log(`- ${t}`));

console.log("\n=== INSPECTING SERVICES ===");
const services = fs.readdirSync('./src/services');
services.forEach(s => console.log(`- ${s}`));
