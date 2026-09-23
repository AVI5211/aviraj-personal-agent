import { ImageResponse } from "next/og";
import avatar from "../../public/aviraj-avatar.png";

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
          background: "#f8fafc",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          overflow: "hidden",
          width: "100%",
        }}
      >
        <img
          alt="Aviraj"
          src={avatar.src}
          style={{ height: "100%", objectFit: "cover", width: "100%" }}
        />
      </div>
    ),
    size,
  );
}
