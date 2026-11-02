# EasyList — Production Frontend

A commercial SaaS web application developed by **Avenzo Technologies** designed to help wholesale grocery shops convert handwritten customer orders into editable digital lists.

---

## 1. Team Responsibilities

To ensure clean architecture and separation of concerns across our development team:

### Frontend Responsibilities (This Codebase)
- UI/UX implementation from Figma designs
- Converting Figma designs into production-ready React components
- Responsive layouts across mobile, tablet, and desktop breakpoints
- Frontend form validation, UX interactions, and visual feedback
- Centralized design tokens and typography hierarchy
- Reusable HTTP client and TypeScript interfaces
- Connecting to backend APIs once contracts and endpoints are provided

### Backend Responsibilities (Teammates)
- Backend services and API development
- Database schema design, migrations, and management
- Authentication backend, JWT/session issuance, and credential hashing
- AI handwriting extraction APIs (Tamil & English handwriting recognition)
- Server-side translation and transliteration APIs (Tamil ↔ English)
- Backend security, server-side rate limiting, and cloud deployment

---

## 2. Technology Stack

- **Core**: [React 19](https://react.dev/) + [Vite 8](https://vitejs.dev/) + [TypeScript 5.7](https://www.typescriptlang.org/) (Strict Mode)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) with centralized CSS tokens and design system variables
- **Routing**: [React Router v7](https://reactrouter.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Code Quality**: ESLint flat config (`typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`)
- **Typography**:
  - **Headings**: *Plus Jakarta Sans*
  - **Body, Inputs, & Buttons**: *Inter*
  - **Tamil Text**: *Noto Sans Tamil*

---

## 3. Brand & Design System

### Brand Color Palette
| Token | Hex Value | Usage |
|---|---|---|
| **Primary Navy** | `#111C35` | Main headers, navbar, primary brand container |
| **Primary Blue** | `#087BFA` | Primary call-to-action buttons, active navigation, focus rings |
| **Accent Blue** | `#3B9BFF` | Hover states, secondary accents, highlight badges |
| **Page Background** | `#F0F5FC` | Application background (subtle cool tint) |
| **Dashboard Background** | `#F5F7FB` | Main workspace background |
| **White** | `#FFFFFF` | Cards, modals, form surfaces, dropdowns |
| **Primary Text** | `#111827` | Main headings and body text |
| **Secondary Text** | `#64748B` | Subtitles, helper text, table column labels |
| **Input Border** | `#DCE5F2` | Default input border, card dividers |
| **Placeholder Text** | `#8296B5` | Form input placeholder text |

### Responsive Breakpoints
- **Mobile Small**: `360px`
- **Mobile Medium**: `390px`
- **Mobile Large**: `430px`
- **Tablet**: `768px`
- **Desktop Small**: `1024px`
- **Desktop Medium**: `1280px`
- **Desktop Large**: `1440px`

---

## 4. Architecture & Folder Structure

```
c:\EasyList\
├── public/
│   └── images/
│       ├── EasyList logo.png              # Primary commercial logo
│       ├── EasyList login image.png       # Auth visual artwork
│       ├── Login-EasyList.png             # Figma reference screenshot
│       └── Dashboard-EasyList.png         # Figma reference screenshot
├── src/
│   ├── assets/                            # Asset constant mappings
│   ├── components/
│   │   ├── layout/                        # App shell, headers, nav
│   │   └── ui/                            # Atomic buttons, inputs, modals, badges
│   ├── features/                          # Domain features (scheduled roadmap)
│   │   ├── auth/                          # Authentication forms
│   │   ├── upload/                        # Multi-image order upload
│   │   ├── extraction/                    # Item review & verification
│   │   ├── translation/                   # Tamil <-> English translation
│   │   ├── export/                        # PDF, Excel, CSV, TXT exports
│   │   └── settings/                      # Store profile settings
│   ├── hooks/                             # Shared custom React hooks
│   ├── pages/                             # Route page components
│   ├── routes/                            # React Router paths & router definition
│   │   ├── paths.ts                       # Typed route constants
│   │   ├── PlaceholderScreen.tsx          # Phase 1 route placeholder
│   │   ├── FoundationHome.tsx             # Phase 1 verification landing
│   │   └── index.tsx                      # Centralized createBrowserRouter
│   ├── services/
│   │   └── api/                           # Reusable HTTP client & API configs
│   │       ├── client.ts                  # Abortable fetch client with error handling
│   │       ├── config.ts                  # Base URL & timeout config
│   │       ├── error.ts                   # Unified ApiError class
│   │       └── index.ts                   # Barrel export
│   ├── styles/
│   │   ├── index.css                      # Tailwind v4, resets, print styles
│   │   ├── tokens.css                     # CSS Custom Properties
│   │   └── tokens.ts                      # Strongly typed TypeScript tokens
│   ├── types/
│   │   ├── api.ts                         # Request, response, error types
│   │   ├── state.ts                       # Async UI state patterns
│   │   └── vite-env.d.ts                  # Vite client & env type declarations
│   ├── utils/                             # Core utilities (cn, formatting, sanitize)
│   ├── App.tsx                            # Root application component
│   └── main.tsx                           # Application entry point
├── .env.example                           # Safe configuration template
├── .gitignore                             # Version control exclusions
├── eslint.config.js                       # ESLint 9/10 flat config
├── index.html                             # Semantic HTML shell & Google Fonts
├── package.json                           # Scripts & dependencies
├── tsconfig.json                          # Strict TypeScript config
└── vite.config.ts                         # Vite configuration with Tailwind
```

---

## 5. Frontend Routing Foundation

The application router is structured with centralized route constants in `src/routes/paths.ts`:

### Public Routes
- `/login` — Sign In screen (Phase 2)
- `/register` — Create Account screen (Phase 2)
- `/forgot-password` — Password recovery screen (Phase 2)
- `/reset-password` — Password reset screen (Phase 2)

### Protected Routes
- `/dashboard` — Multi-image upload and workflow tracker (Phase 3)
- `/review` — Side-by-side extracted item editor & translation (Phase 5)
- `/export` — List preview and multi-format download (Phase 6)
- `/settings` — Shop profile management (Phase 6)

---

## 6. Backend Integration Readiness

The frontend HTTP client in `src/services/api/client.ts` is fully prepared to integrate with the backend API without invented endpoints:

1. **Environment Configuration**: Set `VITE_API_BASE_URL` in `.env.local` to point to the backend server.
2. **Dynamic Auth Token Injection**: Once authentication endpoints are delivered, register the token provider via:
   ```ts
   import { apiClient } from '@/services/api';

   apiClient.setTokenProvider(async () => {
     return localStorage.getItem('access_token');
   });
   ```
3. **Request Cancellation**: Every request supports native `AbortSignal` for user cancellations or route transitions.
4. **Standard Error Handling**: All HTTP responses return a structured `ApiError` with status code, message, and field validation details.
5. **Async State Models**: `src/types/state.ts` provides `createInitialState`, `createLoadingState`, `createSuccessState`, and `createErrorState` helpers.

### Information Required From Backend Team
When backend endpoints are ready, the frontend team requires:
- Swagger / OpenAPI specification or Postman collection
- Authentication flow specifications (Session cookie vs Bearer JWT token)
- AI handwriting extraction request payload format (Multipart form-data image upload schema)
- AI extraction response structure (Item names, quantities, detected units, confidence scores)
- Translation API endpoint contracts (Tamil ↔ English transliteration/translation)

---

## 7. Development Scripts

```bash
# Start local development server (http://localhost:3000)
npm run dev

# Run TypeScript typecheck without emitting files
npm run typecheck

# Run ESLint validation
npm run lint

# Compile production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## 8. Development Roadmap

- [x] **Phase 1 — Frontend foundation setup** *(Completed)*
- [ ] **Phase 2 — Login and Create Account UI**
- [ ] **Phase 3 — Dashboard UI**
- [ ] **Phase 4 — Image upload and preview interactions**
- [ ] **Phase 5 — Extract & Review UI**
- [ ] **Phase 6 — Export UI and browser-side export functionality**
- [ ] **Phase 7 — Backend API integration with teammates**
- [ ] **Phase 8 — Responsive testing and UI refinement**
- [ ] **Phase 9 — Production frontend deployment**
