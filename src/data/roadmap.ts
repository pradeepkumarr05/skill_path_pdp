import type { AgenticSession, RoadmapSubtopic, RoadmapTopic, SkillAssessmentResult } from '../types/assessment';

const subtopicTemplates: Record<string, Omit<RoadmapSubtopic, 'id' | 'skill' | 'minutes'>[]> = {
  HTML: [
    {
      title: 'Semantic Form Controls',
      objective: 'Use native elements for accessible app workflows.',
      checkPrompt: 'Explain why a native submit button is safer than a div with a click handler in a production form.',
      correction: 'A native button gives semantics, keyboard activation, focus behavior, and form submission behavior without extra JavaScript.',
      notes: ['Prefer native controls before ARIA.', 'Every interactive element needs keyboard behavior and a clear accessible name.'],
    },
    {
      title: 'Accessible Content Structure',
      objective: 'Structure documents so users and assistive technology can scan them.',
      checkPrompt: 'Explain how main, section, headings, and alt text work together on a product page.',
      correction: 'Landmarks, ordered headings, and meaningful alt text create a navigable structure for both visual and assistive users.',
      notes: ['Use one main landmark per page.', 'Meaningful images need concise alt text; decorative images use empty alt text.'],
    },
  ],
  CSS: [
    {
      title: 'Responsive Grid Systems',
      objective: 'Build stable layouts that adapt without breakpoint sprawl.',
      checkPrompt: 'Explain when you would use repeat(auto-fit, minmax(...)) in an assessment dashboard.',
      correction: 'It creates responsive tracks that fill available space while respecting a minimum usable card width.',
      notes: ['Use minmax for stable responsive grids.', 'Prevent content jumps with explicit min widths, aspect ratios, and overflow rules.'],
    },
    {
      title: 'Box Model Predictability',
      objective: 'Control sizing, spacing, and layout stability.',
      checkPrompt: 'Explain why border-box makes form and card sizing easier to reason about.',
      correction: 'border-box includes padding and border in the declared size, making nested layout calculations predictable.',
      notes: ['Set box-sizing globally in app CSS resets.', 'Use padding for internal space and margin for external rhythm.'],
    },
  ],
  JavaScript: [
    {
      title: 'Event Loop and Async Flow',
      objective: 'Reason about browser execution order under load.',
      checkPrompt: 'Explain why a Promise callback usually runs before a setTimeout callback.',
      correction: 'Promise callbacks are microtasks, and the JavaScript runtime drains microtasks before the next macrotask.',
      notes: ['await pauses the async function, not the whole thread.', 'Microtasks run before timer macrotasks.'],
    },
    {
      title: 'Client-Side Idempotency Guards',
      objective: 'Prevent duplicate user actions during pending work.',
      checkPrompt: 'Explain how you would stop a double-click from creating two checkout requests.',
      correction: 'Lock the action while pending and pair it with a server idempotency key or duplicate guard.',
      notes: ['Disable primary actions during pending submissions.', 'Client guards help UX; server idempotency protects correctness.'],
    },
  ],
  TypeScript: [
    {
      title: 'Discriminated UI State',
      objective: 'Model request states without nullable field confusion.',
      checkPrompt: 'Explain why a status-based union is better than optional data and error fields.',
      correction: 'Each state owns only the fields it can legally use, and TypeScript narrows from the status discriminator.',
      notes: ['Use a literal status field for request states.', 'Avoid data/error/loading combinations that can contradict each other.'],
    },
    {
      title: 'Type Narrowing in API Results',
      objective: 'Safely handle variant responses from backend calls.',
      checkPrompt: 'Explain what TypeScript learns after checking if "error" in result.',
      correction: 'The property check narrows the union to the member that contains error, allowing safe access.',
      notes: ['Narrow before reading variant-specific fields.', 'Use exhaustive switches for important app state machines.'],
    },
  ],
  React: [
    {
      title: 'List Identity and Reconciliation',
      objective: 'Keep component state attached to the correct rendered item.',
      checkPrompt: 'Explain why array indexes are unsafe keys when rows can be reordered.',
      correction: 'React uses keys for identity; unstable keys can move local state to the wrong row after reorder.',
      notes: ['Use stable ids for list keys.', 'Indexes are only acceptable for static lists that never reorder or filter.'],
    },
    {
      title: 'Effect Cleanup Discipline',
      objective: 'Avoid leaks and stale behavior in interactive screens.',
      checkPrompt: 'Explain what cleanup an interval-based timer needs in useEffect.',
      correction: 'Return a cleanup function that clears the interval whenever dependencies change or the component unmounts.',
      notes: ['Clean up timers, listeners, subscriptions, and media handlers.', 'Keep effect dependencies aligned with values used inside.'],
    },
  ],
  'Node.js': [
    {
      title: 'Server Secret Boundaries',
      objective: 'Keep API keys and scoring logic out of the browser.',
      checkPrompt: 'Explain why Gemini or payment keys must stay in a Node backend.',
      correction: 'Browser code is inspectable, so secrets and abuse controls must live on a server boundary.',
      notes: ['Keep secrets in server env vars.', 'Centralize validation, rate limits, audit logs, and provider calls on the backend.'],
    },
    {
      title: 'Non-Blocking Request Handling',
      objective: 'Understand why Node fits I/O-heavy assessment APIs.',
      checkPrompt: 'Explain how the event loop helps Node serve many waiting API requests.',
      correction: 'Node can wait on I/O without blocking the main thread, then resume callbacks as operations complete.',
      notes: ['Avoid CPU-heavy work on the event loop.', 'Use async I/O for provider calls, file reads, and network requests.'],
    },
  ],
  'REST APIs': [
    {
      title: 'Idempotent Endpoint Design',
      objective: 'Make retries safe in assessment submission flows.',
      checkPrompt: 'Explain why PUT is commonly idempotent and how that helps retries.',
      correction: 'PUT sets a known resource representation, so repeated identical requests should leave the resource in the same state.',
      notes: ['Use idempotency keys for non-idempotent operations.', 'Question id guards help prevent duplicate answer submission.'],
    },
    {
      title: 'Validation Status Codes',
      objective: 'Return predictable errors for frontend clients.',
      checkPrompt: 'Explain when a validation failure might return 422 instead of 400.',
      correction: '422 fits requests that are syntactically valid JSON but semantically invalid for business rules.',
      notes: ['Use consistent error shapes.', 'Separate parse errors from business validation errors.'],
    },
  ],
  'Data Structures and Algorithms': [
    {
      title: 'Hash Map Pattern Recognition',
      objective: 'Spot O(n) lookup patterns in coding rounds.',
      checkPrompt: 'Explain why a hash map helps solve two-sum in expected linear time.',
      correction: 'A hash map stores seen values so each complement lookup is expected O(1) during one scan.',
      notes: ['Track values you have already seen.', 'State the time and space tradeoff clearly.'],
    },
    {
      title: 'Graph Traversal Basics',
      objective: 'Use BFS for shortest paths in unweighted graphs.',
      checkPrompt: 'Explain why BFS finds the shortest path by edge count in an unweighted graph.',
      correction: 'BFS explores nodes in distance layers, so the first time a node is reached is through the fewest edges.',
      notes: ['Use a queue for BFS.', 'Track visited nodes to avoid cycles and repeated work.'],
    },
  ],
  PostgreSQL: [
    {
      title: 'Index Tradeoffs',
      objective: 'Choose indexes based on real query patterns.',
      checkPrompt: 'Explain the read/write tradeoff of adding an index to a busy table.',
      correction: 'Indexes can speed reads but add storage and write-maintenance cost on inserts, updates, and deletes.',
      notes: ['Index frequent filters, joins, and sorts.', 'Do not index every column by default.'],
    },
    {
      title: 'Transactional Consistency',
      objective: 'Protect multi-step writes from partial completion.',
      checkPrompt: 'Explain why order creation and inventory decrement belong in one transaction.',
      correction: 'A transaction makes related writes commit together or roll back together, preserving consistency.',
      notes: ['Use transactions for dependent writes.', 'Think about rollback paths before adding side effects.'],
    },
  ],
  MongoDB: [
    {
      title: 'Embedding vs Referencing',
      objective: 'Model document data around access patterns.',
      checkPrompt: 'Explain when bounded child data should be embedded in a parent document.',
      correction: 'Embedding fits data that is small, bounded, and usually read with the parent.',
      notes: ['Avoid unbounded arrays inside one document.', 'Let read/write patterns drive modeling choices.'],
    },
    {
      title: 'Indexing Query Patterns',
      objective: 'Design indexes for high-value filters and sorts.',
      checkPrompt: 'Explain what should guide index design in MongoDB collections.',
      correction: 'Indexes should match the common filters and sort patterns that must stay fast.',
      notes: ['Build indexes around real queries.', 'Measure query plans instead of guessing.'],
    },
  ],
  Git: [
    {
      title: 'Secret-Safe Git Workflow',
      objective: 'Prevent sensitive files from reaching commits.',
      checkPrompt: 'Explain what to do when .env is staged but not committed.',
      correction: 'Unstage the file, confirm .env is ignored, and rotate the secret if it left your machine.',
      notes: ['Keep .env in .gitignore.', 'Never push API keys or generated secrets.'],
    },
    {
      title: 'Clean Feature Branch Review',
      objective: 'Keep collaboration history understandable.',
      checkPrompt: 'Explain why a team may rebase a feature branch before review.',
      correction: 'Rebasing can replay local commits on the latest base, making review history cleaner when used carefully.',
      notes: ['Avoid rewriting shared branches without coordination.', 'Resolve conflicts deliberately and rerun tests.'],
    },
  ],
};

