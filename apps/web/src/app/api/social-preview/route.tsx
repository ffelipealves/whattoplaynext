import { ImageResponse } from "next/og";

export const dynamic = "force-static";

export function GET() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#f4f7ff",
        color: "#17203a",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "center",
        padding: "72px",
        width: "100%",
      }}
    >
      <div style={{ color: "#3157d5", display: "flex", fontSize: 28 }}>
        STRUCTURED GAME DISCOVERY
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 82,
          fontWeight: 700,
          letterSpacing: "-3px",
          marginTop: 22,
          textAlign: "center",
        }}
      >
        What To Play Next
      </div>
      <div
        style={{
          color: "#526079",
          display: "flex",
          fontSize: 32,
          marginTop: 24,
          textAlign: "center",
        }}
      >
        Find games by the constraints that matter right now.
      </div>
    </div>,
    { height: 630, width: 1200 },
  );
}
