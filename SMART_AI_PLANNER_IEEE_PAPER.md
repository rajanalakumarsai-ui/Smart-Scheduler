# Smart AI Planner: An AI-Assisted Adaptive Academic Study Planning System

**First Author, Second Author**  
Department of Computer Science and Engineering, [University Name], [City], [Country]  
first.author@[institution].edu, second.author@[institution].edu

## Abstract

Students preparing for several examinations must manage limited study time, differing subject difficulty, high-priority topics, and approaching deadlines. Conventional handwritten timetables and general-purpose calendar applications frequently distribute study time without adequately considering subject urgency or examination constraints. This paper presents Smart AI Planner, a secure, browser-based academic planning system that generates personalized study schedules and integrates progress monitoring, reminders, learning resources, study-material management, and AI-assisted research. The system collects subject names, examination dates, difficulty ratings, priority status, and available daily study hours. A weighted scheduling algorithm allocates thirty-minute study blocks according to subject complexity, high-priority status, time remaining until an examination, and previously allocated time. The application uses HTML, CSS, JavaScript, Python, and SQLite. Authentication is implemented with salted PBKDF2-HMAC-SHA256 passwords and HTTP-only session cookies. The research assistant combines DuckDuckGo search with a locally hosted Ollama large language model, thereby avoiding the need for a paid third-party generative-AI API. The system provides subject progress, weekly study summaries, HTTPS resource links, file uploads, schedule sharing, and iCalendar export. This paper describes the problem, system architecture, scheduling algorithm, implementation, experimental methodology, expected contributions, limitations, and future improvements. Because the project has not yet been evaluated with a participant-based usability study or controlled academic-performance experiment, the empirical section is presented as a proposed evaluation rather than as fabricated measured results.

**Keywords:** adaptive scheduling, examination planning, educational technology, personalized learning, study-tracking system, Ollama, SQLite, artificial intelligence, web application.

## I. INTRODUCTION

Academic success depends not only on the quantity of study performed but also on how effectively available study time is allocated. Students commonly prepare for several subjects concurrently. Each subject may have a different examination date, complexity, revision requirement, and personal importance. When multiple examinations are scheduled close together, students must decide how much time to assign to each subject and how frequently to revise already studied material. Simple fixed timetables may become ineffective because they do not adapt to these changing requirements.

Manual planning introduces several practical difficulties. First, a student must continuously calculate the number of days remaining before each examination. Second, difficult subjects may require more sessions, while easier subjects may need less repeated study. Third, study plans must be updated when priorities change or a subject is completed. Fourth, reminders, progress records, uploaded documents, web resources, and completed task history are often maintained separately. This fragmentation increases planning effort and reduces the visibility of overall academic progress.

Artificial intelligence and web technologies offer an opportunity to combine planning, monitoring, and learning support in a single environment. However, introducing AI into an educational application does not automatically make the application useful or personalized. The system must also preserve reliable deterministic behavior, protect personal study data, provide a clear interface, and support the learner’s control over priorities and schedules. A useful study planning system should therefore integrate an understandable scheduling policy with secure account management and user-controlled resources.

The proposed project addresses this need through **Smart AI Planner**, a full-stack web application that converts subject and examination requirements into a day-wise study schedule. The system accepts subject difficulty on a scale from one to five and permits a subject to be marked as high priority. The scheduling process divides the user’s daily study hours into thirty-minute units and assigns those units through a weighted priority function. Subjects with higher difficulty, high-priority status, and nearer examination dates receive larger allocations. A subject is included only until its examination date, allowing the system to shift study time toward other remaining subjects.

In addition to scheduling, the application provides a dashboard for viewing current tasks, upcoming examinations, and in-app reminders. It records completed sessions, displays subject-wise completion, summarizes study activity from the previous seven days, and allows schedules to be shared or exported as iCalendar `.ics` files. Study resources can be stored as HTTPS links, and supported learning materials can be uploaded to the server. A separate AI research assistant uses DuckDuckGo for web retrieval and an Ollama-hosted language model for response generation. Search context and recent conversation history are sent to the model, and source links are returned to the user.

