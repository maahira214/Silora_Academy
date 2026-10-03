# Silora Academy — Tutoring Operations Platform
## Software Requirements & Product Specification

**Document version:** 1.0  
**Date:** 2 October 2026  
**Purpose:** Product/engineering specification to use as the source of truth when designing and building the Silora Academy software.

---

# 1. Executive Summary

Silora Academy is a tutoring platform that provides one-to-one and group classes. Classes are conducted online, primarily through Google Meet.

As the number of students, teachers, and simultaneous classes increases, two operational problems have become major bottlenecks:

1. **Manual Google Meet admission and class monitoring**
   - A Silora employee currently needs to join classes using a Silora Academy account.
   - The employee admits the teacher and student into the Google Meet.
   - The employee remains available during the class.
   - With many simultaneous classes, Silora needs too many people just to perform this repetitive access-control task.

2. **Indirect teacher/student communication**
   - Teachers and students are intentionally prevented from having each other's personal phone numbers/contact details.
   - The current communication path is:
     `Teacher → Silora employee → Student`
     or
     `Student → Silora employee → Teacher`.
   - This creates delays, especially when a teacher asks for an image, worksheet, document, or other information during a live class.
   - Silora wants direct, fast communication without exposing personal contact information or allowing teacher/student relationships to move outside Silora.

The proposed software should become the operational layer between Silora, teachers, students, and Google Meet.

The central design principle is:

> **Automate the normal path and involve Silora staff only when something goes wrong.**

The system should not replace Google Meet. It should integrate with Google Workspace/Google Meet and automate class scheduling, access, notifications, monitoring, attendance/status, and controlled communication.

---

# 2. Business Goals

The system should achieve the following business goals.

## 2.1 Eliminate routine manual class admission

Silora employees should not need to sit in every class merely to admit a teacher and student.

Authorized teacher/student accounts should be able to enter their assigned class without a Silora employee manually admitting them, subject to the Google Workspace/Meet configuration and access controls.

## 2.2 Reduce operational staffing

One Silora operations person should be able to monitor many simultaneous classes from a dashboard instead of physically joining each class.

The operations team should handle exceptions such as:

- teacher has not joined
- student has not joined
- wrong person attempted to join
- class has a technical issue
- class was cancelled/rescheduled
- unusual communication/activity requires review

## 2.3 Provide controlled teacher/student communication

Teachers and students should be able to communicate directly inside the Silora platform without seeing:

- personal phone numbers
- personal WhatsApp accounts
- personal email addresses
- other private contact information

## 2.4 Protect Silora's customer relationship

The system must make it difficult for a teacher and student to move the relationship outside Silora.

Silora should retain:

- account ownership
- class assignment
- communication history
- access control
- administrative control
- audit logs
- ability to disable or change relationships

## 2.5 Improve speed of communication

A teacher should be able to send a message/file directly to the student without waiting for a Silora employee to forward it.

A student should be able to send a question/image/file directly to the teacher through the platform.

---

# 3. Current-State Workflow

## 3.1 Current class workflow

Typical current process:

1. Silora schedules a class.
2. Teacher and student know the class time.
3. Teacher joins Google Meet.
4. Student joins Google Meet.
5. Silora employee joins using a Silora Academy account.
6. Silora employee admits teacher/student.
7. Silora employee remains available during the class.
8. Class takes place.
9. Silora employee leaves/continues monitoring.

### Current problem

If 20 classes happen simultaneously, Silora may need people monitoring many different meetings.

This does not scale.

---

# 4. Current Communication Workflow

## 4.1 Teacher → Student

Current process:

`Teacher → Silora employee → Student`

Example:

Teacher says:

> Please send the student this worksheet.

Teacher sends it to Silora.

Silora employee receives it.

Employee forwards it to the student.

Student receives it.

This creates unnecessary delay.

## 4.2 Student → Teacher

Current process:

`Student → Silora employee → Teacher`

Example:

Student has an image/question that the teacher needs.

Student sends it to Silora.

Silora employee forwards it to the teacher.

The teacher may be waiting inside the class.

This can waste several minutes of teaching time.

---

# 5. Target-State Workflow

## 5.1 Class access

Target:

`Teacher → Silora Platform → Google Meet`

`Student → Silora Platform → Google Meet`

No routine Silora employee admission should be required.

The system knows:

- class
- teacher
- student(s)
- schedule
- Google Meet space
- authorized participants
- class status

The platform provides a controlled "Join Class" experience.

Google Meet remains the video-conferencing layer.

---

# 6. Target-State Communication

Target:

`Teacher → Silora Platform → Student`

`Student → Silora Platform → Teacher`

The teacher and student communicate using Silora accounts.

They do NOT need each other's personal phone number.

The platform handles:

- text messages
- images
- documents
- PDFs
- class-related files
- notifications
- unread message counts

---

# 7. Core Product Concept

The software should be thought of as a:

> **Silora Tutoring Operations & Communication Platform**

It should initially have four core areas:

1. **Class & Scheduling Management**
2. **Google Meet Integration**
3. **Teacher/Student Communication**
4. **Silora Admin Monitoring & Control**

---

