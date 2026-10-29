import crypto from 'node:crypto';
const h = (p) => crypto.createHash('sha256').update('jansewa:' + p).digest('hex');
export const OFFICE = { hi: 'तहसील मथुरा, ज़िला मथुरा', en: 'Mathura Tehsil, Mathura District' };
// Demo accounts (prototype): all share one demo password, stored only as a hash.
export const USERS = {
  officer: { id: 'officer', role: 'officer', name: { hi: 'श्री अजय प्रताप सिंह', en: 'Shri Ajay Pratap Singh' }, designation: { hi: 'नायब तहसीलदार', en: 'Naib Tehsildar' }, hash: h('Jansewa@123') },
  officer2: { id: 'officer2', role: 'officer', name: { hi: 'श्रीमती नीलम वर्मा', en: 'Smt. Neelam Verma' }, designation: { hi: 'नायब तहसीलदार', en: 'Naib Tehsildar' }, hash: h('Jansewa@123') },
  supervisor: { id: 'supervisor', role: 'supervisor', name: { hi: 'श्री राजेश तिवारी', en: 'Shri Rajesh Tiwari' }, designation: { hi: 'तहसीलदार', en: 'Tehsildar' }, hash: h('Jansewa@123') },
};
export const checkPassword = (u, p) => { const a = Buffer.from(h(String(p))), b = Buffer.from(u.hash); return a.length === b.length && crypto.timingSafeEqual(a, b); };
export const publicUser = (u, prefs) => ({ id: u.id, role: u.role, name: u.name, designation: u.designation, office: OFFICE, onboarded: !!prefs?.onboarded });
