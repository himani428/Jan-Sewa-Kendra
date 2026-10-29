// Display-language dictionary for fictional names/places. Stored data stays in one canonical form (Devanagari).
export const POOL = [
  ['अशोक कुमार', 'Ashok Kumar', 'रामदीन', 'Ramdeen', 'सादाबाद', 'Sadabad'], ['रीना देवी', 'Reena Devi', 'स्व. हरिओम', 'Late Hariom', 'बरसाना', 'Barsana'],
  ['सुरेश चंद', 'Suresh Chand', 'मानसिंह', 'Mansingh', 'कोसी कलाँ', 'Kosi Kalan'], ['प्रेमवती', 'Premwati', 'स्व. बनवारी', 'Late Banwari', 'गोकुल', 'Gokul'],
  ['विनोद कुमार', 'Vinod Kumar', 'दयाराम', 'Dayaram', 'महावन', 'Mahavan'], ['शकुंतला देवी', 'Shakuntala Devi', 'स्व. नत्थू सिंह', 'Late Natthu Singh', 'बल्देव', 'Baldeo'],
  ['धर्मेंद्र सिंह', 'Dharmendra Singh', 'भगवान सिंह', 'Bhagwan Singh', 'राया', 'Raya'], ['सीमा रानी', 'Seema Rani', 'स्व. रघुवीर', 'Late Raghuveer', 'फरह', 'Farah'],
  ['योगेश शर्मा', 'Yogesh Sharma', 'हरिशंकर शर्मा', 'Harishankar Sharma', 'छाता', 'Chhata'], ['राधा देवी', 'Radha Devi', 'स्व. मुरारी', 'Late Murari', 'गोवर्धन', 'Govardhan'],
  ['नरेश पाल', 'Naresh Pal', 'चंद्रपाल', 'Chandrapal', 'सौंख', 'Saunkh'], ['कविता सिंह', 'Kavita Singh', 'स्व. उदयवीर', 'Late Udayveer', 'मांट', 'Mant'],
];
const base = {
  'रमेश चंद': 'Ramesh Chand', 'हरि सिंह': 'Hari Singh', 'नगला बीच': 'Nagla Beech', 'सुनीता देवी': 'Sunita Devi', 'स्व. मोहन लाल': 'Late Mohan Lal', 'मोहन लाल': 'Mohan Lal',
  'बल्देव': 'Baldeo', 'पवन कुमार शर्मा': 'Pawan Kumar Sharma', 'ओमप्रकाश शर्मा': 'Omprakash Sharma', 'राया': 'Raya', 'गीता रानी': 'Geeta Rani', 'गिता रानी': 'Gita Rani',
  'स्व. बाबूराम': 'Late Baburam', 'बाबूराम': 'Baburam', 'फरह': 'Farah', 'मुकेश यादव': 'Mukesh Yadav', 'रामस्वरूप यादव': 'Ramswaroop Yadav', 'अकबरपुर': 'Akbarpur',
  'अनीता सिंह': 'Anita Singh', 'सत्यपाल सिंह': 'Satyapal Singh', 'मांट': 'Mant', 'राजवीर सिंह': 'Rajveer Singh', 'स्व. करन सिंह': 'Late Karan Singh', 'करन सिंह': 'Karan Singh',
  'छाता': 'Chhata', 'हरपाल सिंह': 'Harpal Singh', 'गजराज सिंह': 'Gajraj Singh', 'गोवर्धन': 'Govardhan', 'कमला देवी': 'Kamla Devi', 'स्व. रामभरोसे': 'Late Rambharose',
  'रामभरोसे': 'Rambharose', 'नौहझील': 'Naujheel', 'दिनेश गुप्ता': 'Dinesh Gupta', 'दिनेश कुमार गुप्ता': 'Dinesh Kumar Gupta', 'लक्ष्मण प्रसाद गुप्ता': 'Laxman Prasad Gupta',
  'सौंख': 'Saunkh', 'पूनम देवी': 'Poonam Devi', 'स्व. जगदीश': 'Late Jagdish', 'जगदीश': 'Jagdish', 'सोहनलाल': 'Sohanlal', 'पन्नालाल': 'Pannalal', 'मीना कुमारी': 'Meena Kumari',
  'स्व. देवीसिंह': 'Late Devisingh', 'देवीसिंह': 'Devisingh', 'बृजेश कुमार': 'Brijesh Kumar', 'किशनलाल': 'Kishanlal', 'जितेंद्र सिंह': 'Jitendra Singh', 'भूरे सिंह': 'Bhure Singh',
};
export const T = { ...base };
for (const [a, ae, f, fe, v, ve] of POOL) { T[a] = ae; T[f] = fe; T[f.replace('स्व. ', '')] = fe.replace('Late ', ''); T[v] = ve; }
export const L = (s) => (s == null ? s : { hi: s, en: T[s] ?? s });
