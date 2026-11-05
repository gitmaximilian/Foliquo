// Localized display text for app-authored clarification prompts. Canonical
// question/context IDs stay untouched so saved answers and unreadable matches
// remain stable when the interface language changes.
window.TOCRQuestionCopy=(question,locale='en')=>{
 const q=question||{},language=['en','de','ar'].includes(locale)?locale:'en';
 const source=String(q.source||q.context||'').replace(/^Namensabgleich:\s*/,'').replace(/^Unleserliche Stelle:\s*/,'');
 if(q.kind==='personal-rule')return language==='en'?'Your approved rules conflict. Which rule should apply to this job? Enter its number.':language==='ar'?'تتعارض قواعدك المعتمدة. أي قاعدة تريد تطبيقها على هذه المهمة؟ أدخل رقمها.':q.question;
 if(q.kind==='personal-rule-scope'){const labels=language==='ar'?{sourceLanguage:'لغة المصدر',targetLanguage:'اللغة المستهدفة',documentType:'نوع المستند'}:{sourceLanguage:'source language',targetLanguage:'target language',documentType:'document type'};return language==='de'?q.question:language==='ar'?`يرجى تحديد ${labels[q.scopeField]||'النطاق'} للتحقق من القواعد المحفوظة.`:`Please specify the ${labels[q.scopeField]||'scope'} to check the saved rules.`;}
 if(q.kind==='learning-layout')return language==='en'?'Your approved samples have different layout settings. Which sample should apply to this job? Enter its number or sample name.':language==='ar'?'تختلف إعدادات التنسيق في نماذجك المعتمدة. أي نموذج تريد تطبيقه على هذه المهمة؟ أدخل رقمه أو اسمه.':q.question;
 if(q.kind==='name'){
  if(language==='en')return `Which Latin-script spelling of “${source}” appears in the passport, or should be used after verification?`;
  if(language==='ar')return `ما هي كتابة الاسم بالأحرف اللاتينية لـ «${source}» كما تظهر في جواز السفر أو التي ينبغي استخدامها بعد التحقق؟`;
  return `Welche lateinische Schreibweise von „${source}“ steht im Pass oder soll nach Prüfung verwendet werden?`;
 }
 if(q.kind==='unreadable'){
  if(language==='en')return `Please read “${source}” or add a clearer image of this area.`;
  if(language==='ar')return `يرجى قراءة «${source}» أو إضافة صورة أوضح لهذا الموضع.`;
  return `Bitte „${source}“ entziffern oder eine bessere Aufnahme dieser Stelle ergänzen.`;
 }
 if(/Die Sprache konnte nicht eindeutig erkannt werden/i.test(q.context||'')){
  return language==='en'?'Which source language is this document written in?':language==='ar'?'ما لغة المصدر المكتوب بها هذا المستند؟':'Welche Ausgangssprache hat dieses Dokument?';
 }
 return q.question||'';
};
