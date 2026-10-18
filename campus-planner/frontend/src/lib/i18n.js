// English is the source of truth; Bengali falls back to English for any missing key.
export const DICT = {
  en: {
    'nav.routine': 'Routine', 'nav.cgpa': 'CGPA', 'nav.admin': 'Admin', 'nav.account': 'Account',
    'nav.signin': 'Sign in', 'nav.signout': 'Sign out', 'nav.main': 'Main',
    'adminOnly': 'This area is for administrators.',
    'theme.toLight': 'Switch to light theme', 'theme.toDark': 'Switch to dark theme', 'lang.switch': 'বাংলা',
    'lang.aria': 'Switch language to Bengali',

    'routine.updatedOn': 'Updated on {d}', 'routine.none': 'No routine uploaded yet',
    'routine.semester': 'Semester {a} to {b}', 'routine.ics': '.ics file', 'routine.subscribe': 'Subscribe link',
    'routine.subscribeTitle': 'Live link: your calendar app updates itself when the routine changes',
    'routine.image': 'Image', 'routine.print': 'PDF / Print',
    'routine.offline': 'You are offline. Showing the last routine saved on this device.',
    'routine.copied': 'Link copied. In Google Calendar: Other calendars → From URL',
    'routine.copyThis': 'Copy this link: {u}', 'routine.imgFail': 'Could not create the image. Use PDF / Print instead.',
    'routine.updatedToast': 'Routine just updated', 'routine.newNotice': 'New notice: {t}',

    'filter.department': 'Department', 'filter.batch': 'Batch', 'filter.section': 'Section', 'filter.teacher': 'Teacher',
    'filter.allDepartments': 'All departments', 'filter.allBatches': 'All batches', 'filter.allSections': 'All sections',
    'filter.anyTeacher': 'Any teacher',

    'grid.none': 'No classes found for this selection yet.', 'grid.agenda': 'Weekly agenda',
    'day.Sat': 'Saturday', 'day.Sun': 'Sunday', 'day.Mon': 'Monday', 'day.Tue': 'Tuesday', 'day.Wed': 'Wednesday',
    'day.Thu': 'Thursday', 'day.Fri': 'Friday',
    'kind.theory': 'Theory', 'kind.lab': 'Lab', 'kind.elective': 'Elective', 'kind.project': 'Project',
    'kind.exam': 'Exam / Substitute',
    'kindShort.theory': 'Theory', 'kindShort.lab': 'Lab', 'kindShort.elective': 'Elective', 'kindShort.project': 'Project',
    'kindShort.exam': 'Exam',

    'auth.welcome': 'Welcome back', 'auth.create': 'Create your account', 'auth.name': 'Name', 'auth.email': 'Email',
    'auth.password': 'Password', 'auth.pwMin': '(min 8 characters)', 'auth.wait': 'Please wait…',
    'auth.signin': 'Sign in', 'auth.signup': 'Sign up', 'auth.newHere': 'New here? Create an account',
    'auth.haveAccount': 'Have an account? Sign in',

    'cgpa.semesters': 'Semesters', 'cgpa.report': 'Download report', 'cgpa.semesterName': 'Semester name',
    'cgpa.sgpa': 'SGPA', 'cgpa.unsaved': 'unsaved', 'cgpa.save': 'Save', 'cgpa.saving': 'Saving…',
    'cgpa.deleteSemester': 'Delete semester', 'cgpa.course': 'Course', 'cgpa.credits': 'Credits', 'cgpa.grade': 'Grade',
    'cgpa.courseName': 'Course name', 'cgpa.notInGpa': 'Not in GPA', 'cgpa.removeCourse': 'Remove course',
    'cgpa.addCourse': 'Add course', 'cgpa.addSemester': 'Add semester', 'cgpa.defaultName': 'Semester {n}',
    'cgpa.saved': 'Semester saved',
    'cgpa.retakeNote': 'Retaking a course? Enter it again with the same name. Only the latest attempt counts toward CGPA. P, W and I grades are ignored; T adds credits earned without grade points.',
    'cgpa.cumulative': 'Cumulative CGPA', 'cgpa.earned': 'Earned credits', 'cgpa.status': 'Status',
    'cgpa.trend': 'Performance trend', 'cgpa.trendEmpty': 'Add courses to see your trend.',
    'cgpa.trendAria': 'Line chart of SGPA and CGPA per semester', 'cgpa.distribution': 'Grade distribution',
    'cgpa.distAria': 'Bar chart of number of courses per grade', 'cgpa.courses': 'Courses',
    'status.Good': 'Good', 'status.Improving': 'Improving', 'status.Critical': 'Critical',

    'target.title': 'Target planner', 'target.cgpa': 'Target CGPA', 'target.credits': 'Next semester credits',
    'target.addGraded': 'Add graded courses to plan ahead.',
    'target.stays': 'Your CGPA stays above {t} even with a very low SGPA next semester.',
    'target.need': 'You need an SGPA of {n} next semester.',
    'target.no': 'Not reachable in one semester: it would need an SGPA of {n} and the maximum is {m}.',

    'account.change': 'Change password', 'account.current': 'Current password', 'account.new': 'New password (min 8 characters)',
    'account.update': 'Update password', 'account.saving': 'Saving…',
    'account.changed': 'Password changed. Other devices were signed out.',
  },
  bn: {
    'nav.routine': 'রুটিন', 'nav.cgpa': 'সিজিপিএ', 'nav.admin': 'অ্যাডমিন', 'nav.account': 'অ্যাকাউন্ট',
    'nav.signin': 'সাইন ইন', 'nav.signout': 'সাইন আউট', 'nav.main': 'প্রধান মেনু',
    'adminOnly': 'এই অংশ শুধু অ্যাডমিনদের জন্য।',
    'theme.toLight': 'লাইট থিম চালু করুন', 'theme.toDark': 'ডার্ক থিম চালু করুন', 'lang.switch': 'English',
    'lang.aria': 'ভাষা ইংরেজিতে পরিবর্তন করুন',

    'routine.updatedOn': 'হালনাগাদ: {d}', 'routine.none': 'এখনও কোনো রুটিন আপলোড করা হয়নি',
    'routine.semester': 'সেমিস্টার {a} থেকে {b}', 'routine.ics': '.ics ফাইল', 'routine.subscribe': 'সাবস্ক্রাইব লিংক',
    'routine.subscribeTitle': 'লাইভ লিংক: রুটিন বদলালে আপনার ক্যালেন্ডার অ্যাপ নিজে থেকেই আপডেট হবে',
    'routine.image': 'ছবি', 'routine.print': 'পিডিএফ / প্রিন্ট',
    'routine.offline': 'আপনি অফলাইনে আছেন। এই ডিভাইসে সংরক্ষিত সর্বশেষ রুটিন দেখানো হচ্ছে।',
    'routine.copied': 'লিংক কপি হয়েছে। গুগল ক্যালেন্ডারে: Other calendars → From URL',
    'routine.copyThis': 'এই লিংকটি কপি করুন: {u}', 'routine.imgFail': 'ছবি তৈরি করা যায়নি। এর বদলে পিডিএফ / প্রিন্ট ব্যবহার করুন।',
    'routine.updatedToast': 'রুটিন এইমাত্র হালনাগাদ হয়েছে', 'routine.newNotice': 'নতুন নোটিশ: {t}',

    'filter.department': 'বিভাগ', 'filter.batch': 'ব্যাচ', 'filter.section': 'সেকশন', 'filter.teacher': 'শিক্ষক',
    'filter.allDepartments': 'সব বিভাগ', 'filter.allBatches': 'সব ব্যাচ', 'filter.allSections': 'সব সেকশন',
    'filter.anyTeacher': 'যেকোনো শিক্ষক',

    'grid.none': 'এই নির্বাচনের জন্য এখনও কোনো ক্লাস পাওয়া যায়নি।', 'grid.agenda': 'সাপ্তাহিক তালিকা',
    'day.Sat': 'শনিবার', 'day.Sun': 'রবিবার', 'day.Mon': 'সোমবার', 'day.Tue': 'মঙ্গলবার', 'day.Wed': 'বুধবার',
    'day.Thu': 'বৃহস্পতিবার', 'day.Fri': 'শুক্রবার',
    'kind.theory': 'তত্ত্বীয়', 'kind.lab': 'ল্যাব', 'kind.elective': 'ঐচ্ছিক', 'kind.project': 'প্রজেক্ট',
    'kind.exam': 'পরীক্ষা / বিকল্প ক্লাস',
    'kindShort.theory': 'তত্ত্বীয়', 'kindShort.lab': 'ল্যাব', 'kindShort.elective': 'ঐচ্ছিক', 'kindShort.project': 'প্রজেক্ট',
    'kindShort.exam': 'পরীক্ষা',

    'auth.welcome': 'আবার স্বাগতম', 'auth.create': 'অ্যাকাউন্ট খুলুন', 'auth.name': 'নাম', 'auth.email': 'ইমেইল',
    'auth.password': 'পাসওয়ার্ড', 'auth.pwMin': '(কমপক্ষে ৮ অক্ষর)', 'auth.wait': 'একটু অপেক্ষা করুন…',
    'auth.signin': 'সাইন ইন', 'auth.signup': 'সাইন আপ', 'auth.newHere': 'নতুন? অ্যাকাউন্ট খুলুন',
    'auth.haveAccount': 'অ্যাকাউন্ট আছে? সাইন ইন করুন',

    'cgpa.semesters': 'সেমিস্টার', 'cgpa.report': 'রিপোর্ট ডাউনলোড', 'cgpa.semesterName': 'সেমিস্টারের নাম',
    'cgpa.sgpa': 'এসজিপিএ', 'cgpa.unsaved': 'সংরক্ষিত নয়', 'cgpa.save': 'সংরক্ষণ', 'cgpa.saving': 'সংরক্ষণ হচ্ছে…',
    'cgpa.deleteSemester': 'সেমিস্টার মুছুন', 'cgpa.course': 'কোর্স', 'cgpa.credits': 'ক্রেডিট', 'cgpa.grade': 'গ্রেড',
    'cgpa.courseName': 'কোর্সের নাম', 'cgpa.notInGpa': 'জিপিএতে ধরা হয় না', 'cgpa.removeCourse': 'কোর্স সরান',
    'cgpa.addCourse': 'কোর্স যোগ করুন', 'cgpa.addSemester': 'সেমিস্টার যোগ করুন', 'cgpa.defaultName': 'সেমিস্টার {n}',
    'cgpa.saved': 'সেমিস্টার সংরক্ষিত হয়েছে',
    'cgpa.retakeNote': 'কোনো কোর্স আবার নিচ্ছেন? একই নামে আবার লিখুন। সিজিপিএতে শুধু সর্বশেষ চেষ্টা গণ্য হয়। P, W ও I গ্রেড হিসাবে ধরা হয় না; T শুধু অর্জিত ক্রেডিট যোগ করে, গ্রেড পয়েন্ট নয়।',
    'cgpa.cumulative': 'ক্রমযোজিত সিজিপিএ', 'cgpa.earned': 'অর্জিত ক্রেডিট', 'cgpa.status': 'অবস্থা',
    'cgpa.trend': 'ফলাফলের ধারা', 'cgpa.trendEmpty': 'ধারা দেখতে কোর্স যোগ করুন।',
    'cgpa.trendAria': 'প্রতি সেমিস্টারের এসজিপিএ ও সিজিপিএ-র লাইন চার্ট', 'cgpa.distribution': 'গ্রেডের বণ্টন',
    'cgpa.distAria': 'প্রতিটি গ্রেডে কোর্সের সংখ্যার বার চার্ট', 'cgpa.courses': 'কোর্স',
    'status.Good': 'ভালো', 'status.Improving': 'উন্নতি হচ্ছে', 'status.Critical': 'সংকটজনক',

    'target.title': 'লক্ষ্য পরিকল্পনা', 'target.cgpa': 'লক্ষ্যমাত্রার সিজিপিএ', 'target.credits': 'পরের সেমিস্টারের ক্রেডিট',
    'target.addGraded': 'আগে থেকে পরিকল্পনা করতে গ্রেডসহ কোর্স যোগ করুন।',
    'target.stays': 'পরের সেমিস্টারে খুব কম এসজিপিএ হলেও আপনার সিজিপিএ {t}-এর উপরে থাকবে।',
    'target.need': 'পরের সেমিস্টারে আপনার এসজিপিএ লাগবে {n}।',
    'target.no': 'এক সেমিস্টারে সম্ভব নয়: এসজিপিএ লাগত {n}, কিন্তু সর্বোচ্চ {m}।',

    'account.change': 'পাসওয়ার্ড পরিবর্তন', 'account.current': 'বর্তমান পাসওয়ার্ড', 'account.new': 'নতুন পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)',
    'account.update': 'পাসওয়ার্ড আপডেট করুন', 'account.saving': 'সংরক্ষণ হচ্ছে…',
    'account.changed': 'পাসওয়ার্ড বদলেছে। অন্য ডিভাইসগুলো থেকে সাইন আউট করা হয়েছে।',
  },
}

export function translate(lang, key, vars) {
  let s = DICT[lang]?.[key] ?? DICT.en[key] ?? key
  if (vars) for (const k of Object.keys(vars)) s = s.replaceAll(`{${k}}`, vars[k])
  return s
}