# 8. User Roles

## 8.1 Super Admin

Full system access.

Can:

- create/delete/deactivate users
- manage teachers
- manage students
- manage admins
- create classes
- edit classes
- assign teachers
- assign students
- configure schedules
- manage Google integrations
- see class status
- see attendance/status
- access audit logs
- manage communication policies
- investigate flagged activity

## 8.2 Operations/Admin

Day-to-day operational access.

Can:

- see upcoming classes
- see live classes
- see alerts
- reschedule/cancel classes
- contact teachers/students through approved channels
- view class status
- manage operational issues

Should have less access to sensitive configuration than Super Admin.

## 8.3 Teacher

Can:

- see assigned classes
- see class schedule
- join assigned Google Meet
- communicate with assigned students
- send/receive files
- see relevant class information
- report technical issues
- mark/submit class notes if this is later added

Cannot:

- see student personal contact information
- see unrelated students
- contact students outside an active/authorized Silora relationship
- change system-level permissions

## 8.4 Student

Can:

- see own classes
- join assigned classes
- communicate with assigned teacher(s)
- send/receive files
- see class-related notifications
- see class history where permitted

Cannot:

- see teacher personal contact information
- see unrelated teachers/students
- access other students' data

## 8.5 Parent/Guardian

Not required for MVP unless Silora needs it.

Can be added later for:

- class schedule
- attendance
- progress
- payments
- notifications
- communication with Silora

---

# 9. Module 1 — Class & Scheduling Management

This module is the source of truth for every tutoring session.

## 9.1 Class entity

Each class/session should have:

- Class ID
- Student ID(s)
- Teacher ID
- Subject
- Grade/level
- Curriculum/board
- Class type: one-to-one/group
- Date
- Start time
- End time
- Time zone
- Recurrence information
- Google Meet Space ID
- Google Meet URL
- Status
- Created by
- Created timestamp
- Updated timestamp

## 9.2 Class types

### One-to-one

One teacher + one student.

Example:

`Teacher A ↔ Student A`

### Group class

One teacher + multiple students.

Example:

`Teacher A ↔ Student A, Student B, Student C, Student D`

The architecture must support both from the beginning.

---

# 10. Scheduling Requirements

Admins should be able to:

- create a one-time class
- create recurring classes
- modify a class
- cancel a class
- reschedule a class
- replace a teacher
- add/remove students from a group
- change duration
- change subject
- generate/assign Google Meet space

Example recurring schedule:

`Every Monday, Wednesday and Friday at 6:00 PM`

The system should generate individual class sessions from the recurring schedule.

---

# 11. Class Lifecycle

Every class should have a state.

Suggested states:

```text
SCHEDULED
   ↓
UPCOMING
   ↓
OPEN
   ↓
LIVE
   ↓
COMPLETED
```

Possible exception states:

```text
CANCELLED
RESCHEDULED
TEACHER_ABSENT
STUDENT_ABSENT
TECHNICAL_ISSUE
UNKNOWN
```

The exact state machine should be finalized during implementation.

---

# 12. Automated Notifications

The system should automatically notify participants.

## 12.1 Example notification schedule

### 30 minutes before

Teacher:

> Your Mathematics class starts at 6:00 PM.

Student:

> Your Mathematics class starts at 6:00 PM.

### 10 minutes before

Reminder with Join Class button.

### At class time

"Class is starting now."

### If teacher has not joined

Trigger operational alert after a configurable grace period.

### If student has not joined

Notify the relevant participant and optionally alert operations.

The exact notification timings should be configurable.

---

# 13. Google Meet Integration

Google Meet should remain the video-conferencing platform.

The Silora application should not attempt to build its own video conferencing system.

Google's Google Meet REST API provides functionality for programmatic management of meeting spaces, participants/members, and meeting/participant information.

Official documentation:

- Google Meet REST API overview:
  https://developers.google.com/workspace/meet/api/guides/overview
- Meeting space members:
  https://developers.google.com/workspace/meet/api/guides/meeting-space-members
- Google Meet support for joining/access:
  https://support.google.com/meet/answer/9302870

The engineering team should verify current Google Workspace/Meet API capabilities and account/edition requirements before implementation.

---

# 14. Google Meet Access Model

The system must NOT rely on a fake browser bot that joins every meeting and clicks "Admit" unless Google officially supports the exact required workflow.

That would be fragile and operationally expensive.

Preferred architecture:

1. Silora creates/configures the Google Meet space.
2. The system associates the meeting with the Silora class.
3. Authorized teacher/student identities are associated with the class.
4. Google Workspace/Meet access settings are configured so authorized participants can enter without routine manual admission, where supported.
5. Silora monitors class state through supported Google APIs/events.
6. Silora receives exceptions rather than acting as a permanent human gatekeeper.

---

# 15. Important Google Workspace Requirement

Before coding, Silora must confirm:

- Which Google Workspace edition/accounts are used by teachers.
- Which Google Workspace edition/accounts are used by students.
- Whether teachers use Silora-managed Google accounts.
- Whether students use Google accounts or other email providers.
- Whether the Google Meet API is available under the organization's Workspace setup.
- Which Meet access modes are available.
- Whether external participants are permitted.
- What OAuth/admin permissions are available.
- Whether domain-wide delegation is required/appropriate.
- Which Meet events can be received in real time.
- What participant/attendance information is available.

