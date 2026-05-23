interface Props {
  title: string;
  description?: string;
}

export function SectionPlaceholder({ title, description }: Props) {
  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        <p className="mt-2 text-sm text-gray-500">
          {description ?? 'This screen is on the roadmap. Use Conversations for the agent inbox today.'}
        </p>
      </div>
    </div>
  );
}