The objectives of this study are:

1. to collect and validate student study requirements;
2. to generate an adaptive daily plan based on examination deadlines and difficulty;
3. to preserve study plans and progress between sessions;
4. to provide subject-wise progress and weekly activity summaries;
5. to integrate reminders, resources, and uploaded materials;
6. to offer a source-referenced local AI research assistant;
7. to implement secure authentication and data isolation; and
8. to identify future work required for a complete evaluation of effectiveness and usability.

The remainder of this paper is organized as follows. Section II reviews existing planning and educational technologies. Section III describes the proposed system architecture. Section IV explains the scheduling methodology and algorithm. Section V discusses implementation details and security. Section VI presents the evaluation methodology and limitations of the current evidence. Section VII discusses results and implications, while Section VIII concludes the paper and identifies future work.

## II. RELATED WORK

### A. Calendar and Manual Study Planning

Traditional planners and general-purpose calendar applications allow users to create events, set reminders, and organize appointments. They provide useful availability management but generally require students to decide manually how much study time to assign to each subject. A calendar does not necessarily identify a difficult subject, prioritize a high-importance examination, or divide the time remaining before a deadline according to changing urgency. Consequently, a student may use a calendar effectively for scheduling sessions while still making inconsistent allocation decisions.

Manual timetables have the advantage of simplicity and user control. However, they are difficult to update and require repeated calculations when examination dates or available study time change. A static timetable also cannot show whether a subject has been completed or provide a summary of study behavior.

### B. Study and Productivity Applications

Study applications commonly provide task lists, subject-specific folders, timers, flashcards, and progress charts. These tools improve individual aspects of learning but may not combine them with deadline-oriented scheduling. Timers help a student measure sessions, while task managers help organize work; however, neither mechanism automatically generates an examination plan across several subjects. A complete study planner should connect planning, scheduling, completion, and resource management.

### C. AI-Assisted Educational Systems

Artificial intelligence can support task recommendation, tutoring, question answering, and academic research. Cloud-based large language models can provide broad knowledge, but they typically require external services or API keys and may transmit user prompts to third-party servers. Locally hosted models reduce dependence on external APIs and allow a trusted local environment to control model access. Nevertheless, a language model can produce inaccurate or unsupported statements. Therefore, retrieval of relevant web information and presentation of source links are important when the system is used for research.

### D. Research Gap

Existing tools provide useful calendar, task management, progress, or AI features, but a unified system must also provide deadline-aware subject allocation and personal data persistence. Many systems either do not consider subject difficulty or require a manually constructed timetable. A web application that combines deterministic adaptive scheduling with account-based storage and local AI search can fill this gap for individual student planning. This project is therefore positioned as an integrated, local-first academic planning system rather than a replacement for educational instruction or a formal tutoring platform.

## III. PROPOSED SYSTEM

### A. System Scope

The Smart AI Planner is a client-server web application. The client provides registration, authentication, profile management, subject entry, schedule visualization, progress information, reminders, resources, and file interaction. The Python server handles session authentication, persistent workspace storage, material uploads, secure resource validation, and AI assistant requests. SQLite is used as the local database engine.

The system has the following functional components:

* account registration and login;
* profile and study-requirement management;
* subject and examination-date entry;
* weighted schedule generation;
* task completion and progress tracking;
* weekly activity visualization;
* in-app reminders;
* schedule sharing and iCalendar export;
* HTTPS educational-resource storage;
* subject-specific file uploads;
* web-assisted local AI question answering; and
* responsive dashboard navigation.

### B. System Architecture

