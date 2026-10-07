import Markdown from 'react-markdown';

const allowedElements = ['p', 'h1', 'h2', 'h3', 'h4', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'blockquote', 'hr', 'br'];

export function LessonContent({ children }: { children: string }) {
  return <Markdown skipHtml allowedElements={allowedElements} unwrapDisallowed>{children}</Markdown>;
}
