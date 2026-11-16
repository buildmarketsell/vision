const LETTER_DELAY_S = 0.05;

/** Kokonut's AI text loading: letters rise and fade in a wave (transform and opacity only). */
export function WaveText({ text }: { text: string }) {
  return (
    <span className="wave-text" aria-label={text}>
      {[...text].map((letter, index) => (
        <span key={index} aria-hidden style={{ animationDelay: `${index * LETTER_DELAY_S}s` }}>
          {letter === ' ' ? ' ' : letter}
        </span>
      ))}
    </span>
  );
}
