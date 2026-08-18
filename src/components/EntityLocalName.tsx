import type { LocalizedNames } from "../domain/types";

interface EntityLocalNameProps {
  names: LocalizedNames;
  className?: string;
}

/** 在标题下方展示实体的本地语言名称。 */
export function EntityLocalName({ names, className = "entity-local-name" }: EntityLocalNameProps) {
  const local = names.local?.trim();
  if (!local) return null;
  return (
    <p className={className} lang="auto">
      {local}
    </p>
  );
}