Fig. 1 presents the logical architecture of the system. The browser interface communicates with the Python server through HTTP API endpoints. Authentication and workspace operations access SQLite. Uploaded materials are stored in a dedicated materials table. The AI assistant service first queries DuckDuckGo and then sends the retrieved context and conversation history to the Ollama API. Only authenticated users can access workspace or assistant functions.

```text
+---------------- Browser Interface ----------------+
| HTML/CSS/JavaScript                               |
| Profile | Subjects | Schedule | Progress | Files  |
+----------------------+----------------------------+
                       |
                       v
+---------------- Python HTTP Server ----------------+
| Authentication | Workspace API | Upload API       |
| AI Assistant API | Input Validation               |
+----------+------------------+---------------------+
           |                  |
           v                  v
+----------------+  +------------------------------+
| SQLite         |  | External/Local Services      |
| Users/Sessions |  | DuckDuckGo | Ollama          |
| Workspaces     |  |                              |
| Materials      |  +------------------------------+
+----------------+
```

**Fig. 1. Logical architecture of Smart AI Planner.**

### C. Data Flow

The application operates through the following stages:

1. The user registers or logs in.
2. The server verifies credentials and creates a secure session.
3. The user provides profile and subject information.
4. The scheduling module generates one entry for each day until the latest examination.
5. The user reviews the generated timetable.
6. Completed tasks are recorded and included in progress calculations.
7. Workspace changes are persisted in SQLite.
8. Study materials and resources are associated with subjects.
9. The AI assistant retrieves search results and produces contextual responses.

The system separates browser presentation from server-side storage and validation. This separation prevents unauthorized workspace access and allows the same server data to be reused when the browser is reopened.

## IV. METHODOLOGY

### A. Input Data

For each subject \(i\), the system accepts:

\[
S_i = (N_i, E_i, C_i, P_i)
\]

where \(N_i\) is the subject name, \(E_i\) is the examination date, \(C_i\in\{1,2,3,4,5\}\) is the difficulty level, and \(P_i\in\{true,false\}\) indicates high-priority status. The user also enters daily study hours \(H\), where the implemented interface limits the value to 0.5–12 hours.

The number of thirty-minute blocks is calculated as:

\[
B=\operatorname{round}(H\times 2)
\]

For example, two hours per day produce four thirty-minute blocks. This conversion allows a half-hour scheduling granularity and avoids unsupported fractions of study sessions.

### B. Deadline and Availability Filtering

For a study date \(d\), subjects with examinations before \(d\) are excluded:

\[
A(d)=\{S_i\mid E_i\geq d\}
\]

This rule ensures that no subject is scheduled after its examination. Scheduling continues until the final examination date. The number of scheduled days is:

\[
D=\operatorname{round}\left(\frac{E_{\max}-D_{\text{today}}}{86400000}\right)+1
\]

where \(86400000\) represents the number of milliseconds in one day.

### C. Priority Formula

For each available subject, the system calculates a weighted priority before every study block:

\[
W_i(d)=
\frac{C_i\times(1.5\text{ if }P_i\text{ else }1)
\times(1+\frac{7}{D_i(d)+1})}
{A_i(d)+1}
\]

In this formula:

* \(C_i\) represents the subject’s difficulty;
* \(P_i\) increases the weight of high-priority subjects by a factor of 1.5;
* \(D_i(d)\) is the number of remaining days before the examination;
* the term \(1+7/(D_i+1)\) increases urgency as the examination approaches; and
* \(A_i(d)\) is the number of blocks already allocated to the subject on the current day.

The denominator \(A_i(d)+1\) provides fairness during a day by reducing a subject’s priority after it receives repeated allocations. The subject with the largest calculated weight receives the next block:

\[
S^*=\arg\max_{S_i\in A(d)}W_i(d)
\]

The allocation is repeated until all \(B\) blocks have been assigned. After allocation, consecutive blocks for the same subject may represent a longer session.

### D. Algorithm

