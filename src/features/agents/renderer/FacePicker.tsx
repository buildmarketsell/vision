import { Shuffle } from 'lucide-react';
import { FACE_COLOUR_NAMES, FACE_COLOURS, FACE_SHAPES, type AgentFace as Face } from '../../../shared/agents';
import { AgentFace } from './AgentFace';

/** Pick a face: Bupsy's shapes in the agent's colour, then the eight colours, plus Shuffle. */
export function FacePicker({ face, onChange }: { face: Face; onChange: (face: Face) => void }) {
  const shuffle = () => {
    const shape = FACE_SHAPES[Math.floor(Math.random() * FACE_SHAPES.length)] ?? 'circle';
    const colour = (face.colour + 1 + Math.floor(Math.random() * (FACE_COLOURS.length - 1))) % FACE_COLOURS.length;
    onChange({ shape, colour });
  };
  return (
    <div className="face-picker">
      <div className="face-picker-shapes" role="radiogroup" aria-label="Shape">
        {FACE_SHAPES.map((shape) => (
          <button key={shape} role="radio" aria-checked={face.shape === shape} aria-label={shape} title={shape} data-selected={face.shape === shape} onClick={() => onChange({ ...face, shape })}>
            <AgentFace face={{ shape, colour: face.colour }} size={28} />
          </button>
        ))}
      </div>
      <div className="face-picker-colours" role="radiogroup" aria-label="Colour">
        {FACE_COLOURS.map((colour, index) => (
          <button
            key={colour}
            role="radio"
            aria-checked={face.colour === index}
            aria-label={FACE_COLOUR_NAMES[index]}
            title={FACE_COLOUR_NAMES[index]}
            data-selected={face.colour === index}
            style={{ background: colour }}
            onClick={() => onChange({ ...face, colour: index })}
          />
        ))}
        <button className="agent-button" data-kind="ghost" onClick={shuffle}>
          <Shuffle size={14} strokeWidth={1.75} /> Shuffle
        </button>
      </div>
    </div>
  );
}
