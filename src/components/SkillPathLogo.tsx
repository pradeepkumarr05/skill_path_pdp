interface SkillPathLogoProps {
  tone?: 'light' | 'dark';
}

export function SkillPathLogo({ tone = 'light' }: SkillPathLogoProps) {
  const textClass = tone === 'light' ? 'fill-skillpath-cream' : 'fill-skillpath-night';
  const underline = tone === 'light' ? '#D7FF4F' : '#00A884';

  return (
    <svg className="h-12 w-[170px]" viewBox="0 0 170 48" role="img" aria-label="SkillPath">
      <text className={`logo-script text-[34px] font-semibold ${textClass}`} x="2" y="34">
        SkillPath
      </text>
      <path d="M12 40 C45 45, 91 44, 154 37" fill="none" stroke={underline} strokeLinecap="round" strokeWidth="3" />
    </svg>
  );
}
