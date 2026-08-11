import { Bebas_Neue, Damion } from "next/font/google";

export const brandFont = Damion({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-brand",
});

// Tall condensed caps for the event banners, echoing the flyer's poster type.
export const displayFont = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-poster",
});
