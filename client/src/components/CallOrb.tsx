interface CallOrbProps {
  active: boolean;
  speaking: boolean;
  connecting: boolean;
}

export function CallOrb({
  active,
  speaking,
  connecting,
}: CallOrbProps) {
  return (
    <div
      className={[
        "call-orb-wrapper",
        active ? "active" : "",
        speaking ? "speaking" : "",
        connecting ? "connecting" : "",
      ].join(" ")}
    >
      <div className="orb-ring orb-ring-one" />
      <div className="orb-ring orb-ring-two" />

      <div className="call-orb">
        <div className="orb-core">
          <span className="orb-star">✦</span>
        </div>
      </div>
    </div>
  );
}