These are implementation-critical and must not be assumed.

---

# 16. Recommended Account Architecture

Ideally, every teacher should have a Silora-managed identity.

For example:

`teacher123@siloraacademy.com`

Students should also ideally have a Silora-controlled account or an application identity.

The application identity and Google identity should be linked internally.

Example:

```text
Silora User
    |
    +-- user_id: 83921
    |
    +-- role: TEACHER
    |
    +-- Google identity: teacher123@siloraacademy.com
```

This gives the system reliable identity mapping.

If students cannot or should not receive Silora Google Workspace accounts, the engineering design must define another secure way to identify authorized participants.

---

# 17. Class Join Experience

Teacher dashboard:

```text
MY UPCOMING CLASSES

6:00 PM
Mathematics
Student: Aarav

[ JOIN CLASS ]
```

Student dashboard:

```text
MY UPCOMING CLASSES

6:00 PM
Mathematics
Teacher: Rahul

[ JOIN CLASS ]
```

The button should open the correct Google Meet session.

The system should verify that the user is authorized for that class before providing the active class experience.

---

# 18. Class Monitoring Dashboard

Silora operations should have a live dashboard.

Example:

```text
LIVE CLASSES

6:00 PM — Mathematics
Teacher: Rahul
Student: Aarav
Status: LIVE

6:00 PM — Physics
Teacher: Priya
Student: Sarah
Status: LIVE

6:00 PM — Chemistry
Teacher: Amit
Student: Rohan
Status: TEACHER NOT JOINED

6:00 PM — Biology
Teacher: Neha
Student: Arjun
Status: STUDENT NOT JOINED
```

The dashboard should allow filtering by:

- date
- time
- teacher
- student
- subject
- status
- class type

---

# 19. Exception-Based Monitoring

This is one of the most important product requirements.

Silora staff should NOT be expected to watch every class.

Instead, the system should surface exceptions.

Examples:

### Teacher missing

```text
ALERT
Teacher has not joined.

Class: Mathematics
Teacher: Rahul
Student: Aarav
Start: 6:00 PM
Current: 6:05 PM
```

### Student missing

```text
ALERT
Student has not joined.

Class: Physics
Teacher: Priya
Student: Sarah
Start: 6:00 PM
Current: 6:05 PM
```

### Both missing

```text
ALERT
No participants detected.
```

### Unexpected participant

```text
SECURITY ALERT
Unauthorized/unexpected participant detected.
```

Where supported by the Google Meet API and organization's configuration.

---

# 20. Communication Module

This is the second major part of the application.

It should be an internal messaging system.

## 20.1 Teacher-to-student chat

Example:

```text
Teacher: Please complete questions 1–10.

Student: Sir, I have a doubt in question 5.

Teacher: Send me a picture.

Student: [image.jpg]

Teacher: I can see it. We'll discuss it now.
```

No phone number is exchanged.

---

# 21. Chat Identity Model

A user should see:

Teacher:

`Rahul — Mathematics Teacher`

Student:

`Aarav — Student`

The user should NOT see:

- personal phone number
- personal WhatsApp number
- personal email
- private address
- unnecessary personal information

The backend can retain private information if required for account management, but it should never be exposed through the other party's normal interface.

---

# 22. Relationship-Based Messaging

Chat permissions should be based on a valid Silora relationship.

Example:

```text
Teacher Rahul
       |
       | assigned to
       ↓
Student Aarav
       |
       ↓
Mathematics Class
```

Rahul can message Aarav only because Silora assigned Rahul to Aarav.

If Rahul is removed from the class/assignment:

- the active relationship ends
- the chat becomes read-only or archived, according to Silora policy
- new messages are disabled

This is critical.

Do not create permanent unrestricted contacts.

---

# 23. Group Class Communication

For group classes:

```text
Mathematics — Grade 10

Teacher: Rahul

Students:
Aarav
Riya
Kabir
Meera
```

Possible channels:

### Class group

Everyone in that class can communicate.

### Teacher-to-student private conversation

Teacher can communicate with an individual student if Silora policy permits.

### Admin announcements

Silora can broadcast messages to the class.

The exact privacy rules should be configurable.

---

# 24. File Sharing

The chat must support:

- JPG
- PNG
- PDF
- DOC/DOCX
- PPT/PPTX
- common educational file types

The system should enforce:

- maximum file size
- allowed file types
- malware/security scanning where appropriate
- access control
- retention policy

Example:

Teacher uploads:

`Algebra_Worksheet.pdf`

Student receives:

> Rahul shared Algebra_Worksheet.pdf

Student can view/download it.

---

# 25. Notifications for Chat

When a new message arrives:

- in-app unread count
- browser notification where permitted
- mobile push notification if mobile app exists
- email notification if configured

Notifications should not expose unnecessary sensitive content on lock screens.

Example:

Good:

> New message from your Silora teacher.

Avoid:

> Your teacher said "Call me on 9876543210."

