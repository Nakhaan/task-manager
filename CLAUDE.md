<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->

---

# Task Manager — Codebase Guide

## Project Overview

A cross-platform task management app (iOS, Android, Web) with project-based task assignment, status workflows, and per-user time tracking. Built with Expo/React Native on the frontend and Convex as the serverless backend.

**Core features:**
- Password-based auth with role system (admin / member)
- Projects with invite-token membership
- Tasks with a 4-state workflow: `pending_acceptance` → `accepted` → `in_progress` → `completed`
- Per-task time tracking (start/pause, one active timer per user)
- Admin dashboards for users and departments

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | Expo ~54.0.33 + React Native 0.81.5 |
| UI language | React 19.1.0 + TypeScript (strict) |
| Routing | Expo Router ~6.0.23 (file-based) |
| Backend / database | Convex 1.34.1 |
| Authentication | @convex-dev/auth 0.0.91 (Password provider) |
| Secure storage | expo-secure-store (native), localStorage (web) |
| Linting | ESLint 9.25.0 (eslint-config-expo) |
| Build / deploy | EAS (Expo Application Services) |

**TypeScript path alias:** `@/*` resolves to the repository root. Use `@/convex/_generated/api` etc.

---

## Directory Structure

```
task-manager/
├── app/                        # Expo Router screens (file-based routing)
│   ├── _layout.tsx             # Root layout: ConvexAuthProvider + ThemeProvider + Stack
│   ├── (auth)/                 # Auth screens group (redirects out if authenticated)
│   │   ├── _layout.tsx
│   │   ├── sign-in.tsx
│   │   └── sign-up.tsx
│   ├── (tabs)/                 # Main tab navigation (auth-guarded)
│   │   ├── _layout.tsx         # Tab bar setup (Ionicons)
│   │   ├── index.tsx           # Timer screen
│   │   ├── tasks.tsx           # My Tasks (accepted + in_progress)
│   │   ├── pending.tsx         # Pending acceptance queue
│   │   ├── projects.tsx        # Projects list + create/join
│   │   └── summary.tsx         # Time analytics by department
│   ├── project/[id].tsx        # Dynamic project detail + task management
│   ├── admin/
│   │   ├── users.tsx           # User role management (admin only)
│   │   └── departments.tsx     # Department CRUD (admin only)
│   ├── join/[token].tsx        # Join project via invite token
│   └── modal.tsx
├── components/                 # Reusable React Native components
├── hooks/                      # Custom hooks (useColorScheme, useThemeColor)
├── constants/
│   └── theme.ts                # Colors + Fonts constants
├── convex/                     # Convex backend (DO NOT edit _generated/)
│   ├── schema.ts               # Database schema
│   ├── auth.ts                 # Auth setup + afterUserCreatedOrUpdated callback
│   ├── auth.config.ts          # JWT config (reads CONVEX_SITE_URL)
│   ├── http.ts                 # HTTP routes (auth endpoints)
│   ├── users.ts                # User queries/mutations
│   ├── projects.ts             # Project queries/mutations
│   ├── tasks.ts                # Task queries/mutations
│   ├── timers.ts               # Time tracking queries/mutations
│   ├── departments.ts          # Department queries/mutations
│   └── _generated/             # AUTO-GENERATED — never edit manually
│       ├── api.d.ts / api.js
│       ├── server.d.ts / server.js
│       ├── dataModel.d.ts
│       └── ai/guidelines.md    # Convex AI usage rules
├── assets/                     # Images, icons, splash screens
├── app.json                    # Expo app config
├── eas.json                    # EAS build profiles
├── tsconfig.json               # TypeScript config
└── eslint.config.js
```

---

## Development Workflows

### Start the dev server

```bash
npm start          # Expo dev server (Metro bundler)
npm run android    # Android emulator
npm run ios        # iOS simulator
npm run web        # Web browser
```

### Lint

```bash
npm run lint       # ESLint via expo lint
```

### Convex

The Convex backend runs as a separate cloud service. The frontend connects via `EXPO_PUBLIC_CONVEX_URL`. In development, run `npx convex dev` alongside the Expo server to sync schema and functions automatically.

---

## Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `EXPO_PUBLIC_CONVEX_URL` | `.env.local` (frontend) | Convex deployment URL |
| `CONVEX_SITE_URL` | Convex dashboard env vars | JWT issuer domain (used in `auth.config.ts`) |

---

## Convex Backend

### Database Schema (`convex/schema.ts`)

| Table | Key fields | Important indexes |
|---|---|---|
| `userProfiles` | userId, name, email, role, customRoleLabel | by_userId, by_email |
| `departments` | name, createdBy | — |
| `projects` | name, description, ownerId | by_ownerId |
| `projectMembers` | projectId, userId, joinedAt | by_projectId, by_userId, by_projectId_and_userId |
| `projectInvites` | projectId, token, createdBy | by_token |
| `tasks` | projectId, title, status, assigneeId, creatorId, departmentId | by_projectId, by_assigneeId, by_assigneeId_and_status |
| `timeSessions` | taskId, userId, startTime, endTime | by_userId, by_taskId, by_userId_and_taskId |
| `activeTimers` | userId, taskId, sessionId | by_userId |

Plus Convex Auth internal tables (from `authTables`).

### Function Files

