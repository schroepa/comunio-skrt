import { Liquid } from "liquid-gooey";

const chips = ["Position", "Preis", "Nur mein Kader"] as const;

export default function RadarFilters() {
  return (
    <Liquid fill="var(--card)" blur={8} contrast={18} className="flex flex-wrap gap-1 p-1">
      {chips.map((label) => (
        <Liquid.Item key={label} transition="bouncy">
          <button
            type="button"
            disabled
            className="bg-transparent px-3 py-1.5 text-sm text-muted-foreground"
          >
            {label}
          </button>
        </Liquid.Item>
      ))}
    </Liquid>
  );
}
