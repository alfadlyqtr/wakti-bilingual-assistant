export const MULTI_FILE_FEATURES_CAPABILITY = `
## 🔗 MULTI-FILE FEATURE PLAYBOOK

When a user asks for any feature below, you MUST touch ALL files listed — not just one.
A file that exists but is never imported does NOTHING. Dead code = failed task.

### STEP 0 — ALWAYS DO THIS FIRST FOR MULTI-FILE FEATURES:
1. Run list_files to see the full project structure
2. Write your plan: "I will touch N files: file1, file2, file3..."
3. Execute each file in order
4. Verify each file after editing
5. Only call task_complete after all files are done

---

### Language Toggle (Arabic/English, i18n, bilingual, RTL)
Files to touch:
1. CREATE /context/LanguageContext.js — translations object for both languages, toggleLanguage(), t(key) function, useEffect to set dir=rtl/ltr on html element
2. UPDATE App.js — import LanguageProvider, wrap entire app JSX with <LanguageProvider>
3. UPDATE Navbar — import useLanguage, add globe icon toggle button (ع / E), use t() for all nav link labels
4. UPDATE EVERY other component (Hero, Services, Footer, Contact, Team, etc.) — import useLanguage, replace ALL hardcoded text strings with t('key')

---

### Dark Mode Toggle
Files to touch:
1. CREATE /context/ThemeContext.js — theme state, toggleTheme(), useEffect to set data-theme on html
2. UPDATE App.js — import ThemeProvider, wrap app with <ThemeProvider>
3. UPDATE styles.css — add :root[data-theme="dark"] variable overrides
4. UPDATE Navbar — import useTheme, add sun/moon toggle button

---

### Shopping Cart
Files to touch:
1. CREATE /context/CartContext.js — items state, addItem(), removeItem(), clearCart(), total computed value
2. UPDATE App.js — import CartProvider, wrap app with <CartProvider>
3. UPDATE Navbar — import useCart, add cart icon with item count badge
4. UPDATE product components — import useCart, add "Add to Cart" button on each product calling addItem()
5. CREATE /components/Cart.jsx — cart drawer/modal showing items and total

---

### Authentication (Login / Signup / Logout)
Files to touch:
1. CREATE /context/AuthContext.js — user state, login(), logout(), signup()
2. UPDATE App.js — import AuthProvider, wrap app with <AuthProvider>
3. UPDATE Navbar — import useAuth, show login button when logged out, user name + logout when logged in
4. CREATE /pages/Login.jsx — login form
5. UPDATE App.js router — add /login route, protect private routes

---

### Scroll Animations (fade-in, slide-in, AOS, Framer Motion)
Files to touch:
1. UPDATE App.js — import and initialize animation library (e.g. AOS.init() in useEffect)
2. UPDATE EVERY section component — add animation wrapper or data-aos attribute to each major element
Note: Use framer-motion if already in the project. Use AOS if not. Never mix both.

---

### Toast / Notification System
Files to touch:
1. CREATE /context/ToastContext.js — toasts array state, showToast(message, type), removeToast()
2. UPDATE App.js — import ToastProvider, wrap app, render <ToastContainer> at root level
3. CREATE /components/Toast.jsx — renders toast list in fixed position
4. UPDATE any component that shows notifications — import useToast, call showToast()

---

### Modal / Popup System
Files to touch:
1. CREATE /context/ModalContext.js — isOpen state, openModal(content), closeModal()
2. UPDATE App.js — import ModalProvider, wrap app, render <Modal> at root level
3. CREATE /components/Modal.jsx — overlay + content slot
4. UPDATE triggering components — import useModal, call openModal() on button click

---

### New Page / Route
Files to touch:
1. CREATE /pages/NewPage.jsx — the page component
2. UPDATE App.js — add import + <Route path="/new-page" element={<NewPage />}>
3. UPDATE Navbar — add nav link <a href="/new-page">Page Name</a>
4. Verify: clicking the nav link loads the page

---

### Search / Filter (within one page)
Self-contained — one component only:
1. UPDATE the page/component — add useState for query + filtered list
2. Add <input onChange> that updates query
3. Render filteredItems.map() instead of allItems.map()
No context needed.

---

### Tabs / Accordion (within one component)
Self-contained — one component only:
1. UPDATE the component — add useState for activeTab
2. Render tab buttons that set activeTab
3. Conditionally render content based on activeTab
No context needed.

---

### Image Slider / Carousel
Self-contained — one component only:
1. UPDATE the component — add useState for currentIndex
2. Add prev/next buttons calling setCurrentIndex
3. Optional: useEffect with setInterval for auto-play
No context needed.

---

### Countdown Timer
Self-contained — one component only:
1. UPDATE the component — add useState for timeLeft
2. Add useEffect with setInterval to calculate days/hours/minutes/seconds from target date
3. Render the countdown display
No context needed.

---

### Theme Color Change
One file only:
1. UPDATE styles.css or index.css — change ONLY :root CSS variable values
ALL components automatically reflect the change via var(--color-name).
Never edit individual component colors. Never hardcode hex values in components.

---

### TASK_COMPLETE QUALITY — MANDATORY FORMAT
A bad summary like "Done" or "Added the toggle" is REJECTED.

Every task_complete summary MUST include:
- List every file changed with its full path
- One sentence per file explaining what changed
- Final line: "The user can now [see/click/use] [the feature] by [how to use it]"

Example:
"1. /context/LanguageContext.js — Created with EN/AR translations and toggleLanguage()
2. /App.js — Wrapped with LanguageProvider
3. /components/Navbar.jsx — Added globe toggle button, nav links translate
4. /components/Hero.jsx — All text uses t() keys
5. /components/Services.jsx — All text uses t() keys
The toggle (ع / E) is in the navbar. Clicking it switches the entire site between Arabic (RTL) and English (LTR)."
`;
