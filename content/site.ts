import type { NavKey, TileKey } from "./dictionary";

export const brand = "CasaMove";

export const contact = {
  phone: "05 22 99 83 83",
  phoneHref: "tel:+212522998383",
  email: "contact@casamove.ma",
  emailHref: "mailto:contact@casamove.ma",
};

export const navItems: { key: NavKey; href: string }[] = [
  { key: "explore", href: "#se-deplacer" },
  { key: "lines", href: "#lignes" },
  { key: "tickets", href: "#tarifs" },
  { key: "news", href: "#actualites" },
  { key: "contact", href: "#contact" },
];

export type IconKey =
  | "tram"
  | "bus"
  | "train"
  | "plane"
  | "ship"
  | "map"
  | "shop"
  | "chat";

export const tiles: { key: TileKey; icon: IconKey; href: string }[] = [
  { key: "lines", icon: "tram", href: "#lignes" },
  { key: "map", icon: "map", href: "#carte" },
  { key: "shops", icon: "shop", href: "#points-de-vente" },
  { key: "contact", icon: "chat", href: "#contact" },
];

export const storeLinks = {
  apple: "https://apps.apple.com/",
  google: "https://play.google.com/store",
};

export const socials = [
  { label: "Facebook", href: "https://facebook.com" },
  { label: "Instagram", href: "https://instagram.com" },
  { label: "YouTube", href: "https://youtube.com" },
];
