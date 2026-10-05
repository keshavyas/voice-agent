interface WaveformProps {
active: boolean;
}

export function Waveform({
active,
}: WaveformProps) {
return (
    <div
    className={`waveform ${
        active ? "waveform-active" : ""
    }`}
    aria-hidden="true"
    >
    {Array.from({ length: 24 }).map(
        (_, index) => (
        <span
            key={index}
            style={{
            animationDelay: `${
                index * 45
            }ms`,
            }}
        />
        ),
    )}
    </div>
);
}