import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "linear-gradient(135deg, #14532d 0%, #22c55e 100%)",
          color: "white",
          display: "flex",
          fontFamily: "sans-serif",
          fontSize: 168,
          fontWeight: 800,
          height: "100%",
          justifyContent: "center",
          letterSpacing: -18,
          width: "100%",
        }}
      >
        AM
      </div>
    ),
    size,
  );
}
