# PIMH Academy LMS — Complete Operations & Instruction Manual

**Live Portal URL:** [https://academy.craftedmindss.com](https://academy.craftedmindss.com)  
**Login Page:** [https://academy.craftedmindss.com/login](https://academy.craftedmindss.com/login)  
**Student Registration Page:** [https://academy.craftedmindss.com/register](https://academy.craftedmindss.com/register)

---

## 1. How the Academy LMS Works (4 Portals & Role Hierarchy)

PIMH Academy LMS is built around **four distinct roles**, each with its own dedicated portal and permission level:

| Role | Portal URL | Capabilities & Permissions |
| :--- | :--- | :--- |
| **Super Admin** | `/super-admin` | Full control over the entire academy. Can create/edit/delete **Super Admins**, **Admins**, **Faculty**, and **Students**; manage all courses; approve/reject student payment receipts; configure academy settings; view leads & activity logs; trigger deadline reminders. |
| **Admin** | `/admin` | Day-to-day operations manager. Can create/manage **Faculty** and **Students**, create/edit courses & schedules, approve/reject student payment receipts, and post announcements. *(Cannot create/modify Super Admins or delete users permanently).* |
| **Faculty (Teacher)** | `/faculty` | Course instructor portal. Can manage only the courses assigned to them: add weekly modules, upload study materials (PDFs/slides/links), create quizzes & assignments, schedule live classes, grade student submissions, and moderate course discussions. |
| **Student** | `/student` | Learner portal. Starts in a **Locked** state upon registration until a course payment receipt is uploaded and approved by an Admin/Super Admin. Once unlocked, students can access modules, download materials, take timed quizzes, submit assignments, join live sessions, and download completion certificates. |

---

## 2. How to Log In

### Master Super Admin Accounts
Your system is pre-configured with two **Master Super Admin** accounts:

1. **Email:** `abrar_a@live.com`  
   **Default Password:** `Password123!`  
   **Role:** `SUPER_ADMIN`
2. **Email:** `craft@craftedmindss.com`  
   **Default Password:** `Password123!`  
   **Role:** `SUPER_ADMIN`

### Two Ways to Sign In (`/login`)
1. **Email & Password:**
   - Go to [https://academy.craftedmindss.com/login](https://academy.craftedmindss.com/login).
   - Enter your email and password (use the **👁️ eye icon** to verify what you typed) and click **Sign In**.
   - The system automatically redirects you to your role's portal (`/super-admin`, `/admin`, `/faculty`, or `/student`).
2. **Continue with Google (One-Click OAuth):**
   - Click **Continue with Google** on `/login` or `/register`.
   - Select your Google account (`craft@craftedmindss.com`, student Gmail, etc.).
   - If your email already exists in the system (such as `craft@craftedmindss.com` or an invited Faculty member), Google automatically links to your existing role and logs you into your portal.
   - If a brand-new person signs in with Google for the first time, an email-verified **Student** account is created for them automatically.

> **Tip — Changing Your Password:**  
> Once logged in, click **Settings** in the left sidebar (or **Profile** for Faculty/Students) -> enter a new password under **Change Password** -> click **Update Password**.

---

## 3. How to Add & Manage Super Admins, Admins, and Faculty

### Step-by-Step: Adding a New Staff Member (Super Admin, Admin, or Faculty)
1. Log in as a **Super Admin** (`abrar_a@live.com` or `craft@craftedmindss.com`).
2. In the left sidebar, click **Users**.
3. Click the **`+ Create User`** button in the top-right corner.
4. Fill in the form:
   - **Full Name:** e.g., `Dr. Ahmed Khan`
   - **Email Address:** e.g., `ahmed@craftedmindss.com`
   - **Phone:** e.g., `+92 300 1234567`
   - **Role:** Select from the dropdown:
     - `SUPER_ADMIN` *(Only visible when logged in as a Super Admin)*
     - `ADMIN` *(Only visible when logged in as a Super Admin)*
     - `FACULTY`
     - `STUDENT`
   - **Title / Specialization:** e.g., `Senior Faculty — Clinical Psychology`
   - **Initial Password (Optional):**
     - If you type a password here, they can log in immediately with that password, **and** they will also receive an invitation email.
     - If you leave it blank, a secure temporary password is generated automatically.
5. Click **Create User**.

### What Happens Next (Automated Email Invite)
- When you create a **Super Admin**, **Admin**, or **Faculty** account, the system automatically sends an official invitation email from **`PIMH Academy <academy@craftedmindss.com>`** to their email address.
- The email contains a secure **`Set Up Your Account & Password`** link (`/setup-account?token=...`).
- When the staff member clicks that link:
  1. They choose their own private password (minimum 8 characters).
  2. Their email is marked as verified (`ACTIVE`).
  3. They are logged straight into their portal (`/super-admin`, `/admin`, or `/faculty`).

### Managing Existing Users (Edit, Deactivate, or Delete)
In the **Users** tab of the Super Admin portal:
- **Filter by Role:** Use the tabs (`All`, `Super Admins`, `Admins`, `Faculty`, `Students`) or the search box to find any user.
- **Edit Details / Change Role:** Click **Edit** next to a user to update their Name, Phone, Title, Role, or Status.
- **Suspend / Activate:** Click **Deactivate** to temporarily block a user from logging in (`INACTIVE`), or **Activate** to restore access.
- **Permanent Delete (Super Admin Only):** Click the red **Delete** button next to any user to permanently remove their account and all associated enrollments/submissions from the database.

---

## 4. How Students Join & Unlock Their Courses (2 Ways)

### Way 1: Student Self-Registration & Payment Receipt Approval (Standard Automated Flow)

This is the primary workflow designed for real students enrolling through the website:

#### Step A — Student Registers (`/register`)
1. The student visits [https://academy.craftedmindss.com/register](https://academy.craftedmindss.com/register).
2. They either:
   - Fill out **Full Name, Email, Phone, and Password** and click **Create Account** -> they receive an email from `PIMH Academy <academy@craftedmindss.com>` -> they click **"Verify My Email"** (which activates their account and redirects them to `/student`), **OR**
   - Click **Continue with Google** (which verifies their email automatically and takes them straight to `/student`).

#### Step B — Student Sees the Locked Dashboard & Uploads Payment Receipt
1. Because the new student has **0 active courses**, their Student Portal (`/student`) opens in **🔒 Locked Mode**:
   - Sidebar tabs (`My Courses`, `Assessments`, `Materials`, `Schedule`, `Discussions`, `Certificates`) display a lock icon (`🔒`).
   - Fake statistics are hidden.
2. In the center of the screen, the student sees the **3-Step Course Enrollment & Payment Verification Box**:
   - **Step 1:** Select the desired course from the dropdown (e.g., *Foundations of Counseling Theory*).
   - **Step 2:** Select their **Payment Receipt Image** (screenshot of bank transfer, EasyPaisa/JazzCash receipt, or deposit slip in JPG/PNG/WEBP format). A live preview of the receipt appears immediately.
   - **Step 3:** Click **`Submit Receipt for Approval`**.
3. Once submitted, the student sees their receipt status listed as **`⏳ Pending Review`** along with a **`🔄 Check Approval Status`** button.

#### Step C — Admin / Super Admin Reviews & Approves the Receipt
1. Log in to the **Super Admin** (`/super-admin`) or **Admin** (`/admin`) portal.
2. Look at the **Dashboard** or click **Enrollments** in the left sidebar.
3. At the top of **Enrollments**, you will see the **Pending Payment Receipts** table showing:
   - Student Name & Email
   - Requested Course Name
   - Date Submitted
   - **`🖼️ View Receipt`** button (click to open and inspect the student's uploaded payment screenshot in a new tab).
4. Take action:
   - Click **`✓ Approve & Unlock`**:
     - The student's enrollment status immediately changes from `Pending` to `Active`.
     - Module 1 of the course is unlocked for the student.
     - An automated **Enrollment Approved** email is sent to the student with a direct link to open their dashboard.
     - Next time the student clicks **Check Approval Status** (or refreshes `/student`), their full Student Dashboard and all sidebar tabs unlock immediately!
   - Or click **`✕ Reject`**:
     - The pending request is removed, and the student receives an email notifying them to upload a valid payment receipt.

---

### Way 2: Manual Enrolment by Admin / Super Admin (Direct Bypass)
If a student paid in person or you want to grant them immediate access without waiting for them to upload a receipt:
1. Ensure the student has registered (or create their account manually under **Users** -> **`+ Create User`** with Role = `STUDENT`).
2. Go to **Enrollments** in the left sidebar.
3. Click **`+ Enrol Student`** in the top-right corner.
4. Select the **Student** and the **Course** from the dropdowns and click **Enrol**.
5. This directly sets their enrollment to **`Active`** and unlocks their Student Dashboard immediately.

---

## 5. How to Manage Courses, Curriculum, Materials & Assessments

Your database comes with **3 ready-to-use courses** (*Foundations of Counseling Theory*, *Educational Psychology & Development*, and *Student Mental Health & Wellbeing*). You can edit these, assign faculty to them, or create brand-new courses.

### 5.1 Creating a Course & Assigning Faculty (Admin / Super Admin)
1. Go to **Courses** in the left sidebar.
2. Click **`+ Create Course`** to add a new course (enter Course Name, URL Slug, Description, Status = `Active`, and select an assigned Faculty teacher).
3. To assign or change the instructor on an existing course:
   - Click **Manage** (or **Assign Teacher**) on any course card -> select the **Faculty** member from the dropdown -> click **Save**.
   - Once assigned, that course immediately appears inside that teacher's **Faculty Portal (`/faculty`)**.

### 5.2 Adding Weekly Modules (Admin, Super Admin, or Assigned Faculty)
1. Open **Courses** (or **Modules & Unlock Rules** in the Faculty portal).
2. Select a course and click **`+ Add Module`**.
3. Enter the Module Title (e.g., `Week 1 — Introduction`) and the **Unlock Threshold %** (default `70%` — the minimum score required on the current module to unlock the next module).

### 5.3 Uploading Study Materials (PDFs, Slides, Videos, Links)
1. Go to **Materials** in the left sidebar.
2. Click **`+ Upload Material`**.
3. Choose the **Course & Module**, enter a **Title**, and choose:
   - **File Upload:** Upload a PDF, Word document, PowerPoint, or image directly from your computer, **OR**
   - **External Link:** Paste a YouTube/Vimeo video URL, Google Drive folder, or reading link.
4. Students enrolled in that course can now download or open the material from their **Materials** tab.

### 5.4 Creating Quizzes & Written Assignments
1. Go to **Assessments** (or **Quizzes & Assignments** in the Faculty portal).
2. Click **`+ Create Assessment`**.
3. Select the **Module**, enter the **Title**, **Due Date**, and choose the **Type**:
   - **Quiz (Auto-Graded Multiple Choice):**
     - Set the **Time Limit (minutes)** (e.g., `20` mins) and **Allowed Attempts** (e.g., `3`).
     - Add questions, provide 4 answer choices for each question, and mark the correct option.
     - When students take a quiz, it is timed and **graded automatically** upon submission.
   - **Assignment (Written / File Submission — Faculty Graded):**
     - Students type their response or paste their case study write-up in the Student Portal.
     - Their submission appears in the **Submissions** tab for the Faculty/Admin to grade.

### 5.5 Scheduling Live Classes (Zoom / Google Meet)
1. Go to **Schedule** in the left sidebar.
2. Click **`+ Add Session`**.
3. Select the **Course**, enter the **Session Title** (e.g., *Live Q&A — Week 2*), **Date**, **Time**, and paste your **Zoom or Google Meet link**.
4. Enrolled students will see the session on their **Schedule** calendar with a **`Join Live Session`** button.

---

## 6. Daily Operations: Grading, Discussions, Reminders & Certificates

### Grading Student Assignments (Faculty / Admin)
1. Click **Submissions** in the left sidebar.
2. You will see all student submissions labeled **`Ungraded`** or **`Graded`**.
3. Click **`Grade`** next to an ungraded submission:
   - Read the student's submitted text.
   - Enter a **Score (0–100)** and written **Feedback**.
   - Click **Submit Grade**.
4. The student receives an in-app notification with their score, and their module progress automatically updates. If their score meets the module's pass threshold (e.g., `70%`), the next module in the course automatically unlocks!

### Course Discussions & Announcements
- **Discussions:** Students and Faculty can post questions, replies, and file attachments inside any module's discussion board.
- **Announcements:**
  - **Super Admins / Admins** can post **Academy-Wide Announcements** (visible to everyone) or course-specific announcements.
  - **Faculty** can post announcements to their assigned courses.

### Automated & Manual Deadline Reminders
- **Automatic Background Check:** Every 6 hours, the server automatically checks for any Quiz or Assignment due within the next **48 hours** and emails enrolled students who haven't submitted yet (each student is only reminded once per assessment).
- **Manual Trigger Button:** As a Super Admin or Admin, you can go to the **Activity Log** tab at any time and click **`📧 Send Due Reminders Now`** in the top-right corner to immediately send reminder emails for upcoming deadlines.

### Student Completion Certificates
- Once a student completes all modules in an active course (`100%` course progress), a downloadable, print-ready **Official PIMH Academy Certificate of Completion** unlocks automatically inside their **Certificates** tab.

---

## 7. Quick Troubleshooting & Maintenance Checklist

| Question / Scenario | How to Handle It |
| :--- | :--- |
| **A student says they didn't receive the verification email** | Have them check their Spam/Promotions folder for `academy@craftedmindss.com`, or click **`Resend Verification Email`** on the `/verify-pending` screen. Alternatively, as Super Admin, you can click **Activate** next to their name in the **Users** tab. |
| **A student uploaded a receipt and says their dashboard is still locked** | Go to **Super Admin -> Enrollments**, verify their receipt under **Pending Enrollments**, and click **`✓ Approve & Unlock`**. Tell the student to click **`Check Approval Status`** on their screen. |
| **A Faculty member cannot see a course in their portal** | Go to **Super Admin -> Courses**, click **Manage / Assign Teacher** on that course, and assign that Faculty member as an instructor. |
| **How to update cohort dates or default pass mark** | Go to **Super Admin -> Settings**, update **Current Term Name**, **Start/End Dates**, **Default Pass Mark (%)**, and click **Save Settings**. |