```text
INPUT: subjects, dailyHours
OUTPUT: scheduleEntries

startDate <- today's date
finalExamDate <- maximum examination date
blockCount <- round(dailyHours * 2)

FOR each date from startDate to finalExamDate:
    availableSubjects <- subjects whose examDate >= date
    allocatedBlocks <- block count for each available subject = 0

    FOR blockIndex = 1 to blockCount:
        IF availableSubjects is empty:
            EXIT loop

        FOR each subject in availableSubjects:
            daysUntilExam <- maximum(0, differenceInDays(subject.examDate, date))
            priority <- subject.complexity
                        * (subject.priority ? 1.5 : 1)
                        * (1 + 7 / (daysUntilExam + 1))
                        / (allocatedBlocks[subject] + 1)

        selectedSubject <- subject with highest priority
        allocatedBlocks[selectedSubject]++

    Create a schedule entry containing date, exam-day status, and allocated tasks

RETURN scheduleEntries
```

### E. Schedule Interpretation

The result is a list of day objects. Each object contains the date, whether an examination occurs on that date, and the selected subjects with their calculated study hours. On an examination day, the system displays an examination badge. However, the scheduling period should end or stop assigning work on an examination day when appropriate revisions are complete. The current implementation retains the exam-day entry and still evaluates subjects available on that date.

The scheduling policy is heuristic rather than globally optimized. It does not attempt to solve a mixed-integer optimization problem, guarantee a minimum completion threshold, or model sleep, breaks, and personal calendar events. Instead, it provides a transparent, understandable approximation suitable for an undergraduate prototype.

### F. AI Assistant Methodology

For an AI query \(Q\), the backend performs the following process:

1. Ollama availability is checked.
2. DuckDuckGo is queried using \(Q\).
3. Search HTML is parsed for result titles, URLs, and snippets.
4. The system retains up to five HTTPS results.
5. Search text is formatted as contextual system content.
6. The latest ten valid conversation messages are included.
7. The locally hosted Ollama model generates a response.
8. The reply and source titles/URLs are sent to the browser.

The conversation is kept in browser memory and is not persisted in the SQLite workspace. The backend rejects invalid roles, missing text, oversized messages, and histories longer than ten messages.

## V. IMPLEMENTATION

### A. Front-End Implementation

The front end is implemented with HTML5, CSS, and JavaScript. HTML defines the account, profile, requirements, schedule, progress, materials, and reminder interfaces. CSS provides responsive layout, cards, progress bars, schedule entries, focus states, and mobile breakpoints. JavaScript validates form input, generates subject rows, saves workspace data, builds schedule entries, updates dashboard panels, and communicates with server APIs.

The dashboard contains the following primary views:

* **Overview:** today’s tasks and upcoming examinations;
* **Study Plan:** complete schedule, sharing, and calendar export;
* **Progress:** subject completion and weekly activity;
* **Materials:** resource links and uploaded files;
* **AI Assistant:** a separate authenticated research page.

### B. Server-Side Implementation

The server is implemented using Python’s `http.server` module and `ThreadingHTTPServer`. It serves static files and JSON endpoints and initializes the SQLite database at startup. The implementation creates tables for users, sessions, workspaces, and study materials.

Workspace state is limited to profile, study, completed tasks, study sessions, reminders, and resources. Unsupported fields are rejected. Resource URLs are restricted to HTTPS addresses. This validation reduces malformed workspace values and prevents insecure resource protocols.

### C. Authentication and Session Management

User passwords are not stored in plaintext. Registration creates a random sixteen-byte salt and calculates:

\[
H = \operatorname{PBKDF2}_{\text{HMAC-SHA256}}
(P,S,310000)
\]

where \(P\) is the password and \(S\) is the random salt.

Login compares a newly calculated candidate hash with the stored hash using `hmac.compare_digest` to reduce timing differences. A random session token is generated after successful authentication. The server stores only the SHA-256 hash of the token and associates it with the user identifier and expiration time. The browser receives an HTTP-only, `SameSite=Strict` session cookie. Secure-cookie behavior can be enabled through `COOKIE_SECURE=1` when HTTPS is available. Sessions expire after seven days.

