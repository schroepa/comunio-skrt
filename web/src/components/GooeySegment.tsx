import { Liquid } from "liquid-gooey";
import { useEffect, useState } from "react";
import { useLiquidPill } from "../hooks/use-liquid-pill";

export type GooeyOption = {
  value: string;
  label: string;
  shortLabel?: string;
  title?: string;
};

type Props = {
  options: readonly GooeyOption[];
  value: string;
  ariaLabel: string;
  name?: string;
  fill?: "primary" | "muted";
  onChange?: (value: string) => void;
  submitOnChange?: boolean;
};

const fills = {
  primary: "var(--primary)",
  muted: "var(--muted)",
} as const;

export default function GooeySegment({
  options,
  value,
  ariaLabel,
  name,
  fill = "muted",
  onChange,
  submitOnChange = Boolean(name),
}: Props) {
  const [current, setCurrent] = useState(value);
  const { rootRef, pill } = useLiquidPill<HTMLDivElement>(current);

  useEffect(() => {
    setCurrent(value);
  }, [value]);
  const activeFg = fill === "primary" ? "var(--primary-foreground)" : "var(--foreground)";

  function select(next: string, form?: HTMLFormElement | null) {
    setCurrent(next);
    onChange?.(next);
    if (submitOnChange) form?.requestSubmit();
  }

  return (
    <div ref={rootRef} className="relative min-w-0 max-w-full overflow-x-auto">
      <Liquid
        fill={fills[fill]}
        blur={8}
        contrast={18}
        className="relative inline-flex min-w-min items-center gap-1 rounded-full p-1"
        shadow="0 2px 8px color-mix(in oklch, var(--foreground) 8%, transparent)"
      >
        {pill.width > 0 ? (
          <Liquid.Item effect="move" move={{ springiness: 0.55, trail: 0.45, stretch: 0.32, wobble: 0.35 }}>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute rounded-full bg-transparent"
              style={{ left: pill.left, top: pill.top, width: pill.width, height: pill.height }}
            />
          </Liquid.Item>
        ) : null}
        <div className="relative z-10 flex items-center gap-1" role="group" aria-label={ariaLabel}>
          {options.map((option) => {
            const active = current === option.value;
            const className =
              "inline-flex min-h-11 shrink-0 cursor-pointer items-center whitespace-nowrap rounded-full bg-transparent px-3 text-sm";
            const style = { color: active ? activeFg : "var(--muted-foreground)", fontWeight: active ? 600 : 400 };
            const label = (
              <>
                <span className={option.shortLabel ? "sm:hidden" : undefined}>{option.shortLabel ?? option.label}</span>
                {option.shortLabel ? <span className="hidden sm:inline">{option.label}</span> : null}
              </>
            );

            if (name != null) {
              return (
                <label
                  key={option.value || "all"}
                  className={className}
                  data-liquid-active={active ? "true" : undefined}
                  title={option.title ?? option.label}
                  style={style}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name={name}
                    value={option.value}
                    checked={active}
                    onChange={(event) => select(option.value, event.currentTarget.form)}
                  />
                  {label}
                </label>
              );
            }

            return (
              <button
                key={option.value || "all"}
                type="button"
                className={className}
                data-liquid-active={active ? "true" : undefined}
                title={option.title ?? option.label}
                aria-pressed={active}
                style={style}
                onClick={() => select(option.value)}
              >
                {label}
              </button>
            );
          })}
        </div>
      </Liquid>
    </div>
  );
}