---

# 26. Preventing Contact Leakage

This is a business-critical security requirement.

The goal is to reduce the chance that teacher/student users exchange personal contact information.

Possible controls:

## 26.1 UI-level control

Never show phone/email information to the other party.

## 26.2 Chat moderation

Detect likely contact information such as:

- phone numbers
- WhatsApp-style numbers
- email addresses
- social media handles
- external contact requests

Example:

```text
Teacher:
"Message me on WhatsApp at 98XXXXXXXX."
```

System:

```text
Potential contact-information sharing detected.
```

The system can:

- warn the sender
- block/quarantine the message
- replace the content
- flag it for admin review

The exact enforcement level should be a configurable Silora policy.

## 26.3 Link monitoring

Potentially flag links to:

- personal social profiles
- external messaging platforms
- personal websites
- contact forms

Do not automatically block every URL because educational resources often legitimately require links.

## 26.4 Audit trail

Retain an audit event that a message was flagged.

---

# 27. Important Privacy Principle

Silora should not secretly record or monitor private conversations beyond what is legally and contractually appropriate.

The product should have a clear communication/privacy policy explaining:

- what messages are stored
- who can access them
- how long they are retained
- when messages may be reviewed
- what happens when contact-information sharing is detected
- how users can report abuse

Legal/privacy requirements must be reviewed for the jurisdictions in which Silora operates.

---

# 28. Admin Communication Controls

Admins should be able to:

- search users
- view a user's active relationships
- view class-related communication where policy permits
- investigate reported conversations
- flag a user
- suspend a user
- disable chat
- restore chat
- remove teacher/student assignment

Admins should NOT have unrestricted access simply because they are admins. Permissions should follow role-based access control.

---

# 29. Audit Logging

The system should log important actions.

Examples:

```text
Teacher logged in
Teacher joined class
Student joined class
Teacher uploaded file
Student downloaded file
Admin created class
Admin changed teacher assignment
Admin cancelled class
Message was flagged
User was suspended
```

Each audit event should contain:

- event ID
- actor
- action
- target
- timestamp
- IP/device metadata where appropriate
- result
- relevant class/user ID

---

# 30. Attendance

Attendance should eventually be automated using Google Meet participation data where supported.

For each class:

```text
Class: Mathematics
Date: 02 Oct 2026
Start: 6:00 PM
End: 7:00 PM

Teacher:
Joined: 5:58 PM
Left: 7:01 PM

Student:
Joined: 6:02 PM
Left: 6:59 PM
```

This can produce:

- attendance status
- join time
- leave time
- duration
- late arrival
- early departure

Attendance logic should be configurable.

For example:

```text
Present
Late
Absent
Partial
```

Do not assume a single universal threshold.

---

# 31. Class Session Record

Every class session should have a permanent record.

Example:

```text
CLASS SESSION #84721

Teacher: Rahul
Student: Aarav
Subject: Mathematics
Date: 02 Oct 2026
Time: 6:00–7:00 PM

Meet:
meet-space-id

Attendance:
Teacher: Present
Student: Present

Chat:
12 messages
2 files

Status:
Completed
```

---

# 32. Security Requirements

Security should be treated as a core requirement, not a later feature.

## Authentication

Use secure authentication.

Possible options:

- Google OAuth for Google-managed users
- email/password with secure password hashing
- passwordless login
- organization-managed SSO

Do not store plaintext passwords.

## Authorization

Use role-based access control.

Every API request should verify:

- authenticated user
- role
- resource ownership/relationship
- class membership

Never rely only on frontend restrictions.

---

# 33. Multi-Tenant/Data Isolation Principle

Even if Silora initially has one organization, the backend should keep a clean organization boundary.

Every important resource should be associated with Silora/organization context.

This reduces the risk of accidental cross-customer access if the platform later supports more academies.

---

# 34. Data Model — Initial Concept

Suggested entities:

```text
User
TeacherProfile
StudentProfile
AdminProfile
Class
ClassParticipant
ClassSession
Schedule
GoogleMeetSpace
MessageThread
Message
Attachment
Notification
Attendance
Alert
AuditLog
Relationship
```

Potential relationships:

```text
User
  ├── TeacherProfile
  ├── StudentProfile
  └── AdminProfile

Class
  ├── Teacher(s)
  ├── Student(s)
  ├── Schedule
  ├── GoogleMeetSpace
  └── ClassSession(s)

ClassSession
  ├── Attendance
  ├── Messages
  ├── Alerts
  └── AuditLogs
```

The final database design should be created by the engineering team.

---

# 35. Suggested Core Database Relationships

A teacher should not directly "own" a student.

Instead, Silora creates an assignment/relationship:

```text
TeacherStudentAssignment

teacher_id
student_id
subject_id
class_id
start_date
end_date
status
```

This is safer.

It allows:

- teacher replacement
- temporary assignments
- multiple teachers
- multiple subjects
- historical records

---

# 36. Notification Architecture

Use a central notification service.

Events can include:

