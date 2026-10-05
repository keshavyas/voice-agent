interface LanguageBadgeProps {
language: string;
}

export function LanguageBadge({
  language,
}: LanguageBadgeProps) {
  return (
    <div className="language-badge">
      <span className="language-icon">
        ◉
      </span>

      <span>
        {language === "Auto"
          ? "Auto language"
          : language}
      </span>
    </div>
  );
}