- **`users.ts`** – `getCurrentUser`, `getAllUsers` (admin), `updateUserRole` (admin), `updateMyName`
- **`projects.ts`** – `getMyProjects`, `getAllProjects` (admin), `getProject`, `getProjectMembers`, `createProject`, `generateInviteToken`, `joinByToken`, `removeProjectMember`
- **`tasks.ts`** – `getProjectTasks`, `getMyTasks`, `getPendingTasks`, `getMyAllTasks`, `getTaskById`, `createTask`, `updateTask`, `deleteTask`, `acceptTask`, `rejectTask`
- **`timers.ts`** – `getActiveTimer`, `getMyTasksWithTime`, `getTimeSummary`, `startTimer`, `pauseTimer`
- **`departments.ts`** – `getDepartments`, `createDepartment` (admin), `deleteDepartment` (admin)

### Task Status Workflow

```
pending_acceptance  →  accepted  →  in_progress  →  completed
```

- Task assigned to someone else starts as `pending_acceptance`
- Task assigned to self (or unassigned) starts as `accepted`
- `startTimer` sets status to `in_progress`; `pauseTimer` reverts to `accepted`
- `rejectTask` reassigns to creator and sets status to `accepted`

### Authorization Patterns

- All functions call `getAuthUserId(ctx)` and throw if unauthenticated
- Role checks: `userProfile.role === 'admin'` for admin-only operations
- Project membership checks via `projectMembers` table lookup
- `deleteTask`: admin OR project owner OR task creator

### Generated Files — Never Edit

`convex/_generated/` is fully auto-generated by `npx convex dev`. The key exports:

```typescript
import { api } from '@/convex/_generated/api';          // function references
import { Id, Doc } from '@/convex/_generated/dataModel'; // table types
```

---

## Frontend Conventions

### Data Fetching (Convex hooks)

```typescript
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

// Read (reactive — auto-updates on data change)
const tasks = useQuery(api.tasks.getMyTasks);
const project = useQuery(api.projects.getProject, { projectId });

// Write
const createTask = useMutation(api.tasks.createTask);
await createTask({ projectId, title, assigneeId });
```

- `useQuery` returns `undefined` while loading, then the typed result
- Always guard against undefined: `tasks ?? []`

### Authentication

```typescript
import { useConvexAuth } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';

const { isAuthenticated, isLoading } = useConvexAuth();
const { signIn, signOut } = useAuthActions();

// Sign in with password
await signIn('password', { email, password, flow: 'signIn' });
```

- Root layout wraps the app in `ConvexAuthProvider`
- Tab layout redirects to `/(auth)/sign-in` when `!isAuthenticated`
- Auth layout redirects to `/(tabs)` when `isAuthenticated`

### Routing

Uses Expo Router (file-based). Key patterns:

```typescript
import { useRouter, useLocalSearchParams } from 'expo-router';

const router = useRouter();
router.push('/project/abc123');
router.navigate('/(tabs)');

// Dynamic route params
const { id } = useLocalSearchParams<{ id: string }>();
```

### State Management

No Redux or Zustand. Pattern:
- **Server state:** Convex `useQuery` (reactive) and `useMutation`
- **Local UI state:** React `useState` (modals, filters, form inputs)
- **Derived data:** `useMemo` for filtered lists and lookup maps

### Styling

Uses `StyleSheet.create()` — no Tailwind, no CSS modules.

**Design tokens:**

| Token | Value |
|---|---|
| Primary (indigo) | `#4f46e5` |
| Background | `#f5f5f5` |
| Card background | `#fff` |
| Admin (purple) | `#7c3aed` |
| In Progress (green) | `#059669` |
| Pending (amber) | `#f59e0b` |
| Completed (gray) | `#6b7280` |
| Destructive (red) | `#dc2626` |

**Shadow pattern (cross-platform):**
```typescript
shadowColor: '#000',
shadowOffset: { width: 0, height: 2 },
shadowOpacity: 0.06,
shadowRadius: 12,
elevation: 3,  // Android
```

### Naming Conventions

| Kind | Convention | Example |
|---|---|---|
| Components / screens | PascalCase | `TimerScreen`, `ProjectDetailScreen` |
| Hooks | camelCase, `use` prefix | `useColorScheme` |
| Functions | camelCase | `handleStart`, `formatHHMMSS` |
| Constants | UPPER_SNAKE_CASE | `STATUS_COLOR`, `STATUS_LABELS` |
| Types / interfaces | PascalCase | `Filter = 'all' \| 'active' \| 'done'` |

### Error Handling Pattern

```typescript
async function handleAction() {
  try {
    await mutation({ /* params */ });
  } catch (e: any) {
    Alert.alert('Error', e.message ?? 'Failed to complete action');
  }
}
```

### Modal Pattern

```typescript
const [editingItem, setEditingItem] = useState<Item | null>(null);

<Modal visible={!!editingItem} transparent animationType="slide">
  <View style={styles.modalOverlay}>
    <View style={styles.modalSheet}>
      {/* content */}
    </View>
  </View>
</Modal>
```

### Timer / Interval Pattern

```typescript
const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

useEffect(() => {
  if (activeTimer?.startTime) {
    intervalRef.current = setInterval(tick, 1000);
  }
  return () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  };
}, [activeTimer?.startTime]);
```

### Platform-Specific Files

- `.ios.ts` / `.web.ts` suffixes for platform-specific implementations
- `Platform.OS !== 'web'` checks inline when the difference is small

---

## Testing

No test files exist yet. The project is set up to use **convex-test** with **vitest** for backend function testing (see `convex/_generated/ai/guidelines.md` for patterns). There is no frontend test setup currently.

---

## Build & Deployment

Uses EAS (Expo Application Services):

```bash
eas build --profile development   # internal dev build
eas build --profile preview       # internal distribution
eas build --profile production    # app store release
```

EAS project ID: `71857ede-734c-4ad1-ab76-edebf508c5fa`  
App bundle IDs: `com.nkwz.taskmanager` (iOS + Android)