```text
CLASS_CREATED
CLASS_UPDATED
CLASS_CANCELLED
CLASS_STARTING_SOON
CLASS_STARTED
TEACHER_JOINED
STUDENT_JOINED
TEACHER_MISSING
STUDENT_MISSING
NEW_MESSAGE
NEW_FILE
MESSAGE_FLAGGED
```

Each event can trigger different notification channels.

---

# 37. Alert Priorities

Suggested levels:

### INFO

Normal operational information.

### WARNING

Something may require attention.

Example:

Student is 3 minutes late.

### CRITICAL

Immediate intervention required.

Example:

Teacher has not joined 10 minutes after class start.

---

# 38. Admin Dashboard — Recommended Layout

## Top summary

```text
Today's Classes: 128
Upcoming: 42
Live: 18
Completed: 63
Alerts: 5
Critical: 1
```

## Live class table

```text
Time | Subject | Teacher | Student(s) | Status | Action
```

## Alerts

```text
Critical — Teacher missing
Warning — Student late
Warning — Technical issue
```

## Quick actions

- Schedule class
- Reschedule
- Cancel
- Assign teacher
- Open class
- View communication
- View attendance

---

# 39. Teacher Dashboard

```text
TODAY

6:00 PM
Mathematics
Aarav
[JOIN]

7:30 PM
Physics
Riya
[JOIN]

MESSAGES
3 unread

UPCOMING
Tomorrow:
3 classes
```

Teacher should not need to navigate through multiple systems.

---

# 40. Student Dashboard

```text
TODAY

6:00 PM
Mathematics
Rahul
[JOIN]

7:30 PM
Physics
Priya
[JOIN]

MESSAGES
2 unread

MATERIALS
3 new files
```

---

# 41. Error Handling

The system must handle failures gracefully.

Examples:

## Google API unavailable

Show:

> We are having trouble connecting to Google Meet. Silora operations has been notified.

## Meeting not found

Alert admin immediately.

## Teacher account not authorized

Prevent join and alert operations.

## Student attempts to join another student's class

Deny access.

## Class cancelled

Disable Join Class and notify all participants.

---

# 42. Security Scenario — Wrong Class Link

The system must not assume possession of a link means authorization.

Example:

Student A receives Student B's Meet URL.

Student A attempts to access Student B's class.

The application should verify the user's relationship to the class.

Where Google Meet's configuration/API supports the necessary restriction, the meeting should also enforce participant access.

---

# 43. Security Scenario — Teacher Leaves Silora

When a teacher is deactivated:

1. Disable Silora login.
2. Disable access to classes.
3. Disable active teacher/student messaging relationships.
4. Remove/revoke appropriate Google access.
5. Preserve historical class/communication records according to retention policy.
6. Alert administrators if the teacher had upcoming classes.

---

# 44. Security Scenario — Student Leaves Silora

When a student is deactivated:

1. Disable login.
2. Disable future class access.
3. Cancel or reassign upcoming classes.
4. Disable active teacher communication.
5. Preserve historical records according to policy.

---

# 45. Business Rule — No Direct Contact Details

This should be an explicit product rule:

> Teacher and student interfaces must not expose each other's private phone number, WhatsApp number, personal email address, or other direct personal contact information.

The system itself may store contact details for legitimate account/operational purposes, but access must be controlled.

---

# 46. Business Rule — Silora Owns the Relationship

The teacher-student relationship is a Silora-managed relationship.

The teacher is not given an unrestricted permanent communication channel to every student.

Messaging permissions are derived from active Silora assignments.

---

# 47. Business Rule — No Manual Forwarding

For normal teacher/student class communication:

> Silora employees should not need to manually forward messages or files.

The software should route messages automatically.

Admins intervene only when:

- the user reports a problem
- a policy violation is detected
- a class has an operational exception
- an administrative action is required

---

# 48. Business Rule — One Source of Truth

The Silora application should be the authoritative source for:

- who teaches whom
- which class exists
- class timing
- class status
- class relationship
- communication permissions

Google Meet is the video infrastructure, not the business database.

---

# 49. MVP Scope

The first release should focus only on the two problems.

## MVP Feature Set

### Admin

- login
- teacher management
- student management
- class creation
- class scheduling
- teacher/student assignment
- Google Meet association
- upcoming classes
- live class dashboard
- alerts
- class status
- audit logs

### Teacher

- login
- upcoming classes
- Join Class
- class details
- chat with assigned students
- file upload
- notifications

### Student

- login
- upcoming classes
- Join Class
- class details
- chat with assigned teacher
- file upload
- notifications

### Google Integration

- Google authentication where applicable
- Meet creation/association
- authorized participant handling
- class status/participant monitoring where supported
- attendance data where supported

---

# 50. Features NOT Required in MVP

Do not unnecessarily build these initially:

- payments
- invoices
- payroll
- AI tutoring
- homework grading
- parent portal
- advanced analytics
- CRM
- marketing automation
- public marketplace
- built-in video conferencing
- complex LMS features

They can be added after the core operational problem is solved.

---

# 51. Future Phase Features

After MVP is stable:

## Phase 2

- attendance reports
- class notes
- homework
- assignments
- student progress
- teacher performance dashboards
- parent accounts
- automated reports

## Phase 3