### D. Database Schema

The core SQLite schema is shown conceptually as follows:

**users**

* `id`
* `email`
* `password_salt`
* `password_hash`
* `created_at`

**sessions**

* `token_hash`
* `user_id`
* `expires_at`

**workspaces**

* `user_id`
* `data`

**materials**

* `id`
* `user_id`
* `name`
* `size`
* `mime_type`
* `subject_name`
* `uploaded_at`
* `data`

Workspace values are stored as JSON text, while uploaded material contents are stored as SQLite BLOB values. Database foreign keys link sessions and materials to users. Deleting a user may cascade-delete its sessions and materials.

### E. Study-Material Validation

The upload interface accepts PDF, Word, PowerPoint, text, Markdown, JPEG, and PNG files. The server validates the extension, name, subject name, Base64 encoding, and decoded file size. Uploaded files must contain at least one byte and cannot exceed five megabytes. MIME type is inferred from the file name. File names are sanitized before storage and retrieval.

### F. Progress and Analytics

When a task is marked complete, the browser stores a unique task key based on date and subject. It also creates a completed study session containing date, subject identifier, subject name, duration, and completion timestamp. The subject progress value is calculated as the number of completed subject tasks divided by the number of planned subject tasks:

\[
\text{Progress}_{i}=
\frac{N_{\text{completed},i}}{N_{\text{planned},i}}\times100
\]

If no tasks are planned for a subject, the application reports zero percent rather than dividing by zero. The weekly chart displays study hours completed during the latest seven-day window.

### G. AI Search Assistant

The assistant backend restricts access to authenticated sessions and validates the question and conversation history. Search queries are submitted to DuckDuckGo through a URL-encoded HTTP request. Search result HTML is parsed, and source URLs are required to use HTTPS. The system filters unsafe URLs and duplicate results. Up to five sources are sent to the model.

The system prompt instructs the model to answer clearly, distinguish supported facts from uncertainty, use supplied web results, cite sources, treat results as untrusted data, and avoid inventing citations. This design reduces uncontrolled prompt injection and unsupported source generation. However, the model can still misinterpret sources or fail to include complete factual support. Therefore, source links are displayed for independent verification.

### H. Security and Privacy Considerations

The main security mechanisms are:

* PBKDF2-HMAC-SHA256 password hashing;
* unique password salts;
* constant-time password comparison;
* HTTP-only session cookies;
* SameSite protection;
* optional secure-cookie mode;
* server-side access verification;
* workspace field allowlists;
* HTTPS-only resource URLs;
* upload extension and size validation;
* sanitized file names;
* and request-size limits.

The system is appropriate for local or trusted deployment environments. The repository documentation notes that the built-in server is not a hardened public production service. Additional security measures would include HTTPS deployment, rate limiting, malware scanning, email verification, password-reset protection, audit logs, database encryption at rest, and a production-grade web server.

## VI. EXPERIMENTAL SETUP AND EVALUATION

### A. Functional Testing

The repository includes `tests/test_assistant_backend.py`, which defines unit tests for the AI assistant. The tests verify that a valid query produces an Ollama request, that the search query is URL encoded, that conversation history is converted to assistant context, that unsafe search URLs are filtered, and that unavailable Ollama services or missing models return appropriate status messages.

**Table I. Existing Assistant Test Cases**

| Test case | Expected behavior |
|---|---|
| Successful search and reply | Search and Ollama requests execute; HTTPS source returned |
| Ollama unavailable | Status indicates that Ollama is not running |
| Model absent | Status instructs the user to install the configured model |

These tests validate backend behavior but do not measure scheduling accuracy, user satisfaction, or academic performance. Therefore, the final paper must not claim an empirical improvement in learning outcomes without participant data.

