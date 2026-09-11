import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "알바 근무 일정 관리",
    short_name: "근무 일정",
    description: "매장 알바 근무 일정 관리",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0071e3",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
