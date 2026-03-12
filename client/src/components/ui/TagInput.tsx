import { useState, useRef, KeyboardEvent } from "react";
import { X, RotateCcw } from "lucide-react";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  defaultTags?: string[];
}

export default function TagInput({
  tags,
  onChange,
  placeholder = "Add tag...",
  defaultTags,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLInputElement>(null);

  function addTag() {
    const trimmed = inputValue.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInputValue("");
    inputRef.current?.focus();
  }

  function removeTag(index: number) {
    onChange(tags.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  }

  function startEditing(index: number) {
    setEditingIndex(index);
    setEditValue(tags[index]);
    setTimeout(() => editRef.current?.focus(), 0);
  }

  function commitEdit() {
    if (editingIndex === null) return;
    const trimmed = editValue.trim();
    if (trimmed && !tags.includes(trimmed)) {
      const updated = [...tags];
      updated[editingIndex] = trimmed;
      onChange(updated);
    } else if (trimmed === tags[editingIndex]) {
      // No change
    }
    setEditingIndex(null);
    setEditValue("");
  }

  function handleEditKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
    } else if (e.key === "Escape") {
      setEditingIndex(null);
      setEditValue("");
    }
  }

  function handleReset() {
    if (defaultTags) {
      onChange([...defaultTags]);
    } else {
      onChange([]);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-[var(--color-surface-overlay,#1e1e2e)] px-3 py-2 focus-within:border-[var(--color-accent,#7c3aed)]"
      >
        {tags.map((tag, i) =>
          editingIndex === i ? (
            <input
              key={i}
              ref={editRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleEditKeyDown}
              className="rounded bg-[var(--color-accent,#7c3aed)]/20 px-2 py-0.5 text-sm text-white outline-none"
              style={{ width: `${Math.max(editValue.length, 3)}ch` }}
            />
          ) : (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--color-accent,#7c3aed)]/20 border border-[var(--color-accent,#7c3aed)]/40 px-2.5 py-0.5 text-sm text-white cursor-default select-none"
              onDoubleClick={() => startEditing(i)}
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(i)}
                className="ml-0.5 rounded-full p-0.5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                aria-label={`Remove ${tag}`}
              >
                <X size={12} />
              </button>
            </span>
          ),
        )}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="min-w-[80px] flex-1 bg-transparent text-sm text-white placeholder-white/40 outline-none"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={addTag}
          disabled={!inputValue.trim()}
          className="rounded bg-[var(--color-accent,#7c3aed)] px-3 py-1 text-xs font-medium text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          Add
        </button>
        {defaultTags && (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 rounded border border-white/10 px-3 py-1 text-xs text-white/60 hover:text-white hover:border-white/30 transition-colors"
          >
            <RotateCcw size={12} />
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
