
import { useEffect, useRef, useState } from "react";
import {
  useParams,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  ControlBar,
  useParticipants,
  useConnectionState,
} from "@livekit/components-react";

import { ConnectionState } from "livekit-client";
import "@livekit/components-styles";

import { supabase } from "../services/supabase";

// ------------------------------------
// LiveKit Participant Information
// ------------------------------------
function CallParticipants() {
  const participants = useParticipants();
  const connectionState = useConnectionState();

  const connected =
    connectionState === ConnectionState.Connected;

  return (
    <div style={styles.participantBox}>
      <p style={styles.participantText}>
        {connected
          ? `Connected participants: ${participants.length}`
          : "Connecting to LiveKit..."}
      </p>

      {connected && participants.length === 1 && (
        <p style={styles.waitingText}>
          Waiting for the other participant...
        </p>
      )}

      {connected && participants.length >= 2 && (
        <p style={styles.connectedText}>
          Both participants connected
        </p>
      )}

      <p style={styles.connectionText}>
        Connection: {connectionState}
      </p>
    </div>
  );
}

// ------------------------------------
// Main Call Component
// ------------------------------------
export default function Call() {
  const { contactId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();

  const currentUserId =
    sessionStorage.getItem("profile_user_id");

  const callId = state?.callId;

  const [connection, setConnection] = useState(null);
  const [status, setStatus] = useState("ringing");
  const [error, setError] = useState("");
  const [leaving, setLeaving] = useState(false);

  const endingRef = useRef(false);

  // ------------------------------------
  // Monitor Supabase Call Status
  // ------------------------------------
  useEffect(() => {
    if (!callId) {
      setError("Missing call information.");
      return;
    }

    let active = true;

    const channel = supabase
      .channel(`call-status-${callId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "calls",
          filter: `id=eq.${callId}`,
        },
        (payload) => {
          if (!active) return;

          setStatus(payload.new.status);
        }
      )
      .subscribe((subscriptionStatus) => {
        if (subscriptionStatus === "SUBSCRIBED") {
          loadCallStatus();
        }
      });

    async function loadCallStatus() {
      const { data, error } = await supabase
        .from("calls")
        .select("status")
        .eq("id", callId)
        .single();

      if (!active) return;

      if (error) {
        setError(error.message);
      } else if (data) {
        setStatus(data.status);
      }
    }

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [callId]);

  // ------------------------------------
  // Request LiveKit Token
  // Only connect after call acceptance
  // ------------------------------------
  useEffect(() => {
    if (
      !currentUserId ||
      !contactId ||
      !callId ||
      status !== "accepted"
    ) {
      return;
    }

    let cancelled = false;

    async function getLiveKitToken() {
      try {
        setError("");

        const response = await fetch(
          "http://localhost:3001/api/call-token",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              callerId: currentUserId,
              contactId,
            }),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Failed to connect to LiveKit"
          );
        }

        if (!cancelled) {
          setConnection(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      }
    }

    getLiveKitToken();

    return () => {
      cancelled = true;
    };
  }, [currentUserId, contactId, callId, status]);

  // ------------------------------------
  // End Call
  // ------------------------------------
  const endCall = async () => {
    if (endingRef.current) return;

    endingRef.current = true;
    setLeaving(true);

    try {
      if (
        callId &&
        status !== "declined" &&
        status !== "ended"
      ) {
        const { error } = await supabase
          .from("calls")
          .update({ status: "ended" })
          .eq("id", callId)
          .in("status", ["ringing", "accepted"]);

        if (error) {
          console.error("End call error:", error);
        }
      }
    } catch (err) {
      console.error("Call termination failed:", err);
    } finally {
      navigate("/chat");
    }
  };

  const callFinished =
    status === "declined" ||
    status === "ended";

  // ------------------------------------
  // Render Call Screen
  // ------------------------------------
  return (
    <div style={styles.page}>
      <div style={styles.container}>

        {/* Call Icon */}
        <div style={styles.callIcon}>📞</div>

        {/* Contact Name */}
        <h1 style={styles.contactName}>
          {state?.contactName || "Voice Call"}
        </h1>

        {/* Phone Number */}
        <p style={styles.phoneNumber}>
          {state?.phoneNumber || ""}
        </p>

        {/* Call Status */}
        {status === "ringing" && (
          <p style={styles.ringingText}>
            Calling... Waiting for an answer
          </p>
        )}

        {status === "accepted" && (
          <p style={styles.acceptedText}>
            Call accepted
          </p>
        )}

        {status === "declined" && (
          <p style={styles.endedText}>
            Call declined
          </p>
        )}

        {status === "ended" && (
          <p style={styles.endedText}>
            Call ended
          </p>
        )}

        {/* Error Message */}
        {error && (
          <p style={styles.errorText}>
            {error}
          </p>
        )}

        {/* LiveKit Calling System */}
        {status === "accepted" &&
          !callFinished &&
          !leaving &&
          connection && (
            <div style={styles.livekitContainer}>
              <LiveKitRoom
                serverUrl={connection.serverUrl}
                token={connection.token}
                connect={true}
                audio={true}
                video={false}
                data-lk-theme="default"
                onDisconnected={() => {
                  if (!endingRef.current) {
                    endCall();
                  }
                }}
                onError={(err) => {
                  setError(err.message);
                }}
              >
                {/* Participant Count */}
                <CallParticipants />

                {/* Remote Audio */}
                <RoomAudioRenderer />

                {/* Microphone Controls */}
                <ControlBar
                  controls={{
                    microphone: true,
                    camera: false,
                    screenShare: false,
                    chat: false,
                  }}
                  variation="minimal"
                />

              </LiveKitRoom>
            </div>
          )}

        {/* Preparing Connection */}
        {status === "accepted" &&
          !connection &&
          !error && (
            <p style={styles.waitingText}>
              Preparing voice connection...
            </p>
          )}

        {/* End Call Button */}
        <button
          onClick={endCall}
          disabled={leaving}
          style={styles.endCallButton}
        >
          {leaving
            ? "Ending..."
            : callFinished
              ? "Back to Contacts"
              : "End Call"}
        </button>

      </div>
    </div>
  );
}

// ------------------------------------
// Page Styles
// ------------------------------------
const styles = {
  page: {
    minHeight: "100vh",
    background: "#111827",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Arial, sans-serif",
    padding: "20px",
    boxSizing: "border-box",
  },

  container: {
    textAlign: "center",
    width: "100%",
    maxWidth: "500px",
  },

  callIcon: {
    fontSize: "65px",
    marginBottom: "20px",
  },

  contactName: {
    fontSize: "32px",
    fontWeight: "700",
    margin: "10px 0",
    color: "#ffffff",
  },

  phoneNumber: {
    fontSize: "16px",
    color: "#cbd5e1",
    marginBottom: "10px",
  },

  ringingText: {
    color: "#facc15",
    fontSize: "15px",
    marginBottom: "20px",
  },

  acceptedText: {
    color: "#4ade80",
    fontSize: "15px",
    marginBottom: "20px",
  },

  endedText: {
    color: "#f87171",
    fontSize: "15px",
    marginBottom: "20px",
  },

  errorText: {
    color: "#fca5a5",
    fontSize: "14px",
    marginBottom: "20px",
  },

  livekitContainer: {
    marginTop: "20px",
    marginBottom: "25px",
    padding: "20px",
    background: "#1f2937",
    borderRadius: "16px",
  },

  participantBox: {
    marginBottom: "20px",
    padding: "12px",
    background: "#374151",
    borderRadius: "10px",
  },

  participantText: {
    color: "#ffffff",
    fontSize: "17px",
    fontWeight: "600",
  },

  waitingText: {
    color: "#facc15",
    fontSize: "14px",
  },

  connectedText: {
    color: "#4ade80",
    fontSize: "14px",
  },

  connectionText: {
    color: "#9ca3af",
    fontSize: "12px",
  },

  endCallButton: {
    marginTop: "20px",
    padding: "14px 32px",
    background: "#dc2626",
    color: "#ffffff",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
    fontSize: "15px",
    fontWeight: "600",
  },
};