### B. Proposed Scheduling Evaluation

A controlled scheduling evaluation can use simulated subject datasets. Each dataset should specify subject count, examination dates, difficulty ratings, priority status, and daily study hours. The scheduler should be compared with:

* uniform allocation;
* deadline-only allocation;
* difficulty-only allocation; and
* manual student-created schedules.

Suggested scheduling metrics are:

* average daily assignment balance;
* percentage of high-difficulty subjects assigned before their examination;
* percentage of high-priority subjects assigned;
* average deadline proximity of scheduled subjects;
* maximum idle time for a subject;
* and response time for schedule generation.

A test should verify that no subject is assigned after its examination date and that the total scheduled time matches the configured daily hours.

### C. Proposed Usability Study

An optional undergraduate evaluation can recruit 20–30 students. Participants can perform:

1. account registration;
2. subject entry;
3. schedule generation;
4. task completion;
5. reminder creation;
6. file upload;
7. resource link insertion; and
8. use of the AI assistant.

The System Usability Scale (SUS) can be used to measure perceived usability [1]. NASA-TLX or a short workload questionnaire can measure perceived effort [2]. Task completion time and error counts can be recorded automatically or by observation.

The user study should also collect:

* perceived schedule usefulness;
* perceived workload;
* perceived deadline awareness;
* satisfaction with progress reporting;
* perceived reliability of AI sources;
* and willingness to continue using the application.

### D. Proposed Academic-Outcome Study

If used in a semester-long study, participants could be divided into a planner group and a manual-planning control group. Academic indicators may include assignments completed on time, study consistency, examination scores, revision frequency, and self-reported stress. Statistical comparison may use a paired \(t\)-test for normally distributed results or a non-parametric alternative where assumptions are not satisfied.

At a minimum, the study should define:

* participant inclusion and exclusion criteria;
* study duration;
* baseline characteristics;
* intervention and control activities;
* outcome variables;
* data-collection methods;
* and participant consent.

This work should not claim that the system improves examination performance unless the design supports such a claim.

### E. Security Testing

Security tests should cover duplicate registration, incorrect login, expired sessions, cross-user workspace access, oversized workspace data, unsupported upload formats, oversized files, unsafe URLs, malformed JSON, and file deletion by unauthorized users. A password comparison test and session-token test would verify authentication behavior.

## VII. RESULTS AND DISCUSSION

No final accuracy or academic-performance result can be reported until participant or benchmark evaluation is completed. The current project, however, demonstrates a complete implementation of the major functional requirements.

### A. Implemented Functional Coverage

The system demonstrates:

* personalized subject entry;
* examination-date-aware scheduling;
* weighted allocation of study blocks;
* persistent account and workspace data;
* completion tracking;
* progress summaries;
* reminders;
* resource and file management;
* schedule export and sharing;
* source-referenced local AI search; and
* responsive dashboard navigation.

### B. Interpretation of the Scheduling Method

The scheduling formula is transparent and deterministic. Its components can be explained to a user: difficult subjects receive a higher weight, high-priority subjects receive an additional factor, and deadline proximity increases urgency. The fairness denominator prevents the same subject from monopolizing all blocks within a day. However, the formula has several limitations:

* it does not learn from completed performance;
* it does not automatically vary study duration according to historical productivity;
* it does not model breaks or unavailable time periods;
* it does not account for prerequisite dependencies between subjects;
* and it can allocate excessive time to the latest subject if configuration parameters are not balanced.

These limitations should be considered design constraints rather than failures. The current implementation prioritizes explainability and low computational cost.

### C. Expected Results from Future Evaluation

With a correctly conducted user study, successful results could include a significantly higher task completion rate for planned study sessions, improved awareness of approaching examinations, lower manual planning time, and positive SUS scores. The AI assistant could improve the speed of locating educational references, but its reliability would require separate factual accuracy assessment.