- payments
- invoices
- subscriptions
- teacher payroll
- CRM
- lead management
- admissions

## Phase 4

- AI class summaries
- AI-generated progress reports
- automated homework assistance
- learning analytics
- recommendation systems

---

# 52. Recommended Technical Architecture

A reasonable high-level architecture is:

```text
                    WEB / MOBILE CLIENTS
                            |
                            v
                     API / BACKEND
                            |
          ┌─────────────────┼─────────────────┐
          |                 |                 |
          v                 v                 v
     PostgreSQL       Notification       File Storage
       Database          Service
          |
          v
   Silora Business Logic
          |
     ┌────┴───────────┐
     |                |
     v                v
Google Workspace    Messaging
/ Meet APIs         Service
```

The exact programming language/framework can be selected by the development team.

---

# 53. Suggested Technology Categories

The implementation team can choose technologies based on experience.

Possible architecture:

### Frontend

- React / Next.js
- TypeScript

### Backend

- Node.js / NestJS or similar
- TypeScript

OR:

- Python / FastAPI / Django

### Database

- PostgreSQL

### Real-time messaging

- WebSockets
- managed realtime service
- Firebase/Firestore or equivalent if appropriate

### File storage

- Google Cloud Storage
- AWS S3
- equivalent secure object storage

### Authentication

- Google OAuth
- secure application authentication

### Deployment

- Google Cloud / AWS / Azure

The technology choice is less important than correct architecture, access control, Google integration, reliability, and security.

---

# 54. Messaging Architecture

Do not make chat a simple frontend-to-frontend connection.

Use:

```text
Teacher Client
      |
      v
Messaging API
      |
      v
Authorization
      |
      v
Message Database
      |
      v
Notification Service
      |
      v
Student Client
```

Every message should pass through the backend so Silora can enforce:

- relationship permissions
- file permissions
- moderation rules
- audit logging
- notification logic

---

# 55. Real-Time Chat

A modern implementation can use WebSockets or an equivalent realtime service.

Flow:

```text
Teacher sends message
        ↓
Backend verifies teacher/student relationship
        ↓
Message stored
        ↓
Event generated
        ↓
Student receives message instantly
        ↓
Notification sent if offline
```

---

# 56. File Upload Architecture

Do not send large files through the normal messaging API if avoidable.

Preferred flow:

```text
Teacher
  ↓
Request upload permission
  ↓
Backend validates relationship
  ↓
Secure upload URL
  ↓
Object storage
  ↓
File record created
  ↓
Message references file
  ↓
Student receives file
```

Use short-lived/signed URLs for private files.

---

# 57. API Authorization

Every sensitive endpoint must enforce server-side authorization.

Example:

`GET /classes/84721`

Backend checks:

```text
Is user authenticated?
        ↓
Does user have permission?
        ↓
Is user a participant/admin?
        ↓
Return data
```

Never rely on:

```text
if (user.role === "teacher") {
    showButton();
}
```

The backend must enforce permissions even if the frontend is bypassed.

---

# 58. Suggested API Areas

Possible API structure:

```text
/auth
/users
/teachers
/students
/classes
/schedules
/sessions
/google/meet
/messages
/threads
/attachments
/notifications
/attendance
/alerts
/audit-logs
/admin
```

The exact API contract should be created during implementation.

---

# 59. Important Google Integration Principle

Do not build around undocumented Google Meet behavior.

Use official APIs/documentation wherever possible.

If a desired feature is not supported through the official API, the engineering team should identify the limitation before selecting a workaround.

Avoid browser automation against Google Meet as the primary architecture unless there is a compelling, reviewed reason and an explicit understanding of reliability/security implications.

---

# 60. Monitoring & Reliability

The system should monitor:

- Google API failures
- notification failures
- failed class creation
- failed Meet association
- message delivery failures
- file upload failures
- authentication failures
- unexpected participant events where available

Admins should see system health separately from class alerts.

---

# 61. Data Retention

Silora must define retention periods for:

- messages
- attachments
- attendance
- audit logs
- class records
- user accounts

Do not delete historical data simply because a user leaves unless policy requires it.

Retention should be documented and implemented consistently.

---

# 62. Privacy and Compliance

Before production, Silora should review:

- applicable Indian privacy/data-protection requirements
- requirements in countries where students/parents/teachers are located
- child/minor data requirements if applicable
- Google Workspace data processing terms
- storage/security requirements
- consent and privacy notices
- communication monitoring policies

The software should be designed for privacy by default.

---

# 63. Non-Functional Requirements

## Reliability

Class joining should be highly reliable because failure directly affects live teaching.

## Performance

Dashboard should load quickly even with thousands of classes.

## Scalability

The system must support many simultaneous classes.

Example target should be defined by Silora, e.g.:

- 1,000 students
- 200 teachers
- 100 simultaneous classes

The actual numbers must be finalized before load testing.

## Security

Sensitive information must be encrypted in transit and at rest where appropriate.

## Availability

The class-management service should have high availability around peak tutoring hours.

---

# 64. Peak-Time Design

The system should expect many classes to start at the same time.

For example:

```text
6:00 PM

Class 1
Class 2
Class 3
...
Class 100
```

