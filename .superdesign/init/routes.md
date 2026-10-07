# Routes and State Navigation

All screens currently share URL `/`; React state determines rendering. Dashboard hash links prevent default navigation and update local state. No router is installed.

| Step | Entry | Layout |
| --- | --- | --- |
| login | src/pages/LoginPage.tsx | standalone authentication |
| profile | src/pages/ProfileSetupPage.tsx | standalone setup |
| dashboard | src/App.tsx: Dashboard | workspace header/navigation |
| guidelines | src/pages/AssessmentGuidelinesPage.tsx | preparation |
| chat | src/pages/LiveChatbotAssessmentPage.tsx | assessment |
| skill | src/pages/SkillAssessmentPage.tsx | assessment |
| roadmap | src/pages/LearningRoadmapPage.tsx | learning |

Full navigation configuration is the App source in layouts.md; there is no separate router config.

