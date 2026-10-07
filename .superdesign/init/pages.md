# Page Dependencies

Global dependencies for all pages: src/main.tsx -> src/App.tsx; src/styles.css; tailwind.config.js. Shared logo has no imports. API imports only assessment/profile types, making a type-only cycle with profile setup. Assessment types have no local imports. Roadmap data imports assessment types only.

## src/pages/AssessmentGuidelinesPage.tsx

- import { SkillPathLogo } from '../components/SkillPathLogo';
- import type { ProfileSetupResult } from './ProfileSetupPage';
- import type { AssessmentAccessGrant } from '../types/assessment';

## src/pages/LearningRoadmapPage.tsx

- import { SkillPathLogo } from '../components/SkillPathLogo';
- import { buildRoadmap } from '../data/roadmap';
- import type { AgenticSession, AssessmentAccessGrant, NotebookEntry, RoadmapSubtopic, SkillAssessmentResult } from '../types/assessment';
- import type { ProfileSetupResult } from './ProfileSetupPage';

## src/pages/LiveChatbotAssessmentPage.tsx

- import { CameraMonitor } from '../components/CameraMonitor';
- import { SkillPathLogo } from '../components/SkillPathLogo';
- import { recordProctorEvent, startAgentSession, submitAgentAnswer } from '../api/skillpathApi';
- import type { AssessmentAccessGrant, AgenticSession, SkillState } from '../types/assessment';
- import type { ProfileSetupResult } from './ProfileSetupPage';

## src/pages/LoginPage.tsx

- import { SkillPathLogo } from '../components/SkillPathLogo';
- import { googleLogin, loginCredentials, register, type LoginResponse } from '../api/skillpathApi';

## src/pages/ProfileSetupPage.tsx

- import { SkillPathLogo } from '../components/SkillPathLogo';
- import type { LoginMethod } from './LoginPage';
- import { uploadDocument } from '../api/skillpathApi';

## src/pages/SkillAssessmentPage.tsx

- import { CameraMonitor } from '../components/CameraMonitor';
- import { SkillPathLogo } from '../components/SkillPathLogo';
- import { createSkillAssessment, recordSkillAssessmentProctorEvent, submitSkillAssessment } from '../api/skillpathApi';
- import type { AgenticSession, AssessmentAccessGrant, SkillAssessment, SkillAssessmentResult } from '../types/assessment';
- import type { ProfileSetupResult } from './ProfileSetupPage';

## src/api/skillpathApi.ts

- import type { AgenticSession, SkillAssessment, SkillAssessmentResult } from '../types/assessment';
- import type { ProfileSetupResult } from '../pages/ProfileSetupPage';

## src/types/assessment.ts

- No local imports.

## src/data/roadmap.ts

- import type { AgenticSession, RoadmapSubtopic, RoadmapTopic, SkillAssessmentResult } from '../types/assessment';