The evaluation report should include the SUS score, mean task completion time, scheduling error rate, number of successful AI requests, number of failed requests, and participant comments. It should not report a mean or percentage without sample size and, where applicable, confidence intervals or standard deviation.

### D. Limitations

The project has the following limitations:

1. The system is not yet validated through a formal participant study.
2. The scheduling heuristic has not been compared against optimization or machine-learning baselines.
3. No cloud synchronization or cross-device database sharing is implemented.
4. The in-app reminder feature operates while the application is open.
5. Email and push notifications are not implemented.
6. AI search depends on internet access and DuckDuckGo availability.
7. Ollama must be installed and running with the selected model.
8. The built-in HTTP server is suitable for local or trusted use, not hardened public deployment.
9. Uploaded files are stored in SQLite and may not scale efficiently for many large files.
10. The study-plan view does not model holidays, sleep, unavailable periods, or exam-specific revision strategies.
11. The system cannot establish that a language-model answer is correct, even when a source is displayed.
12. Progress is based on task completion, not measured learning or examination performance.

## VIII. CONCLUSION AND FUTURE WORK

This paper presented Smart AI Planner, a browser-based academic planning system that combines adaptive examination scheduling, task tracking, progress visualization, reminders, resource management, study-material storage, and AI-assisted research. The system was implemented using HTML, CSS, JavaScript, Python, and SQLite. It uses PBKDF2-HMAC-SHA256 and server-side sessions to protect account access and isolates workspace data for authenticated users.

The scheduling algorithm converts daily study time into thirty-minute blocks and prioritizes subjects based on difficulty, high-priority status, examination proximity, and allocation fairness. The application provides a transparent alternative to manually maintained timetables. The AI assistant uses DuckDuckGo search results as contextual evidence for an Ollama-hosted model and presents source links to the user.

The principal contribution of this project is the integration of scheduling and learning-support functions within a single local-first web application. A student can create a plan, record progress, manage learning materials, configure reminders, and search educational information without separate applications. The security and privacy design also provides a foundation for a controlled local deployment.

Future work should include:

* formal usability and academic-outcome studies;
* comparison with greedy, genetic, and constraint-based scheduling methods;
* machine-learning prediction of subject difficulty and required revision time;
* automatic adjustment based on completed-session history;
* support for unavailable time blocks, breaks, holidays, and part-time study;
* cloud synchronization and multi-device access;
* push and email notification services;
* subject-level study analytics;
* collaborative or team study plans;
* encrypted database storage;
* malware scanning for uploads;
* role-based access for teachers and administrators;
* multi-language support;
* and a production-ready deployment architecture.

Future AI work should include hallucination assessment, citation verification, retrieval quality metrics, and prompt-injection defense. The assistant should also allow users to select verified academic sources and distinguish peer-reviewed information from general web content.

## ACKNOWLEDGMENT

The authors would like to acknowledge [supervisor name], [department name], and [institution name] for guidance and support.

## REFERENCES

[1] J. Brooke, “SUS: A Quick and Dirty Usability Scale,” *Usability Evaluation in Industry*, 1996.

[2] S. G. Hart and L. E. Staveland, “Development of NASA-TLX (Task Load Index): Results of empirical and theoretical research,” *Advances in Psychology*, vol. 52, pp. 139–183, 1988.

[3] Ollama Documentation, “Run LLMs locally,” 2025. [Online]. Available: https://ollama.com/

[4] DuckDuckGo, “DuckDuckGo Search,” 2025. [Online]. Available: https://duckduckgo.com/

[5] SQLite Consortium, “SQLite: A small, fast, self-contained SQL database engine,” 2025. [Online]. Available: https://sqlite.org/

[6] OWASP Foundation, “Password Storage Cheat Sheet,” 2025. [Online]. Available: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html

[7] OWASP Foundation, “Session Management Cheat Sheet,” 2025. [Online]. Available: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