Do not design the system assuming class-start events are evenly distributed.

Use:

- asynchronous jobs
- queues
- retries
- idempotency
- rate-limit handling
- caching where appropriate

---

# 65. Failure Recovery

If a Google API request fails:

1. Retry where appropriate.
2. Use exponential backoff.
3. Avoid duplicate class/meeting creation.
4. Log failure.
5. Alert operations if the failure affects an imminent class.

Every operation that can be retried should be designed to be idempotent.

---

# 66. Example End-to-End Scenario

## Scenario: One-to-one Mathematics class

Teacher:

Rahul

Student:

Aarav

Time:

6:00 PM–7:00 PM

### Admin creates class

```text
Subject: Mathematics
Teacher: Rahul
Student: Aarav
Start: 6:00 PM
End: 7:00 PM
```

System creates/associates Google Meet.

### 30 minutes before

Both receive notification.

### 10 minutes before

Both receive reminder.

### 5 minutes before

Teacher opens Silora.

Clicks:

`JOIN CLASS`

Student does the same.

### 6:00 PM

Both enter Google Meet.

No Silora employee needs to admit them.

### 6:10 PM

Teacher asks:

> Please send me the image of your homework.

Student opens Silora chat.

Uploads image.

Teacher sees it immediately.

### 7:00 PM

Class ends.

System records session/attendance information where available.

Admin dashboard shows:

```text
Mathematics
Rahul
Aarav
Completed
```

No human forwarding occurred.

---

# 67. Example Exception Scenario

Teacher does not join.

### 6:00 PM

Student joins.

Teacher absent.

### Configured grace period passes

System detects teacher has not joined, where the required Google Meet event/participant data is available.

Admin sees:

```text
CRITICAL ALERT

Teacher not present

Class: Mathematics
Teacher: Rahul
Student: Aarav
Start: 6:00 PM
```

Admin contacts the teacher or takes the required operational action.

This is where a human is useful.

---

# 68. Example Communication Scenario

Teacher:

> Please send me your homework image.

Student:

Uploads image.

Teacher receives it immediately.

There is no:

```text
Teacher → Silora employee
Silora employee → Student
Student → Silora employee
Silora employee → Teacher
```

The software eliminates the chain.

---

# 69. Example Contact-Leak Scenario

Teacher attempts to send:

> You can WhatsApp me at XXXXXXXX.

The system detects possible phone/contact information.

Depending on Silora's configured policy:

```text
Option A:
Warn teacher.

Option B:
Block the message and inform teacher.

Option C:
Allow but create an admin review alert.

Option D:
Quarantine for review.
```

The exact policy should be decided by Silora.

---

# 70. Product Principle: Silora Remains in Control

Automation must not mean loss of control.

Silora should always retain the ability to:

- see who is assigned to whom
- change assignments
- stop communication
- deactivate accounts
- monitor class status
- intervene in problems
- review operational history
- audit important actions

---

# 71. Acceptance Criteria for MVP

The MVP should not be considered complete until the following work.

## Class management

- [ ] Admin can create a class.
- [ ] Admin can assign teacher.
- [ ] Admin can assign one or more students.
- [ ] Admin can schedule class.
- [ ] Admin can reschedule class.
- [ ] Admin can cancel class.
- [ ] System supports one-to-one classes.
- [ ] System supports group classes.

## Google Meet

- [ ] Class is associated with correct Meet.
- [ ] Authorized teacher can join.
- [ ] Authorized student can join.
- [ ] Routine manual Silora admission is eliminated where supported by Google configuration.
- [ ] Wrong user cannot access the class through Silora.
- [ ] Meet integration failures are detected/logged.

## Monitoring

- [ ] Admin can see upcoming classes.
- [ ] Admin can see live classes.
- [ ] Admin can identify teacher/student presence where supported.
- [ ] Missing participant generates alert according to configured grace period.
- [ ] Completed class is recorded.

## Chat

- [ ] Teacher can message assigned student.
- [ ] Student can message assigned teacher.
- [ ] Group classes support appropriate group communication.
- [ ] Text messages work in realtime or near realtime.
- [ ] Images/files can be sent.
- [ ] Notifications work.
- [ ] Phone numbers are not exposed.
- [ ] Personal email is not exposed.
- [ ] Chat access is based on active Silora relationship.
- [ ] Admin can disable communication when required.

## Security

- [ ] Authentication works.
- [ ] Role-based access control works.
- [ ] Backend authorization is enforced.
- [ ] Audit logs are generated.
- [ ] File access is protected.
- [ ] User deactivation revokes access.
- [ ] Teacher/student data is isolated.

---

# 72. Recommended Development Order

Do not ask Claude to build the entire product in one giant prompt.

Build it incrementally.

## Stage 1 — Architecture

Define:

- database schema
- roles
- authentication
- authorization
- class model
- relationship model
- API structure
- Google integration strategy

## Stage 2 — Admin

Build:

- login
- teacher management
- student management
- class management
- schedule management

## Stage 3 — Teacher/Student portals

Build:

- login
- dashboards
- class list
- class details
- Join Class

## Stage 4 — Google Meet

Implement and test:

- OAuth
- Meet creation/configuration
- meeting association
- access model
- participant/event monitoring
- attendance if available

This stage must be tested extensively with real Silora Google Workspace accounts.

## Stage 5 — Messaging

Implement:

- conversations
- realtime messaging
- attachments
- notifications
- permissions
- relationship-based access

## Stage 6 — Monitoring

Implement:

- live class dashboard
- missing teacher alert
- missing student alert
- technical alerts
- audit logs

## Stage 7 — Security

Test:

- unauthorized access
- cross-student access
- cross-teacher access
- expired relationships
- deactivated accounts
- malicious file uploads
- API authorization
- contact-information leakage

## Stage 8 — Production hardening

Add:

- backups
- monitoring
- logging
- rate limits
- retries
- error tracking
- load testing
- disaster recovery

---

# 73. Instructions for Claude Code

Use this document as the product specification.

Claude should NOT immediately generate thousands of lines of code.

It should first:

1. Read this entire specification.
2. Identify ambiguities.
3. Identify Google Meet API constraints that must be verified.
4. Propose the architecture.
5. Propose the database schema.
6. Propose authentication/authorization.
7. Propose the Google Workspace integration.
8. Propose the messaging architecture.
9. Propose the admin/teacher/student UI structure.
10. Produce an implementation plan.
11. Build the application incrementally.
12. Write tests for every critical workflow.
13. Never bypass backend authorization merely because the UI hides an option.
14. Never use fake/mock Google Meet behavior in production code.
15. Clearly identify anything that requires a real Google Workspace credential/configuration.

---

# 74. Questions Claude/Developer Must Resolve Before Production

These questions require real Silora business decisions or Google Workspace verification.

### Google

1. Does every teacher have a Silora Google Workspace account?
2. Do students have Google accounts?
3. Are students inside or outside Silora's Google Workspace domain?
4. Which Google Workspace edition does Silora use?
5. Which Meet API permissions are available?
6. Can the desired participant-access model be implemented with official APIs?
7. Which real-time Meet events are available for the chosen Workspace setup?
8. What are Google's API quotas/rate limits for the expected class volume?

### Operations

9. How many teachers?
10. How many students?
11. How many classes per day?
12. Maximum simultaneous classes?
13. Typical class duration?
14. Typical peak hours?
15. How much grace period should be used for late participants?

### Communication

16. Should teacher/student chat remain available after a class ends?
17. Should it remain available while the teacher is assigned to the student?
18. Should teachers be allowed to send private messages to individual students in group classes?
19. Which file types are permitted?
20. Maximum file size?
21. Should messages be editable/deletable?
22. What should happen when a teacher/student leaves Silora?
23. What contact information should be automatically detected/blocked?

### Privacy

24. How long should messages be stored?
25. How long should files be stored?
26. Who can review conversations?
27. What user notification/consent is required?
28. What privacy policy applies to minors?

These decisions should be documented before production launch.

---

# 75. Final Product Vision

The final system should transform Silora from a manually coordinated tutoring operation into a software-assisted tutoring operation.

### Today

```text
                 SILORA EMPLOYEE
                 /      |       \
                /       |        \
           Teacher    Student   Google Meet
                \       |        /
                 \      |       /
                  Manual coordination
```

### Target

```text
                 SILORA PLATFORM
                       |
        ┌──────────────┼──────────────┐
        |              |              |
     Scheduling     Messaging      Monitoring
        |              |              |
        ↓              ↓              ↓
     Google Meet   Teacher ↔ Student  Admin
```

The employee's role changes from:

> **"Join every class and forward every message."**

to:

> **"Manage the system and intervene when something needs human attention."**

That is the fundamental business transformation this software should deliver.

---

# 76. Key Requirements in One Page

If the entire document needs to be reduced to the most important requirements:

### Problem 1 — Class admission

**Current:**
Silora employee joins every Google Meet and manually admits teacher/student.

**Required:**
Teacher and student should automatically be able to enter their authorized class without routine human admission, using supported Google Meet/Workspace access controls and APIs.

**Silora role:**
Monitor exceptions rather than every class.

---

### Problem 2 — Teacher/student communication

**Current:**
Teacher ↔ Silora employee ↔ Student.

**Required:**
Teacher ↔ Silora platform ↔ Student.

**Privacy:**
No personal phone number, WhatsApp, or private contact information is exposed.

**Business protection:**
Communication is only available through active Silora-managed relationships, with configurable contact-information detection, moderation, audit logs, and administrative controls.

---

### Core principle

> **Automate classes. Centralize communication. Protect identities. Preserve Silora's control. Escalate exceptions to humans.**

---

# 77. Reference Documentation

The engineering team should consult the current official Google documentation during implementation:

- Google Meet REST API:
  https://developers.google.com/workspace/meet/api/guides/overview

- Google Meet meeting-space members:
  https://developers.google.com/workspace/meet/api/guides/meeting-space-members

- Google Meet access/joining controls:
  https://support.google.com/meet/answer/9302870

The Google APIs and Workspace behavior should be verified against the current documentation at implementation time because capabilities, quotas, and Workspace requirements can change.

