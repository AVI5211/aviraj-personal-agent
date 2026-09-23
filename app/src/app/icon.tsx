import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";
export const runtime = "nodejs";

export default async function Icon() {
  const avatar = await readFile(join(process.cwd(), "public", "aviraj-avatar.png"));
  const avatarDataUri = `data:image/png;base64,${avatar.toString("base64")}`;

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
          src={avatarDataUri}
          style={{ height: "100%", objectFit: "cover", width: "100%" }}
        />
      </div>
    ),
    size,
  );
}