function priorityFromScore(score: number): RoadmapTopic['priority'] {
  if (score < 45) return 'Critical';
  if (score < 70) return 'High';
  return 'Medium';
}

export function buildRoadmap(chatSession: AgenticSession | null, skillResult: SkillAssessmentResult): RoadmapTopic[] {
  const oaBySkill = new Map<string, { correct: number; total: number }>();
  for (const item of skillResult.results) {
    const current = oaBySkill.get(item.skill) ?? { correct: 0, total: 0 };
    oaBySkill.set(item.skill, {
      correct: current.correct + (item.correct ? 1 : 0),
      total: current.total + 1,
    });
  }

  const chatBySkill = new Map<string, number>();
  chatSession?.skillStates.forEach((state) => {
    if (typeof state.finalScore === 'number') {
      chatBySkill.set(state.skill, state.finalScore);
    }
  });

  const scoredSkills = Array.from(oaBySkill.entries()).map(([skill, oa]) => {
    const oaScore = Math.round((oa.correct / oa.total) * 100);
    const chatScore = chatBySkill.get(skill);
    const score = typeof chatScore === 'number' ? Math.round(oaScore * 0.6 + chatScore * 0.4) : oaScore;
    return {
      skill,
      score,
      oaScore,
      chatScore,
      source: typeof chatScore === 'number' ? 'Chatbot + OA' as const : 'OA' as const,
    };
  });

  const weakSkills = scoredSkills
    .filter((item) => item.score < 80)
    .sort((a, b) => a.score - b.score || a.skill.localeCompare(b.skill));
  const selectedSkills = (weakSkills.length ? weakSkills : scoredSkills.sort((a, b) => a.score - b.score)).slice(0, 5);

  return selectedSkills.map((item) => {
    const templates = subtopicTemplates[item.skill] ?? [];
    return {
      id: item.skill.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      skill: item.skill,
      title: `${item.skill} Readiness Recovery`,
      priority: priorityFromScore(item.score),
      score: item.score,
      source: item.source,
      reason:
        typeof item.chatScore === 'number'
          ? `Combined signal: chatbot ${item.chatScore}%, deterministic OA ${item.oaScore}%.`
          : `Deterministic OA signal: ${item.oaScore}%.`,
      subtopics: templates.map((template, index) => ({
        ...template,
        id: `${item.skill.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index + 1}`,
        skill: item.skill,
        minutes: 10,
      })),
    };
  });
}
