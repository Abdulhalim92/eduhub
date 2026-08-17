import { Sigma, Atom, FlaskConical, BookOpen, Code2, Dna, Palette } from "lucide-react";
import { C } from "@/lib/data";

const MOTIFS = [
  { Icon: Sigma,        size: 96,  top: "8%",  left: "6%",  rotate: -14 },
  { Icon: Atom,         size: 130, top: "58%", left: "3%",  rotate: 10 },
  { Icon: FlaskConical, size: 84,  top: "14%", left: "88%", rotate: 16 },
  { Icon: BookOpen,     size: 108, top: "68%", left: "90%", rotate: -8 },
  { Icon: Code2,        size: 74,  top: "40%", left: "94%", rotate: 6 },
  { Icon: Dna,          size: 92,  top: "82%", left: "18%", rotate: -18 },
  { Icon: Palette,      size: 70,  top: "4%",  left: "42%", rotate: 12 },
];

/** Faint education-subject watermarks for hero/section backgrounds. Purely decorative. */
export function SubjectMotifs() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }} aria-hidden="true">
      {MOTIFS.map(({ Icon, size, top, left, rotate }, i) => (
        <Icon
          key={i}
          size={size}
          strokeWidth={1.1}
          style={{
            position: "absolute",
            top,
            left,
            color: C.teal,
            opacity: 0.07,
            transform: `rotate(${rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}
