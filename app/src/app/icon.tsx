import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default async function Icon() {
  const avatar = await fetch(new URL("../../public/aviraj-avatar.png", import.meta.url)).then(
    (response) => response.arrayBuffer(),
  );

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
          src={avatar as unknown as string}
          style={{ height: "100%", objectFit: "cover", width: "100%" }}
        />
      </div>
    ),
    size,
  );
}
