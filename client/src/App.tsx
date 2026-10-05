import { CallInterface } from "./components/CallInterface";
import { useVoiceAgent } from "./hooks/useVoiceAgent";

function App() {
  const {
    status,
    transcript,
    isMuted,
    speaking,
    language,
    sessionTime,
    connect,
    disconnect,
    toggleMute,
    error,
    clearError,
  } = useVoiceAgent();

  return (
    <>
      <CallInterface
        status={status}
        transcript={transcript}
        isMuted={isMuted}
        speaking={speaking}
        language={language}
        sessionTime={sessionTime}
        onStart={connect}
        onEnd={disconnect}
        onToggleMute={toggleMute}
      />

      {error && (
        <div className="error-toast">
          <div>
            <strong>
              Connection problem
            </strong>

            <p>{error}</p>
          </div>

          <button
            type="button"
            onClick={clearError}
            aria-label="Close error"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}

export default App;