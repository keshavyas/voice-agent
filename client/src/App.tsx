import { CallInterface } from "./components/CallInterface";
import { useVoiceAgent } from "./hooks/useVoiceAgent";

function App() {
  const voiceAgent = useVoiceAgent();

  return (
    <>
      <CallInterface
        status={voiceAgent.status}
        transcript={voiceAgent.transcript}
        isMuted={voiceAgent.isMuted}
        speaking={voiceAgent.speaking}
        language={voiceAgent.language}
        sessionTime={voiceAgent.sessionTime}
        onStart={voiceAgent.connect}
        onEnd={voiceAgent.disconnect}
        onToggleMute={
          voiceAgent.toggleMute
        }
      />

      {voiceAgent.error && (
        <div className="error-toast">
          <div>
            <strong>
              Connection problem
            </strong>

            <p>
              {voiceAgent.error}
            </p>
          </div>

          <button
            type="button"
            onClick={voiceAgent.clearError}
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}

export default App;