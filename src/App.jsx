import { useEffect, useState } from "react";
import "./App.css";
import { supabase } from "./lib/supabaseClient";

function App() {
  const [page, setPage] = useState("login");

  // ================= LOGIN STATUS =================

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  // ================= LOCAL STORAGE =================
  const ACCOUNTS_KEY = "classmate_accounts";
  const SESSION_KEY = "classmate_session";
  const LANGUAGE_KEY = "classmate_language";
  const NOTIFICATIONS_KEY = "classmate_notifications";
  const BROWSER_NOTIFICATION_SENT_KEY = "classmate_browser_notification_sent";

  const getAccounts = () => {
    try {
      return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "{}");
    } catch {
      return {};
    }
  };

  const saveAccounts = (accounts) => {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  };

  // ================= LANGUAGE =================

  const [language, setLanguage] = useState(() => {
    return localStorage.getItem(LANGUAGE_KEY) || "en";
  });

  const toggleLanguage = () => {
    setLanguage((current) => {
      const next = current === "en" ? "th" : "en";
      localStorage.setItem(LANGUAGE_KEY, next);
      return next;
    });
  };

  // ================= SETTINGS =================

  const SETTINGS_KEY = "classmate_settings";

  const defaultSettings = {
    theme: "light",
    timeFormat: "24",
    weekStart: "monday",
    compactSchedule: false,
    notifications: true,
  };

  const [settings, setSettings] = useState(() => {
    try {
      return {
        ...defaultSettings,
        ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"),
      };
    } catch {
      return defaultSettings;
    }
  });

  const updateSetting = (key, value) => {
    setSettings((current) => {
      const next = { ...current, [key]: value };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  };

  // ================= BACKUP / RESTORE =================
  // Backups contain the current student's app data but never include the password.
  const createBackupData = () => {
    const accounts = getAccounts();
    const account = accounts[profileUsername] || {};

    return {
      app: "ClassMate",
      backupVersion: 1,
      exportedAt: new Date().toISOString(),
      data: {
        profile: {
          username: profileUsername || account.username || "Student",
          email: profileEmail || account.email || "",
          studentId: studentId || account.studentId || "",
          major: major || account.major || "",
          institution: institution || account.institution || "",
          profileImage: profileImage || account.profileImage || "",
        },
        classes: Array.isArray(classes) ? classes : [],
        assignments: Array.isArray(assignments) ? assignments : [],
        settings,
        language,
        notificationReadIds,
      },
    };
  };

  const handleBackupData = () => {
    if (!isLoggedIn) {
      alert(language === "en" ? "Please log in before creating a backup." : "กรุณาเข้าสู่ระบบก่อนสำรองข้อมูล");
      return;
    }

    try {
      const backup = createBackupData();
      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `ClassMate-Backup-${date}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      alert(language === "en" ? "Backup created successfully." : "สำรองข้อมูลเรียบร้อยแล้ว");
    } catch (error) {
      console.error("ClassMate backup failed:", error);
      alert(language === "en" ? "Could not create the backup file." : "ไม่สามารถสร้างไฟล์สำรองข้อมูลได้");
    }
  };

  const handleRestoreData = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!isLoggedIn) {
      alert(language === "en" ? "Please log in before restoring data." : "กรุณาเข้าสู่ระบบก่อนกู้คืนข้อมูล");
      return;
    }

    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      if (backup?.app !== "ClassMate" || backup?.backupVersion !== 1 || !backup?.data) {
        throw new Error("Invalid backup format");
      }

      const data = backup.data;
      const profile = data.profile || {};
      const restoredClasses = Array.isArray(data.classes) ? data.classes : [];
      const restoredAssignments = Array.isArray(data.assignments) ? data.assignments : [];
      const restoredSettings = { ...defaultSettings, ...(data.settings || {}) };
      const restoredLanguage = data.language === "th" ? "th" : "en";
      const restoredNotifications = data.notificationReadIds && typeof data.notificationReadIds === "object"
        ? data.notificationReadIds
        : {};

      const targetUsername = profile.username?.trim() || profileUsername;
      if (!targetUsername) throw new Error("Missing username");

      const confirmed = window.confirm(
        language === "en"
          ? "Restore this backup? Your current profile, classes, assignments and settings on this device will be replaced by the backup."
          : "ต้องการกู้คืนข้อมูลจากไฟล์นี้หรือไม่? โปรไฟล์ รายวิชา งาน และการตั้งค่าปัจจุบันบนอุปกรณ์นี้จะถูกแทนที่ด้วยข้อมูลในไฟล์สำรอง"
      );
      if (!confirmed) return;

      const accounts = getAccounts();
      const currentAccount = accounts[profileUsername] || {};
      const preservedPassword = currentAccount.password || "";
      const restoredAccount = {
        ...currentAccount,
        username: targetUsername,
        email: profile.email || "",
        studentId: profile.studentId || "",
        major: profile.major || "Computer Science",
        institution: profile.institution || "ABC University",
        profileImage: profile.profileImage || "",
        classes: restoredClasses,
        assignments: restoredAssignments,
        password: preservedPassword,
      };

      if (profileUsername && profileUsername !== targetUsername) {
        delete accounts[profileUsername];
      }
      accounts[targetUsername] = restoredAccount;
      saveAccounts(accounts);
      localStorage.setItem(SESSION_KEY, targetUsername);
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(restoredSettings));
      localStorage.setItem(LANGUAGE_KEY, restoredLanguage);
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(restoredNotifications));

      setProfileUsername(targetUsername);
      setProfileEmail(restoredAccount.email);
      setStudentId(restoredAccount.studentId);
      setMajor(restoredAccount.major);
      setInstitution(restoredAccount.institution);
      setProfileImage(restoredAccount.profileImage);
      setClasses(restoredClasses);
      setAssignments(restoredAssignments);
      setSettings(restoredSettings);
      setLanguage(restoredLanguage);
      setNotificationReadIds(restoredNotifications);
      setEditingProfile(false);
      setShowClassForm(false);
      setShowAssignmentForm(false);
      setPage("home");

      alert(restoredLanguage === "en" ? "Data restored successfully." : "กู้คืนข้อมูลเรียบร้อยแล้ว");
    } catch (error) {
      console.error("ClassMate restore failed:", error);
      alert(language === "en"
        ? "This file is not a valid ClassMate backup."
        : "ไฟล์นี้ไม่ใช่ไฟล์สำรองข้อมูลของ ClassMate ที่ถูกต้อง");
    }
  };

  // ================= MENU =================

  const [menuOpen, setMenuOpen] = useState(false);

  // ================= NOTIFICATIONS =================
  const [notificationReadIds, setNotificationReadIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || "{}");
    } catch {
      return {};
    }
  });

  const [notificationPage, setNotificationPage] = useState("all");

  // ================= ASSIGNMENTS / TASKS =================
  const [assignments, setAssignments] = useState([]);
  const [assignmentFilter, setAssignmentFilter] = useState("all");
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState(null);
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [assignmentClassId, setAssignmentClassId] = useState("");
  const [assignmentDueDate, setAssignmentDueDate] = useState("");
  const [assignmentDueTime, setAssignmentDueTime] = useState("23:59");
  const [assignmentPriority, setAssignmentPriority] = useState("medium");
  const [assignmentProgress, setAssignmentProgress] = useState(0);
  const [assignmentNote, setAssignmentNote] = useState("");

  // ================= LOGIN =================

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // ================= REGISTER =================

  const [registerUsername, setRegisterUsername] = useState("");
  const [email, setEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [registerSubmitting, setRegisterSubmitting] = useState(false);

  // ================= FORGOT PASSWORD =================

  const [forgotEmail, setForgotEmail] = useState("");

  // ================= PROFILE =================

  const [profileUsername, setProfileUsername] = useState("Student");

  const [profileEmail, setProfileEmail] = useState(
    "student@example.com"
  );

  const [studentId, setStudentId] = useState("20260001");

  const [major, setMajor] = useState("Computer Science");

  const [institution, setInstitution] = useState(
    "ABC University"
  );

  const [profileImage, setProfileImage] = useState("");

  const [editingProfile, setEditingProfile] = useState(false);

  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editStudentId, setEditStudentId] = useState("");
  const [editMajor, setEditMajor] = useState("");
  const [editInstitution, setEditInstitution] = useState("");
  const [editImage, setEditImage] = useState("");

  // ==================================================
  // MY CLASSES
  // ==================================================

  const [classes, setClasses] = useState([]);

  // ==================================================
  // SUPABASE DATA LOADING
  // ==================================================

  const mapClassFromDb = (row) => ({
    id: row.id,
    userId: row.user_id,
    legacyId: row.legacy_id || "",
    name: row.name || "",
    code: row.code || "",
    teacher: row.teacher || "",
    day: row.day || "",
    time: row.time || "",
    room: row.room || "",
    color: row.color || "blue",
  });

  const mapAssignmentFromDb = (row) => ({
    id: row.id,
    userId: row.user_id,
    legacyId: row.legacy_id || "",
    classId: row.class_id || null,
    className: row.class_name || "",
    classCode: row.class_code || "",
    title: row.title || "",
    dueDate: row.due_date || "",
    dueTime: row.due_time || "23:59",
    priority: row.priority || "medium",
    progress: Number(row.progress) || 0,
    status: row.status || "pending",
    note: row.note || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  const loadSupabaseUserData = async (user) => {
    if (!user?.id) return;

    setCurrentUserId(user.id);

    try {
      const [profileResult, classesResult, assignmentsResult] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("classes").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
        supabase.from("assignments").select("*").eq("user_id", user.id).order("due_date", { ascending: true }),
      ]);

      if (profileResult.error) throw profileResult.error;
      if (classesResult.error) throw classesResult.error;
      if (assignmentsResult.error) throw assignmentsResult.error;

      let profile = profileResult.data || {};

      // Create the profile row automatically for a new Supabase user.
      if (!profileResult.data) {
        const profileInsert = {
          user_id: user.id,
          username: user.user_metadata?.username || user.email || "Student",
          email: user.email || "",
          student_id: "",
          major: "Computer Science",
          institution: "ABC University",
          profile_image: "",
        };

        const { data: createdProfile, error: profileCreateError } = await supabase
          .from("profiles")
          .insert(profileInsert)
          .select()
          .single();

        if (profileCreateError) {
          throw profileCreateError;
        }

        profile = createdProfile || profileInsert;
      }

      const dbClasses = (classesResult.data || []).map(mapClassFromDb);
      const dbAssignments = (assignmentsResult.data || []).map(mapAssignmentFromDb);

      setProfileUsername(profile.username || user.user_metadata?.username || user.email || "Student");
      setProfileEmail(profile.email || user.email || "");
      setStudentId(profile.student_id || "");
      setMajor(profile.major || "Computer Science");
      setInstitution(profile.institution || "ABC University");
      setProfileImage(profile.profile_image || "");
      setClasses(dbClasses);
      setAssignments(dbAssignments);

      // Keep a small local cache for backup/restore only. Supabase is the source of truth.
      const cacheKey = `classmate_cache_${user.id}`;
      localStorage.setItem(cacheKey, JSON.stringify({
        username: profile.username || user.user_metadata?.username || user.email || "Student",
        email: profile.email || user.email || "",
        studentId: profile.student_id || "",
        major: profile.major || "Computer Science",
        institution: profile.institution || "ABC University",
        profileImage: profile.profile_image || "",
        classes: dbClasses,
        assignments: dbAssignments,
      }));

      setIsLoggedIn(true);
      setPage("home");
    } catch (error) {
      console.error("ClassMate Supabase data loading failed:", error);
      alert(
        language === "en"
          ? `Could not load your ClassMate data from Supabase. ${error?.message || ""}`
          : `ไม่สามารถโหลดข้อมูล ClassMate จาก Supabase ได้ ${error?.message || ""}`
      );
      setIsLoggedIn(false);
      setCurrentUserId(null);
    } finally {
      }
  };

  // Restore the authenticated Supabase session after refresh.
  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;

      if (error) {
        console.error("Supabase session restore failed:", error);
        return;
      }

      if (data.session?.user) {
        await loadSupabaseUserData(data.session.user);
      }
    };

    restoreSession();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      if (session?.user) {
        // Defer the data queries so the auth callback is not blocked by Supabase internals.
        setTimeout(() => {
          if (mounted) loadSupabaseUserData(session.user);
        }, 0);
      } else {
        setCurrentUserId(null);
        setIsLoggedIn(false);
        setClasses([]);
        setAssignments([]);
      }
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const [showClassForm, setShowClassForm] = useState(false);

  const [editingClassId, setEditingClassId] = useState(null);

  const [className, setClassName] = useState("");
  const [classCode, setClassCode] = useState("");
  const [classTeacher, setClassTeacher] = useState("");
  const [classDay, setClassDay] = useState("Monday");
  const [classTime, setClassTime] = useState("");
  const [classRoom, setClassRoom] = useState("");
  const [classColor, setClassColor] = useState("blue");

  const [classSearch, setClassSearch] = useState("");
  const [classDayFilter, setClassDayFilter] = useState("all");
  const [classSort, setClassSort] = useState("name");
  const [selectedClass, setSelectedClass] = useState(null);
  const [scheduleView, setScheduleView] = useState("week");
  const [selectedScheduleClass, setSelectedScheduleClass] = useState(null);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  const classColorOptions = [
    { value: "blue", labelEn: "Blue", labelTh: "ฟ้า", emoji: "🔵" },
    { value: "purple", labelEn: "Purple", labelTh: "ม่วง", emoji: "🟣" },
    { value: "green", labelEn: "Green", labelTh: "เขียว", emoji: "🟢" },
    { value: "orange", labelEn: "Orange", labelTh: "ส้ม", emoji: "🟠" },
    { value: "pink", labelEn: "Pink", labelTh: "ชมพู", emoji: "🩷" },
    { value: "yellow", labelEn: "Yellow", labelTh: "เหลือง", emoji: "🟡" },
  ];

  // ==================================================
  // LOGIN
  // ==================================================

  const handleLogin = async (e) => {
  e.preventDefault();

  const cleanUsername = username.trim();

  if (!cleanUsername || !password) {
    alert(
      language === "en"
        ? "Please enter your username/email and password."
        : "กรุณากรอกชื่อผู้ใช้/อีเมลและรหัสผ่าน"
    );
    return;
  }

  try {
    // Supabase ใช้ Email สำหรับ Login
    const loginEmail = cleanUsername.toLowerCase();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });

    if (error) {
      console.error("Supabase Login Error:", error);

      alert(
        language === "en"
          ? error.message
          : "เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมลและรหัสผ่าน"
      );
      return;
    }

    const user = data.user;

    // Supabase is the source of truth for profile/classes/assignments.
    localStorage.setItem(SESSION_KEY, user.id);
    await loadSupabaseUserData(user);
    setMenuOpen(false);
    setPassword("");

    alert(
      language === "en"
        ? `Welcome back, ${user.user_metadata?.username || user.email}!`
        : `ยินดีต้อนรับกลับ ${user.user_metadata?.username || user.email}!`
    );

  } catch (error) {
    console.error("Login Error:", error);

    alert(
      language === "en"
        ? "Something went wrong while logging in."
        : "เกิดข้อผิดพลาดระหว่างเข้าสู่ระบบ"
    );
  }
};

  // ==================================================
  // REGISTER
  // ==================================================

  const handleRegister = async (e) => {
    e.preventDefault();

    const cleanUsername = registerUsername.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanUsername || !cleanEmail || !registerPassword || !confirmPassword) {
      alert(language === "en" ? "Please fill in all fields." : "กรุณากรอกข้อมูลให้ครบทุกช่อง");
      return;
    }

    if (registerPassword.length < 6) {
      alert(language === "en" ? "Password must be at least 6 characters." : "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }

    if (registerPassword !== confirmPassword) {
      alert(language === "en" ? "Passwords do not match." : "รหัสผ่านไม่ตรงกัน");
      return;
    }

    if (!supabase) {
      alert(language === "en" ? "Supabase is not configured. Please check your .env.local file." : "ยังไม่ได้ตั้งค่า Supabase กรุณาตรวจสอบไฟล์ .env.local");
      return;
    }

    setRegisterSubmitting(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: registerPassword,
        options: { data: { username: cleanUsername } },
      });

      if (error) throw error;

      const needsEmailConfirmation = !data.session;
      alert(
        language === "en"
          ? needsEmailConfirmation
            ? `Account created for ${cleanUsername}! Please check ${cleanEmail} and confirm your email before logging in.`
            : `Account created for ${cleanUsername}! You can now log in.`
          : needsEmailConfirmation
            ? `สร้างบัญชี ${cleanUsername} สำเร็จแล้ว! กรุณาตรวจสอบอีเมล ${cleanEmail} และยืนยันอีเมลก่อนเข้าสู่ระบบ`
            : `สร้างบัญชี ${cleanUsername} สำเร็จแล้ว! สามารถเข้าสู่ระบบได้เลย`
      );

      setIsLoggedIn(false);
      setPage("login");
      setUsername(cleanEmail);
      setPassword("");
      setRegisterUsername("");
      setEmail("");
      setRegisterPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("ClassMate Supabase registration failed:", error);
      const message = String(error?.message || "");
      let friendlyMessage = language === "en" ? "Registration failed. Please try again." : "สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";

      if (/already registered|already exists|user already/i.test(message)) {
        friendlyMessage = language === "en" ? "This email is already registered." : "อีเมลนี้ถูกสมัครไว้แล้ว";
      } else if (/username|duplicate key|profiles/i.test(message)) {
        friendlyMessage = language === "en" ? "This username is already in use. Please choose another username." : "ชื่อผู้ใช้นี้ถูกใช้งานแล้ว กรุณาเลือกชื่อผู้ใช้อื่น";
      } else if (/invalid email/i.test(message)) {
        friendlyMessage = language === "en" ? "Please enter a valid email address." : "กรุณากรอกอีเมลให้ถูกต้อง";
      }

      alert(friendlyMessage);
    } finally {
      setRegisterSubmitting(false);
    }
  };

  // ==================================================
  // FORGOT PASSWORD
  // ==================================================

  const handleForgotPassword = (e) => {
    e.preventDefault();

    const cleanEmail = forgotEmail.trim();

    if (!cleanEmail) {
      alert(
        language === "en"
          ? "Please enter your email."
          : "กรุณากรอกอีเมลของคุณ"
      );
      return;
    }

    const accounts = getAccounts();
    const matchedUsername = Object.keys(accounts).find(
      (key) => accounts[key].email?.toLowerCase() === cleanEmail.toLowerCase()
    );

    if (!matchedUsername) {
      alert(
        language === "en"
          ? "No account was found with this email."
          : "ไม่พบบัญชีที่ใช้อีเมลนี้"
      );
      return;
    }

    alert(
      language === "en"
        ? `Account found: ${matchedUsername}. For this local demo, log in with your registered password.`
        : `พบบัญชี ${matchedUsername} แล้ว สำหรับเดโมแบบ Local Storage ให้เข้าสู่ระบบด้วยรหัสผ่านที่สมัครไว้`
    );

    setForgotEmail("");
    setIsLoggedIn(false);
    setPage("login");
  };

  // ==================================================
  // PROFILE EDIT
  // ==================================================

  const startEditingProfile = () => {
    setEditUsername(profileUsername);
    setEditEmail(profileEmail);
    setEditStudentId(studentId);
    setEditMajor(major);
    setEditInstitution(institution);
    setEditImage(profileImage);

    setEditingProfile(true);
  };

  const saveProfile = async () => {
    if (
      !editUsername.trim() ||
      !editEmail.trim() ||
      !editStudentId.trim() ||
      !editMajor.trim() ||
      !editInstitution.trim()
    ) {
      alert(
        language === "en"
          ? "Please fill in all profile fields."
          : "กรุณากรอกข้อมูลโปรไฟล์ให้ครบทุกช่อง"
      );
      return;
    }

    if (!currentUserId) {
      alert(language === "en" ? "Please log in again." : "กรุณาเข้าสู่ระบบใหม่อีกครั้ง");
      return;
    }

    const payload = {
      user_id: currentUserId,
      username: editUsername.trim(),
      email: editEmail.trim().toLowerCase(),
      student_id: editStudentId.trim(),
      major: editMajor.trim(),
      institution: editInstitution.trim(),
      profile_image: editImage || "",
      updated_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase
        .from("profiles")
        .upsert(payload, { onConflict: "user_id" });

      if (error) throw error;

      setProfileUsername(payload.username);
      setProfileEmail(payload.email);
      setStudentId(payload.student_id);
      setMajor(payload.major);
      setInstitution(payload.institution);
      setProfileImage(payload.profile_image);
      setEditingProfile(false);

      alert(
        language === "en"
          ? "Profile updated successfully!"
          : "อัปเดตโปรไฟล์เรียบร้อยแล้ว!"
      );
    } catch (error) {
      console.error("Supabase profile save failed:", error);
      alert(
        language === "en"
          ? `Could not save your profile. ${error?.message || ""}`
          : `ไม่สามารถบันทึกโปรไฟล์ได้ ${error?.message || ""}`
      );
    }
  };

  const cancelEditingProfile = () => {
    setEditingProfile(false);
  };

  // ==================================================
  // PROFILE IMAGE
  // ==================================================

  const handleProfileImageChange = (e) => {
    const file = e.target.files[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert(
        language === "en"
          ? "Please select an image file."
          : "กรุณาเลือกไฟล์รูปภาพ"
      );

      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setEditImage(reader.result);
    };

    reader.readAsDataURL(file);
  };

  // ==================================================
  // MY CLASSES - RESET FORM
  // ==================================================

  const resetClassForm = () => {
    setClassName("");
    setClassCode("");
    setClassTeacher("");
    setClassDay("Monday");
    setClassTime("");
    setClassRoom("");
    setClassColor("blue");

    setEditingClassId(null);

    setShowClassForm(false);
  };

  // ==================================================
  // MY CLASSES - OPEN ADD FORM
  // ==================================================

  const openAddClassForm = () => {
    setClassName("");
    setClassCode("");
    setClassTeacher("");
    setClassDay("Monday");
    setClassTime("");
    setClassRoom("");
    setClassColor("blue");

    setEditingClassId(null);

    setShowClassForm(true);
  };

  // ==================================================
  // MY CLASSES - EDIT
  // ==================================================

  const openEditClassForm = (selectedClass) => {
    setClassName(selectedClass.name);
    setClassCode(selectedClass.code);
    setClassTeacher(selectedClass.teacher);
    setClassDay(selectedClass.day);
    setClassTime(selectedClass.time);
    setClassRoom(selectedClass.room);
    setClassColor(selectedClass.color || "blue");

    setEditingClassId(selectedClass.id);

    setShowClassForm(true);
  };

  // ==================================================
  // MY CLASSES - SAVE
  // ==================================================

  const saveClass = async (e) => {
    e.preventDefault();

    if (!currentUserId) {
      alert(language === "en" ? "Please log in again." : "กรุณาเข้าสู่ระบบใหม่อีกครั้ง");
      return;
    }

    if (
      !className.trim() ||
      !classCode.trim() ||
      !classTeacher.trim() ||
      !classDay ||
      !classTime.trim() ||
      !classRoom.trim()
    ) {
      alert(
        language === "en"
          ? "Please fill in all class information."
          : "กรุณากรอกข้อมูลรายวิชาให้ครบทุกช่อง"
      );
      return;
    }

    const payload = {
      user_id: currentUserId,
      name: className.trim(),
      code: classCode.trim(),
      teacher: classTeacher.trim(),
      day: classDay,
      time: classTime.trim(),
      room: classRoom.trim(),
      color: classColor,
    };

    try {
      let result;

      if (editingClassId !== null) {
        result = await supabase
          .from("classes")
          .update(payload)
          .eq("id", editingClassId)
          .eq("user_id", currentUserId)
          .select()
          .single();
      } else {
        result = await supabase
          .from("classes")
          .insert(payload)
          .select()
          .single();
      }

      if (result.error) throw result.error;

      const savedClass = mapClassFromDb(result.data);

      setClasses((current) =>
        editingClassId !== null
          ? current.map((item) => item.id === savedClass.id ? savedClass : item)
          : [...current, savedClass]
      );

      resetClassForm();

      alert(
        language === "en"
          ? editingClassId !== null ? "Class updated successfully!" : "Class added successfully!"
          : editingClassId !== null ? "แก้ไขรายวิชาเรียบร้อยแล้ว!" : "เพิ่มรายวิชาเรียบร้อยแล้ว!"
      );
    } catch (error) {
      console.error("Supabase class save failed:", error);
      alert(
        language === "en"
          ? `Could not save the class. ${error?.message || ""}`
          : `ไม่สามารถบันทึกรายวิชาได้ ${error?.message || ""}`
      );
    }
  };

  // ==================================================
  // MY CLASSES - DELETE
  // ==================================================

  const deleteClass = async (classId) => {
    const confirmed = window.confirm(
      language === "en"
        ? "Are you sure you want to delete this class?"
        : "คุณแน่ใจหรือไม่ว่าต้องการลบรายวิชานี้?"
    );

    if (!confirmed) return;

    if (!currentUserId) {
      alert(language === "en" ? "Please log in again." : "กรุณาเข้าสู่ระบบใหม่อีกครั้ง");
      return;
    }

    try {
      const { error } = await supabase
        .from("classes")
        .delete()
        .eq("id", classId)
        .eq("user_id", currentUserId);

      if (error) throw error;

      setClasses((current) => current.filter((item) => item.id !== classId));

      alert(language === "en" ? "Class deleted successfully!" : "ลบรายวิชาเรียบร้อยแล้ว!");
    } catch (error) {
      console.error("Supabase class delete failed:", error);
      alert(
        language === "en"
          ? `Could not delete the class. ${error?.message || ""}`
          : `ไม่สามารถลบรายวิชาได้ ${error?.message || ""}`
      );
    }
  };

  // ==================================================
  // ASSIGNMENTS / TASKS
  // ==================================================

  const resetAssignmentForm = () => {
    setAssignmentTitle("");
    setAssignmentClassId(classes[0]?.id ? String(classes[0].id) : "");
    setAssignmentDueDate("");
    setAssignmentDueTime("23:59");
    setAssignmentPriority("medium");
    setAssignmentProgress(0);
    setAssignmentNote("");
    setEditingAssignmentId(null);
  };

  const openAddAssignmentForm = (classId = "") => {
    resetAssignmentForm();
    setAssignmentClassId(classId ? String(classId) : (classes[0]?.id ? String(classes[0].id) : ""));
    setShowAssignmentForm(true);
  };

  const openEditAssignmentForm = (item) => {
    setEditingAssignmentId(item.id);
    setAssignmentTitle(item.title || "");
    setAssignmentClassId(item.classId ? String(item.classId) : "");
    setAssignmentDueDate(item.dueDate || "");
    setAssignmentDueTime(item.dueTime || "23:59");
    setAssignmentPriority(item.priority || "medium");
    setAssignmentProgress(Number.isFinite(Number(item.progress)) ? Number(item.progress) : (item.status === "completed" ? 100 : 0));
    setAssignmentNote(item.note || "");
    setShowAssignmentForm(true);
  };

  const saveAssignment = async (e) => {
    e.preventDefault();

    if (!currentUserId) {
      alert(language === "en" ? "Please log in again." : "กรุณาเข้าสู่ระบบใหม่อีกครั้ง");
      return;
    }

    if (!assignmentTitle.trim() || !assignmentClassId || !assignmentDueDate) {
      alert(language === "en"
        ? "Please enter a title, choose a class, and set a due date."
        : "กรุณากรอกชื่องาน เลือกรายวิชา และกำหนดวันส่ง");
      return;
    }

    const selectedClassItem = classes.find((item) => String(item.id) === String(assignmentClassId));
    if (!selectedClassItem) {
      alert(language === "en" ? "Please choose a valid class." : "กรุณาเลือกรายวิชาที่ถูกต้อง");
      return;
    }

    const progress = Math.min(100, Math.max(0, Number(assignmentProgress) || 0));
    const existing = assignments.find((item) => item.id === editingAssignmentId);
    const payload = {
      user_id: currentUserId,
      class_id: selectedClassItem.id,
      class_name: selectedClassItem.name,
      class_code: selectedClassItem.code || null,
      title: assignmentTitle.trim(),
      due_date: assignmentDueDate,
      due_time: assignmentDueTime || "23:59",
      priority: assignmentPriority,
      progress,
      status: progress === 100 ? "completed" : (existing?.status || "pending"),
      note: assignmentNote.trim() || null,
      updated_at: new Date().toISOString(),
    };

    try {
      let result;

      if (editingAssignmentId) {
        result = await supabase
          .from("assignments")
          .update(payload)
          .eq("id", editingAssignmentId)
          .eq("user_id", currentUserId)
          .select()
          .single();
      } else {
        result = await supabase
          .from("assignments")
          .insert(payload)
          .select()
          .single();
      }

      if (result.error) throw result.error;

      const savedAssignment = mapAssignmentFromDb(result.data);

      setAssignments((current) =>
        editingAssignmentId
          ? current.map((item) => item.id === savedAssignment.id ? savedAssignment : item)
          : [...current, savedAssignment]
      );

      setShowAssignmentForm(false);
      resetAssignmentForm();

      alert(
        language === "en"
          ? editingAssignmentId ? "Assignment updated successfully!" : "Assignment added successfully!"
          : editingAssignmentId ? "แก้ไขงานเรียบร้อยแล้ว!" : "เพิ่มงานเรียบร้อยแล้ว!"
      );
    } catch (error) {
      console.error("Supabase assignment save failed:", error);
      alert(
        language === "en"
          ? `Could not save the assignment. ${error?.message || ""}`
          : `ไม่สามารถบันทึกงานได้ ${error?.message || ""}`
      );
    }
  };

  const toggleAssignmentStatus = async (id) => {
    if (!currentUserId) return;

    const item = assignments.find((entry) => entry.id === id);
    if (!item) return;

    const completed = item.status !== "completed";
    const progress = completed ? 100 : Math.min(Number(item.progress) || 0, 99);

    try {
      const { data, error } = await supabase
        .from("assignments")
        .update({
          status: completed ? "completed" : "pending",
          progress,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", currentUserId)
        .select()
        .single();

      if (error) throw error;

      const updated = mapAssignmentFromDb(data);
      setAssignments((current) => current.map((entry) => entry.id === id ? updated : entry));
    } catch (error) {
      console.error("Supabase assignment status update failed:", error);
      alert(language === "en" ? `Could not update the assignment. ${error?.message || ""}` : `ไม่สามารถอัปเดตสถานะงานได้ ${error?.message || ""}`);
    }
  };

  const deleteAssignment = async (id) => {
    const item = assignments.find((entry) => entry.id === id);
    if (!item || !currentUserId) return;

    const confirmed = window.confirm(language === "en"
      ? `Delete "${item.title}"?`
      : `ต้องการลบ "${item.title}" หรือไม่?`);
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("assignments")
        .delete()
        .eq("id", id)
        .eq("user_id", currentUserId);

      if (error) throw error;

      setAssignments((current) => current.filter((entry) => entry.id !== id));
    } catch (error) {
      console.error("Supabase assignment delete failed:", error);
      alert(language === "en" ? `Could not delete the assignment. ${error?.message || ""}` : `ไม่สามารถลบงานได้ ${error?.message || ""}`);
    }
  };

  const formatAssignmentDate = (dateValue) => {
    if (!dateValue) return "—";
    const date = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateValue;
    return new Intl.DateTimeFormat(language === "en" ? "en-US" : "th-TH", {
      day: "numeric", month: "short", year: "numeric"
    }).format(date);
  };

  const getAssignmentDueTimestamp = (item) => {
    if (!item.dueDate) return Number.MAX_SAFE_INTEGER;
    const date = new Date(`${item.dueDate}T${item.dueTime || "23:59"}:00`);
    return Number.isNaN(date.getTime()) ? Number.MAX_SAFE_INTEGER : date.getTime();
  };

  const isAssignmentOverdue = (item) =>
    item.status !== "completed" && getAssignmentDueTimestamp(item) < currentTime.getTime();

  // IMPORTANT: These filter helpers must be declared before filteredAssignments.
  // Otherwise Today / Next 7 days can hit the JavaScript temporal dead zone
  // and the React page becomes blank.
  const getDaysUntilDue = (item) => {
    if (!item.dueDate) return null;
    const due = new Date(`${item.dueDate}T00:00:00`);
    if (Number.isNaN(due.getTime())) return null;

    const today = new Date(currentTime);
    today.setHours(0, 0, 0, 0);

    return Math.ceil((due.getTime() - today.getTime()) / 86400000);
  };

  const isAssignmentToday = (item) => getDaysUntilDue(item) === 0;

  const isAssignmentWithin7Days = (item) => {
    const days = getDaysUntilDue(item);
    return days !== null && days >= 0 && days <= 7;
  };

  const filteredAssignments = [...assignments]
    .filter((item) => {
      if (assignmentFilter === "pending") return item.status !== "completed";
      if (assignmentFilter === "today") return item.status !== "completed" && isAssignmentToday(item);
      if (assignmentFilter === "next7") return item.status !== "completed" && isAssignmentWithin7Days(item);
      if (assignmentFilter === "completed") return item.status === "completed";
      if (assignmentFilter === "overdue") return isAssignmentOverdue(item);
      return true;
    })
    .filter((item) => {
      const query = assignmentSearch.trim().toLowerCase();
      if (!query) return true;
      return [item.title, item.className, item.classCode, item.note]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    })
    .sort((a, b) => getAssignmentDueTimestamp(a) - getAssignmentDueTimestamp(b));

  const pendingAssignments = assignments.filter((item) => item.status !== "completed");
  const completedAssignments = assignments.filter((item) => item.status === "completed");
  const overdueAssignments = pendingAssignments.filter(isAssignmentOverdue);
  const upcomingAssignments = pendingAssignments
    .filter((item) => !isAssignmentOverdue(item))
    .sort((a, b) => getAssignmentDueTimestamp(a) - getAssignmentDueTimestamp(b));


  const getAssignmentCountdown = (item) => {
    if (item.status === "completed") return language === "en" ? "Completed" : "เสร็จแล้ว";
    const due = getAssignmentDueTimestamp(item);
    if (!Number.isFinite(due) || due === Number.MAX_SAFE_INTEGER) return language === "en" ? "No deadline" : "ไม่มีกำหนดส่ง";
    const diff = due - currentTime.getTime();
    if (diff < 0) {
      const days = Math.max(1, Math.floor(Math.abs(diff) / 86400000));
      return language === "en" ? `${days}d overdue` : `เลยกำหนด ${days} วัน`;
    }
    const hours = Math.floor(diff / 3600000);
    if (hours < 24) return language === "en" ? `Due in ${Math.max(1, hours)}h` : `เหลือ ${Math.max(1, hours)} ชม.`;
    const days = Math.ceil(diff / 86400000);
    if (days === 1) return language === "en" ? "Due tomorrow" : "ส่งพรุ่งนี้";
    return language === "en" ? `${days} days left` : `เหลือ ${days} วัน`;
  };


  const updateAssignmentProgress = async (id, value) => {
    if (!currentUserId) return;

    const progress = Math.min(100, Math.max(0, Number(value) || 0));
    const status = progress === 100 ? "completed" : "pending";

    try {
      const { data, error } = await supabase
        .from("assignments")
        .update({
          progress,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", currentUserId)
        .select()
        .single();

      if (error) throw error;

      const updated = mapAssignmentFromDb(data);
      setAssignments((current) => current.map((item) => item.id === id ? updated : item));
    } catch (error) {
      console.error("Supabase assignment progress update failed:", error);
      alert(language === "en" ? `Could not update progress. ${error?.message || ""}` : `ไม่สามารถอัปเดตความคืบหน้าได้ ${error?.message || ""}`);
    }
  };

  const smartAssignmentBuckets = {
    today: pendingAssignments.filter(isAssignmentToday),
    next7: pendingAssignments.filter(isAssignmentWithin7Days),
  };
  const assignmentProgressTotal = assignments.length
    ? Math.round(assignments.reduce((sum, item) => sum + (Number(item.progress) || (item.status === "completed" ? 100 : 0)), 0) / assignments.length)
    : 0;

  // ==================================================
  // MENU
  // ==================================================

  const handleMenuClick = (targetPage) => {
    setPage(targetPage);

    setMenuOpen(false);

    if (targetPage !== "profile") {
      setEditingProfile(false);
    }

    if (targetPage !== "classes") {
      setShowClassForm(false);
      setSelectedClass(null);
    }
  };

  // ==================================================
  // OPEN PAGE FROM HOME
  // ==================================================

  const openPage = (targetPage) => {
    setPage(targetPage);

    setMenuOpen(false);
  };

  // ==================================================
  // LOGOUT
  // ==================================================

  const handleLogout = async () => {
    setMenuOpen(false);

    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Supabase logout failed:", error);
    }

    localStorage.removeItem(SESSION_KEY);
    setCurrentUserId(null);
    setIsLoggedIn(false);
    setPage("login");
    setEditingProfile(false);
    setShowClassForm(false);
    setShowAssignmentForm(false);
    setClasses([]);
    setAssignments([]);
    setPassword("");
  };

  // ==================================================
  // MY CLASSES - SEARCH / FILTER / SORT
  // ==================================================

  const filteredClasses = [...classes]
    .filter((item) => {
      const query = classSearch.trim().toLowerCase();
      if (!query) return true;

      return [item.name, item.code, item.teacher, item.day, item.room]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(query)
        );
    })
    .filter((item) =>
      classDayFilter === "all" ? true : item.day === classDayFilter
    )
    .sort((a, b) => {
      if (classSort === "code") {
        return String(a.code || "").localeCompare(
          String(b.code || ""),
          undefined,
          { numeric: true, sensitivity: "base" }
        );
      }

      if (classSort === "day") {
        const order = {
          Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4,
          Friday: 5, Saturday: 6, Sunday: 7,
        };
        return (order[a.day] || 99) - (order[b.day] || 99);
      }

      return String(a.name || "").localeCompare(
        String(b.name || ""),
        undefined,
        { sensitivity: "base" }
      );
    });

  const getDayLabel = (day) => {
    const labels = {
      Monday: language === "en" ? "Monday" : "จันทร์",
      Tuesday: language === "en" ? "Tuesday" : "อังคาร",
      Wednesday: language === "en" ? "Wednesday" : "พุธ",
      Thursday: language === "en" ? "Thursday" : "พฤหัสบดี",
      Friday: language === "en" ? "Friday" : "ศุกร์",
      Saturday: language === "en" ? "Saturday" : "เสาร์",
      Sunday: language === "en" ? "Sunday" : "อาทิตย์",
    };
    return labels[day] || day;
  };

  const getClassColorClass = (item) =>
    `class-color-${item.color || "blue"}`;

  // ==================================================
  // SCHEDULE
  // ==================================================

  const baseScheduleDays = [
    { key: "Monday", en: "Mon", th: "จันทร์" },
    { key: "Tuesday", en: "Tue", th: "อังคาร" },
    { key: "Wednesday", en: "Wed", th: "พุธ" },
    { key: "Thursday", en: "Thu", th: "พฤหัส" },
    { key: "Friday", en: "Fri", th: "ศุกร์" },
    { key: "Saturday", en: "Sat", th: "เสาร์" },
    { key: "Sunday", en: "Sun", th: "อาทิตย์" },
  ];

  const scheduleDays =
    settings.weekStart === "sunday"
      ? [baseScheduleDays[6], ...baseScheduleDays.slice(0, 6)]
      : baseScheduleDays;

  const getTodayName = () =>
    ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
      new Date().getDay()
    ];

  const getTimeStart = (timeValue) => {
    const match = String(timeValue || "").match(/(\d{1,2})[:.]?(\d{2})?/);
    if (!match) return 0;
    const hour = Number(match[1]);
    const minute = Number(match[2] || 0);
    return hour * 60 + minute;
  };

  const getTimeEnd = (timeValue) => {
    const matches = String(timeValue || "").match(/(\d{1,2})[:.]?(\d{2})?/g);
    if (!matches || matches.length < 2) return getTimeStart(timeValue) + 60;
    return getTimeStart(matches[matches.length - 1]);
  };

  const scheduleRows = [...classes].sort(
    (a, b) => getTimeStart(a.time) - getTimeStart(b.time)
  );

  const scheduleTimeSlots = Array.from(
    new Set(
      scheduleRows
        .map((item) => String(item.time || "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => getTimeStart(a) - getTimeStart(b));

  const getScheduleClasses = (day) =>
    scheduleRows.filter((item) => item.day === day);

  // Advanced time-block timeline. Existing time strings such as
  // "09:00 - 12:00" and "11:00-21:00" are parsed automatically.
  const timedScheduleRows = scheduleRows
    .filter((item) => item.time)
    .map((item) => ({
      ...item,
      startMinute: getTimeStart(item.time),
      endMinute: Math.max(getTimeEnd(item.time), getTimeStart(item.time) + 30),
    }));

  const rawScheduleStart = timedScheduleRows.length
    ? Math.min(...timedScheduleRows.map((item) => item.startMinute))
    : 8 * 60;
  const rawScheduleEnd = timedScheduleRows.length
    ? Math.max(...timedScheduleRows.map((item) => item.endMinute))
    : 18 * 60;
  const scheduleTimelineStart = Math.max(0, Math.floor(rawScheduleStart / 30) * 30);
  const scheduleTimelineEnd = Math.min(24 * 60, Math.ceil(rawScheduleEnd / 30) * 30);
  const scheduleTimelineSlotHeight = 48;
  const scheduleTimelineHeight = Math.max(
    240,
    ((scheduleTimelineEnd - scheduleTimelineStart) / 30) * scheduleTimelineSlotHeight
  );
  const scheduleTimelineSlots = Array.from(
    { length: Math.max(1, (scheduleTimelineEnd - scheduleTimelineStart) / 30) },
    (_, index) => scheduleTimelineStart + index * 30
  );

  const formatScheduleClock = (minutes) => {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    if (settings.timeFormat === "12") {
      const period = hour >= 12 ? "PM" : "AM";
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
    }
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  };

  const getTimelineStyle = (item) => {
    const top = ((item.startMinute - scheduleTimelineStart) / 30) * scheduleTimelineSlotHeight + 4;
    const height = Math.max(52, ((item.endMinute - item.startMinute) / 30) * scheduleTimelineSlotHeight - 8);
    return { top: `${top}px`, height: `${height}px` };
  };

  // ==================================================
  // HOME DASHBOARD
  // ==================================================

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const getCurrentMinutes = () =>
    currentTime.getHours() * 60 + currentTime.getMinutes();

  const todayName = getTodayName();
  const todayClasses = scheduleRows
    .filter((item) => item.day === todayName)
    .sort((a, b) => getTimeStart(a.time) - getTimeStart(b.time));

  const currentMinutes = getCurrentMinutes();
  const nextTodayClass = todayClasses.find(
    (item) => getTimeStart(item.time) >= currentMinutes
  );

  const formatDashboardDate = (date) => {
    return new Intl.DateTimeFormat(language === "en" ? "en-US" : "th-TH", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  };

  const formatDashboardTime = (date) =>
    new Intl.DateTimeFormat(language === "en" ? "en-US" : "th-TH", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);

  const getNextClassMessage = () => {
    if (!classes.length) {
      return language === "en"
        ? "Add a class to see your next class here."
        : "เพิ่มรายวิชาเพื่อดูคาบเรียนถัดไปที่นี่";
    }

    if (nextTodayClass) {
      return language === "en"
        ? "Your next class today"
        : "คาบเรียนถัดไปของวันนี้";
    }

    return language === "en"
      ? "No more classes today"
      : "วันนี้ไม่มีคาบเรียนแล้ว";
  };

  // ==================================================
  // TOTAL CLASSES
  // ==================================================

  const totalClasses = classes.length;
  const profileCompletionFields = [
    profileUsername,
    profileEmail,
    studentId,
    major,
    institution,
  ];

  const profileCompletion = Math.round(
    (profileCompletionFields.filter((value) => String(value || "").trim()).length /
      profileCompletionFields.length) *
      100
  );


  // ==================================================
  // SMART NOTIFICATIONS HELPERS
  // ==================================================

  const getBrowserNotificationSent = () => {
    try {
      return JSON.parse(localStorage.getItem(BROWSER_NOTIFICATION_SENT_KEY) || "{}");
    } catch {
      return {};
    }
  };

  const requestBrowserNotifications = async () => {
    if (!("Notification" in window)) {
      alert(language === "en"
        ? "This browser does not support desktop notifications."
        : "เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือนบนเดสก์ท็อป");
      return;
    }

    try {
      const permission = Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
      if (permission === "granted") {
        new Notification("ClassMate", {
          body: language === "en" ? "Smart notifications are enabled." : "เปิดการแจ้งเตือนอัจฉริยะแล้ว",
          icon: "/favicon.ico",
        });
      } else {
        alert(language === "en"
          ? "Browser notifications are blocked. You can allow them in browser site settings."
          : "การแจ้งเตือนถูกบล็อก สามารถอนุญาตได้จากการตั้งค่าเว็บไซต์ของเบราว์เซอร์");
      }
    } catch (error) {
      console.error("ClassMate notification permission failed:", error);
    }
  };

  const notificationItems = [
    ...todayClasses
      .map((item) => {
        const start = getTimeStart(item.time);
        const minutesUntil = start - currentMinutes;
        if (minutesUntil < -30 || minutesUntil > 120) return null;

        const id = minutesUntil <= 30
          ? `class-${item.id}-${todayName}-soon`
          : `class-${item.id}-${todayName}-upcoming`;
        const isUrgent = minutesUntil >= 0 && minutesUntil <= 30;
        const isLive = minutesUntil < 0;

        return {
          id,
          type: isUrgent ? "urgent" : isLive ? "live" : "class",
          icon: isUrgent ? "⏰" : isLive ? "▶️" : "📚",
          title: language === "en"
            ? (isUrgent ? "Class starts soon" : isLive ? "Class is starting" : "Upcoming class")
            : (isUrgent ? "คาบเรียนกำลังจะเริ่ม" : isLive ? "คาบเรียนกำลังเริ่ม" : "มีคาบเรียนใกล้เข้ามา"),
          message: language === "en"
            ? (isUrgent
              ? `${item.name} starts in ${minutesUntil} minute${minutesUntil === 1 ? "" : "s"}.`
              : isLive
                ? `${item.name} started at ${item.time}.`
                : `${item.name} starts at ${item.time}.`)
            : (isUrgent
              ? `${item.name} จะเริ่มในอีก ${minutesUntil} นาที`
              : isLive
                ? `${item.name} เริ่มเรียนเวลา ${item.time} แล้ว`
                : `${item.name} เริ่มเรียนเวลา ${item.time}`),
          time: item.time,
          classItem: item,
          targetPage: "schedule",
          read: Boolean(notificationReadIds[id]),
          browserPriority: isUrgent ? "high" : "normal",
        };
      })
      .filter(Boolean),
    ...pendingAssignments
      .map((item) => {
        const due = getAssignmentDueTimestamp(item);
        if (!Number.isFinite(due) || due === Number.MAX_SAFE_INTEGER) return null;
        const diff = due - currentTime.getTime();
        const hours = diff / 3600000;
        if (hours < -24 || hours > 72) return null;

        let milestone = "72h";
        let type = "assignment";
        let icon = "📝";
        let titleEn = "Assignment due soon";
        let titleTh = "งานใกล้ถึงกำหนด";
        let messageEn = `${item.title} is due ${formatAssignmentDate(item.dueDate)} at ${item.dueTime || "23:59"}.`;
        let messageTh = `${item.title} ครบกำหนดส่ง ${formatAssignmentDate(item.dueDate)} เวลา ${item.dueTime || "23:59"}`;

        if (diff < 0) {
          milestone = "overdue";
          type = "assignment-overdue";
          icon = "🚨";
          const overdueHours = Math.max(1, Math.floor(Math.abs(diff) / 3600000));
          titleEn = "Assignment overdue";
          titleTh = "งานเลยกำหนดส่ง";
          messageEn = `${item.title} is overdue by about ${overdueHours} hour${overdueHours === 1 ? "" : "s"}.`;
          messageTh = `${item.title} เลยกำหนดส่งประมาณ ${overdueHours} ชั่วโมง`;
        } else if (hours <= 24) {
          milestone = "24h";
          type = "assignment-urgent";
          icon = "⏳";
          titleEn = "Assignment due soon";
          titleTh = "งานใกล้ถึงกำหนดมาก";
          messageEn = `${item.title} is due in ${Math.max(1, Math.ceil(hours))} hour${Math.ceil(hours) === 1 ? "" : "s"}.`;
          messageTh = `${item.title} เหลืออีกประมาณ ${Math.max(1, Math.ceil(hours))} ชั่วโมง`;
        } else if (hours <= 48) {
          milestone = "48h";
        }

        const id = `assignment-${item.id}-${milestone}-${item.dueDate}`;
        return {
          id,
          type,
          icon,
          title: language === "en" ? titleEn : titleTh,
          message: language === "en" ? messageEn : messageTh,
          time: item.dueTime || "23:59",
          assignmentItem: item,
          targetPage: "assignments",
          read: Boolean(notificationReadIds[id]),
          browserPriority: type === "assignment-urgent" || type === "assignment-overdue" ? "high" : "normal",
        };
      })
      .filter(Boolean),
  ].sort((a, b) => {
    const aPriority = a.browserPriority === "high" ? 0 : 1;
    const bPriority = b.browserPriority === "high" ? 0 : 1;
    return aPriority - bPriority;
  });

  const unreadNotifications = notificationItems.filter((item) => !item.read);
  const visibleNotifications = notificationPage === "unread"
    ? unreadNotifications
    : notificationItems;

  const saveNotificationState = (next) => {
    setNotificationReadIds(next);
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(next));
  };

  const markNotificationRead = (id) => {
    saveNotificationState({ ...notificationReadIds, [id]: true });
  };

  const markAllNotificationsRead = () => {
    const next = { ...notificationReadIds };
    notificationItems.forEach((item) => {
      next[item.id] = true;
    });
    saveNotificationState(next);
  };

  const clearAllNotifications = () => {
    const next = { ...notificationReadIds };
    notificationItems.forEach((item) => {
      next[item.id] = true;
    });
    saveNotificationState(next);
  };

  const openNotification = (item) => {
    markNotificationRead(item.id);
    if (item.targetPage === "schedule") {
      setSelectedScheduleClass(item.classItem || null);
    }
    openPage(item.targetPage || "notifications");
  };

  // Send only high-priority browser notifications once per milestone.
  useEffect(() => {
    if (!isLoggedIn || !settings.notifications || !window.isSecureContext || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const candidates = notificationItems.filter((item) => !item.read && item.browserPriority === "high");
    if (!candidates.length) return;

    const sent = getBrowserNotificationSent();
    const nextSent = { ...sent };
    let changed = false;

    candidates.forEach((item) => {
      if (sent[item.id]) return;
      try {
        new Notification(item.title, {
          body: item.message,
          icon: "/favicon.ico",
          tag: item.id,
        });
        nextSent[item.id] = new Date().toISOString();
        changed = true;
      } catch (error) {
        console.error("ClassMate browser notification failed:", error);
      }
    });

    if (changed) {
      localStorage.setItem(BROWSER_NOTIFICATION_SENT_KEY, JSON.stringify(nextSent));
    }
  }, [isLoggedIn, settings.notifications, currentTime, language, notificationItems.length]);

  // ==================================================
  // AUTH PAGE CHECK
  // ==================================================

  /*
    ใช้ isLoggedIn แทนการตรวจจากชื่อ page

    ก่อน Login:
    Login / Register / Forgot / Settings
    -> เมนูจะแสดง Settings อย่างเดียว

    หลัง Login:
    Home / Profile / Classes / Schedule / Settings
    -> เมนูจะแสดงทุกเมนู + Logout
  */

  const isLoggedInPage = isLoggedIn;

  // Prevent direct navigation to protected pages while logged out.
  useEffect(() => {
    if (!isLoggedIn && ["home", "profile", "classes", "schedule"].includes(page)) {
      setPage("login");
    }
  }, [isLoggedIn, page]);

  return (
    <div className={`app ${settings.theme === "dark" ? "theme-dark" : ""} ${settings.compactSchedule ? "compact-schedule" : ""}`}>
      {/* ==================================================
          HEADER
      ================================================== */}

      <header className="header">
        <button
          className="menu-btn"
          onClick={() => setMenuOpen(true)}
          type="button"
          aria-label="Open menu"
        >
          ☰
        </button>

        <h1>ClassMate</h1>

        <button
          className="language-btn"
          onClick={toggleLanguage}
          type="button"
        >
          ◉ {language === "en" ? "EN" : "TH"}⌄
        </button>

        {isLoggedIn && (
          <button
            className="notification-header-btn"
            type="button"
            onClick={() => openPage("notifications")}
            aria-label={language === "en" ? "Notifications" : "การแจ้งเตือน"}
          >
            <span>🔔</span>
            {unreadNotifications.length > 0 && (
              <b>{unreadNotifications.length > 9 ? "9+" : unreadNotifications.length}</b>
            )}
          </button>
        )}
      </header>

      {/* ==================================================
          SIDEBAR
      ================================================== */}

      {menuOpen && (
        <>
          <div
            className="menu-overlay"
            onClick={() => setMenuOpen(false)}
          />

          <aside className="sidebar">
            <div className="sidebar-header">
              <h2>ClassMate</h2>

              <button
                className="close-btn"
                onClick={() => setMenuOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>

            <nav className="sidebar-menu">
              {/* ==================================================
                  MENU FOR UNAUTHENTICATED PAGES
              ================================================== */}

              {!isLoggedInPage ? (
                <button
                  type="button"
                  onClick={() =>
                    handleMenuClick("settings")
                  }
                >
                  ⚙️{" "}
                  {language === "en"
                    ? "Settings"
                    : "ตั้งค่า"}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      handleMenuClick("home")
                    }
                  >
                    🏠{" "}
                    {language === "en"
                      ? "Home"
                      : "หน้าหลัก"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleMenuClick("profile")
                    }
                  >
                    👤{" "}
                    {language === "en"
                      ? "Profile"
                      : "โปรไฟล์"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleMenuClick("classes")
                    }
                  >
                    📚{" "}
                    {language === "en"
                      ? "My Classes"
                      : "วิชาของฉัน"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleMenuClick("schedule")
                    }
                  >
                    📅{" "}
                    {language === "en"
                      ? "Schedule"
                      : "ตารางเรียน"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleMenuClick("notifications")
                    }
                  >
                    🔔 {language === "en" ? "Notifications" : "การแจ้งเตือน"}
                    {unreadNotifications.length > 0 && (
                      <span className="sidebar-notification-count">{unreadNotifications.length > 9 ? "9+" : unreadNotifications.length}</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMenuClick("assignments")}
                  >
                    📝 {language === "en" ? "Assignments" : "งาน / การบ้าน"}
                    {pendingAssignments.length > 0 && (
                      <span className="sidebar-notification-count">{pendingAssignments.length > 9 ? "9+" : pendingAssignments.length}</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleMenuClick("settings")
                    }
                  >
                    ⚙️{" "}
                    {language === "en"
                      ? "Settings"
                      : "ตั้งค่า"}
                  </button>
                </>
              )}
            </nav>

            {/* ==================================================
                LOGOUT
            ================================================== */}

            {isLoggedInPage && (
              <button
                className="logout-btn"
                type="button"
                onClick={handleLogout}
              >
                🚪{" "}
                {language === "en"
                  ? "Logout"
                  : "ออกจากระบบ"}
              </button>
            )}
          </aside>
        </>
      )}

      {/* ==================================================
          MAIN
      ================================================== */}

      <main className="main">
        {/* ==================================================
            LOGIN
        ================================================== */}

        {page === "login" && (
          <form
            className="login-card"
            onSubmit={handleLogin}
          >
            <h2>
              {language === "en"
                ? "Welcome"
                : "ยินดีต้อนรับ"}
            </h2>

            <div className="logo-circle">
              <div className="logo-text">CLASSMATE</div>
            </div>

            <div className="input-group">
              <label htmlFor="username">
                {language === "en"
                  ? "Username"
                  : "ชื่อผู้ใช้"}
              </label>

              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value)
                }
              />
            </div>

            <div className="input-group">
              <label htmlFor="password">
                {language === "en"
                  ? "Password"
                  : "รหัสผ่าน"}
              </label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
              />
            </div>

            <a
              href="#"
              className="forgot"
              onClick={(e) => {
                e.preventDefault();
                setPage("forgot");
              }}
            >
              {language === "en"
                ? "Forgot password?"
                : "ลืมรหัสผ่าน?"}
            </a>

            <button
              type="submit"
              className="login-btn"
            >
              {language === "en"
                ? "Login"
                : "เข้าสู่ระบบ"}
            </button>

            <p className="register">
              {language === "en"
                ? "Don’t have Account?"
                : "ยังไม่มีบัญชี?"}

              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setPage("register");
                }}
              >
                {" "}
                {language === "en"
                  ? "Register"
                  : "สมัครสมาชิก"}
              </a>
            </p>
          </form>
        )}

        {/* ==================================================
            HOME
            KEEP THIS DESIGN
        ================================================== */}

        {page === "home" && (
          <div className="home-page home-dashboard">
            <section className="home-welcome home-dashboard-hero">
              <div className="home-hero-copy">
                <div className="home-hero-topline">
                  <p className="home-small-title">
                    {language === "en" ? "Welcome back" : "ยินดีต้อนรับกลับ"}
                  </p>
                  <span className="home-live-time">
                    {formatDashboardTime(currentTime)}
                  </span>
                </div>

                <h2>{profileUsername}</h2>

                <p className="home-hero-date">
                  {formatDashboardDate(currentTime)}
                </p>

                <p className="home-hero-subtitle">
                  {language === "en"
                    ? "Here’s a quick look at your study day."
                    : "นี่คือภาพรวมการเรียนของคุณในวันนี้"}
                </p>
              </div>

              <button
                type="button"
                className="home-avatar home-avatar-button"
                onClick={() => openPage("profile")}
                title={language === "en" ? "Open profile" : "เปิดโปรไฟล์"}
              >
                {profileImage ? (
                  <img src={profileImage} alt="Profile" />
                ) : (
                  "👤"
                )}
              </button>
            </section>

            <section className="home-stats-grid">
              <div className="home-stat-card">
                <div className="home-stat-icon">📚</div>
                <div>
                  <span>{language === "en" ? "Total Classes" : "รายวิชาทั้งหมด"}</span>
                  <strong>{totalClasses}</strong>
                </div>
              </div>

              <div className="home-stat-card">
                <div className="home-stat-icon">🗓️</div>
                <div>
                  <span>{language === "en" ? "Today" : "วันนี้"}</span>
                  <strong>{todayClasses.length}</strong>
                </div>
              </div>

              <div className="home-stat-card home-stat-next">
                <div className="home-stat-icon">⏰</div>
                <div>
                  <span>{language === "en" ? "Next Class" : "คาบถัดไป"}</span>
                  <strong>{nextTodayClass ? nextTodayClass.time : "—"}</strong>
                </div>
              </div>
            </section>

            <section className="home-stats-grid home-assignment-summary-grid">
              <div className="home-stat-card">
                <div className="home-stat-icon">📝</div>
                <div>
                  <span>{language === "en" ? "Assignments" : "งานทั้งหมด"}</span>
                  <strong>{assignments.length}</strong>
                </div>
              </div>

              <div className="home-stat-card">
                <div className="home-stat-icon">🎯</div>
                <div>
                  <span>{language === "en" ? "Due Today" : "ส่งวันนี้"}</span>
                  <strong>{smartAssignmentBuckets.today.length}</strong>
                </div>
              </div>

              <div className="home-stat-card">
                <div className="home-stat-icon">📅</div>
                <div>
                  <span>{language === "en" ? "Next 7 Days" : "7 วันข้างหน้า"}</span>
                  <strong>{smartAssignmentBuckets.next7.length}</strong>
                </div>
              </div>

              <div className="home-stat-card">
                <div className="home-stat-icon">📈</div>
                <div>
                  <span>{language === "en" ? "Progress" : "ความคืบหน้า"}</span>
                  <strong>{assignmentProgressTotal}%</strong>
                </div>
              </div>
            </section>

            <section className="home-section">
              <div className="home-section-heading">
                <div>
                  <h3>{language === "en" ? "Next Class" : "คาบเรียนถัดไป"}</h3>
                  <p>{getNextClassMessage()}</p>
                </div>
                <button
                  type="button"
                  className="home-text-btn"
                  onClick={() => openPage("schedule")}
                >
                  {language === "en" ? "View Schedule →" : "ดูตารางเรียน →"}
                </button>
              </div>

              {nextTodayClass ? (
                <button
                  type="button"
                  className={`home-next-card ${getClassColorClass(nextTodayClass)}`}
                  onClick={() => {
                    setSelectedScheduleClass(nextTodayClass);
                    openPage("schedule");
                  }}
                >
                  <div className="home-next-time">
                    <strong>{nextTodayClass.time}</strong>
                    <span>{getDayLabel(todayName)}</span>
                  </div>

                  <div className="home-next-divider" />

                  <div className="home-next-main">
                    <strong>{nextTodayClass.name}</strong>
                    <span>{nextTodayClass.code}</span>
                    <small>
                      {nextTodayClass.teacher} · {nextTodayClass.room}
                    </small>
                  </div>

                  <span className="home-next-arrow">→</span>
                </button>
              ) : (
                <div className="home-empty-card">
                  <div className="home-empty-icon">☕</div>
                  <div>
                    <strong>
                      {classes.length
                        ? language === "en"
                          ? "You’re done for today!"
                          : "วันนี้เรียนเสร็จแล้ว!"
                        : language === "en"
                          ? "Your dashboard is ready"
                          : "แดชบอร์ดของคุณพร้อมแล้ว"}
                    </strong>
                    <p>
                      {classes.length
                        ? language === "en"
                          ? "Enjoy your free time or prepare for tomorrow."
                          : "พักผ่อนหรือเตรียมตัวสำหรับวันพรุ่งนี้ได้เลย"
                        : language === "en"
                          ? "Add your first class to get a personalized schedule."
                          : "เพิ่มรายวิชาแรกเพื่อสร้างตารางเรียนของคุณ"}
                    </p>
                  </div>
                </div>
              )}
            </section>

            <section className="home-section">
              <div className="home-section-heading">
                <div>
                  <h3>{language === "en" ? "Today’s Classes" : "ตารางเรียนวันนี้"}</h3>
                  <p>
                    {language === "en"
                      ? `${todayClasses.length} class${todayClasses.length === 1 ? "" : "es"} scheduled`
                      : `มี ${todayClasses.length} รายวิชาในวันนี้`}
                  </p>
                </div>
                <button
                  type="button"
                  className="home-text-btn"
                  onClick={() => openPage("schedule")}
                >
                  {language === "en" ? "Full Schedule →" : "ตารางทั้งหมด →"}
                </button>
              </div>

              {todayClasses.length > 0 ? (
                <div className="home-today-list">
                  {todayClasses.slice(0, 4).map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={`home-today-item ${getClassColorClass(item)}`}
                      onClick={() => {
                        setSelectedScheduleClass(item);
                        openPage("schedule");
                      }}
                    >
                      <span className="home-today-dot" />
                      <span className="home-today-time">{item.time}</span>
                      <span className="home-today-info">
                        <strong>{item.name}</strong>
                        <small>{item.code} · {item.room}</small>
                      </span>
                      <span className="home-today-arrow">→</span>
                    </button>
                  ))}

                  {todayClasses.length > 4 && (
                    <button
                      type="button"
                      className="home-more-btn"
                      onClick={() => openPage("schedule")}
                    >
                      {language === "en"
                        ? `View ${todayClasses.length - 4} more class${todayClasses.length - 4 === 1 ? "" : "es"}`
                        : `ดูอีก ${todayClasses.length - 4} รายวิชา`}
                    </button>
                  )}
                </div>
              ) : (
                <div className="home-empty-card home-empty-today">
                  <div className="home-empty-icon">📅</div>
                  <div>
                    <strong>
                      {language === "en" ? "No classes today" : "วันนี้ไม่มีเรียน"}
                    </strong>
                    <p>
                      {language === "en"
                        ? "Your day is clear. Add a class whenever you’re ready."
                        : "วันนี้ตารางว่างแล้ว เพิ่มรายวิชาได้ทุกเมื่อ"}
                    </p>
                  </div>
                </div>
              )}
            </section>

            <section className="home-section home-assignments-section">
              <div className="home-section-heading">
                <div>
                  <h3>{language === "en" ? "Assignments" : "งาน / การบ้าน"}</h3>
                  <p>{language === "en" ? "Keep track of what is due next." : "ติดตามงานที่ต้องส่งและงานที่ใกล้ถึงกำหนด"}</p>
                </div>
                <button type="button" className="home-text-btn" onClick={() => openPage("assignments")}>
                  {language === "en" ? "View all →" : "ดูทั้งหมด →"}
                </button>
              </div>

              {upcomingAssignments.length || overdueAssignments.length ? (
                <div className="home-assignment-list">
                  {[...overdueAssignments, ...upcomingAssignments].slice(0, 4).map((item) => (
                    <button key={item.id} type="button" className={`home-assignment-item ${isAssignmentOverdue(item) ? "is-overdue" : ""}`} onClick={() => openPage("assignments")}>
                      <span className="home-assignment-check" aria-hidden="true">{item.status === "completed" ? "✓" : ""}</span>
                      <span className="home-assignment-main">
                        <strong>{item.title}</strong>
                        <small>{item.className} · {formatAssignmentDate(item.dueDate)} · {item.dueTime}</small>
                        <span className="home-assignment-progress"><span style={{ width: `${Number(item.progress) || (item.status === "completed" ? 100 : 0)}%` }} /></span>
                      </span>
                      <span className="home-assignment-right">
                        <b className={isAssignmentOverdue(item) ? "countdown overdue" : "countdown"}>{getAssignmentCountdown(item)}</b>
                        <span className={`assignment-priority-pill priority-${item.priority}`}>{item.priority}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="home-assignment-empty">
                  <span>📝</span>
                  <div>
                    <strong>{language === "en" ? "No assignments yet" : "ยังไม่มีงาน"}</strong>
                    <p>{language === "en" ? "Add your first task and connect it to a class." : "เพิ่มงานแรกและเชื่อมกับรายวิชาของคุณ"}</p>
                  </div>
                  <button
                    type="button"
                    className="login-btn compact-btn"
                    onClick={() => {
                      openPage("assignments");
                      openAddAssignmentForm();
                    }}
                  >
                    ＋ {language === "en" ? "Add Task" : "เพิ่มงาน"}
                  </button>
                </div>
              )}
            </section>

            <section className="home-section">
              <div className="home-section-heading">
                <div>
                  <h3>{language === "en" ? "Quick Actions" : "การทำงานด่วน"}</h3>
                  <p>{language === "en" ? "Manage your study space in one tap." : "จัดการการเรียนของคุณได้ในคลิกเดียว"}</p>
                </div>
              </div>

              <div className="home-actions-grid">
                <button type="button" className="home-action-card" onClick={() => { openPage("classes"); openAddClassForm(); }}>
                  <span className="home-action-icon">＋</span>
                  <strong>{language === "en" ? "Add Class" : "เพิ่มรายวิชา"}</strong>
                  <small>{language === "en" ? "Create a new class" : "สร้างรายวิชาใหม่"}</small>
                </button>

                <button type="button" className="home-action-card" onClick={() => openPage("schedule")}>
                  <span className="home-action-icon">📅</span>
                  <strong>{language === "en" ? "View Schedule" : "ดูตารางเรียน"}</strong>
                  <small>{language === "en" ? "See your weekly plan" : "ดูแผนการเรียนรายสัปดาห์"}</small>
                </button>

                <button type="button" className="home-action-card" onClick={() => openPage("profile")}>
                  <span className="home-action-icon">👤</span>
                  <strong>{language === "en" ? "Edit Profile" : "แก้ไขโปรไฟล์"}</strong>
                  <small>{language === "en" ? "Update your information" : "อัปเดตข้อมูลของคุณ"}</small>
                </button>

                <button type="button" className="home-action-card" onClick={() => openPage("settings")}>
                  <span className="home-action-icon">⚙️</span>
                  <strong>{language === "en" ? "Settings" : "ตั้งค่า"}</strong>
                  <small>{language === "en" ? "Customize ClassMate" : "ปรับแต่ง ClassMate"}</small>
                </button>
              </div>
            </section>
          </div>
        )}

        {/* ==================================================
            REGISTER
        ================================================== */}

        {page === "register" && (
          <form
            className="login-card"
            onSubmit={handleRegister}
          >
            <h2>
              {language === "en"
                ? "Create Account"
                : "สร้างบัญชี"}
            </h2>

            <div className="logo-circle">
              <div className="logo-text">CLASSMATE</div>
            </div>

            <div className="input-group">
              <label htmlFor="registerUsername">
                {language === "en"
                  ? "Username"
                  : "ชื่อผู้ใช้"}
              </label>

              <input
                id="registerUsername"
                type="text"
                value={registerUsername}
                onChange={(e) =>
                  setRegisterUsername(
                    e.target.value
                  )
                }
              />
            </div>

            <div className="input-group">
              <label htmlFor="email">
                {language === "en"
                  ? "Email"
                  : "อีเมล"}
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
              />
            </div>

            <div className="input-group">
              <label htmlFor="registerPassword">
                {language === "en"
                  ? "Password"
                  : "รหัสผ่าน"}
              </label>

              <input
                id="registerPassword"
                type="password"
                value={registerPassword}
                onChange={(e) =>
                  setRegisterPassword(
                    e.target.value
                  )
                }
              />
            </div>

            <div className="input-group">
              <label htmlFor="confirmPassword">
                {language === "en"
                  ? "Confirm Password"
                  : "ยืนยันรหัสผ่าน"}
              </label>

              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) =>
                  setConfirmPassword(
                    e.target.value
                  )
                }
              />
            </div>

            <button
              type="submit"
              className="login-btn"
              disabled={registerSubmitting}
            >
              {registerSubmitting
                ? (language === "en" ? "Creating account..." : "กำลังสร้างบัญชี...")
                : (language === "en" ? "Register" : "สมัครสมาชิก")}
            </button>

            <p className="register">
              {language === "en"
                ? "Already have an account?"
                : "มีบัญชีอยู่แล้ว?"}

              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setPage("login");
                }}
              >
                {" "}
                {language === "en"
                  ? "Login"
                  : "เข้าสู่ระบบ"}
              </a>
            </p>
          </form>
        )}

        {/* ==================================================
            FORGOT PASSWORD
        ================================================== */}

        {page === "forgot" && (
          <form
            className="login-card"
            onSubmit={handleForgotPassword}
          >
            <h2>
              {language === "en"
                ? "Forgot Password"
                : "ลืมรหัสผ่าน"}
            </h2>

            <div className="logo-circle">
              <div className="logo-text">CLASSMATE</div>
            </div>

            <div className="input-group">
              <label htmlFor="forgotEmail">
                {language === "en"
                  ? "Email"
                  : "อีเมล"}
              </label>

              <input
                id="forgotEmail"
                type="email"
                value={forgotEmail}
                onChange={(e) =>
                  setForgotEmail(e.target.value)
                }
              />
            </div>

            <button
              type="submit"
              className="login-btn"
            >
              {language === "en"
                ? "Send Reset Link"
                : "ส่งลิงก์รีเซ็ตรหัสผ่าน"}
            </button>

            <p className="register">
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setPage("login");
                }}
              >
                {language === "en"
                  ? "← Back to Login"
                  : "← กลับไปหน้าเข้าสู่ระบบ"}
              </a>
            </p>
          </form>
        )}

        {/* ==================================================
            PROFILE
        ================================================== */}

        {page === "profile" && (
          <div className="login-card profile-card">
            <h2>
              {editingProfile
                ? language === "en"
                  ? "Edit Profile"
                  : "แก้ไขโปรไฟล์"
                : language === "en"
                  ? "Profile"
                  : "โปรไฟล์"}
            </h2>

            {!editingProfile && (
              <div className="profile-hero">
                <div className="profile-hero-avatar">
                  {profileImage ? (
                    <img src={profileImage} alt="Profile" className="profile-image" />
                  ) : (
                    <span>👤</span>
                  )}
                </div>
                <div className="profile-hero-copy">
                  <span className="profile-kicker">
                    {language === "en" ? "STUDENT PROFILE" : "โปรไฟล์นักเรียน"}
                  </span>
                  <h3>{profileUsername}</h3>
                  <p>{major || (language === "en" ? "Add your major" : "เพิ่มสาขาของคุณ")}</p>
                  <span className="profile-institution">{institution}</span>
                </div>
                <div className="profile-hero-badge">
                  <strong>{totalClasses}</strong>
                  <span>{language === "en" ? "Classes" : "วิชา"}</span>
                </div>
              </div>
            )}

            <div className="profile-avatar">
              {editingProfile && editImage ? (
                <img
                  src={editImage}
                  alt="Profile"
                  className="profile-image"
                />
              ) : profileImage ? (
                <img
                  src={profileImage}
                  alt="Profile"
                  className="profile-image"
                />
              ) : (
                "👤"
              )}
            </div>

            {editingProfile ? (
              <div className="profile-edit-form">
                <div className="input-group">
                  <label htmlFor="editUsername">
                    {language === "en"
                      ? "Username"
                      : "ชื่อผู้ใช้"}
                  </label>

                  <input
                    id="editUsername"
                    type="text"
                    value={editUsername}
                    onChange={(e) =>
                      setEditUsername(
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="editEmail">
                    {language === "en"
                      ? "Email"
                      : "อีเมล"}
                  </label>

                  <input
                    id="editEmail"
                    type="email"
                    value={editEmail}
                    onChange={(e) =>
                      setEditEmail(e.target.value)
                    }
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="editStudentId">
                    {language === "en"
                      ? "Student ID"
                      : "รหัสนักศึกษา"}
                  </label>

                  <input
                    id="editStudentId"
                    type="text"
                    value={editStudentId}
                    onChange={(e) =>
                      setEditStudentId(
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="editMajor">
                    {language === "en"
                      ? "Class / Major"
                      : "ชั้น / สาขา"}
                  </label>

                  <input
                    id="editMajor"
                    type="text"
                    value={editMajor}
                    onChange={(e) =>
                      setEditMajor(e.target.value)
                    }
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="editInstitution">
                    {language === "en"
                      ? "Institution"
                      : "สถานศึกษา"}
                  </label>

                  <input
                    id="editInstitution"
                    type="text"
                    value={editInstitution}
                    onChange={(e) =>
                      setEditInstitution(
                        e.target.value
                      )
                    }
                    placeholder={
                      language === "en"
                        ? "Enter your school or university"
                        : "กรอกชื่อโรงเรียนหรือมหาวิทยาลัย"
                    }
                  />
                </div>

                <div className="profile-upload">
                  <label htmlFor="profileImageInput">
                    {language === "en"
                      ? "Profile Picture"
                      : "รูปโปรไฟล์"}
                  </label>

                  <input
                    id="profileImageInput"
                    type="file"
                    accept="image/*"
                    onChange={
                      handleProfileImageChange
                    }
                  />
                </div>

                <div className="profile-actions">
                  <button
                    type="button"
                    className="login-btn"
                    onClick={saveProfile}
                  >
                    💾{" "}
                    {language === "en"
                      ? "Save Changes"
                      : "บันทึกการเปลี่ยนแปลง"}
                  </button>

                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={
                      cancelEditingProfile
                    }
                  >
                    ✕{" "}
                    {language === "en"
                      ? "Cancel"
                      : "ยกเลิก"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="profile-completion">
                  <div className="profile-completion-head">
                    <span>{language === "en" ? "Profile completion" : "ความสมบูรณ์ของโปรไฟล์"}</span>
                    <strong>{profileCompletion}%</strong>
                  </div>
                  <div className="profile-progress-track">
                    <span style={{ width: `${profileCompletion}%` }} />
                  </div>
                </div>

                <div className="profile-info">
                  <div className="profile-row">
                    <span>
                      {language === "en"
                        ? "Username"
                        : "ชื่อผู้ใช้"}
                    </span>

                    <strong>
                      {profileUsername}
                    </strong>
                  </div>

                  <div className="profile-row">
                    <span>
                      {language === "en"
                        ? "Email"
                        : "อีเมล"}
                    </span>

                    <strong>
                      {profileEmail}
                    </strong>
                  </div>

                  <div className="profile-row">
                    <span>
                      {language === "en"
                        ? "Student ID"
                        : "รหัสนักศึกษา"}
                    </span>

                    <strong>
                      {studentId}
                    </strong>
                  </div>

                  <div className="profile-row">
                    <span>
                      {language === "en"
                        ? "Class / Major"
                        : "ชั้น / สาขา"}
                    </span>

                    <strong>{major}</strong>
                  </div>

                  <div className="profile-row">
                    <span>
                      {language === "en"
                        ? "Institution"
                        : "สถานศึกษา"}
                    </span>

                    <strong>
                      {institution}
                    </strong>
                  </div>
                </div>

                <button
                  type="button"
                  className="login-btn"
                  onClick={
                    startEditingProfile
                  }
                >
                  ✏️{" "}
                  {language === "en"
                    ? "Edit Profile"
                    : "แก้ไขโปรไฟล์"}
                </button>
              </>
            )}
          </div>
        )}

        {/* ==================================================
            MY CLASSES
            KEEP THIS DESIGN
        ================================================== */}

        {page === "classes" && (
          <div className="classes-page">
            <div className="classes-header">
              <div>
                <p className="home-small-title">
                  {language === "en" ? "Your study" : "การเรียนของคุณ"}
                </p>
                <h2>
                  {language === "en" ? "My Classes" : "วิชาของฉัน"}
                </h2>
                <p className="classes-count">
                  {language === "en"
                    ? `${totalClasses} ${totalClasses === 1 ? "class" : "classes"}`
                    : `${totalClasses} รายวิชา`}
                </p>
              </div>

              <button type="button" className="add-class-btn" onClick={openAddClassForm}>
                ＋ {language === "en" ? "Add Class" : "เพิ่มรายวิชา"}
              </button>
            </div>

            {classes.length > 0 && (
              <div className="classes-toolbar">
                <div className="class-search-wrap">
                  <span>⌕</span>
                  <input
                    type="search"
                    value={classSearch}
                    onChange={(e) => setClassSearch(e.target.value)}
                    placeholder={
                      language === "en"
                        ? "Search class, code, teacher..."
                        : "ค้นหาวิชา รหัส อาจารย์..."
                    }
                  />
                  {classSearch && (
                    <button
                      type="button"
                      className="clear-search-btn"
                      onClick={() => setClassSearch("")}
                    >
                      ×
                    </button>
                  )}
                </div>

                <select
                  className="class-filter-select"
                  value={classDayFilter}
                  onChange={(e) => setClassDayFilter(e.target.value)}
                >
                  <option value="all">{language === "en" ? "All days" : "ทุกวัน"}</option>
                  <option value="Monday">{language === "en" ? "Monday" : "จันทร์"}</option>
                  <option value="Tuesday">{language === "en" ? "Tuesday" : "อังคาร"}</option>
                  <option value="Wednesday">{language === "en" ? "Wednesday" : "พุธ"}</option>
                  <option value="Thursday">{language === "en" ? "Thursday" : "พฤหัสบดี"}</option>
                  <option value="Friday">{language === "en" ? "Friday" : "ศุกร์"}</option>
                  <option value="Saturday">{language === "en" ? "Saturday" : "เสาร์"}</option>
                  <option value="Sunday">{language === "en" ? "Sunday" : "อาทิตย์"}</option>
                </select>

                <select
                  className="class-filter-select"
                  value={classSort}
                  onChange={(e) => setClassSort(e.target.value)}
                >
                  <option value="name">{language === "en" ? "Sort: Name" : "เรียง: ชื่อวิชา"}</option>
                  <option value="code">{language === "en" ? "Sort: Code" : "เรียง: รหัสวิชา"}</option>
                  <option value="day">{language === "en" ? "Sort: Day" : "เรียง: วัน"}</option>
                </select>
              </div>
            )}

            {showClassForm && (
              <form className="class-form-card" onSubmit={saveClass}>
                <div className="class-form-heading">
                  <div>
                    <span className="form-eyebrow">
                      {editingClassId !== null
                        ? language === "en" ? "UPDATE COURSE" : "แก้ไขข้อมูลวิชา"
                        : language === "en" ? "NEW COURSE" : "เพิ่มรายวิชา"}
                    </span>
                    <h3>
                      {editingClassId !== null
                        ? language === "en" ? "Edit Class" : "แก้ไขรายวิชา"
                        : language === "en" ? "Add New Class" : "เพิ่มรายวิชาใหม่"}
                    </h3>
                  </div>
                  <button type="button" className="form-close-btn" onClick={resetClassForm}>×</button>
                </div>

                <div className="class-form-grid">
                  <div className="input-group">
                    <label htmlFor="className">{language === "en" ? "Class Name" : "ชื่อรายวิชา"}</label>
                    <input id="className" type="text" value={className} onChange={(e) => setClassName(e.target.value)} placeholder={language === "en" ? "Example: Web Programming" : "เช่น Web Programming"} />
                  </div>

                  <div className="input-group">
                    <label htmlFor="classCode">{language === "en" ? "Course Code" : "รหัสวิชา"}</label>
                    <input id="classCode" type="text" value={classCode} onChange={(e) => setClassCode(e.target.value)} placeholder="CS101" />
                  </div>

                  <div className="input-group">
                    <label htmlFor="classTeacher">{language === "en" ? "Teacher" : "อาจารย์"}</label>
                    <input id="classTeacher" type="text" value={classTeacher} onChange={(e) => setClassTeacher(e.target.value)} placeholder={language === "en" ? "Teacher name" : "ชื่ออาจารย์"} />
                  </div>

                  <div className="input-group">
                    <label htmlFor="classDay">{language === "en" ? "Day" : "วัน"}</label>
                    <select id="classDay" value={classDay} onChange={(e) => setClassDay(e.target.value)}>
                      <option value="Monday">{language === "en" ? "Monday" : "จันทร์"}</option>
                      <option value="Tuesday">{language === "en" ? "Tuesday" : "อังคาร"}</option>
                      <option value="Wednesday">{language === "en" ? "Wednesday" : "พุธ"}</option>
                      <option value="Thursday">{language === "en" ? "Thursday" : "พฤหัสบดี"}</option>
                      <option value="Friday">{language === "en" ? "Friday" : "ศุกร์"}</option>
                      <option value="Saturday">{language === "en" ? "Saturday" : "เสาร์"}</option>
                      <option value="Sunday">{language === "en" ? "Sunday" : "อาทิตย์"}</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label htmlFor="classTime">{language === "en" ? "Time" : "เวลาเรียน"}</label>
                    <input id="classTime" type="text" value={classTime} onChange={(e) => setClassTime(e.target.value)} placeholder="09:00 - 12:00" />
                  </div>

                  <div className="input-group">
                    <label htmlFor="classRoom">{language === "en" ? "Room" : "ห้องเรียน"}</label>
                    <input id="classRoom" type="text" value={classRoom} onChange={(e) => setClassRoom(e.target.value)} placeholder={language === "en" ? "Room 301" : "ห้อง 301"} />
                  </div>

                  <div className="input-group class-color-group">
                    <label>{language === "en" ? "Class Color" : "สีประจำวิชา"}</label>
                    <div className="class-color-picker">
                      {classColorOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={`color-choice ${option.value} ${classColor === option.value ? "selected" : ""}`}
                          onClick={() => setClassColor(option.value)}
                          title={language === "en" ? option.labelEn : option.labelTh}
                        >
                          {option.emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="class-form-actions">
                  <button type="submit" className="login-btn">
                    💾 {editingClassId !== null
                      ? language === "en" ? "Save Changes" : "บันทึกการแก้ไข"
                      : language === "en" ? "Add Class" : "เพิ่มรายวิชา"}
                  </button>
                  <button type="button" className="cancel-btn" onClick={resetClassForm}>
                    ✕ {language === "en" ? "Cancel" : "ยกเลิก"}
                  </button>
                </div>
              </form>
            )}

            {classes.length === 0 ? (
              <div className="empty-classes">
                <div className="empty-classes-icon">📚</div>
                <h3>{language === "en" ? "No classes yet" : "ยังไม่มีรายวิชา"}</h3>
                <p>{language === "en" ? "Add your first class to get started." : "เพิ่มรายวิชาแรกของคุณเพื่อเริ่มต้น"}</p>
                <button type="button" className="add-class-btn" onClick={openAddClassForm}>
                  ＋ {language === "en" ? "Add Class" : "เพิ่มรายวิชา"}
                </button>
              </div>
            ) : filteredClasses.length === 0 ? (
              <div className="empty-classes filtered-empty">
                <div className="empty-classes-icon">⌕</div>
                <h3>{language === "en" ? "No matching classes" : "ไม่พบรายวิชาที่ค้นหา"}</h3>
                <p>{language === "en" ? "Try another keyword or clear your filters." : "ลองใช้คำค้นหาอื่น หรือล้างตัวกรอง"}</p>
                <button
                  type="button"
                  className="add-class-btn secondary-action"
                  onClick={() => { setClassSearch(""); setClassDayFilter("all"); }}
                >
                  ↺ {language === "en" ? "Clear Filters" : "ล้างตัวกรอง"}
                </button>
              </div>
            ) : (
              <div className="classes-list">
                {filteredClasses.map((item) => (
                  <div
                    className={`class-card class-color-${item.color || "blue"}`}
                    key={item.id}
                  >
                    <div className="class-color-strip" />

                    <div className="class-card-top">
                      <div className={`class-icon class-color-${item.color || "blue"}`}>📚</div>

                      <div className="class-title">
                        <h3>{item.name}</h3>
                        <span>{item.code}</span>
                      </div>

                      <div className="class-actions">
                        <button type="button" className="class-info-btn" onClick={() => setSelectedClass(item)} title={language === "en" ? "View details" : "ดูรายละเอียด"}>ⓘ</button>
                        <button type="button" className="class-edit-btn" onClick={() => openEditClassForm(item)} title={language === "en" ? "Edit" : "แก้ไข"}>✏️</button>
                        <button type="button" className="class-delete-btn" onClick={() => deleteClass(item.id)} title={language === "en" ? "Delete" : "ลบ"}>🗑️</button>
                      </div>
                    </div>

                    <div className="class-details">
                      <div className="class-detail">
                        <span>👨‍🏫</span>
                        <div><small>{language === "en" ? "Teacher" : "อาจารย์"}</small><strong>{item.teacher}</strong></div>
                      </div>
                      <div className="class-detail">
                        <span>📅</span>
                        <div><small>{language === "en" ? "Day" : "วัน"}</small><strong>{getDayLabel(item.day)}</strong></div>
                      </div>
                      <div className="class-detail">
                        <span>🕐</span>
                        <div><small>{language === "en" ? "Time" : "เวลา"}</small><strong>{item.time}</strong></div>
                      </div>
                      <div className="class-detail">
                        <span>🏫</span>
                        <div><small>{language === "en" ? "Room" : "ห้อง"}</small><strong>{item.room}</strong></div>
                      </div>
                    </div>

                    <button type="button" className="class-view-hint" onClick={() => setSelectedClass(item)}>
                      {language === "en" ? "View class details →" : "ดูรายละเอียดวิชา →"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {selectedClass && (
              <div className="class-detail-overlay" onClick={() => setSelectedClass(null)}>
                <div
                  className={`class-detail-modal class-color-${selectedClass.color || "blue"}`}
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                >
                  <div className="modal-color-orb" />
                  <button type="button" className="modal-close-btn" onClick={() => setSelectedClass(null)}>×</button>
                  <div className="modal-class-icon">📚</div>
                  <span className="modal-course-code">{selectedClass.code}</span>
                  <h3>{selectedClass.name}</h3>

                  <div className="modal-details-grid">
                    <div><span>👨‍🏫</span><small>{language === "en" ? "Teacher" : "อาจารย์"}</small><strong>{selectedClass.teacher}</strong></div>
                    <div><span>📅</span><small>{language === "en" ? "Day" : "วัน"}</small><strong>{getDayLabel(selectedClass.day)}</strong></div>
                    <div><span>🕐</span><small>{language === "en" ? "Time" : "เวลา"}</small><strong>{selectedClass.time}</strong></div>
                    <div><span>🏫</span><small>{language === "en" ? "Room" : "ห้อง"}</small><strong>{selectedClass.room}</strong></div>
                  </div>

                  <div className="modal-actions">
                    <button
                      type="button"
                      className="login-btn"
                      onClick={() => {
                        const item = selectedClass;
                        setSelectedClass(null);
                        openEditClassForm(item);
                      }}
                    >
                      ✏️ {language === "en" ? "Edit Class" : "แก้ไขรายวิชา"}
                    </button>
                    <button type="button" className="cancel-btn" onClick={() => setSelectedClass(null)}>
                      {language === "en" ? "Close" : "ปิด"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}


        {/* ==================================================
            SCHEDULE
        ================================================== */}

        {page === "schedule" && (
          <div className="schedule-page">
            <div className="schedule-page-header">
              <div>
                <p className="home-small-title">
                  {language === "en" ? "Your weekly plan" : "แผนการเรียนประจำสัปดาห์"}
                </p>
                <h2>{language === "en" ? "Schedule" : "ตารางเรียน"}</h2>
                <p className="schedule-subtitle">
                  {classes.length
                    ? language === "en"
                      ? `${classes.length} classes connected from My Classes`
                      : `เชื่อมต่อจากวิชาของฉัน ${classes.length} รายวิชา`
                    : language === "en"
                      ? "Add classes to build your weekly schedule."
                      : "เพิ่มรายวิชาเพื่อสร้างตารางเรียนประจำสัปดาห์"}
                </p>
              </div>

              <div className="schedule-header-actions">
                <div className="schedule-view-toggle">
                  <button
                    type="button"
                    className={scheduleView === "week" ? "active" : ""}
                    onClick={() => setScheduleView("week")}
                  >
                    ▦ {language === "en" ? "Week" : "สัปดาห์"}
                  </button>
                  <button
                    type="button"
                    className={scheduleView === "list" ? "active" : ""}
                    onClick={() => setScheduleView("list")}
                  >
                    ☰ {language === "en" ? "List" : "รายการ"}
                  </button>
                </div>

                <button
                  type="button"
                  className="schedule-print-btn"
                  onClick={() => window.print()}
                >
                  🖨️ {language === "en" ? "Print" : "พิมพ์"}
                </button>
              </div>
            </div>

            {classes.length === 0 ? (
              <div className="schedule-empty">
                <div className="schedule-empty-icon">📅</div>
                <h3>{language === "en" ? "Your schedule is empty" : "ตารางเรียนยังว่างอยู่"}</h3>
                <p>
                  {language === "en"
                    ? "Add classes in My Classes and they will appear here automatically."
                    : "เพิ่มวิชาในเมนูวิชาของฉัน แล้ววิชาจะมาแสดงที่นี่อัตโนมัติ"}
                </p>
                <button
                  type="button"
                  className="add-class-btn"
                  onClick={() => openPage("classes")}
                >
                  📚 {language === "en" ? "Go to My Classes" : "ไปที่วิชาของฉัน"}
                </button>
              </div>
            ) : (
              <>
                <div className="schedule-today-banner">
                  <div className="today-banner-icon">✨</div>
                  <div>
                    <span>{language === "en" ? "TODAY" : "วันนี้"}</span>
                    <strong>
                      {getDayLabel(getTodayName())}
                    </strong>
                  </div>
                  <div className="today-banner-count">
                    <strong>{getScheduleClasses(getTodayName()).length}</strong>
                    <span>{language === "en" ? "classes" : "วิชา"}</span>
                  </div>
                </div>

                {scheduleView === "week" ? (
                  <div className="schedule-grid-wrap">
                    <div className="schedule-timeline">
                      <div className="schedule-timeline-head">
                        <div className="schedule-timeline-corner">TIME</div>
                        {scheduleDays.map((day) => (
                          <div
                            key={day.key}
                            className={`schedule-timeline-day-head ${day.key === getTodayName() ? "today" : ""}`}
                          >
                            <small>{language === "en" ? day.en : day.th}</small>
                            <strong>{day.key === getTodayName() ? "●" : ""}</strong>
                          </div>
                        ))}
                      </div>

                      {scheduleTimeSlots.length === 0 ? (
                        <div className="schedule-no-times">
                          {language === "en" ? "Add a time to your classes to see the timetable." : "เพิ่มเวลาเรียนในแต่ละวิชาเพื่อแสดงตาราง"}
                        </div>
                      ) : (
                        <div
                          className="schedule-timeline-body"
                          style={{ minHeight: `${scheduleTimelineHeight}px` }}
                        >
                          <div
                            className="schedule-timeline-axis"
                            style={{ height: `${scheduleTimelineHeight}px` }}
                          >
                            {scheduleTimelineSlots.map((minute) => (
                              <span
                                key={minute}
                                className={minute % 60 === 0 ? "major" : "minor"}
                                style={{ top: `${((minute - scheduleTimelineStart) / 30) * scheduleTimelineSlotHeight}px` }}
                              >
                                {minute % 60 === 0 ? formatScheduleClock(minute) : ""}
                              </span>
                            ))}
                          </div>

                          {scheduleDays.map((day) => {
                            const dayClasses = timedScheduleRows.filter((item) => item.day === day.key);
                            return (
                              <div
                                key={day.key}
                                className={`schedule-timeline-day-column ${day.key === getTodayName() ? "today-column" : ""}`}
                                style={{ height: `${scheduleTimelineHeight}px` }}
                              >
                                {dayClasses.map((item) => (
                                  <button
                                    type="button"
                                    className={`schedule-class-card schedule-time-block class-color-${item.color || "blue"}`}
                                    style={getTimelineStyle(item)}
                                    key={item.id}
                                    onClick={() => setSelectedScheduleClass(item)}
                                    title={`${item.name} · ${item.time}`}
                                  >
                                    <span className="schedule-card-code">{item.code}</span>
                                    <strong>{item.name}</strong>
                                    <small>🕐 {item.time}</small>
                                    <small>⌂ {item.room}</small>
                                  </button>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="schedule-list-view">
                    {scheduleDays.map((day) => {
                      const dayClasses = getScheduleClasses(day.key);
                      if (!dayClasses.length) return null;

                      return (
                        <section
                          className={`schedule-list-day ${day.key === getTodayName() ? "today" : ""}`}
                          key={day.key}
                        >
                          <div className="schedule-list-day-head">
                            <div>
                              <span>{language === "en" ? day.en : day.th}</span>
                              <strong>{getDayLabel(day.key)}</strong>
                            </div>
                            {day.key === getTodayName() && (
                              <b>{language === "en" ? "TODAY" : "วันนี้"}</b>
                            )}
                          </div>

                          <div className="schedule-list-items">
                            {dayClasses.map((item) => (
                              <button
                                type="button"
                                className={`schedule-list-item class-color-${item.color || "blue"}`}
                                key={item.id}
                                onClick={() => setSelectedScheduleClass(item)}
                              >
                                <div className="schedule-list-time">{item.time}</div>
                                <div className="schedule-list-main">
                                  <strong>{item.name}</strong>
                                  <span>{item.code} · {item.teacher}</span>
                                </div>
                                <div className="schedule-list-room">🏫 {item.room}</div>
                                <span className="schedule-list-arrow">→</span>
                              </button>
                            ))}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                )}

                <div className="schedule-footer-tip">
                  <span>💡</span>
                  <p>
                    {language === "en"
                      ? "Tap a class to view details. Changes made in My Classes are reflected here automatically."
                      : "แตะที่วิชาเพื่อดูรายละเอียด การแก้ไขในวิชาของฉันจะอัปเดตที่นี่อัตโนมัติ"}
                  </p>
                </div>
              </>
            )}

            {selectedScheduleClass && (
              <div
                className="schedule-modal-overlay"
                onClick={() => setSelectedScheduleClass(null)}
              >
                <div
                  className={`schedule-modal class-color-${selectedScheduleClass.color || "blue"}`}
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                >
                  <button
                    type="button"
                    className="modal-close-btn"
                    onClick={() => setSelectedScheduleClass(null)}
                  >
                    ×
                  </button>
                  <div className="schedule-modal-icon">📅</div>
                  <span className="modal-course-code">{selectedScheduleClass.code}</span>
                  <h3>{selectedScheduleClass.name}</h3>

                  <div className="schedule-modal-info">
                    <div>
                      <span>📅</span>
                      <small>{language === "en" ? "Day" : "วัน"}</small>
                      <strong>{getDayLabel(selectedScheduleClass.day)}</strong>
                    </div>
                    <div>
                      <span>🕐</span>
                      <small>{language === "en" ? "Time" : "เวลา"}</small>
                      <strong>{selectedScheduleClass.time}</strong>
                    </div>
                    <div>
                      <span>🏫</span>
                      <small>{language === "en" ? "Room" : "ห้อง"}</small>
                      <strong>{selectedScheduleClass.room}</strong>
                    </div>
                    <div>
                      <span>👨‍🏫</span>
                      <small>{language === "en" ? "Teacher" : "อาจารย์"}</small>
                      <strong>{selectedScheduleClass.teacher}</strong>
                    </div>
                  </div>

                  <div className="schedule-modal-actions">
                    <button
                      type="button"
                      className="login-btn"
                      onClick={() => {
                        const item = selectedScheduleClass;
                        setSelectedScheduleClass(null);
                        openPage("classes");
                        openEditClassForm(item);
                      }}
                    >
                      ✏️ {language === "en" ? "Edit in My Classes" : "แก้ไขในวิชาของฉัน"}
                    </button>
                    <button
                      type="button"
                      className="cancel-btn"
                      onClick={() => setSelectedScheduleClass(null)}
                    >
                      {language === "en" ? "Close" : "ปิด"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}


        {/* ==================================================
            ASSIGNMENTS / TASKS
        ================================================== */}

        {page === "assignments" && (
          <div className="assignments-page">
            <div className="assignments-header">
              <div>
                <p className="home-small-title">
                  {language === "en" ? "Stay organized" : "จัดการงานให้เป็นระเบียบ"}
                </p>
                <h2>{language === "en" ? "Assignments" : "งาน / การบ้าน"}</h2>
                <p className="assignments-subtitle">
                  {language === "en"
                    ? "Track every task and connect it directly to your classes."
                    : "ติดตามงานทุกชิ้นและเชื่อมกับรายวิชาของคุณโดยตรง"}
                </p>
              </div>
              <button
                type="button"
                className="assignment-add-btn"
                onClick={() => openAddAssignmentForm()}
                disabled={classes.length === 0}
              >
                ＋ {language === "en" ? "Add Assignment" : "เพิ่มงาน"}
              </button>
            </div>

            <div className="assignment-stats-grid">
              <div className="assignment-stat-card"><span>📝</span><div><small>Total</small><strong>{assignments.length}</strong></div></div>
              <div className="assignment-stat-card"><span>⏳</span><div><small>{language === "en" ? "Pending" : "ค้างอยู่"}</small><strong>{pendingAssignments.length}</strong></div></div>
              <div className="assignment-stat-card"><span>⚠️</span><div><small>{language === "en" ? "Overdue" : "เลยกำหนด"}</small><strong>{overdueAssignments.length}</strong></div></div>
              <div className="assignment-stat-card"><span>✓</span><div><small>{language === "en" ? "Completed" : "เสร็จแล้ว"}</small><strong>{completedAssignments.length}</strong></div></div>
            </div>

            <div className="smart-assignment-overview">
              <div className="smart-assignment-card"><span>🎯</span><div><small>{language === "en" ? "Today" : "วันนี้"}</small><strong>{smartAssignmentBuckets.today.length}</strong></div></div>
              <div className="smart-assignment-card"><span>📆</span><div><small>{language === "en" ? "Next 7 days" : "7 วันข้างหน้า"}</small><strong>{smartAssignmentBuckets.next7.length}</strong></div></div>
              <div className="smart-assignment-card smart-progress-card"><span>📈</span><div><small>{language === "en" ? "Overall progress" : "ความคืบหน้ารวม"}</small><strong>{assignmentProgressTotal}%</strong><div className="smart-progress-track"><i style={{ width: `${assignmentProgressTotal}%` }} /></div></div></div>
            </div>

            <div className="assignments-toolbar glass-panel">
              <label className="assignment-search-wrap">
                <span>⌕</span>
                <input
                  value={assignmentSearch}
                  onChange={(e) => setAssignmentSearch(e.target.value)}
                  placeholder={language === "en" ? "Search assignments..." : "ค้นหางาน..."}
                />
              </label>
              <div className="assignment-filters">
                {[
                  ["all", language === "en" ? "All" : "ทั้งหมด"],
                  ["today", language === "en" ? "Today" : "วันนี้"],
                  ["next7", language === "en" ? "Next 7 days" : "7 วัน"],
                  ["pending", language === "en" ? "Pending" : "ค้างอยู่"],
                  ["overdue", language === "en" ? "Overdue" : "เลยกำหนด"],
                  ["completed", language === "en" ? "Completed" : "เสร็จแล้ว"],
                ].map(([key, label]) => (
                  <button
                    type="button"
                    key={key}
                    className={assignmentFilter === key ? "active" : ""}
                    onClick={() => setAssignmentFilter(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {classes.length === 0 ? (
              <div className="assignments-empty glass-panel">
                <div>📚</div>
                <h3>{language === "en" ? "Add a class first" : "เพิ่มรายวิชาก่อน"}</h3>
                <p>{language === "en" ? "Assignments are linked to My Classes, so add at least one class before creating a task." : "งานจะเชื่อมกับวิชาของฉันโดยตรง กรุณาเพิ่มอย่างน้อย 1 รายวิชาก่อนสร้างงาน"}</p>
                <button type="button" className="login-btn compact-btn" onClick={() => openPage("classes")}>
                  📚 {language === "en" ? "Go to My Classes" : "ไปที่วิชาของฉัน"}
                </button>
              </div>
            ) : filteredAssignments.length === 0 ? (
              <div className="assignments-empty glass-panel">
                <div>📝</div>
                <h3>{assignments.length ? (language === "en" ? "No matching assignments" : "ไม่พบงานที่ค้นหา") : (language === "en" ? "No assignments yet" : "ยังไม่มีงาน")}</h3>
                <p>{assignments.length ? (language === "en" ? "Try another keyword or filter." : "ลองเปลี่ยนคำค้นหาหรือตัวกรอง") : (language === "en" ? "Create your first assignment and connect it to a class." : "สร้างงานแรกและเชื่อมกับรายวิชาของคุณ")}</p>
                {!assignments.length && (
                  <button type="button" className="login-btn compact-btn" onClick={() => openAddAssignmentForm()}>
                    ＋ {language === "en" ? "Add Assignment" : "เพิ่มงาน"}
                  </button>
                )}
              </div>
            ) : (
              <div className="assignments-list">
                {filteredAssignments.map((item) => {
                  const linkedClass = classes.find((c) => String(c.id) === String(item.classId));
                  const overdue = isAssignmentOverdue(item);
                  return (
                    <article key={item.id} className={`assignment-card ${overdue ? "is-overdue" : ""} ${item.status === "completed" ? "is-completed" : ""}`}>
                      <button type="button" className="assignment-check-btn" onClick={() => toggleAssignmentStatus(item.id)}>
                        {item.status === "completed" ? "✓" : ""}
                      </button>
                      <div>
                        <div className="assignment-card-top">
                          <span className={`assignment-class-dot class-color-${linkedClass?.color || "blue"}`} />
                          <span>{item.classCode || linkedClass?.code || ""}</span>
                          <span>·</span>
                          <span>{item.className || linkedClass?.name || (language === "en" ? "Unknown class" : "ไม่ทราบวิชา")}</span>
                        </div>
                        <h3>{item.title}</h3>
                        {item.note && <p>{item.note}</p>}
                        <div className="assignment-meta">
                          <span>📅 {formatAssignmentDate(item.dueDate)}</span>
                          <span>🕐 {item.dueTime || "23:59"}</span>
                          <span className={overdue ? "assignment-countdown overdue" : "assignment-countdown"}>⏳ {getAssignmentCountdown(item)}</span>
                          {overdue && <span className="assignment-overdue-pill">{language === "en" ? "OVERDUE" : "เลยกำหนด"}</span>}
                          <span className={`assignment-priority-pill priority-${item.priority}`}>{item.priority}</span>
                        </div>
                        <div className="assignment-progress-row">
                          <span>{language === "en" ? "Progress" : "ความคืบหน้า"}</span>
                          <div className="assignment-progress-track"><i style={{ width: `${Number(item.progress) || (item.status === "completed" ? 100 : 0)}%` }} /></div>
                          <select value={Number(item.progress) || (item.status === "completed" ? 100 : 0)} onChange={(e) => updateAssignmentProgress(item.id, e.target.value)} aria-label={language === "en" ? "Assignment progress" : "ความคืบหน้างาน"}>
                            {[0,25,50,75,100].map((value) => <option key={value} value={value}>{value}%</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="assignment-card-actions">
                        <button type="button" onClick={() => openEditAssignmentForm(item)}>✏️</button>
                        <button type="button" onClick={() => deleteAssignment(item.id)}>🗑️</button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {showAssignmentForm && (
              <div className="assignment-modal-overlay" onClick={() => setShowAssignmentForm(false)}>
                <form className="assignment-modal" onSubmit={saveAssignment} onClick={(e) => e.stopPropagation()}>
                  <div className="assignment-modal-header">
                    <div>
                      <p className="home-small-title">{editingAssignmentId ? (language === "en" ? "EDIT TASK" : "แก้ไขงาน") : (language === "en" ? "NEW TASK" : "งานใหม่")}</p>
                      <h3>{editingAssignmentId ? (language === "en" ? "Edit Assignment" : "แก้ไขงาน") : (language === "en" ? "Add Assignment" : "เพิ่มงาน")}</h3>
                    </div>
                    <button type="button" className="modal-close-btn" onClick={() => setShowAssignmentForm(false)}>×</button>
                  </div>

                  <div className="assignment-form-grid">
                    <label className="form-group assignment-full">
                      <span>{language === "en" ? "Assignment title" : "ชื่องาน"} *</span>
                      <input autoFocus value={assignmentTitle} onChange={(e) => setAssignmentTitle(e.target.value)} placeholder={language === "en" ? "e.g. Database Report" : "เช่น รายงาน Database"} required />
                    </label>
                    <label className="form-group">
                      <span>{language === "en" ? "Class" : "รายวิชา"} *</span>
                      <select value={assignmentClassId} onChange={(e) => setAssignmentClassId(e.target.value)} required>
                        <option value="">{language === "en" ? "Select a class" : "เลือกรายวิชา"}</option>
                        {classes.map((c) => <option key={c.id} value={c.id}>{c.code ? `${c.code} · ` : ""}{c.name}</option>)}
                      </select>
                    </label>
                    <label className="form-group">
                      <span>{language === "en" ? "Due date" : "วันส่ง"} *</span>
                      <input type="date" value={assignmentDueDate} onChange={(e) => setAssignmentDueDate(e.target.value)} required />
                    </label>
                    <label className="form-group">
                      <span>{language === "en" ? "Due time" : "เวลาส่ง"}</span>
                      <input type="time" value={assignmentDueTime} onChange={(e) => setAssignmentDueTime(e.target.value)} />
                    </label>
                    <label className="form-group">
                      <span>{language === "en" ? "Priority" : "ความสำคัญ"}</span>
                      <select value={assignmentPriority} onChange={(e) => setAssignmentPriority(e.target.value)}>
                        <option value="low">{language === "en" ? "Low" : "ต่ำ"}</option>
                        <option value="medium">{language === "en" ? "Medium" : "ปานกลาง"}</option>
                        <option value="high">{language === "en" ? "High" : "สูง"}</option>
                      </select>
                    </label>
                    <label className="form-group">
                      <span>{language === "en" ? "Progress" : "ความคืบหน้า"}</span>
                      <select value={assignmentProgress} onChange={(e) => setAssignmentProgress(Number(e.target.value))}>
                        {[0,25,50,75,100].map((value) => <option key={value} value={value}>{value}%</option>)}
                      </select>
                    </label>
                    <label className="form-group assignment-full">
                      <span>{language === "en" ? "Note" : "รายละเอียด"}</span>
                      <textarea rows="4" value={assignmentNote} onChange={(e) => setAssignmentNote(e.target.value)} placeholder={language === "en" ? "Optional note..." : "รายละเอียดเพิ่มเติม (ไม่บังคับ)"} />
                    </label>
                  </div>

                  <div className="assignment-modal-actions">
                    <button type="button" className="cancel-btn" onClick={() => setShowAssignmentForm(false)}>
                      {language === "en" ? "Cancel" : "ยกเลิก"}
                    </button>
                    <button type="submit" className="login-btn">
                      ✓ {editingAssignmentId ? (language === "en" ? "Save Changes" : "บันทึกการแก้ไข") : (language === "en" ? "Create Assignment" : "สร้างงาน")}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* ==================================================
            NOTIFICATIONS
        ================================================== */}

        {page === "notifications" && (
          <div className="notifications-page">
            <div className="notifications-header">
              <div>
                <p className="home-small-title">
                  {language === "en" ? "Stay on track" : "ติดตามการเรียนของคุณ"}
                </p>
                <h2>{language === "en" ? "Notifications" : "การแจ้งเตือน"}</h2>
                <p className="notifications-subtitle">
                  {language === "en"
                    ? `${unreadNotifications.length} unread notification${unreadNotifications.length === 1 ? "" : "s"}`
                    : `มี ${unreadNotifications.length} การแจ้งเตือนที่ยังไม่ได้อ่าน`}
                </p>
              </div>

              <div className="notifications-header-actions">
                <button type="button" className="notification-action-btn notification-browser-btn" onClick={requestBrowserNotifications}>
                  🖥️ {language === "en" ? "Enable desktop alerts" : "เปิดแจ้งเตือนบนเครื่อง"}
                </button>
                <button type="button" className="notification-action-btn" onClick={markAllNotificationsRead}>
                  ✓ {language === "en" ? "Mark all read" : "อ่านทั้งหมดแล้ว"}
                </button>
                <button type="button" className="notification-action-btn" onClick={clearAllNotifications}>
                  ✕ {language === "en" ? "Clear" : "ล้าง"}
                </button>
              </div>
            </div>

            <div className="notifications-filter glass-panel">
              <button
                type="button"
                className={notificationPage === "all" ? "active" : ""}
                onClick={() => setNotificationPage("all")}
              >
                {language === "en" ? "All" : "ทั้งหมด"}
              </button>
              <button
                type="button"
                className={notificationPage === "unread" ? "active" : ""}
                onClick={() => setNotificationPage("unread")}
              >
                {language === "en" ? "Unread" : "ยังไม่ได้อ่าน"}
                {unreadNotifications.length > 0 && <span>{unreadNotifications.length}</span>}
              </button>
            </div>

            {visibleNotifications.length > 0 ? (
              <div className="notifications-list">
                {visibleNotifications.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={`notification-card ${item.read ? "is-read" : "is-unread"} notification-${item.type}`}
                    onClick={() => openNotification(item)}
                  >
                    <span className="notification-icon">{item.icon}</span>
                    <span className="notification-content">
                      <strong>{item.title}</strong>
                      <small>{item.message}</small>
                      <em>{item.time} · {getDayLabel(todayName)}</em>
                    </span>
                    <span className="notification-arrow">›</span>
                    {!item.read && <span className="notification-unread-dot" />}
                  </button>
                ))}
              </div>
            ) : (
              <div className="notifications-empty glass-panel">
                <div className="notifications-empty-icon">🔔</div>
                <h3>
                  {language === "en" ? "You're all caught up" : "ไม่มีการแจ้งเตือนใหม่"}
                </h3>
                <p>
                  {language === "en"
                    ? "Class and assignment reminders will appear here automatically."
                    : "การแจ้งเตือนคาบเรียนและงานจะปรากฏที่นี่โดยอัตโนมัติ"}
                </p>
                <button type="button" className="login-btn" onClick={() => openPage("schedule")}>
                  📅 {language === "en" ? "View Schedule" : "ดูตารางเรียน"}
                </button>
              </div>
            )}

            <div className="notifications-tip glass-panel">
              <span>💡</span>
              <p>
                {language === "en"
                  ? "Tip: Notifications are based on today's classes and update automatically as the time changes."
                  : "เคล็ดลับ: การแจ้งเตือนอ้างอิงจากคาบเรียนวันนี้ และจะอัปเดตอัตโนมัติตามเวลา"}
              </p>
            </div>
          </div>
        )}

        {/* ==================================================
            SETTINGS
        ================================================== */}


        {page === "settings" && (
          <div className="settings-page">
            <section className="settings-hero">
              <div>
                <span className="settings-eyebrow">⚙️ {language === "en" ? "PREFERENCES" : "การตั้งค่า"}</span>
                <h2>{language === "en" ? "Settings" : "ตั้งค่า"}</h2>
                <p>{language === "en" ? "Personalize how ClassMate looks and works for you." : "ปรับแต่ง ClassMate ให้เหมาะกับการใช้งานของคุณ"}</p>
              </div>
              <div className="settings-hero-icon">✨</div>
            </section>

            <div className="settings-layout">
              <div className="settings-main">
                <section className="settings-panel">
                  <div className="settings-panel-title">
                    <div><span>🎨</span><div><h3>{language === "en" ? "Appearance" : "รูปลักษณ์"}</h3><p>{language === "en" ? "Choose your glass theme." : "เลือกธีมของหน้าตาแอป"}</p></div></div>
                  </div>
                  <div className="theme-options">
                    <button type="button" className={`theme-option ${settings.theme === "light" ? "active" : ""}`} onClick={() => updateSetting("theme", "light")}>
                      <span className="theme-preview theme-preview-light"><i>☀️</i><b>ClassMate</b></span>
                      <strong>{language === "en" ? "Light Glass" : "กระจกสว่าง"}</strong><small>{language === "en" ? "Clean & airy" : "สว่าง สบายตา"}</small>
                    </button>
                    <button type="button" className={`theme-option ${settings.theme === "dark" ? "active" : ""}`} onClick={() => updateSetting("theme", "dark")}>
                      <span className="theme-preview theme-preview-dark"><i>🌙</i><b>ClassMate</b></span>
                      <strong>{language === "en" ? "Dark Glass" : "กระจกมืด"}</strong><small>{language === "en" ? "Calm at night" : "สบายตาในเวลากลางคืน"}</small>
                    </button>
                  </div>
                </section>

                <section className="settings-panel">
                  <div className="settings-panel-title"><div><span>🕐</span><div><h3>{language === "en" ? "Time & Calendar" : "เวลาและปฏิทิน"}</h3><p>{language === "en" ? "Set how your schedule is displayed." : "กำหนดรูปแบบการแสดงตารางเรียน"}</p></div></div></div>
                  <div className="settings-list">
                    <div className="settings-row"><div><strong>{language === "en" ? "Time format" : "รูปแบบเวลา"}</strong><small>{language === "en" ? "Choose 12-hour or 24-hour time." : "เลือกเวลาแบบ 12 หรือ 24 ชั่วโมง"}</small></div><div className="segmented-control"><button type="button" className={settings.timeFormat === "12" ? "active" : ""} onClick={() => updateSetting("timeFormat", "12")}>12h</button><button type="button" className={settings.timeFormat === "24" ? "active" : ""} onClick={() => updateSetting("timeFormat", "24")}>24h</button></div></div>
                    <div className="settings-row"><div><strong>{language === "en" ? "Week starts on" : "เริ่มสัปดาห์วัน"}</strong><small>{language === "en" ? "Used for your weekly schedule." : "ใช้กำหนดลำดับวันในตารางเรียน"}</small></div><select className="settings-select" value={settings.weekStart} onChange={(e) => updateSetting("weekStart", e.target.value)}><option value="monday">{language === "en" ? "Monday" : "จันทร์"}</option><option value="sunday">{language === "en" ? "Sunday" : "อาทิตย์"}</option></select></div>
                  </div>
                </section>

                <section className="settings-panel">
                  <div className="settings-panel-title"><div><span>📅</span><div><h3>{language === "en" ? "Schedule" : "ตารางเรียน"}</h3><p>{language === "en" ? "Control the amount of information you see." : "ควบคุมการแสดงผลของตารางเรียน"}</p></div></div></div>
                  <div className="settings-list">
                    <div className="settings-row"><div><strong>{language === "en" ? "Compact schedule" : "ตารางแบบกระชับ"}</strong><small>{language === "en" ? "Use tighter spacing in Schedule and weekly views." : "ลดระยะห่างเพื่อให้เห็นข้อมูลมากขึ้น"}</small></div><button type="button" className={`settings-switch ${settings.compactSchedule ? "on" : ""}`} aria-pressed={settings.compactSchedule} onClick={() => updateSetting("compactSchedule", !settings.compactSchedule)}><span /></button></div>
                    <div className="settings-row"><div><strong>{language === "en" ? "Notifications" : "การแจ้งเตือน"}</strong><small>{language === "en" ? "Keep study reminders enabled." : "เปิดการแจ้งเตือนสำหรับการเรียน"}</small></div><button type="button" className={`settings-switch ${settings.notifications ? "on" : ""}`} aria-pressed={settings.notifications} onClick={() => updateSetting("notifications", !settings.notifications)}><span /></button></div>
                  </div>
                </section>

                <section className="settings-panel backup-panel">
                  <div className="settings-panel-title"><div><span>💾</span><div><h3>{language === "en" ? "Backup & Restore" : "สำรองและกู้คืนข้อมูล"}</h3><p>{language === "en" ? "Keep a portable copy of your ClassMate data." : "เก็บสำเนาข้อมูล ClassMate ไว้สำหรับย้ายเครื่องหรือป้องกันข้อมูลสูญหาย"}</p></div></div></div>
                  <div className="backup-content">
                    <div className="backup-info">
                      <strong>{language === "en" ? "Your data stays yours" : "ข้อมูลของคุณยังอยู่กับคุณ"}</strong>
                      <small>{language === "en" ? "Backup includes your profile, classes, assignments, preferences and notification state. Passwords are never included." : "ไฟล์สำรองจะเก็บโปรไฟล์ รายวิชา งาน การตั้งค่า และสถานะการแจ้งเตือน โดยจะไม่เก็บรหัสผ่าน"}</small>
                    </div>
                    <div className="backup-actions">
                      <button type="button" className="backup-action-btn" onClick={handleBackupData} disabled={!isLoggedIn}>
                        <span>⬇️</span>
                        <span><strong>{language === "en" ? "Backup Data" : "สำรองข้อมูล"}</strong><small>{language === "en" ? "Download JSON file" : "บันทึกเป็นไฟล์ JSON"}</small></span>
                      </button>
                      <label className={`backup-action-btn ${!isLoggedIn ? "is-disabled" : ""}`}>
                        <span>⬆️</span>
                        <span><strong>{language === "en" ? "Restore Data" : "กู้คืนข้อมูล"}</strong><small>{language === "en" ? "Import a ClassMate backup" : "นำเข้าไฟล์สำรองของ ClassMate"}</small></span>
                        <input className="backup-file-input" type="file" accept="application/json,.json" onChange={handleRestoreData} disabled={!isLoggedIn} />
                      </label>
                    </div>
                  </div>
                  <div className="backup-warning">⚠️ {language === "en" ? "Restoring replaces the current profile, classes, assignments and settings on this device." : "การกู้คืนจะแทนที่โปรไฟล์ รายวิชา งาน และการตั้งค่าปัจจุบันบนอุปกรณ์นี้"}</div>
                </section>
              </div>

              <aside className="settings-summary">
                <div className="settings-summary-icon">⚡</div>
                <span>{language === "en" ? "YOUR SETUP" : "การตั้งค่าของคุณ"}</span>
                <h3>{language === "en" ? "ClassMate is ready." : "ClassMate พร้อมใช้งาน"}</h3>
                <p>{language === "en" ? "Your preferences are saved automatically on this device." : "การตั้งค่าจะถูกบันทึกอัตโนมัติบนอุปกรณ์นี้"}</p>
                <div className="settings-summary-line"><span>Theme</span><b>{settings.theme === "dark" ? "Dark Glass" : "Light Glass"}</b></div>
                <div className="settings-summary-line"><span>Time</span><b>{settings.timeFormat === "12" ? "12-hour" : "24-hour"}</b></div>
                <div className="settings-summary-line"><span>Week</span><b>{settings.weekStart === "sunday" ? (language === "en" ? "Sunday" : "อาทิตย์") : (language === "en" ? "Monday" : "จันทร์")}</b></div>
              </aside>
            </div>

            {!isLoggedIn && (
              <button type="button" className="login-btn settings-back" onClick={() => { setPage("login"); setMenuOpen(false); }}>← {language === "en" ? "Back to Login" : "กลับไปหน้าเข้าสู่ระบบ"}</button>
            )}
          </div>
        )}
      
      </main>
    </div>
  );
}

export default App;